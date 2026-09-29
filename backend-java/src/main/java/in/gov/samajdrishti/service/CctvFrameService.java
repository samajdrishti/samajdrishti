package in.gov.samajdrishti.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

import org.springframework.stereotype.Service;

import in.gov.samajdrishti.domain.Camera;

/**
 * CCTV frame service.
 *
 * <p>Real site CCTV is usually RTSP/HLS behind credentials, which a browser cannot open
 * directly. Two modes are supported:
 *
 * <ol>
 *   <li>{@code simulated} (the default) - renders a deterministic, <em>moving</em> PNG
 *       frame per camera with no image library at all: the pixels are computed and
 *       encoded straight to PNG. The frame changes on every request, so the client sees
 *       a genuine live feed. This is what makes the demo work with no camera and no key.</li>
 *   <li>{@code mjpeg} / {@code hls} - proxies a real HTTP snapshot source through the
 *       API so the browser stays same-origin and never hits a third-party origin.</li>
 * </ol>
 */
@Service
public class CctvFrameService {

    public static final int FRAME_WIDTH = 320;
    public static final int FRAME_HEIGHT = 180;

    private static final int MAX_PROXIED_BYTES = 4 * 1024 * 1024;
    private static final List<String> IMAGE_CONTENT_TYPES = List.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp");

    private final Map<String, Scene> scenes = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    /** Result of a proxied upstream snapshot, or empty when the camera is simulated. */
    public record ProxiedFrame(byte[] bytes, String contentType) {
    }

    /* ----------------------------------------------------------------- codec */

    private static byte[] pngChunk(String type, byte[] data) {
        byte[] length = new byte[4];
        writeInt(length, data.length);
        byte[] typeAndData = new byte[4 + data.length];
        System.arraycopy(type.getBytes(java.nio.charset.StandardCharsets.US_ASCII), 0, typeAndData, 0, 4);
        System.arraycopy(data, 0, typeAndData, 4, data.length);

        CRC32 crc = new CRC32();
        crc.update(typeAndData);
        byte[] checksum = new byte[4];
        writeInt(checksum, (int) crc.getValue());

        byte[] chunk = new byte[4 + typeAndData.length + 4];
        System.arraycopy(length, 0, chunk, 0, 4);
        System.arraycopy(typeAndData, 0, chunk, 4, typeAndData.length);
        System.arraycopy(checksum, 0, chunk, 4 + typeAndData.length, 4);
        return chunk;
    }

    private static void writeInt(byte[] target, int value) {
        target[0] = (byte) ((value >>> 24) & 0xff);
        target[1] = (byte) ((value >>> 16) & 0xff);
        target[2] = (byte) ((value >>> 8) & 0xff);
        target[3] = (byte) (value & 0xff);
    }

