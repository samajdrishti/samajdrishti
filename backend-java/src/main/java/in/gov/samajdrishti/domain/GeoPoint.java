package in.gov.samajdrishti.domain;

import java.io.IOException;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * A latitude/longitude pair.
 *
 * <p>Stored as two plain {@code DOUBLE} columns instead of a PostgreSQL {@code POINT}
 * so the identical schema and identical queries work on both PostgreSQL and the
 * in-memory H2 database. Serialised as {@code {"lat":..,"lng":..}} - or as JSON
 * {@code null} when no coordinate was captured, which is what the web clients test
 * for with {@code row.geo_coords ? ...}.
 */
@Embeddable
@JsonSerialize(using = GeoPoint.GeoPointSerializer.class)
public class GeoPoint {

    private Double lat;
    private Double lng;

    public GeoPoint() {
    }

    public GeoPoint(Double lat, Double lng) {
        this.lat = lat;
        this.lng = lng;
    }

    public static GeoPoint of(Number lat, Number lng) {
        if (lat == null || lng == null) {
            return null;
        }
        return new GeoPoint(lat.doubleValue(), lng.doubleValue());
    }

    public boolean isPresent() {
        return lat != null && lng != null;
    }

    @Column(name = "geo_lat")
    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    @Column(name = "geo_lng")
    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }

    @Override
    public String toString() {
        return isPresent() ? "(%s,%s)".formatted(lat, lng) : "null";
    }

    /** Collapses an absent coordinate pair to JSON {@code null}. */
    public static class GeoPointSerializer extends JsonSerializer<GeoPoint> {
        @Override
        public void serialize(GeoPoint value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
            if (value == null || !value.isPresent()) {
                gen.writeNull();
                return;
            }
            gen.writeStartObject();
            gen.writeNumberField("lat", value.getLat());
            gen.writeNumberField("lng", value.getLng());
            gen.writeEndObject();
        }
    }
}
