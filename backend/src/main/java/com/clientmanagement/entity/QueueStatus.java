package com.clientmanagement.entity;

/**
 * Queue status enumeration matching PostgreSQL enum
 */
public enum QueueStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED,
    DEAD_LETTER
}
