package in.gov.samajdrishti;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import in.gov.samajdrishti.service.AiEngineTransport;

/**
 * Test wiring: the AI engine is replaced with {@link FakeAiEngineTransport} so the API's
 * own contract is asserted deterministically. {@link AiEngineClientTest} covers the
 * client in isolation, including its offline behaviour.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestConfig {

    /**
     * Named differently from the production bean and marked primary, so it wins injection
     * without having to exclude the real {@code AiClientConfig}.
     */
    @Bean
    @Primary
    public AiEngineTransport fakeAiEngineTransport() {
        return new FakeAiEngineTransport();
    }
}
