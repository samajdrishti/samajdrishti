package in.gov.samajdrishti.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Shared Jackson instance for the realtime framing helpers. */
final class Json {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Json() {
    }

    static String encode(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "null";
        }
    }

    static Object[] decodeArray(String json) {
        try {
            return MAPPER.readValue(json, Object[].class);
        } catch (JsonProcessingException e) {
            return new Object[0];
        }
    }

    @SuppressWarnings("unchecked")
    static java.util.Map<String, Object> decodeMap(String json) {
        try {
            return MAPPER.readValue(json, java.util.Map.class);
        } catch (JsonProcessingException | RuntimeException e) {
            return java.util.Map.of();
        }
    }

    static String stringOf(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    static Integer intOf(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.valueOf(text.strip());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
