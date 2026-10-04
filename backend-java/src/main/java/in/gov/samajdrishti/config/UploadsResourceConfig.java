package in.gov.samajdrishti.config;

import java.nio.file.Path;
import java.time.Duration;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded evidence artefacts from the storage directory
 * ({@code app.uploads.evidence-dir}, default {@code uploads/evidence}).
 *
 * <p>Access stays governed by Spring Security: every request must carry a valid
 * bearer token or the {@code ?token=} query parameter the clients' {@code <img>}
 * tags and {@code window.open} calls use (see {@code JwtAuthFilter}). The
 * artefacts are geo-tagged inspection evidence, so they are never anonymous.
 *
 * <p>Seeded demo rows reference {@code /uploads/evidence/...} paths that
 * intentionally do not exist on disk; those answer with 404, which the
 * dashboards already render as "no file attached".
 */
@Configuration(proxyBeanMethods = false)
public class UploadsResourceConfig implements WebMvcConfigurer {

    private final AppProperties properties;

    public UploadsResourceConfig(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = "file:" + Path.of(properties.uploads().evidenceDir())
                .toAbsolutePath()
                .normalize()
                .toString()
                + "/";
        registry.addResourceHandler("/uploads/evidence/**")
                .addResourceLocations(location)
                .setCacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic());
    }
}
