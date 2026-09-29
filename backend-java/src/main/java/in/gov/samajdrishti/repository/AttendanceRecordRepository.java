package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.AttendanceRecord;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Integer> {

    List<AttendanceRecord> findAllByOrderByIdDesc();

    List<AttendanceRecord> findByInspectionIdOrderByIdDesc(Integer inspectionId);

    Optional<AttendanceRecord> findFirstByInspectionIdOrderByIdDesc(Integer inspectionId);

    Optional<AttendanceRecord> findByClientId(String clientId);

    long countByInspectionId(Integer inspectionId);
}
