package in.gov.samajdrishti;

import java.io.IOException;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import in.gov.samajdrishti.config.DotEnv;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.service.CctvFrameService;

import static org.assertj.core.api.Assertions.assertThat;

class SupportCodeTest {

    // ------------------------------------------------------------------- dotenv

    @Test
    @DisplayName("a .env line is parsed, comments skipped, quotes stripped")
    void dotEnvParsesLines() {
        var values = DotEnv.parse(java.util.List.of(                "# a comment",
                "",
                "PORT=5000",
                "  JWT_SECRET = 'shh'  ",
                "export AI_DEBUG=1",
                "not a pair",
                "EMPTY="));

        assertThat(values)
                .containsEntry("PORT", "5000")
                .containsEntry("JWT_SECRET", "shh")
                .containsEntry("AI_DEBUG", "1")
                .containsEntry("EMPTY", "");
        assertThat(values).doesNotContainKey("not a pair");
    }

    // -------------------------------------------------------------- cctv frames

    @Test
    @DisplayName("the frame encoder emits a valid, decodable PNG")
    void pngEncoderIsValid() throws IOException {
        byte[] rgb = new byte[4 * 3 * 3];
        for (int i = 0; i < rgb.length; i++) {
            rgb[i] = (byte) (i * 7 % 256);
        }
        byte[] png = CctvFrameService.encodePng(4, 3, rgb);

        // Signature, then IHDR, then at least IDAT and IEND.
        assertThat(png[0] & 0xff).isEqualTo(0x89);
        assertThat(new String(png, 1, 3, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("PNG");
        assertThat(new String(png, 12, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("IHDR");
        assertThat(new String(png, png.length - 8, 4, java.nio.charset.StandardCharsets.US_ASCII))
                .isEqualTo("IEND");

        // The IHDR must describe the image we handed in, or a browser renders garbage.
        int width = ((png[16] & 0xff) << 24) | ((png[17] & 0xff) << 16)
                | ((png[18] & 0xff) << 8) | (png[19] & 0xff);
        int height = ((png[20] & 0xff) << 24) | ((png[21] & 0xff) << 16)
                | ((png[22] & 0xff) << 8) | (png[23] & 0xff);
        assertThat(width).isEqualTo(4);
        assertThat(height).isEqualTo(3);
        assertThat(png[24] & 0xff).as("8 bits per channel").isEqualTo(8);
        assertThat(png[25] & 0xff).as("truecolour").isEqualTo(2);
    }

    @Test
    @DisplayName("a rendered frame is deterministic for a given timestamp and differs over time")
    void framesAnimateButAreReproducible() {
        CctvFrameService service = new CctvFrameService();
        Camera camera = new Camera();
        camera.setId(1);
        camera.setName("Main Hall CCTV");

        byte[] first = service.renderFrame(camera, 1_700_000_000_000L);
        byte[] again = service.renderFrame(camera, 1_700_000_000_000L);
        byte[] later = service.renderFrame(camera, 1_700_000_030_000L);

        assertThat(first).isEqualTo(again);
        assertThat(later).as("the feed must move, or it is not a feed").isNotEqualTo(first);
        assertThat(first.length).isGreaterThan(1000);
    }

    @Test
    @DisplayName("a proxied snapshot is refused when there is no usable HTTP source")
    void proxyRejectsNonHttpSources() {
        CctvFrameService service = new CctvFrameService();
        assertThat(service.proxySnapshot(null)).isEmpty();
        assertThat(service.proxySnapshot("")).isEmpty();
        assertThat(service.proxySnapshot("rtsp://camera.local/stream")).isEmpty();
        assertThat(service.proxySnapshot("file:///etc/passwd")).isEmpty();
    }
}
