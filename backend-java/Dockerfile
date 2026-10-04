# Java Backend Dockerfile for Samaj Drishti API
# Multi-stage build for optimized image size

# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and package JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy JAR from builder stage
COPY --from=builder /app/target/samaj-drishti-api.jar app.jar

# Create necessary directories
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://localhost:5000/api/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]