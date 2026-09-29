package in.gov.samajdrishti.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import in.gov.samajdrishti.domain.Attendance;

public interface AttendanceRepository extends JpaRepository<Attendance, Integer> {

    List<Attendance> findAllByOrderByIdDesc();

    /** The single open punch for an official, i.e. checked in but not yet checked out. */
    @Query("select a from Attendance a where a.officialId = :officialId and a.checkIn is not null "
            + "and a.checkOut is null order by a.id desc")
    List<Attendance> findOpenPunches(@Param("officialId") Integer officialId);

    List<Attendance> findByOfficialIdOrderByIdDesc(Integer officialId);

    List<Attendance> findByOfficialIdAndDate(Integer officialId, LocalDate date);

    default Optional<Attendance> findLatestOpenPunch(Integer officialId) {
        List<Attendance> open = findOpenPunches(officialId);
        return open.isEmpty() ? Optional.empty() : Optional.of(open.get(0));
    }
}
