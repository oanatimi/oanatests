package com.clientmanagement.dto;

import com.clientmanagement.entity.VehicleReminder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for VehicleReminder entity.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VehicleReminderDto {
    public String id;
    public String vehicleId;
    public String reminderType;
    public LocalDate expiryDate;
    public LocalDateTime sentAt;
    public String messageContent;
    public LocalDateTime createdAt;

    public static VehicleReminderDto fromEntity(VehicleReminder reminder) {
        VehicleReminderDto dto = new VehicleReminderDto();
        dto.id = reminder.id;
        dto.vehicleId = reminder.vehicleId;
        dto.reminderType = reminder.reminderType;
        dto.expiryDate = reminder.expiryDate;
        dto.sentAt = reminder.sentAt;
        dto.messageContent = reminder.messageContent;
        dto.createdAt = reminder.createdAt;
        return dto;
    }
}
