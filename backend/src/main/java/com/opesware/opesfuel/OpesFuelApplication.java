package com.opesware.opesfuel;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@Modulithic(systemName = "OpesFuel")
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class OpesFuelApplication {

    public static void main(String[] args) {
        SpringApplication.run(OpesFuelApplication.class, args);
    }
}
