package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.InspectionReport;

public interface InspectionReportRepository extends JpaRepository<InspectionReport, Integer> {

    List<InspectionReport> findAllByOrderByIdDesc();

    List<InspectionReport> findByInspectionIdOrderByIdDesc(Integer inspectionId);

    /** The most recent filed report for an inspection, i.e. the current record. */
    Optional<InspectionReport> findFirstByInspectionIdOrderByIdDesc(Integer inspectionId);

    Optional<InspectionReport> findFirstByInspectionIdAndReportStatusOrderByIdDesc(
            Integer inspectionId, String reportStatus);

    List<InspectionReport> findByReportStatusOrderByIdDesc(String reportStatus);

    List<InspectionReport> findByProjectIdOrderByIdDesc(Integer projectId);

    long countByReportStatus(String reportStatus);
}
