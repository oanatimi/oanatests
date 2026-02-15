package com.clientmanagement.dto;

import java.util.List;

/**
 * Request DTO for sending bulk messages.
 */
public class BulkMessageRequest {
    public List<String> clientIds;
    public String content;
}
