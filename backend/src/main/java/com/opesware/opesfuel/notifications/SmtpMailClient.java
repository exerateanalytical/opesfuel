package com.opesware.opesfuel.notifications;

import org.springframework.stereotype.Component;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;

/**
 * Pure-JDK RFC 5321 / RFC 3207 SMTP client supporting STARTTLS (587) and SMTPS (465) with AUTH PLAIN.
 */
@Component
public class SmtpMailClient {

    public record SmtpConfig(String host, int port, String username, String password, boolean startTls, boolean ssl) {}

    public String send(SmtpConfig cfg, String from, String to, String subject, String body) throws IOException {
        String messageId = "<" + UUID.randomUUID() + "@opesfuel.com>";
        Socket raw = new Socket();
        raw.connect(new InetSocketAddress(cfg.host(), cfg.port()), 5000);
        raw.setSoTimeout(10000);

        Socket socket = raw;
        if (cfg.ssl()) {
            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            SSLSocket sslSocket = (SSLSocket) factory.createSocket(raw, cfg.host(), cfg.port(), true);
            sslSocket.startHandshake();
            socket = sslSocket;
        }

        try (Socket activeSocket = socket) {
            BufferedReader in = new BufferedReader(new InputStreamReader(activeSocket.getInputStream(), StandardCharsets.UTF_8));
            BufferedWriter out = new BufferedWriter(new OutputStreamWriter(activeSocket.getOutputStream(), StandardCharsets.UTF_8));

            expectCode(in, "220");
            sendCmd(out, "EHLO opesfuel.local");
            expectCode(in, "250");

            if (!cfg.ssl() && cfg.startTls()) {
                sendCmd(out, "STARTTLS");
                expectCode(in, "220");
                SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
                SSLSocket tls = (SSLSocket) factory.createSocket(activeSocket, cfg.host(), cfg.port(), true);
                tls.startHandshake();
                in = new BufferedReader(new InputStreamReader(tls.getInputStream(), StandardCharsets.UTF_8));
                out = new BufferedWriter(new OutputStreamWriter(tls.getOutputStream(), StandardCharsets.UTF_8));
                sendCmd(out, "EHLO opesfuel.local");
                expectCode(in, "250");
            }

            if (cfg.username() != null && !cfg.username().isBlank()) {
                String authPlain = Base64.getEncoder().encodeToString(
                    ("\0" + cfg.username() + "\0" + (cfg.password() != null ? cfg.password() : "")).getBytes(StandardCharsets.UTF_8)
                );
                sendCmd(out, "AUTH PLAIN " + authPlain);
                expectCode(in, "235");
            }

            sendCmd(out, "MAIL FROM:<" + sanitizeHeader(from) + ">");
            expectCode(in, "250");
            sendCmd(out, "RCPT TO:<" + sanitizeHeader(to) + ">");
            expectCode(in, "250", "251");
            sendCmd(out, "DATA");
            expectCode(in, "354");

            String dateHeader = DateTimeFormatter.RFC_1123_DATE_TIME.format(ZonedDateTime.now(ZoneOffset.UTC));
            out.write("Date: " + dateHeader + "\r\n");
            out.write("From: " + sanitizeHeader(from) + "\r\n");
            out.write("To: " + sanitizeHeader(to) + "\r\n");
            out.write("Subject: " + sanitizeHeader(subject) + "\r\n");
            out.write("Message-ID: " + messageId + "\r\n");
            out.write("MIME-Version: 1.0\r\n");
            out.write("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            String normalizedBody = (body == null ? "" : body).replace("\r\n", "\n").replace("\n.", "\n..").replace("\n", "\r\n");
            out.write(normalizedBody + "\r\n.\r\n");
            out.flush();
            expectCode(in, "250");

            sendCmd(out, "QUIT");
            return messageId;
        }
    }

    private static void sendCmd(BufferedWriter out, String cmd) throws IOException {
        out.write(cmd + "\r\n");
        out.flush();
    }

    private static void expectCode(BufferedReader in, String... expectedPrefixes) throws IOException {
        String lastLine = null;
        String line;
        while ((line = in.readLine()) != null) {
            lastLine = line;
            if (line.length() < 4 || line.charAt(3) != '-') {
                break;
            }
        }
        if (lastLine == null) {
            throw new IOException("SMTP server closed connection unexpectedly.");
        }
        for (String prefix : expectedPrefixes) {
            if (lastLine.startsWith(prefix)) return;
        }
        throw new IOException("SMTP error response: " + lastLine);
    }

    private static String sanitizeHeader(String v) {
        return v == null ? "" : v.replaceAll("[\\r\\n]", " ").trim();
    }
}
