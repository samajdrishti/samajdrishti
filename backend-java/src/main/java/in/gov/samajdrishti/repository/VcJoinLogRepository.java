package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.VcJoinLog;

public interface VcJoinLogRepository extends JpaRepository<VcJoinLog, Integer> {

    List<VcJoinLog> findBySessionIdOrderByIdDesc(Integer sessionId);
}
