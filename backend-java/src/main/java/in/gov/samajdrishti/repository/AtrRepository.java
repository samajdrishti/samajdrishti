package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Atr;

public interface AtrRepository extends JpaRepository<Atr, Integer> {

    List<Atr> findAllByOrderByIdDesc();

    List<Atr> findByStatusOrderByIdDesc(String status);

    List<Atr> findByProjectIdOrderByIdDesc(Integer projectId);

    List<Atr> findByInspectionIdOrderByIdDesc(Integer inspectionId);

    List<Atr> findByAnomalyIdOrderByIdDesc(Integer anomalyId);

    List<Atr> findByAssignedToOrderByIdDesc(Integer assignedTo);

    long countByStatus(String status);

    long countByAssignedToAndStatusNotIn(Integer assignedTo, List<String> statuses);
}
