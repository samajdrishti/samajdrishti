package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.Atr;

public interface AtrRepository extends JpaRepository<Atr, Integer> {

    List<Atr> findAllByOrderByIdDesc();
}
