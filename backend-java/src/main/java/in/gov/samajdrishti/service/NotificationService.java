package in.gov.samajdrishti.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import in.gov.samajdrishti.domain.Notification;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.NotificationRepository;

/**
 * Creates notifications and pushes them over the realtime channel.
 *
 * <p>The write runs in its own transaction so a failure here can never roll back the
 * business operation that triggered the notification.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final RealtimeHub hub;

    public NotificationService(NotificationRepository notifications, RealtimeHub hub) {
        this.notifications = notifications;
        this.hub = hub;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Notification create(Integer userId, String message, String type) {
        try {
            Notification notification = new Notification();
            notification.setUserId(userId);
            notification.setMessage(message);
            notification.setType(type == null ? "info" : type);
            Notification saved = notifications.save(notification);
            hub.emitToUser(userId, "notification", Map.of(
                    "message", message,
                    "type", saved.getType()));
            return saved;
        } catch (RuntimeException e) {
            log.error("Notification error: {}", e.getMessage());
            return null;
        }
    }
}
