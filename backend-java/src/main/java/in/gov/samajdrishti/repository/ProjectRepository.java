package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Project;

public interface ProjectRepository extends JpaRepository<Project, Integer> {

    List<Project> findAllByOrderByCreatedAtDesc();
}
