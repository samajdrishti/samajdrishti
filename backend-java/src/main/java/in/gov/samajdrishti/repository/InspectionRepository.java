package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Inspection;

public interface InspectionRepository extends JpaRepository<Inspection, Integer> {

    List<Inspection> findByAssignedToOrderByCreatedAtDesc(Integer assignedTo);

    List<Inspection> findAllByOrderByCreatedAtDesc();

    List<Inspection> findByProjectId(Integer projectId);

    Optional<Inspection> findByIdAndAssignedTo(Integer id, Integer assignedTo);
}
