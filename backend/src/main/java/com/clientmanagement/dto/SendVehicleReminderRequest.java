package com.clientmanagement.dto;

/**
 * Request DTO for sending vehicle ITP reminder.
 */
public class SendVehicleReminderRequest {
    public String reminderType; // 'ITP', 'INSURANCE', 'ROVINIETA'
    public String messageContent; // Optional custom message
}
