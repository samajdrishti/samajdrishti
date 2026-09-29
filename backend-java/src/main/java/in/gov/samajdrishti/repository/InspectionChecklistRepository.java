package in.gov.samajdrishti.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.InspectionChecklist;

public interface InspectionChecklistRepository extends JpaRepository<InspectionChecklist, Integer> {

    Optional<InspectionChecklist> findByInspectionId(Integer inspectionId);
}
