package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * MessageQueue entity for managing SMS sending queue.
 */
@Entity
@Table(name = "\"MessageQueue\"")
public class MessageQueue extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"messageId\"", nullable = false, unique = true)
    public String messageId;

    @Column(name = "priority", nullable = false)
    public int priority = 0;

    @Column(name = "attempts", nullable = false)
    public int attempts = 0;

    @Column(name = "\"maxAttempts\"", nullable = false)
    public int maxAttempts = 5;

    @Column(name = "\"nextRetry\"", nullable = false)
    public LocalDateTime nextRetry;

    @Column(name = "\"lastError\"")
    public String lastError;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "\"QueueStatus\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    public QueueStatus status = QueueStatus.PENDING;

    @Column(name = "\"createdAt\"", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "\"updatedAt\"", nullable = false)
    public LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (nextRetry == null) {
            nextRetry = now;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
