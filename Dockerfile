# Backend Dockerfile for Railway deployment from monorepo root
# Uses Java/Quarkus backend

FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy backend pom.xml for dependency caching
COPY backend/pom.xml .

# Download dependencies (cached layer)
RUN mvn -B -DskipTests dependency:go-offline

# Copy backend source code
COPY backend/src ./src

# Build the application
RUN mvn clean package -DskipTests

# Production stage
FROM eclipse-temurin:21-jre
WORKDIR /work

# Copy the entire quarkus-app directory structure
COPY --from=build /app/target/quarkus-app/ /work/

# Note: Railway assigns PORT dynamically at runtime
# Quarkus will use the PORT env var via ${PORT:8080} in application.properties
EXPOSE 8080

# Start the application
# Uses JAVA_OPTS environment variable for JVM configuration
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /work/quarkus-run.jar"]
