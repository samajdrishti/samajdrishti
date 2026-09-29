package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.security.JwtService;
import in.gov.samajdrishti.web.dto.Requests;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final List<String> ROLES = List.of("admin", "official", "supervisor");

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody Requests.Register body) {
        if (users.existsByEmailIgnoreCase(body.email())) {
            throw ApiException.badRequest("User already exists");
        }
        User user = new User();
        user.setName(body.name());
        user.setEmail(body.email());
        user.setPassword(passwordEncoder.encode(body.password()));
        user.setRole(ROLES.contains(body.role()) ? body.role() : "official");
        user.setDepartment(body.department());
        user.setPhone(body.phone());
        user.setCreatedAt(java.time.Instant.now());
        User saved = users.save(user);

        return ResponseEntity.status(201).body(session(saved));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody Requests.Login body) {
        User user = users.findByEmailIgnoreCase(body.email().strip()).orElse(null);
        if (user == null || !passwordEncoder.matches(body.password(), user.getPassword())) {
            // One message for both cases: which half was wrong is not the caller's business.
            throw ApiException.badRequest("Invalid credentials");
        }
        return ResponseEntity.ok(session(user));
    }

    @GetMapping("/profile")
    public Map<String, Object> profile(@AuthenticationPrincipal AuthPrincipal current) {
        return Map.of("user", current.asProfile());
    }

    private Map<String, Object> session(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user", publicUser(user));
        body.put("token", jwtService.issueToken(user.getId()));
        return body;
    }

    static Map<String, Object> publicUser(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.getId());
        body.put("name", user.getName());
        body.put("email", user.getEmail());
        body.put("role", user.getRole());
        body.put("department", user.getDepartment());
        body.put("phone", user.getPhone());
        body.put("created_at", user.getCreatedAt());
        return body;
    }
}
