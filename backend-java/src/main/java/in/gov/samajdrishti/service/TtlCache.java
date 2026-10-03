package in.gov.samajdrishti.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Tiny bounded TTL cache with LRU eviction.
 *
 * <p>Used for the two AI-engine calls that sit on the hot path of every dashboard load.
 * Deliberately not a general-purpose cache: it holds at most {@code maxEntries} items,
 * maintains least-recently-used access ordering, and drops expired entries on write and read,
 * so it cannot grow without bound and never needs a background sweeper.
 */
public final class TtlCache<V> {

    private record Entry<V>(V value, Instant expiresAt) {
    }

    private final int maxEntries;
    private final Clock clock;
    private final Map<String, Entry<V>> entries;

    public TtlCache(int maxEntries) {
        this(maxEntries, Clock.systemUTC());
    }

    public TtlCache(int maxEntries, Clock clock) {
        this.maxEntries = Math.max(1, maxEntries);
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
        // true activates access-order (LRU) rather than insertion-order
        this.entries = new LinkedHashMap<>(this.maxEntries, 0.75f, true);
    }

    public synchronized V get(String key) {
        if (key == null) {
            return null;
        }
        Entry<V> entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (clock.instant().isAfter(entry.expiresAt())) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }

    public synchronized void put(String key, V value, Duration ttl) {
        if (key == null || value == null || ttl == null) {
            return;
        }
        Instant now = clock.instant();
        entries.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        if (entries.size() >= maxEntries && !entries.containsKey(key)) {
            String lruKey = entries.keySet().iterator().next();
            entries.remove(lruKey);
        }
        entries.put(key, new Entry<>(value, now.plus(ttl)));
    }

    public synchronized int size() {
        return entries.size();
    }

    public synchronized void clear() {
        entries.clear();
    }
}
