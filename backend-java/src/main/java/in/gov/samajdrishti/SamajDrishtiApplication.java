package in.gov.samajdrishti;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Samaj Drishti API.
 *
 * <p>Replaces the original Node/Express service while keeping the HTTP, JSON and
 * realtime contracts in {@code docs/API-CONTRACT.md} byte-for-byte compatible, so
 * {@code admin/} and {@code mobile-web/} need no changes.
 *
 * <p>Authentication is entirely JWT-based, so Spring's default in-memory user is
 * excluded rather than silently creating a random password.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
public class SamajDrishtiApplication {

    public static void main(String[] args) {
        SpringApplication.run(SamajDrishtiApplication.class, args);
    }
}
