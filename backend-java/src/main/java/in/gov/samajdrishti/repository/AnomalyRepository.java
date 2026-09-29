package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Anomaly;

public interface AnomalyRepository extends JpaRepository<Anomaly, Integer> {

    List<Anomaly> findAllByOrderByIdDesc();

    List<Anomaly> findByInspectionIdOrderByIdDesc(Integer inspectionId);

    List<Anomaly> findByProjectIdOrderByIdDesc(Integer projectId);

    List<Anomaly> findByInspectionIdAndTypeOrderByIdDesc(Integer inspectionId, String type);

    List<Anomaly> findByStatusOrderByIdDesc(String status);

    List<Anomaly> findByHumanVerifiedFalseOrderByIdDesc();

    long countByInspectionId(Integer inspectionId);

    long countByInspectionIdAndHumanVerifiedFalse(Integer inspectionId);
}
