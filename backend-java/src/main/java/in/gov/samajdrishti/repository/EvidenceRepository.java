package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Evidence;

public interface EvidenceRepository extends JpaRepository<Evidence, Integer> {

    List<Evidence> findByInspectionIdOrderByCreatedAtDesc(Integer inspectionId);

    List<Evidence> findByInspectionIdInOrderByCreatedAtDesc(List<Integer> inspectionIds);

    List<Evidence> findAllByOrderByCreatedAtDesc();

    /**
     * The idempotency lookup for an offline replay: the field app re-sends a capture with
     * the same clientId until it gets an ack, and this returns the row the first attempt
     * already wrote instead of duplicating it.
     */
    Optional<Evidence> findByClientId(String clientId);

    Optional<Evidence> findFirstByFileHashAndInspectionIdOrderByIdDesc(String fileHash, Integer inspectionId);

    List<Evidence> findByFileHash(String fileHash);

    long countByInspectionId(Integer inspectionId);
}
