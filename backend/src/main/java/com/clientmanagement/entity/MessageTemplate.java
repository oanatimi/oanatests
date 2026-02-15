package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * MessageTemplate entity for storing reusable message templates.
 */
@Entity
@Table(name = "\"MessageTemplate\"")
public class MessageTemplate extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "name", nullable = false, unique = true)
    public String name;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    public String content;

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
