package com.clientmanagement.resource;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.HealthCheckResponseBuilder;
import org.eclipse.microprofile.health.Readiness;
import jakarta.persistence.EntityManager;
import org.jboss.logging.Logger;

/**
 * Health check for database connectivity.
 */
@Readiness
@ApplicationScoped
public class DatabaseHealthCheck implements HealthCheck {

    private static final Logger LOG = Logger.getLogger(DatabaseHealthCheck.class);

    @Inject
    EntityManager entityManager;

    @Override
    public HealthCheckResponse call() {
        HealthCheckResponseBuilder builder = HealthCheckResponse.named("Database connection");

        try {
            // Test database connectivity
            entityManager.createNativeQuery("SELECT 1").getSingleResult();
            
            // Check required tables
            String[] requiredTables = {"Client", "Message", "MessageQueue", "MessageTemplate", "OptOut", "SystemConfig"};
            boolean allTablesExist = true;
            
            for (String table : requiredTables) {
                try {
                    Long count = ((Number) entityManager.createNativeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '" + table + "'"
                    ).getSingleResult()).longValue();
                    
                    if (count == 0) {
                        allTablesExist = false;
                        builder.withData(table, "MISSING");
                    } else {
                        builder.withData(table, "OK");
                    }
                } catch (Exception e) {
                    allTablesExist = false;
                    builder.withData(table, "ERROR");
                }
            }

            builder.withData("connected", true);
            builder.withData("tablesExist", allTablesExist);

            return builder.up().build();
        } catch (Exception e) {
            LOG.errorf("Database health check failed: %s", e.getMessage());
            return builder
                .withData("connected", false)
                .withData("error", e.getMessage())
                .down()
                .build();
        }
    }
}
