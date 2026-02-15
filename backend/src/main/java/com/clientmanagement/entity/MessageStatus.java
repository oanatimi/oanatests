package com.clientmanagement.entity;

/**
 * Message status enumeration matching PostgreSQL enum
 */
public enum MessageStatus {
    PENDING,
    QUEUED,
    SENDING,
    SENT,
    DELIVERED,
    FAILED
}
