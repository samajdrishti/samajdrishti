package in.gov.samajdrishti.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Institution;

public interface InstitutionRepository extends JpaRepository<Institution, Integer> {

    List<Institution> findAllByOrderByNameAsc();

    List<Institution> findByDistrictOrderByNameAsc(String district);

    List<Institution> findByStatusOrderByNameAsc(String status);

    List<Institution> findByProjectId(Integer projectId);

    Optional<Institution> findFirstByProjectId(Integer projectId);

    List<Institution> findBySchemeOrderByNameAsc(String scheme);
}
