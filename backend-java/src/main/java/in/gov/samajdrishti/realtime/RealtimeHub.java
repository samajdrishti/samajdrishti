package in.gov.samajdrishti.realtime;

import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * Fan-out for the realtime channel.
 *
 * <p>Owns the room registry ({@code user_<id>}) and knows how to frame a Socket.IO
 * {@code EVENT} packet. Transport concerns - the Engine.IO handshake, ping/pong,
 * parsing - live in {@link SocketIoEngineHandler}.
 */
@Component
public class RealtimeHub {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> rooms = new ConcurrentHashMap<>();

    public void register(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    public void unregister(WebSocketSession session) {
        sessions.remove(session.getId());
        rooms.forEach((room, members) -> members.remove(session.getId()));
    }

    /** Adds a socket to the personal room of a user. */
    public void joinUserRoom(String socketId, Integer userId) {
        if (socketId == null || userId == null) {
            return;
        }
        rooms.computeIfAbsent(roomName(userId), key -> ConcurrentHashMap.newKeySet()).add(socketId);
    }

    public static String roomName(Integer userId) {
        return "user_" + userId;
    }

    /** Broadcasts a Socket.IO event to every connected client. */
    public void emit(String event, Object payload) {
        broadcast(sessions.values(), event, payload);
    }

    /** Sends a Socket.IO event to one user's personal room. */
    public void emitToUser(Integer userId, String event, Object payload) {
        if (userId == null) {
            return;
        }
        Set<String> members = rooms.get(roomName(userId));
        if (members == null || members.isEmpty()) {
            return;
        }
        Collection<WebSocketSession> targets = members.stream()
                .map(sessions::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        broadcast(targets, event, payload);
    }

    private void broadcast(Collection<WebSocketSession> targets, String event, Object payload) {
        if (targets.isEmpty()) {
            return;
        }
        String frame = frame(event, payload);
        for (WebSocketSession session : targets) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                // Socket.IO EVENT packet: "42" + [name, payload]
                session.sendMessage(new TextMessage(frame));
            } catch (IOException | RuntimeException e) {
                log.debug("[realtime] dropping frame for {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    /** Builds the Socket.IO EVENT frame; public so the framing can be asserted in a test. */
    public static String frame(String event, Object payload) {
        return "42" + Json.encode(new Object[]{event, payload});
    }

    public int connectedCount() {
        return sessions.size();
    }

    /** The live sockets, used by the Engine.IO heartbeat. */
    public Collection<WebSocketSession> sessions() {
        return List.copyOf(sessions.values());
    }
}
