FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /work
# Copy the entire quarkus-app directory structure
COPY --from=build /app/target/quarkus-app/ /work/
EXPOSE 8080
ENTRYPOINT ["java","-jar","/work/quarkus-run.jar"]
