package com.clientmanagement.resource;

import com.clientmanagement.dto.*;
import com.clientmanagement.entity.Vehicle;
import com.clientmanagement.entity.VehicleReminder;
import com.clientmanagement.entity.Client;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST resource for vehicle management with ITP/reminder tracking.
 */
@Path("/api/vehicles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class VehicleResource {

    private static final Logger LOG = Logger.getLogger(VehicleResource.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    /**
     * Get all vehicles with pagination and filtering.
     */
    @GET
    public Response getVehicles(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("search") String search,
            @QueryParam("itpStatus") String itpStatus, // 'expired', 'expiring_soon', 'valid', 'without_reminder'
            @QueryParam("sortBy") @DefaultValue("itpExpiryDate") String sortBy,
            @QueryParam("sortOrder") @DefaultValue("asc") String sortOrder) {

        try {
            Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder) ? Sort.Direction.Descending : Sort.Direction.Ascending;

            // Build query
            StringBuilder queryBuilder = new StringBuilder("1=1");
            Map<String, Object> params = new HashMap<>();

            if (search != null && !search.isBlank()) {
                queryBuilder.append(" AND (licensePlate LIKE :search OR brand LIKE :search OR model LIKE :search OR vin LIKE :search)");
                params.put("search", "%" + search + "%");
            }

            // Filter by ITP status
            LocalDate today = LocalDate.now();
            LocalDate thirtyDaysFromNow = today.plusDays(30);

            if ("expired".equals(itpStatus)) {
                queryBuilder.append(" AND itpExpiryDate < :today");
                params.put("today", today);
            } else if ("expiring_soon".equals(itpStatus)) {
                queryBuilder.append(" AND itpExpiryDate >= :today AND itpExpiryDate <= :thirtyDays");
                params.put("today", today);
                params.put("thirtyDays", thirtyDaysFromNow);
            } else if ("valid".equals(itpStatus)) {
                queryBuilder.append(" AND itpExpiryDate > :thirtyDays");
                params.put("thirtyDays", thirtyDaysFromNow);
            }

            String query = queryBuilder.toString();

            // Get paginated results
            long total = Vehicle.count(query, params);
            List<Vehicle> vehicles = Vehicle.find(query, Sort.by(sortBy, direction), params)
                .page(Page.of(page - 1, limit))
                .list();

            // Convert to DTOs with reminder info
            List<VehicleDto> vehicleDtos = vehicles.stream()
                .map(vehicle -> {
                    // Load reminders for this vehicle
                    List<VehicleReminder> reminders = VehicleReminder.find(
                        "vehicleId = ?1 ORDER BY sentAt DESC", vehicle.id)
                        .page(Page.of(0, 5))
                        .list();
                    return VehicleDto.fromEntityWithReminders(vehicle, reminders);
                })
                .collect(Collectors.toList());

            // If filtering by 'without_reminder', filter in Java
            if ("without_reminder".equals(itpStatus)) {
                vehicleDtos = vehicleDtos.stream()
                    .filter(v -> v.itpExpiryDate != null && 
                                 ("expired".equals(v.itpStatus) || "expiring_soon".equals(v.itpStatus)) &&
                                 !Boolean.TRUE.equals(v.hasItpReminder))
                    .collect(Collectors.toList());
                total = vehicleDtos.size();
            }

            return Response.ok(ApiResponse.success(vehicleDtos, new PaginationInfo(page, limit, total))).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching vehicles: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching vehicles"))
                .build();
        }
    }

    /**
     * Get vehicles that need ITP reminders (expiring within 30 days and no reminder sent).
     */
    @GET
    @Path("/needing-reminders")
    public Response getVehiclesNeedingReminders() {
        try {
            LocalDate today = LocalDate.now();
            LocalDate thirtyDaysFromNow = today.plusDays(30);

            // Get vehicles with ITP expiring within 30 days
            List<Vehicle> vehicles = Vehicle.find(
                "itpExpiryDate IS NOT NULL AND itpExpiryDate <= :thirtyDays ORDER BY itpExpiryDate ASC",
                Map.of("thirtyDays", thirtyDaysFromNow))
                .list();

            List<VehicleDto> vehicleDtos = vehicles.stream()
                .map(vehicle -> {
                    List<VehicleReminder> reminders = VehicleReminder.find(
                        "vehicleId = ?1 AND reminderType = 'ITP' ORDER BY sentAt DESC", vehicle.id)
                        .list();
                    return VehicleDto.fromEntityWithReminders(vehicle, reminders);
                })
                .filter(v -> !Boolean.TRUE.equals(v.hasItpReminder)) // Only those without reminder for current expiry
                .collect(Collectors.toList());

            return Response.ok(ApiResponse.success(vehicleDtos)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching vehicles needing reminders: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching vehicles"))
                .build();
        }
    }

    /**
     * Get a single vehicle with full details.
     */
    @GET
    @Path("/{id}")
    public Response getVehicle(@PathParam("id") String id) {
        try {
            Vehicle vehicle = Vehicle.findById(id);
            if (vehicle == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Vehicle not found"))
                    .build();
            }

            List<VehicleReminder> reminders = VehicleReminder.find(
                "vehicleId = ?1 ORDER BY sentAt DESC", id)
                .list();

            VehicleDto dto = VehicleDto.fromEntityWithReminders(vehicle, reminders);
            return Response.ok(ApiResponse.success(dto)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching vehicle: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching vehicle"))
                .build();
        }
    }

    /**
     * Create a new vehicle.
     */
    @POST
    @Transactional
    public Response createVehicle(VehicleDto vehicleData) {
        try {
            Vehicle vehicle = new Vehicle();
            vehicle.licensePlate = vehicleData.licensePlate;
            vehicle.brand = vehicleData.brand;
            vehicle.model = vehicleData.model;
            vehicle.vin = vehicleData.vin;
            vehicle.clientId = vehicleData.clientId;
            vehicle.itpExpiryDate = vehicleData.itpExpiryDate;
            vehicle.insuranceExpiryDate = vehicleData.insuranceExpiryDate;
            vehicle.rovinietaExpiryDate = vehicleData.rovinietaExpiryDate;
            vehicle.observations = vehicleData.observations;
            vehicle.persist();

            return Response.status(Response.Status.CREATED)
                .entity(ApiResponse.success(VehicleDto.fromEntity(vehicle), "Vehicle created successfully."))
                .build();
        } catch (Exception e) {
            LOG.errorf("Error creating vehicle: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error creating vehicle"))
                .build();
        }
    }

    /**
     * Update a vehicle.
     */
    @PUT
    @Path("/{id}")
    @Transactional
    public Response updateVehicle(@PathParam("id") String id, VehicleDto updateData) {
        try {
            Vehicle vehicle = Vehicle.findById(id);
            if (vehicle == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Vehicle not found"))
                    .build();
            }

            if (updateData.licensePlate != null) vehicle.licensePlate = updateData.licensePlate;
            if (updateData.brand != null) vehicle.brand = updateData.brand;
            if (updateData.model != null) vehicle.model = updateData.model;
            if (updateData.vin != null) vehicle.vin = updateData.vin;
            if (updateData.clientId != null) vehicle.clientId = updateData.clientId;
            if (updateData.itpExpiryDate != null) vehicle.itpExpiryDate = updateData.itpExpiryDate;
            if (updateData.insuranceExpiryDate != null) vehicle.insuranceExpiryDate = updateData.insuranceExpiryDate;
            if (updateData.rovinietaExpiryDate != null) vehicle.rovinietaExpiryDate = updateData.rovinietaExpiryDate;
            if (updateData.observations != null) vehicle.observations = updateData.observations;

            vehicle.updatedAt = LocalDateTime.now();
            vehicle.persist();

            return Response.ok(ApiResponse.success(VehicleDto.fromEntity(vehicle), "Vehicle updated successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error updating vehicle: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error updating vehicle"))
                .build();
        }
    }

    /**
     * Delete a vehicle.
     */
    @DELETE
    @Path("/{id}")
    @Transactional
    public Response deleteVehicle(@PathParam("id") String id) {
        try {
            Vehicle vehicle = Vehicle.findById(id);
            if (vehicle == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Vehicle not found"))
                    .build();
            }

            vehicle.delete();
            return Response.ok(ApiResponse.success(null, "Vehicle deleted successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error deleting vehicle: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error deleting vehicle"))
                .build();
        }
    }

    /**
     * Send ITP reminder for a vehicle - records the reminder and returns the message to send.
     */
    @POST
    @Path("/{id}/send-reminder")
    @Transactional
    public Response sendItpReminder(@PathParam("id") String id, SendVehicleReminderRequest request) {
        try {
            Vehicle vehicle = Vehicle.findById(id);
            if (vehicle == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Vehicle not found"))
                    .build();
            }

            if (vehicle.itpExpiryDate == null) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Vehicle has no ITP expiry date set"))
                    .build();
            }

            String reminderType = request != null && request.reminderType != null ? request.reminderType : "ITP";
            LocalDate expiryDate = vehicle.itpExpiryDate;

            // Generate message content
            String messageContent;
            if (request != null && request.messageContent != null && !request.messageContent.isBlank()) {
                messageContent = request.messageContent;
            } else {
                String formattedDate = expiryDate.format(DATE_FORMATTER);
                long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), expiryDate);
                
                // Build vehicle description string without extra spaces
                String vehicleDesc = buildVehicleDescription(vehicle.brand, vehicle.model, vehicle.licensePlate);
                
                if (daysUntil < 0) {
                    messageContent = String.format(
                        "Atenție! ITP-ul vehiculului %s a expirat pe %s. Vă rugăm să efectuați inspecția tehnică periodică cât mai curând.",
                        vehicleDesc,
                        formattedDate
                    );
                } else {
                    messageContent = String.format(
                        "Vă informăm că ITP-ul vehiculului %s expiră pe %s (în %d zile). Vă rugăm să programați inspecția tehnică periodică.",
                        vehicleDesc,
                        formattedDate,
                        daysUntil
                    );
                }
            }

            // Create reminder record
            VehicleReminder reminder = new VehicleReminder();
            reminder.vehicleId = vehicle.id;
            reminder.reminderType = reminderType;
            reminder.expiryDate = expiryDate;
            reminder.messageContent = messageContent;
            reminder.sentAt = LocalDateTime.now();
            reminder.persist();

            // Return the reminder info
            Map<String, Object> result = new HashMap<>();
            result.put("reminder", VehicleReminderDto.fromEntity(reminder));
            result.put("messageContent", messageContent);
            result.put("vehicleLicensePlate", vehicle.licensePlate);

            // If there's a client with phone, include that info
            if (vehicle.clientId != null) {
                Client client = Client.findById(vehicle.clientId);
                if (client != null && client.phonePrimary != null) {
                    result.put("clientName", client.companyName);
                    result.put("clientPhone", client.phonePrimary);
                }
            }

            return Response.ok(ApiResponse.success(result, "ITP reminder sent and recorded successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error sending ITP reminder: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error sending reminder"))
                .build();
        }
    }

    /**
     * Get reminder history for a vehicle.
     */
    @GET
    @Path("/{id}/reminders")
    public Response getVehicleReminders(@PathParam("id") String id) {
        try {
            Vehicle vehicle = Vehicle.findById(id);
            if (vehicle == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Vehicle not found"))
                    .build();
            }

            List<VehicleReminder> reminders = VehicleReminder.find(
                "vehicleId = ?1 ORDER BY sentAt DESC", id)
                .list();

            List<VehicleReminderDto> reminderDtos = reminders.stream()
                .map(VehicleReminderDto::fromEntity)
                .collect(Collectors.toList());

            return Response.ok(ApiResponse.success(reminderDtos)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching vehicle reminders: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching reminders"))
                .build();
        }
    }

    /**
     * Build a vehicle description string without extra spaces.
     */
    private String buildVehicleDescription(String brand, String model, String licensePlate) {
        StringBuilder sb = new StringBuilder();
        if (brand != null && !brand.isBlank()) {
            sb.append(brand);
        }
        if (model != null && !model.isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(model);
        }
        if (sb.length() > 0) {
            sb.append(" (").append(licensePlate).append(")");
        } else {
            sb.append(licensePlate);
        }
        return sb.toString();
    }
}
