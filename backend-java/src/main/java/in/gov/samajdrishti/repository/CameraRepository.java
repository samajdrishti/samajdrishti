package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Camera;

public interface CameraRepository extends JpaRepository<Camera, Integer> {

    List<Camera> findAllByOrderByIdAsc();

    List<Camera> findByProjectId(Integer projectId);

    long countByStatus(String status);

    long countByProjectIdAndStatus(Integer projectId, String status);
}
