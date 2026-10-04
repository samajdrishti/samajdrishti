package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.PushSubscription;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Integer> {

    List<PushSubscription> findByUserIdOrderByCreatedAtDesc(Integer userId);

    Optional<PushSubscription> findByUserIdAndEndpoint(Integer userId, String endpoint);

    void deleteByUserIdAndEndpoint(Integer userId, String endpoint);
}
