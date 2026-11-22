# Cameroon Mobile Money (MTN MoMo & Orange Money) + Real Messaging Production Guide

> **Admin Panel UI Provision (Recommended)**: You can connect and live-test MTN MoMo Cameroon, Orange Money Cameroon WebPay, SMTP/Resend Email, Africa's Talking/Twilio SMS, Meta WhatsApp Cloud API, and Gemini AI directly inside **SaaS Control Plane → API & Payment Gateways** (Global) or **Admin & Billing → 4. API & Payment Gateways** (Company). Credentials are encrypted at rest with **AES-256-GCM** (`V23`), hydrated automatically on boot, and hot-reloaded live with zero downtime. Environment variables below remain supported as defaults.

## 1. MTN MoMo Cameroon (Collections & Disbursements)

Configure the following environment variables in `.env` on your production VPS:

```bash
# Sandbox (testing)
OPESFUEL_MTN_BASE_URL=https://sandbox.momodeveloper.mtn.com
OPESFUEL_MTN_TARGET_ENV=sandbox
# Production Cameroon (after MTN Partner Portal KYC approval)
# OPESFUEL_MTN_BASE_URL=https://proxy.momoapi.mtn.com
# OPESFUEL_MTN_TARGET_ENV=mtncameroon

OPESFUEL_MTN_API_USER=<UUID from MTN MoMo Portal>
OPESFUEL_MTN_API_KEY=<API Key from MTN MoMo Portal>
OPESFUEL_MTN_COLLECTION_SUBSCRIPTION_KEY=<Primary Collections Ocp-Apim-Subscription-Key>
OPESFUEL_MTN_DISBURSEMENT_SUBSCRIPTION_KEY=<Optional Disbursements Key for refunds>
OPESFUEL_MTN_CALLBACK_URL=https://api.opesfuel.com/api/v1/public/webhooks/momo/mtn
```

- Sandbox uses `EUR` automatically; `mtncameroon` production uses `XAF`.
- Callback host MUST match the hostname configured on your MTN API User.
- Every webhook callback is server-to-server re-verified via `GET /collection/v1_0/requesttopay/{referenceId}`.

## 2. Orange Money Cameroon WebPay API v1

```bash
OPESFUEL_ORANGE_BASE_URL=https://api.orange.com
# Use "dev" (currency OUV) during Orange Developer Portal testing, "prod" (currency XAF) live
OPESFUEL_ORANGE_ENV=prod
OPESFUEL_ORANGE_CLIENT_ID=<Orange Developer App Client ID>
OPESFUEL_ORANGE_CLIENT_SECRET=<Orange Developer App Client Secret>
OPESFUEL_ORANGE_MERCHANT_KEY=<Orange Money Cameroon Merchant Key>
OPESFUEL_ORANGE_RETURN_URL=https://app.opesfuel.com/#/app/admin
OPESFUEL_ORANGE_CANCEL_URL=https://app.opesfuel.com/#/app/admin
OPESFUEL_ORANGE_NOTIF_URL=https://api.opesfuel.com/api/v1/public/webhooks/momo/orange
OPESFUEL_ORANGE_LANG=fr
```

- Browser return redirects NEVER settle an invoice on their own.
- Settlement only occurs on server-to-server `POST /api/v1/public/webhooks/momo/orange` with strict `notif_token` verification + `POST /orange-money-webpay/cm/v1/transactionstatus` confirmation, or via scheduled reconciliation polling.

## 3. Real Multi-Channel Messaging (Email, SMS, WhatsApp)

```bash
# Email: RESEND | SMTP | LOG_ONLY
OPESFUEL_MAIL_PROVIDER=SMTP
OPESFUEL_MAIL_FROM=noreply@opesfuel.com
OPESFUEL_SMTP_HOST=smtp.yourmailprovider.com
OPESFUEL_SMTP_PORT=587
OPESFUEL_SMTP_USERNAME=apikey_or_user
OPESFUEL_SMTP_PASSWORD=secret
OPESFUEL_SMTP_STARTTLS=true
OPESFUEL_SMTP_SSL=false
# Or for Resend:
# OPESFUEL_MAIL_PROVIDER=RESEND
# OPESFUEL_MAIL_API_KEY=re_xxxxxxxx

# SMS: AFRICAS_TALKING | TWILIO | LOG_ONLY
OPESFUEL_SMS_PROVIDER=AFRICAS_TALKING
OPESFUEL_AT_USERNAME=opesfuel
OPESFUEL_AT_API_KEY=atsk_xxxxxxxx
OPESFUEL_AT_FROM=OPESFUEL
# Or Twilio:
# OPESFUEL_SMS_PROVIDER=TWILIO
# OPESFUEL_TWILIO_ACCOUNT_SID=ACxxxx
# OPESFUEL_TWILIO_AUTH_TOKEN=xxxx
# OPESFUEL_TWILIO_FROM=+237...

# WhatsApp: META_CLOUD | LOG_ONLY
OPESFUEL_WHATSAPP_PROVIDER=META_CLOUD
OPESFUEL_WHATSAPP_PHONE_NUMBER_ID=1234567890
OPESFUEL_WHATSAPP_ACCESS_TOKEN=EAAG...
```

> If a live payment or messaging provider is selected without credentials, OpesFuel returns HTTP `503 Service Unavailable` with a clear configuration message — it never silently fakes success.
