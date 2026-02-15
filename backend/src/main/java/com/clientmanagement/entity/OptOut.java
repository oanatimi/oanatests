package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * OptOut entity for tracking phone numbers that have opted out of receiving messages.
 */
@Entity
@Table(name = "\"OptOut\"")
public class OptOut extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"phoneNumber\"", nullable = false, unique = true)
    public String phoneNumber;

    @Column(name = "reason")
    public String reason;

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
