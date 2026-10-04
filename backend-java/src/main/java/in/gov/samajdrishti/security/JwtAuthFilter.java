package in.gov.samajdrishti.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Resolves the bearer token into an authenticated {@link AuthPrincipal}.
 *
 * <p>A token that is missing or invalid is simply left unauthenticated; whether that is
 * an error is then decided per endpoint by Spring Security, which returns 401 for
 * protected routes. This mirrors the Node middleware, which returned 401 from
 * {@code auth} and fell through to anonymous for {@code softAuth}.
 *
 * <p>A {@code ?token=} query parameter is also accepted, but only for the CCTV
 * snapshot endpoint and the {@code /uploads/} evidence artefacts - the two kinds
 * of URL a browser loads through a plain {@code <img>} tag or {@code window.open},
 * which cannot send an {@code Authorization} header. No other endpoint honours the
 * query parameter, so it can never be used to bypass a check.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String QUERY_TOKEN_PATH_SUFFIX = "/snapshot";
    private static final String QUERY_TOKEN_PATH_PREFIX = "/uploads/";

    private final JwtService jwtService;
    private final UserRepository users;

    public JwtAuthFilter(JwtService jwtService, UserRepository users) {
        this.jwtService = jwtService;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<String> token = extractToken(request);
        if (token.isPresent() && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtService.resolveUserId(token.get())
                    .flatMap(users::findById)
                    .ifPresent(user -> authenticate(user, request));
        }
        chain.doFilter(request, response);
    }

    private java.util.Optional<String> extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return java.util.Optional.of(header.substring(7).strip());
        }
        if (acceptsQueryToken(request.getRequestURI())) {
            String queryToken = request.getParameter("token");
            if (queryToken != null && !queryToken.isBlank()) {
                return java.util.Optional.of(queryToken);
            }
        }
        return java.util.Optional.empty();
    }

    /** Only browser-loaded media URLs may authenticate through the query string. */
    private static boolean acceptsQueryToken(String uri) {
        return uri != null && (uri.endsWith(QUERY_TOKEN_PATH_SUFFIX) || uri.startsWith(QUERY_TOKEN_PATH_PREFIX));
    }

    private void authenticate(User user, HttpServletRequest request) {
        String role = user.getRole() == null ? "official" : user.getRole();
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                AuthPrincipal.from(user),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
