package in.gov.samajdrishti.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Configuration marker so {@link AppProperties} is bound from {@code app.*}. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AppProperties.class)
@EnableScheduling
public class AppConfig {
}
