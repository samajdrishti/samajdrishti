package in.gov.samajdrishti.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.AiEngineTransport;
import in.gov.samajdrishti.service.HttpAiEngineTransport;

/** Wires the AI engine transport and the client that wraps it. */
@Configuration(proxyBeanMethods = false)
public class AiClientConfig {

    @Bean
    public AiEngineTransport aiEngineTransport(
            com.fasterxml.jackson.databind.ObjectMapper objectMapper, AppProperties properties) {
        return new HttpAiEngineTransport(objectMapper, properties);
    }

    @Bean
    public AiEngineClient aiEngineClient(AiEngineTransport transport, AppProperties properties) {
        return new AiEngineClient(transport, properties.aiEngine());
    }
}
