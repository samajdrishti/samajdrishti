package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.VcSession;

public interface VcSessionRepository extends JpaRepository<VcSession, Integer> {

    List<VcSession> findAllByOrderByIdDesc();
}
