package in.gov.samajdrishti.config;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Chooses the data store before any {@code DataSource} bean is created.
 *
 * <p>Environment post-processors run during {@code SpringApplication.run} but before
 * the bean factory refreshes, which is the only point where the JDBC target can still
 * be swapped. The service keeps the {@code DB_MODE} contract of the Node build:
 *
 * <ul>
 *   <li>{@code auto} (default) - PostgreSQL when reachable, otherwise an in-memory H2
 *       database seeded with the same demo dataset</li>
 *   <li>{@code postgres} - PostgreSQL is mandatory, startup fails when it is down</li>
 *   <li>{@code memory} - always the in-memory H2 database</li>
 * </ul>
 *
 * <p>Unlike the previous implementation there is no hand-written SQL interpreter:
 * both modes run the same JPA entities and repositories, so the demo path and the
 * production path cannot drift apart.
 */
public class DataSourceEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String PROPERTY_SOURCE_NAME = "samajdrishti-data-mode";
    static final String H2_URL = "jdbc:h2:mem:samajdrishti;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
    static final int CONNECT_TIMEOUT_SECONDS = 3;

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, String> dotenv = DotEnv.load(Path.of(System.getProperty("user.dir"), ".env"));
        String mode = read(environment, dotenv, "app.db-mode", "DB_MODE", "auto").toLowerCase();
        boolean forceMemory = "memory".equals(mode);
        boolean requirePostgres = "postgres".equals(mode);

        Map<String, Object> overrides = new LinkedHashMap<>();
        String reason = null;

        if (forceMemory) {
            overrides.putAll(memoryOverrides());
        } else {
            String url = read(environment, dotenv, "app.db.url", "DB_URL",
                    "jdbc:postgresql://%s:%s/%s".formatted(
                            read(environment, dotenv, "app.db.host", "DB_HOST", "localhost"),
                            read(environment, dotenv, "app.db.port", "DB_PORT", "5432"),
                            read(environment, dotenv, "app.db.name", "DB_NAME", "samajdrishti")));
            String user = read(environment, dotenv, "app.db.username", "DB_USER", null);
            String password = read(environment, dotenv, "app.db.password", "DB_PASSWORD", null);
            if ((user == null || password == null) && isProduction(environment)) {
                throw new IllegalStateException(
                        "DB_USER and DB_PASSWORD must be set explicitly in production - no default credentials are accepted.");
            }
            user = user == null ? "postgres" : user;
            password = password == null ? "postgres" : password;

            try {
                verifyPostgres(url, user, password);
                overrides.put("spring.datasource.url", url);
                overrides.put("spring.datasource.username", user);
                overrides.put("spring.datasource.password", password);
                overrides.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
                overrides.put("spring.datasource.hikari.maximum-pool-size", "10");
                overrides.put("spring.datasource.hikari.connection-timeout", "5000");
                overrides.put("spring.jpa.hibernate.ddl-auto", "update");
                overrides.put("app.data-mode", "postgres");
                overrides.put("app.seed-enabled", seedFlag(environment, dotenv, false));
            } catch (SQLException | RuntimeException e) {
                reason = e.getMessage();
                if (requirePostgres) {
                    throw new IllegalStateException(
                            "PostgreSQL is required (DB_MODE=postgres) but is unreachable: " + reason, e);
                }
                System.out.println("[db] PostgreSQL unreachable (" + reason + ") - falling back to in-memory demo mode.");
                overrides.putAll(memoryOverrides());
            }
        }

        if (forceMemory) {
            System.out.println("[db] DB_MODE=memory - starting on the in-memory H2 demo database.");
        }

        environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, overrides));
    }

    private static boolean isProduction(ConfigurableEnvironment environment) {
        for (String profile : environment.getActiveProfiles()) {
            if (profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production")) {
                return true;
            }
        }
        String appEnv = System.getenv("APP_ENV");
        if (appEnv == null) {
            appEnv = System.getProperty("APP_ENV");
        }
        if (appEnv == null) {
            appEnv = environment.getProperty("APP_ENV");
        }
        if (appEnv != null && (appEnv.equalsIgnoreCase("prod") || appEnv.equalsIgnoreCase("production"))) {
            return true;
        }
        String prodFlag = System.getenv("PRODUCTION");
        if (prodFlag == null) {
            prodFlag = environment.getProperty("PRODUCTION");
        }
        return "1".equals(prodFlag) || "true".equalsIgnoreCase(prodFlag);
    }

    private static Map<String, Object> memoryOverrides() {
        Map<String, Object> overrides = new LinkedHashMap<>();
        overrides.put("spring.datasource.url", H2_URL);
        overrides.put("spring.datasource.username", "sa");
        overrides.put("spring.datasource.password", "");
        overrides.put("spring.datasource.driver-class-name", "org.h2.Driver");
        overrides.put("spring.jpa.hibernate.ddl-auto", "create-drop");
        overrides.put("app.data-mode", "memory");
        overrides.put("app.seed-enabled", "true");
        return overrides;
    }

    private static void verifyPostgres(String url, String user, String password) throws SQLException {
        Properties properties = new Properties();
        properties.setProperty("user", user);
        properties.setProperty("password", password);
        properties.setProperty("connectTimeout", String.valueOf(CONNECT_TIMEOUT_SECONDS));
        properties.setProperty("socketTimeout", "5");
        properties.setProperty("loginTimeout", String.valueOf(CONNECT_TIMEOUT_SECONDS));
        DriverManager.setLoginTimeout(CONNECT_TIMEOUT_SECONDS);
        try (Connection ignored = DriverManager.getConnection(url, properties)) {
            // Opening a connection is the reachability probe; nothing else to do.
        }
    }

    private static String seedFlag(ConfigurableEnvironment environment, Map<String, String> dotenv, boolean fallback) {
        String raw = read(environment, dotenv, "app.seed-enabled", "SEED_DEMO_DATA", null);
        if (raw == null) {
            return String.valueOf(fallback);
        }
        return String.valueOf(Boolean.parseBoolean(raw));
    }

    /** Environment variable first, then {@code .env}, then the Spring property, then the default. */
    private static String read(ConfigurableEnvironment environment,
                               Map<String, String> dotenv,
                               String property,
                               String envVar,
                               String fallback) {
        String fromEnv = System.getenv(envVar);
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv.trim();
        }
        String sysProp = System.getProperty(envVar);
        if (sysProp != null && !sysProp.isBlank()) {
            return sysProp.trim();
        }
        String fromFile = dotenv.get(envVar);
        if (fromFile != null && !fromFile.isBlank()) {
            return fromFile.trim();
        }
        String fromProperty = environment.getProperty(property);
        return fromProperty == null || fromProperty.isBlank() ? fallback : fromProperty.trim();
    }

    @Override
    public int getOrder() {
        // After config data processing, so application.yml placeholders are resolved.
        return Ordered.LOWEST_PRECEDENCE - 10;
    }
}
