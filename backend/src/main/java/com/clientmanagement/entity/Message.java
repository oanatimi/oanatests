package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Message entity representing SMS messages sent to clients.
 */
@Entity
@Table(name = "\"Message\"")
public class Message extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"clientId\"", nullable = false)
    public String clientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"clientId\"", insertable = false, updatable = false)
    public Client client;

    @Column(name = "\"phoneNumber\"", nullable = false)
    public String phoneNumber;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    public String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "\"MessageStatus\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    public MessageStatus status = MessageStatus.PENDING;

    @Column(name = "\"sentAt\"")
    public LocalDateTime sentAt;

    @Column(name = "\"deliveredAt\"")
    public LocalDateTime deliveredAt;

    @Column(name = "\"errorMessage\"")
    public String errorMessage;

    @Column(name = "\"retryCount\"", nullable = false)
    public int retryCount = 0;

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
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
