package in.gov.samajdrishti.security;

import java.util.Map;

import in.gov.samajdrishti.domain.User;

/**
 * The authenticated caller.
 *
 * <p>{@code @AuthenticationPrincipal AuthPrincipal current} on a controller method is the
 * Java equivalent of the {@code req.user} object the Node middleware attached.
 */
public record AuthPrincipal(Integer id, String name, String email, String role, String department)
        implements java.security.Principal {

    /** {@link Principal} is what lets a controller take {@code AuthPrincipal} as a bare parameter. */
    @Override
    public String getName() {
        return name == null ? email : name;
    }

    public static AuthPrincipal from(User user) {
        return new AuthPrincipal(user.getId(), user.getName(), user.getEmail(),
                user.getRole(), user.getDepartment());
    }

    public boolean isBackOffice() {
        return "admin".equals(role) || "supervisor".equals(role);
    }

    /** The subset {@code GET /auth/profile} returns. */
    public Map<String, Object> asProfile() {
        return Map.of(
                "id", id,
                "name", name == null ? "" : name,
                "email", email == null ? "" : email,
                "role", role == null ? "official" : role,
                "department", department == null ? "" : department);
    }
}
