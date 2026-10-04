package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Notification;
import in.gov.samajdrishti.domain.PushSubscription;
import in.gov.samajdrishti.repository.NotificationRepository;
import in.gov.samajdrishti.repository.PushSubscriptionRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notifications;
    private final PushSubscriptionRepository pushSubscriptions;

    public NotificationController(NotificationRepository notifications,
                                  PushSubscriptionRepository pushSubscriptions) {
        this.notifications = notifications;
        this.pushSubscriptions = pushSubscriptions;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Notification> list(@AuthenticationPrincipal AuthPrincipal current) {
        return notifications.findTop50ByUserIdOrderByCreatedAtDesc(current.id());
    }

    @PutMapping("/{id}/read")
    @Transactional
    public Map<String, Object> markAsRead(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        notifications.markRead(id, current.id());
        return Map.of("message", "Notification marked as read");
    }

    /**
     * Stores one Web Push subscription for the current user's device.
     * Re-subscribing the same endpoint refreshes its keys instead of duplicating.
     */
    @PostMapping("/push-subscriptions")
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> savePushSubscription(@RequestBody Map<String, Object> body,
                                                    @AuthenticationPrincipal AuthPrincipal current) {
        String endpoint = body.get("endpoint") == null ? "" : String.valueOf(body.get("endpoint")).strip();
        if (endpoint.isBlank()) {
            throw ApiException.badRequest("Push subscription endpoint is required");
        }
        Map<String, Object> keys = body.get("keys") instanceof Map<?, ?> map
                ? (Map<String, Object>) map
                : Map.of();

        PushSubscription subscription = pushSubscriptions
                .findByUserIdAndEndpoint(current.id(), endpoint)
                .orElseGet(PushSubscription::new);
        subscription.setUserId(current.id());
        subscription.setEndpoint(endpoint);
        subscription.setP256dh(keys.get("p256dh") == null ? null : String.valueOf(keys.get("p256dh")));
        subscription.setAuth(keys.get("auth") == null ? null : String.valueOf(keys.get("auth")));
        subscription.setCreatedAt(Instant.now());
        pushSubscriptions.save(subscription);
        return Map.of("message", "Push subscription saved", "id", subscription.getId());
    }

    @GetMapping("/push-subscriptions/mine")
    @Transactional(readOnly = true)
    public List<PushSubscription> myPushSubscriptions(@AuthenticationPrincipal AuthPrincipal current) {
        return pushSubscriptions.findByUserIdOrderByCreatedAtDesc(current.id());
    }

    @DeleteMapping("/push-subscriptions")
    @Transactional
    public Map<String, Object> deletePushSubscription(@RequestBody Map<String, Object> body,
                                                      @AuthenticationPrincipal AuthPrincipal current) {
        String endpoint = body.get("endpoint") == null ? "" : String.valueOf(body.get("endpoint")).strip();
        if (!endpoint.isBlank()) {
            pushSubscriptions.deleteByUserIdAndEndpoint(current.id(), endpoint);
        }
        return Map.of("message", "Push subscription removed");
    }
}
