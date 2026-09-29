package in.gov.samajdrishti.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tiny bounded TTL cache.
 *
 * <p>Used for the two AI-engine calls that sit on the hot path of every dashboard load.
 * Deliberately not a general-purpose cache: it holds at most {@code maxEntries} items and
 * drops expired ones on write, so it cannot grow without bound and never needs a
 * background sweeper.
 */
final class TtlCache<V> {

    private record Entry<V>(V value, Instant expiresAt) {
    }

    private final int maxEntries;
    private final Map<String, Entry<V>> entries = new LinkedHashMap<>();

    TtlCache(int maxEntries) {
        this.maxEntries = maxEntries;
    }

    synchronized V get(String key) {
        Entry<V> entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }

    synchronized void put(String key, V value, Duration ttl) {
        Instant now = Instant.now();
        Iterator<Map.Entry<String, Entry<V>>> iterator = entries.entrySet().iterator();
        while (iterator.hasNext()) {
            if (now.isAfter(iterator.next().getValue().expiresAt())) {
                iterator.remove();
            }
        }
        if (entries.size() >= maxEntries) {
            String oldest = entries.keySet().iterator().next();
            entries.remove(oldest);
        }
        entries.put(key, new Entry<>(value, now.plus(ttl)));
    }
}
