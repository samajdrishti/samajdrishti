package in.gov.samajdrishti.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import in.gov.samajdrishti.realtime.SocketIoEngineHandler;

/**
 * Mounts the Socket.IO endpoint at {@code /socket.io/**}, the path
 * {@code socket.io-client} connects to.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SocketIoEngineHandler handler;

    public WebSocketConfig(SocketIoEngineHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/socket.io/**")
                .setAllowedOriginPatterns("*");
    }
}
