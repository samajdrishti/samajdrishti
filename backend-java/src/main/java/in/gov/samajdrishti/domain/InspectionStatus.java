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
 * The persisted LLD state machine, in the order §19 lists it.
 *
 * <p>Previously the valid statuses were a {@code List<String>} inside the controller with
 * no transition checking, so any of four values could be set from any other - including
 * going back to {@code pending} after {@code completed}. The rules live here so the
 * controller, the assignment service and the report service all enforce the same ones.
 *
 * <p>Not every step is reachable from every other: {@code GPS_VERIFIED} requires a passing
 * geofence verdict, and the three parallel states after {@code IN_PROGRESS}
 * ({@code VC_ACTIVE}, {@code EVIDENCE_CAPTURED}, {@code CHECKLIST_COMPLETED}) are
 * milestones, not a sequence, so the machine allows them in any order and requires the
 * field app to move on to {@code AI_ANALYZED} explicitly.
 */
public enum InspectionStatus {

    ASSIGNED,
    ACCEPTED,
    GPS_VERIFIED,
    IN_PROGRESS,
    VC_ACTIVE,
    EVIDENCE_CAPTURED,
    CHECKLIST_COMPLETED,
    AI_ANALYZED,
    SUBMITTED,
    UNDER_REVIEW,
    ATR_CREATED,
    ACTION_IN_PROGRESS,
    VERIFIED,
    CLOSED,
    /** The LLD omits it, but an inspection can be abandoned and that has to be recorded. */
    FLAGGED,
    CANCELLED;

    private static final java.util.Map<InspectionStatus, java.util.Set<InspectionStatus>> ALLOWED =
            java.util.Map.ofEntries(
                    java.util.Map.entry(ASSIGNED, java.util.Set.of(ACCEPTED, FLAGGED, CANCELLED)),
                    java.util.Map.entry(ACCEPTED, java.util.Set.of(GPS_VERIFIED, IN_PROGRESS, FLAGGED, CANCELLED)),
                    java.util.Map.entry(GPS_VERIFIED, java.util.Set.of(IN_PROGRESS, FLAGGED, CANCELLED)),
                    java.util.Map.entry(IN_PROGRESS, java.util.Set.of(
                            VC_ACTIVE, EVIDENCE_CAPTURED, CHECKLIST_COMPLETED, AI_ANALYZED, FLAGGED, CANCELLED)),
                    java.util.Map.entry(VC_ACTIVE, java.util.Set.of(
                            EVIDENCE_CAPTURED, CHECKLIST_COMPLETED, AI_ANALYZED, IN_PROGRESS, FLAGGED)),
                    java.util.Map.entry(EVIDENCE_CAPTURED, java.util.Set.of(
                            CHECKLIST_COMPLETED, AI_ANALYZED, VC_ACTIVE, IN_PROGRESS, FLAGGED)),
                    java.util.Map.entry(CHECKLIST_COMPLETED, java.util.Set.of(
                            AI_ANALYZED, EVIDENCE_CAPTURED, VC_ACTIVE, IN_PROGRESS, FLAGGED)),
                    java.util.Map.entry(AI_ANALYZED, java.util.Set.of(SUBMITTED, UNDER_REVIEW, FLAGGED)),
                    java.util.Map.entry(SUBMITTED, java.util.Set.of(UNDER_REVIEW, FLAGGED)),
                    java.util.Map.entry(UNDER_REVIEW, java.util.Set.of(ATR_CREATED, VERIFIED, FLAGGED)),
                    java.util.Map.entry(ATR_CREATED, java.util.Set.of(ACTION_IN_PROGRESS, UNDER_REVIEW)),
                    java.util.Map.entry(ACTION_IN_PROGRESS, java.util.Set.of(VERIFIED, ATR_CREATED)),
                    java.util.Map.entry(VERIFIED, java.util.Set.of(CLOSED, ACTION_IN_PROGRESS)),
                    java.util.Map.entry(CLOSED, java.util.Set.of()),
                    java.util.Map.entry(FLAGGED, java.util.Set.of(UNDER_REVIEW, ACTION_IN_PROGRESS, CANCELLED)),
                    java.util.Map.entry(CANCELLED, java.util.Set.of()));

    /** Statuses from which no further transition is possible. */
    public boolean isTerminal() {
        return this == CLOSED || this == CANCELLED;
    }

    public boolean isOpenForWork() {
        return !isTerminal();
    }

    /** True when {@code next} is a legal move from this status. */
    public boolean canTransitionTo(InspectionStatus next) {
        return next != null && ALLOWED.getOrDefault(this, java.util.Set.of()).contains(next);
    }

    public java.util.Set<InspectionStatus> allowedNext() {
        return ALLOWED.getOrDefault(this, java.util.Set.of());
    }

    /**
     * Parses a status from either the LLD spelling ({@code gps_verified}) or the legacy
     * dashboard spelling ({@code in_progress}, {@code completed}, {@code pending}).
     *
     * <p>The legacy values predate the machine and are still what {@code admin/} and
     * {@code mobile-web/} send, so they map onto the closest state rather than 400-ing a
     * working client.
     */
    public static InspectionStatus parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalised = value.strip().toUpperCase(java.util.Locale.ROOT).replace('-', '_');
        return switch (normalised) {
            case "PENDING", "ASSIGNED" -> ASSIGNED;
            case "IN_PROGRESS", "INSPECTED", "ACTIVE" -> IN_PROGRESS;
            case "COMPLETED", "DONE" -> SUBMITTED;
            case "SUBMITTED" -> SUBMITTED;
            case "FLAGGED" -> FLAGGED;
            case "CANCELLED", "CANCELED" -> CANCELLED;
            default -> {
                for (InspectionStatus candidate : values()) {
                    if (candidate.name().equals(normalised)) {
                        yield candidate;
                    }
                }
                yield null;
            }
        };
    }
}