    /** Encodes an 8-bit truecolour RGB buffer into a PNG image. Public for the codec test. */
    public static byte[] encodePng(int width, int height, byte[] rgb) {
        byte[] signature = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

        byte[] ihdr = new byte[13];
        writeInt(ihdr, width);
        byte[] heightField = new byte[4];
        writeInt(heightField, height);
        System.arraycopy(heightField, 0, ihdr, 4, 4);
        // IHDR: width(0..3) height(4..7) bitDepth(8) colourType(9) compression(10) filter(11) interlace(12)
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 2;  // colour type: truecolour
        ihdr[10] = 0; // deflate
        ihdr[11] = 0; // adaptive filtering
        ihdr[12] = 0; // no interlace

        int stride = width * 3;
        byte[] raw = new byte[(stride + 1) * height];
        for (int y = 0; y < height; y++) {
            raw[y * (stride + 1)] = 0; // filter type 0 (None)
            System.arraycopy(rgb, y * stride, raw, y * (stride + 1) + 1, stride);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream(raw.length / 2 + 1024);
        try {
            out.write(signature);
            out.write(pngChunk("IHDR", ihdr));
            out.write(pngChunk("IDAT", deflate(raw)));
            out.write(pngChunk("IEND", new byte[0]));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not encode the camera frame", e);
        }
        return out.toByteArray();
    }

    private static byte[] deflate(byte[] data) {
        Deflater deflater = new Deflater(Deflater.BEST_SPEED);
        try {
            deflater.setInput(data);
            deflater.finish();
            ByteArrayOutputStream out = new ByteArrayOutputStream(data.length / 2 + 64);
            byte[] buffer = new byte[8192];
            while (!deflater.finished()) {
                int written = deflater.deflate(buffer);
                out.write(buffer, 0, written);
            }
            return out.toByteArray();
        } finally {
            deflater.end();
        }
    }

    /* --------------------------------------------------------- frame rendering */

    private record Building(int x, int width, int height, int shade) {
    }

    private record Actor(double offset, double speed, int y, int size) {
    }

    private record Scene(List<Building> buildings, List<Actor> actors) {
    }

    private static final class Rng {
        private long state;

        Rng(long seed) {
            this.state = seed % 2147483647L;
            if (this.state <= 0) {
                this.state += 2147483646L;
            }
        }

        double next() {
            state = (state * 16807L) % 2147483647L;
            return (state - 1) / 2147483646d;
        }
    }

    /** Cheap deterministic PRNG so a given camera always looks the same. */
    private static Rng seededRandom(String value) {
        // FNV-1a over the camera key, masked to 32 bits like the previous implementation.
        long hash = 2166136261L;
        for (int i = 0; i < value.length(); i++) {
            hash ^= value.charAt(i);
            hash = (hash * 16777619L) & 0xffffffffL;
        }
        return new Rng(hash);
    }

    private Scene buildScene(Camera camera, int width, int height) {
        Rng rand = seededRandom(camera.getName() + "#" + camera.getId());
        int count = 3 + (int) (rand.next() * 4);
        Building[] buildings = new Building[count];
        for (int i = 0; i < count; i++) {
            buildings[i] = new Building(
                    (int) (rand.next() * width),
                    18 + (int) (rand.next() * 40),
                    24 + (int) (rand.next() * 70),
                    70 + (int) (rand.next() * 50));
        }
        int actorCount = 1 + (int) (rand.next() * 2);
        Actor[] actors = new Actor[actorCount];
        for (int i = 0; i < actorCount; i++) {
            actors[i] = new Actor(
                    rand.next() * 1000,
                    12 + rand.next() * 26,          // pixels per second
                    height - 22 - (int) (rand.next() * 14),
                    4 + (int) (rand.next() * 3));
        }
        return new Scene(List.of(buildings), List.of(actors));
    }

    private Scene sceneFor(Camera camera, int width, int height) {
        return scenes.computeIfAbsent(camera.getId() + ":" + camera.getName() + ":" + width + "x" + height,
                key -> buildScene(camera, width, height));
    }

    private static int clamp255(double value) {
        if (value < 0) {
            return 0;
        }
        return value > 255 ? 255 : (int) value;
    }

    /**
     * Renders one camera frame. {@code at} (epoch millis) drives all motion, so the
     * output is reproducible for a given timestamp.
     */
    public byte[] renderFrame(Camera camera, long at) {
        return renderFrame(camera, at, FRAME_WIDTH, FRAME_HEIGHT);
    }

    public byte[] renderFrame(Camera camera, long at, int width, int height) {
        byte[] rgb = new byte[width * height * 3];
        Scene scene = sceneFor(camera, width, height);
        double t = at / 1000d;
        int horizon = (int) (height * 0.62);
        int noise = (int) ((at / 250) % 7);
        double dusk = (Math.sin(t / 45) + 1) / 2;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                double r;
                double g;
                double b;

                if (y < horizon) {
                    double skyT = (double) y / horizon;
                    r = 108 + skyT * 96 - dusk * 12;
                    g = 146 + skyT * 72 - dusk * 8;
                    b = 186 + skyT * 54;
                    double cloud = Math.sin(x / 34d + t / 6) * Math.cos(y / 26d - t / 9);
                    if (cloud > 0.55) {
                        double lift = (cloud - 0.55) * 90;
                        r += lift;
                        g += lift;
                        b += lift;
                    }
                } else {
                    double groundT = (double) (y - horizon) / (height - horizon);
                    r = 92 + groundT * 26;
                    g = 104 + groundT * 20;
                    b = 78 + groundT * 14;
                    if (groundT > 0.42) {
                        double shade = 70 - groundT * 12;
                        r = shade;
                        g = shade + 2;
                        b = shade + 6;
                        if ((x + (int) (t * 26)) % 48 < 18) {
                            r += 96;
                            g += 92;
                            b += 78;
                        }
                    }
                }

                for (Building building : scene.buildings()) {
                    if (x >= building.x() && x < building.x() + building.width()
                            && y >= horizon - building.height() && y < horizon) {
                        double depth = (double) (y - (horizon - building.height())) / building.height();
                        double shade = building.shade() + depth * 60;
                        r = shade;
                        g = shade + 6;
                        b = shade + 14;
                        if (x % 9 < 4 && y % 8 < 3 && (x + y + (int) (t / 8)) % 11 < 3) {
                            r += 120;
                            g += 96;
                            b += 40;
                        }
                    }
                }

                for (Actor actor : scene.actors()) {
                    double ax = ((actor.offset() + t * actor.speed()) % (width + 60)) - 30;
                    double dy = y - actor.y();
                    if (Math.abs(x - ax) <= actor.size() && dy >= -actor.size() * 3d && dy <= 0) {
                        r = 40;
                        g = 44;
                        b = 52;
                    }
                }

                // CCTV scanlines and sensor grain.
                if (y % 3 == 0) {
                    r *= 0.93;
                    g *= 0.93;
                    b *= 0.93;
                }
                double grain = ((x * 7 + y * 13 + noise * 31) % 17 - 8) * 0.9;
                r += grain;
                g += grain;
                b += grain;

                double cx = (x - width / 2d) / (width / 2d);
                double cy = (y - height / 2d) / (height / 2d);
                double vignette = 1 - Math.min(0.42, (cx * cx + cy * cy) * 0.3);
                r *= vignette;
                g *= vignette;
                b *= vignette;

                int offset = (y * width + x) * 3;
                rgb[offset] = (byte) clamp255(r);
                rgb[offset + 1] = (byte) clamp255(g);
                rgb[offset + 2] = (byte) clamp255(b);
            }
        }
        return encodePng(width, height, rgb);
    }

    /* ----------------------------------------------------------------- proxy */

    /**
     * Proxies a real camera snapshot so the browser stays same-origin.
     *
     * @return the frame, or empty when the upstream is unreachable, too slow, too
     *         large, or not an image - the caller then falls back to a simulated frame.
     */
    public java.util.Optional<ProxiedFrame> proxySnapshot(String streamUrl) {
        if (streamUrl == null || streamUrl.isBlank()) {
            return java.util.Optional.empty();
        }
        try {
            URI uri = URI.create(streamUrl.trim());
            String scheme = uri.getScheme();
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                return java.util.Optional.empty();
            }
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "samaj-drishti-api/2.0")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                return java.util.Optional.empty();
            }
            byte[] body = response.body();
            if (body.length == 0 || body.length > MAX_PROXIED_BYTES) {
                return java.util.Optional.empty();
            }
            String contentType = response.headers().firstValue("content-type").orElse("image/jpeg");
            String baseType = contentType.split(";")[0].strip().toLowerCase();
            if (!IMAGE_CONTENT_TYPES.contains(baseType) && !baseType.startsWith("image/")) {
                return java.util.Optional.empty();
            }
            return java.util.Optional.of(new ProxiedFrame(body, baseType));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return java.util.Optional.empty();
        } catch (IOException | RuntimeException e) {
            return java.util.Optional.empty();
        }
    }
}
