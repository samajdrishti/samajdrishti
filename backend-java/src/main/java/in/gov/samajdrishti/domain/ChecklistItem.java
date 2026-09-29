package in.gov.samajdrishti.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * One checklist line as filled in by the officer.
 *
 * <p>The LLD models a checklist as a row per item, with its own status, remarks and
 * verification timestamp. The previous implementation kept one row per inspection with a
 * {@code {itemId: boolean}} JSON blob, which cannot express "this item failed, and here is
 * why" - and the remarks are the part a supervisor actually reads.
 *
 * <p>{@code InspectionChecklist} is kept as the parent that owns the template and the
 * aggregate score; these rows are the detail under it. A unique index on
 * (inspection, item_code) keeps a replayed offline submit from producing two rows for the
 * same item.
 */
@Entity
@Table(name = "checklist_items", indexes = {
        @Index(name = "idx_checklist_items_inspection", columnList = "inspection_id"),
        @Index(name = "idx_checklist_items_section", columnList = "section"),
        @Index(name = "idx_checklist_items_unique",
                columnList = "inspection_id,item_code", unique = true)
})
public class ChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "checklist_id")
    private Integer checklistId;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    /** Grouping within the template, e.g. {@code infrastructure} or {@code medical}. */
    @Column(name = "section", length = 60)
    private String section;

    /** The item's stable key from the scheme template. */
    @Column(name = "item_code", length = 80)
    private String itemCode;

    /** The question as the officer sees it. */
    @Column(name = "item", columnDefinition = "text")
    private String item;

    /** {@code pending}, {@code verified}, {@code failed}, or {@code not_applicable}. */
    @Column(name = "status", length = 20)
    private String status = "pending";

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "weight")
    private Integer weight;

    @Column(name = "evidence_id")
    private Integer evidenceId;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "client_id", length = 64)
    private String clientId;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getChecklistId() {
        return checklistId;
    }

    public void setChecklistId(Integer checklistId) {
        this.checklistId = checklistId;
    }

    public Integer getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Integer inspectionId) {
        this.inspectionId = inspectionId;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public String getItemCode() {
        return itemCode;
    }

    public void setItemCode(String itemCode) {
        this.itemCode = itemCode;
    }

    public String getItem() {
        return item;
    }

    public void setItem(String item) {
        this.item = item;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public Integer getWeight() {
        return weight;
    }

    public void setWeight(Integer weight) {
        this.weight = weight;
    }

    public Integer getEvidenceId() {
        return evidenceId;
    }

    public void setEvidenceId(Integer evidenceId) {
        this.evidenceId = evidenceId;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
