package in.gov.samajdrishti.realtime;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ScheduledFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.JwtService;

/**
 * Engine.IO v4 / Socket.IO v5 server for the WebSocket transport.
 *
 * <p>Both web clients connect with {@code socket.io-client} configured as
 * {@code transports: ['websocket', 'polling']}, so the WebSocket transport is tried
 * first and long-polling is never needed. Speaking this protocol directly - rather than
 * swapping the clients for STOMP - is what keeps {@code admin/} and {@code mobile-web/}
 * working against the Java service unchanged.
 *
 * <p>Packet layout (Engine.IO v4 over WebSocket):
 * <pre>
 *   server -&gt; client  0{...}            open, carries the session id and ping timers
 *   server -&gt; client  40{"sid":"..."}  Socket.IO CONNECT on the default namespace
 *   server -&gt; client  42["ev",data]     Socket.IO EVENT
 *   server -&gt; client  2                ping
 *   client -&gt; server  3                pong
 *   client -&gt; server  40...             CONNECT
 *   client -&gt; server  42["ev",args]     EVENT
 * </pre>
 */
@Component
public class SocketIoEngineHandler extends TextWebSocketHandler implements SubProtocolCapable {

    private static final Logger log = LoggerFactory.getLogger(SocketIoEngineHandler.class);
    private static final String SUBPROTOCOL = "engine.io-protocol";
    private static final long PING_INTERVAL_MS = 25_000;
    private static final long PING_TIMEOUT_MS = 20_000;

    private final RealtimeHub hub;
    private final JwtService jwtService;
    private final UserRepository users;

    public SocketIoEngineHandler(RealtimeHub hub, JwtService jwtService, UserRepository users) {
        this.hub = hub;
        this.jwtService = jwtService;
        this.users = users;
    }

    @Override
    public List<String> getSubProtocols() {
        // The client requires the server to echo this subprotocol during the handshake.
        return List.of(SUBPROTOCOL);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        String sid = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        session.getAttributes().put("sid", sid);
        hub.register(session);

        // A token in the handshake (io(url, { auth: { token } })) lets the socket join
        // the owner's notification room straight away.
        Integer userId = userIdFromHandshake(session);
        if (userId != null) {
            hub.joinUserRoom(session.getId(), userId);
        }

        Map<String, Object> open = Map.of(
                "sid", sid,
                "upgrades", List.of(),
                "pingInterval", PING_INTERVAL_MS,
                "pingTimeout", PING_TIMEOUT_MS,
                "maxPayload", 1_000_000);
        session.sendMessage(new TextMessage("0" + Json.encode(open)));
    }

    private Integer userIdFromHandshake(WebSocketSession session) {
        String query = session.getUri() == null ? null : session.getUri().getQuery();
        if (query != null && query.contains("token=")) {
            for (String pair : query.split("&")) {
                if (pair.startsWith("token=")) {
                    String token = java.net.URLDecoder.decode(pair.substring(6), java.nio.charset.StandardCharsets.UTF_8);
                    return jwtService.resolveUserId(token).orElse(null);
                }
            }
        }
        return null;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String payload = message.getPayload();
        if (payload.isEmpty()) {
            return;
        }
        char type = payload.charAt(0);
        String body = payload.substring(1);

        switch (type) {
            case '0' -> {
                // Engine.IO open from the client (polling upgrade attempt) - answer with our open packet.
                Map<String, Object> open = Map.of(
                        "sid", session.getAttributes().getOrDefault("sid", ""),
                        "upgrades", List.of(),
                        "pingInterval", PING_INTERVAL_MS,
                        "pingTimeout", PING_TIMEOUT_MS,
                        "maxPayload", 1_000_000);
                session.sendMessage(new TextMessage("0" + Json.encode(open)));
            }
            case '2' -> send(session, "3");          // client ping -> pong
            case '3' -> { }                          // client pong, nothing to do
            case '4' -> handleEvent(session, body);  // Socket.IO packet (CONNECT / EVENT)
            default -> log.debug("[realtime] ignoring packet type '{}'", type);
        }
    }

    private void handleEvent(WebSocketSession session, String body) throws IOException {
        if (body.isEmpty()) {
            return;
        }
        char socketIoType = body.charAt(0);
        String rest = body.substring(1);

        // 0 = CONNECT, 2 = EVENT, 3 = ACK, 4 = BINARY_EVENT, 5 = BINARY_ACK
        if (socketIoType == '0') {
            String sid = String.valueOf(session.getAttributes().getOrDefault("sid", ""));
            session.sendMessage(new TextMessage("40" + Json.encode(Map.of("sid", sid))));
            return;
        }
        if (socketIoType != '2') {
            return;
        }

        Object[] args = Json.decodeArray(rest);
        if (args.length == 0) {
            return;
        }
        String event = Json.stringOf(args[0]);
        if (event == null) {
            return;
        }
        if ("join".equals(event)) {
            Integer userId = args.length > 1 ? Json.intOf(args[1]) : null;
            hub.joinUserRoom(session.getId(), userId);
            return;
        }
        if ("ping".equals(event)) {
            // Socket.IO application-level heartbeat used by some clients.
            send(session, "43" + Json.encode(new Object[]{"pong", args.length > 1 ? args[1] : null}));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        hub.unregister(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("[realtime] transport error on {}: {}", session.getId(), exception.getMessage());
        hub.unregister(session);
    }

    private static void send(WebSocketSession session, String packet) throws IOException {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(packet));
        }
    }

    /** Engine.IO expects the server to ping; an unanswered ping eventually closes the socket. */
    @Scheduled(fixedDelay = PING_INTERVAL_MS)
    public void heartbeat() {
        for (WebSocketSession session : hub.sessions()) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(new TextMessage("2"));
            } catch (IOException | RuntimeException e) {
                log.debug("[realtime] ping to {} failed: {}", session.getId(), e.getMessage());
            }
        }
    }
}
