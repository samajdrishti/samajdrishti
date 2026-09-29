package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import in.gov.samajdrishti.domain.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findTop50ByUserIdOrderByCreatedAtDesc(Integer userId);

    @Modifying
    @Query("update Notification n set n.read = true where n.id = :id and n.userId = :userId")
    int markRead(@Param("id") Integer id, @Param("userId") Integer userId);
}
