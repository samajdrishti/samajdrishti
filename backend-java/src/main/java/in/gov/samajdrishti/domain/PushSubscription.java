package in.gov.samajdrishti.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Web Push subscription for one user device.
 *
 * <p>The field app POSTs the browser-generated endpoint plus the VAPID
 * encryption keys here when an officer enables push alerts. Fan-out (actually
 * POSTing to these endpoints) needs VAPID/FCM server keys that are not
 * provisioned in this build — the rows are the addressing book the sender
 * will read once they are.
 */
@Entity
@Table(name = "push_subscriptions", indexes = {
        @Index(name = "idx_push_subs_user", columnList = "user_id"),
        @Index(name = "idx_push_subs_endpoint", columnList = "endpoint")
})
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "endpoint", nullable = false, length = 500)
    private String endpoint;

    @Column(name = "p256dh", length = 200)
    private String p256dh;

    @Column(name = "auth", length = 100)
    private String auth;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getP256dh() {
        return p256dh;
    }

    public void setP256dh(String p256dh) {
        this.p256dh = p256dh;
    }

    public String getAuth() {
        return auth;
    }

    public void setAuth(String auth) {
        this.auth = auth;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
