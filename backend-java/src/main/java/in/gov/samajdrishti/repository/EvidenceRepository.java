package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Evidence;

public interface EvidenceRepository extends JpaRepository<Evidence, Integer> {

    List<Evidence> findByInspectionIdOrderByCreatedAtDesc(Integer inspectionId);

    List<Evidence> findByInspectionIdInOrderByCreatedAtDesc(List<Integer> inspectionIds);

    List<Evidence> findAllByOrderByCreatedAtDesc();
}
