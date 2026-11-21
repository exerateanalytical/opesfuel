# Stage 1: Build Spring Boot Fat JAR with JDK 25
FROM maven:3.9-eclipse-temurin-25 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# Stage 2: Minimal hardened JRE 25 runtime for VPS deployment
FROM eclipse-temurin:25-jre-alpine
RUN addgroup -S opesfuel && adduser -S opesfuel -G opesfuel && apk add --no-cache curl
WORKDIR /app
COPY --from=builder /build/target/opesfuel-platform-*.jar /app/opesfuel-platform.jar
USER opesfuel
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -sf http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/opesfuel-platform.jar"]
