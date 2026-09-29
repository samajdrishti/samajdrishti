package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.InspectionAssignment;

public interface InspectionAssignmentRepository extends JpaRepository<InspectionAssignment, Integer> {

    List<InspectionAssignment> findAllByOrderByIdDesc();

    List<InspectionAssignment> findByInspectionIdOrderByIdDesc(Integer inspectionId);

    List<InspectionAssignment> findByOfficerIdOrderByIdDesc(Integer officerId);

    List<InspectionAssignment> findByOfficerIdAndStatusOrderByIdDesc(Integer officerId, String status);

    List<InspectionAssignment> findByStatusOrderByIdDesc(String status);

    Optional<InspectionAssignment> findByInspectionIdAndStatus(Integer inspectionId, String status);

    Optional<InspectionAssignment> findByClientId(String clientId);

    long countByOfficerIdAndStatusIn(Integer officerId, List<String> statuses);
}
