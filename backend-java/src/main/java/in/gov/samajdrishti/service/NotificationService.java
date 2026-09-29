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
        return create(userId, null, message, type, null, null);
    }

    /**
     * Creates a notification that can be acted on.
     *
     * <p>{@code referenceType} and {@code referenceId} are what let the field app deep-link:
     * without them an officer told "New action required" has to go and find which ATR it was.
     * Nulls are dropped from the socket payload rather than sent, because
     * {@code Map.of} rejects nulls and a missing title is normal.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Notification create(Integer userId, String title, String message, String type,
                                String referenceType, Integer referenceId) {
        try {
            Notification notification = new Notification();
            notification.setUserId(userId);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setType(type == null ? "info" : type);
            notification.setReferenceType(referenceType);
            notification.setReferenceId(referenceId);
            Notification saved = notifications.save(notification);

            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("id", saved.getId());
            payload.put("message", message);
            payload.put("type", saved.getType());
            if (title != null) {
                payload.put("title", title);
            }
            if (referenceType != null) {
                payload.put("reference_type", referenceType);
            }
            if (referenceId != null) {
                payload.put("reference_id", referenceId);
            }
            hub.emitToUser(userId, "notification", payload);
            return saved;
        } catch (RuntimeException e) {
            log.error("Notification error: {}", e.getMessage());
            return null;
        }
    }
}
