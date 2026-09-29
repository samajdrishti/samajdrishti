package in.gov.samajdrishti.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import in.gov.samajdrishti.domain.BeneficiaryFeedback;

public interface BeneficiaryFeedbackRepository extends JpaRepository<BeneficiaryFeedback, Integer> {

    List<BeneficiaryFeedback> findAllByOrderByIdDesc();
}
