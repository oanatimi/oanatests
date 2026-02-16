package com.clientmanagement.dto;

import com.clientmanagement.entity.Vehicle;
import com.clientmanagement.entity.VehicleReminder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

/**
 * DTO for Vehicle entity.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VehicleDto {
    public String id;
    public String clientId;
    public String licensePlate;
    public String brand;
    public String model;
    public String vin;
    public LocalDate itpExpiryDate;
    public LocalDate insuranceExpiryDate;
    public LocalDate rovinietaExpiryDate;
    public String observations;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    // Computed fields for ITP status
    public String itpStatus; // 'expired', 'expiring_soon', 'valid', 'unknown'
    public Long daysUntilItpExpiry;
    public Boolean hasItpReminder; // Whether a reminder has been sent for current expiry date
    public LocalDateTime lastItpReminderSentAt;

    // Client info when loaded
    public String clientName;
    public String clientPhone;

    // Recent reminders
    public List<VehicleReminderDto> recentReminders;

    public static VehicleDto fromEntity(Vehicle vehicle) {
        VehicleDto dto = new VehicleDto();
        dto.id = vehicle.id;
        dto.clientId = vehicle.clientId;
        dto.licensePlate = vehicle.licensePlate;
        dto.brand = vehicle.brand;
        dto.model = vehicle.model;
        dto.vin = vehicle.vin;
        dto.itpExpiryDate = vehicle.itpExpiryDate;
        dto.insuranceExpiryDate = vehicle.insuranceExpiryDate;
        dto.rovinietaExpiryDate = vehicle.rovinietaExpiryDate;
        dto.observations = vehicle.observations;
        dto.createdAt = vehicle.createdAt;
        dto.updatedAt = vehicle.updatedAt;

        // Calculate ITP status
        dto.calculateItpStatus();

        return dto;
    }

    public static VehicleDto fromEntityWithClient(Vehicle vehicle) {
        VehicleDto dto = fromEntity(vehicle);
        if (vehicle.client != null) {
            dto.clientName = vehicle.client.companyName;
            dto.clientPhone = vehicle.client.phonePrimary;
        }
        return dto;
    }

    public static VehicleDto fromEntityWithReminders(Vehicle vehicle, List<VehicleReminder> reminders) {
        VehicleDto dto = fromEntityWithClient(vehicle);

        if (reminders != null && !reminders.isEmpty()) {
            dto.recentReminders = reminders.stream()
                .map(VehicleReminderDto::fromEntity)
                .collect(Collectors.toList());

            // Check if there's an ITP reminder for current expiry date
            if (vehicle.itpExpiryDate != null) {
                dto.hasItpReminder = reminders.stream()
                    .anyMatch(r -> "ITP".equals(r.reminderType) && 
                                   vehicle.itpExpiryDate.equals(r.expiryDate));

                // Get last ITP reminder sent date
                reminders.stream()
                    .filter(r -> "ITP".equals(r.reminderType))
                    .max((r1, r2) -> r1.sentAt.compareTo(r2.sentAt))
                    .ifPresent(r -> dto.lastItpReminderSentAt = r.sentAt);
            } else {
                dto.hasItpReminder = false;
            }
        } else {
            dto.hasItpReminder = false;
        }

        return dto;
    }

    private void calculateItpStatus() {
        if (itpExpiryDate == null) {
            itpStatus = "unknown";
            daysUntilItpExpiry = null;
            return;
        }

        LocalDate today = LocalDate.now();
        long days = ChronoUnit.DAYS.between(today, itpExpiryDate);
        daysUntilItpExpiry = days;

        if (days < 0) {
            itpStatus = "expired";
        } else if (days <= 30) {
            itpStatus = "expiring_soon";
        } else {
            itpStatus = "valid";
        }
    }
}
