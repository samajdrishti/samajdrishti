package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Notification;
import in.gov.samajdrishti.repository.NotificationRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notifications;

    public NotificationController(NotificationRepository notifications) {
        this.notifications = notifications;
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
}
