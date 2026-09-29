package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.ChecklistItem;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Integer> {

    List<ChecklistItem> findByInspectionIdOrderByIdAsc(Integer inspectionId);

    Optional<ChecklistItem> findByInspectionIdAndItemCode(Integer inspectionId, String itemCode);

    List<ChecklistItem> findByChecklistIdOrderByIdAsc(Integer checklistId);

    void deleteByInspectionId(Integer inspectionId);
}
