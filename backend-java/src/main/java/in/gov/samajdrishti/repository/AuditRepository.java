package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.AuditEntry;

public interface AuditRepository extends JpaRepository<AuditEntry, Integer> {

    List<AuditEntry> findAllByOrderByIdDesc();

    List<AuditEntry> findByEntityOrderByIdDesc(String entity);

    List<AuditEntry> findByEntityAndEntityIdOrderByIdDesc(String entity, Integer entityId);
}
