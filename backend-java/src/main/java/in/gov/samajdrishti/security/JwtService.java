package in.gov.samajdrishti.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.annotation.PostConstruct;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import in.gov.samajdrishti.config.AppProperties;

/**
 * Issues and verifies the HS256 bearer tokens.
 *
 * <p>The payload is the one the Node service produced ({@code {"id": <userId>}} signed
 * with {@code JWT_SECRET} and a 7 day expiry), so a token minted by either
 * implementation is accepted by the other.
 *
 * <p>The configured secret is hashed to 32 bytes, so any passphrase - including the
 * short development default - yields a key that meets the HS256 minimum length.
 */
@Service
public class JwtService {

    private final AppProperties.Jwt settings;
    private final SecretKey key;

    private JwtEncoder encoder;
    private JwtDecoder decoder;

    public JwtService(AppProperties properties) {
        this.settings = properties.jwt();
        this.key = deriveKey(this.settings.secret());
    }

    @PostConstruct
    void buildCodecs() {
        // The key must advertise HS256, otherwise the encoder's algorithm selector
        // cannot match it and signing fails with "Failed to select a JWK signing key".
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(key)
                .algorithm(JWSAlgorithm.HS256)
                .build();
        JWKSet jwkSet = new JWKSet(jwk);
        this.encoder = new NimbusJwtEncoder((selector, context) -> selector.select(jwkSet));
        this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    private static SecretKey deriveKey(String secret) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] material = digest.digest((secret == null ? "" : secret).getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(material, "HmacSHA256");
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable, cannot derive the JWT key", e);
        }
    }

    public String issueToken(Integer userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuedAt(now)
                .expiresAt(now.plus(settings.ttl()))
                .subject(String.valueOf(userId))
                .claim("id", userId)
                .build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                claims)).getTokenValue();
    }

    /** The user id encoded in the token, or empty when the token is absent or invalid. */
    public Optional<Integer> resolveUserId(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Jwt jwt = decoder.decode(token.strip());
            Object id = jwt.getClaim("id");
            if (id == null) {
                id = jwt.getSubject();
            }
            return id == null ? Optional.empty() : Optional.of(((Number) id).intValue());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
