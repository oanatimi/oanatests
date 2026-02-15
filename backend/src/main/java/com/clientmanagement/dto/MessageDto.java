package com.clientmanagement.dto;

import com.clientmanagement.entity.Message;
import com.clientmanagement.entity.MessageStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;

/**
 * Message DTO with optional client information.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageDto {
    public String id;
    public String clientId;
    public String phoneNumber;
    public String content;
    public MessageStatus status;
    public LocalDateTime sentAt;
    public LocalDateTime deliveredAt;
    public String errorMessage;
    public int retryCount;
    public LocalDateTime createdAt;
    public ClientInfo client;

    public static class ClientInfo {
        public String id;
        public String companyName;
        public String phonePrimary;

        public ClientInfo() {}

        public ClientInfo(String id, String companyName, String phonePrimary) {
            this.id = id;
            this.companyName = companyName;
            this.phonePrimary = phonePrimary;
        }
    }

    public static MessageDto fromEntity(Message message) {
        MessageDto dto = new MessageDto();
        dto.id = message.id;
        dto.clientId = message.clientId;
        dto.phoneNumber = message.phoneNumber;
        dto.content = message.content;
        dto.status = message.status;
        dto.sentAt = message.sentAt;
        dto.deliveredAt = message.deliveredAt;
        dto.errorMessage = message.errorMessage;
        dto.retryCount = message.retryCount;
        dto.createdAt = message.createdAt;
        return dto;
    }

    public static MessageDto fromEntityWithClient(Message message) {
        MessageDto dto = fromEntity(message);
        if (message.client != null) {
            dto.client = new ClientInfo(
                message.client.id,
                message.client.companyName,
                message.client.phonePrimary
            );
        }
        return dto;
    }
}
