package in.gov.samajdrishti.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal {@code .env} reader.
 *
 * <p>The Node service loaded {@code backend/.env} with dotenv, and the demo scripts
 * rely on that, so the Java service keeps the same behaviour instead of forcing
 * every value onto the process environment.
 *
 * <p>Existing environment variables always win: a value already present in the
 * system environment is never overwritten by the file.
 */
public final class DotEnv {

    private DotEnv() {
    }

    public static Map<String, String> load(Path file) {
        if (file == null || !Files.isRegularFile(file)) {
            return Map.of();
        }
        try {
            return parse(Files.readAllLines(file, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + file, e);
        }
    }

    /** Parses {@code .env} lines into a map. Public because it is a pure, testable function. */
    public static Map<String, String> parse(List<String> lines) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String raw : lines) {
            String line = raw == null ? "" : raw.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            if (line.startsWith("export ")) {
                line = line.substring("export ".length()).strip();
            }
            int eq = line.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = line.substring(0, eq).strip();
            String value = line.substring(eq + 1).strip();
            if (value.length() >= 2
                    && ((value.startsWith("\"") && value.endsWith("\""))
                    || (value.startsWith("'") && value.endsWith("'")))) {
                value = value.substring(1, value.length() - 1);
            }
            values.put(key, value);
        }
        return values;
    }
}
