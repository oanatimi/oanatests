package com.clientmanagement.dto;

import java.time.LocalDate;

/**
 * Request DTO for sending vehicle ITP reminder.
 */
public class SendVehicleReminderRequest {
    public String vehicleId;
    public String reminderType; // 'ITP', 'INSURANCE', 'ROVINIETA'
    public String messageContent; // Optional custom message
}
