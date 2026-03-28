package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * VehicleReminder entity tracking sent reminders for vehicle ITP/insurance expiry.
 */
@Entity
@Table(name = "\"VehicleReminder\"")
public class VehicleReminder extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"vehicleId\"", nullable = false)
    public String vehicleId;

    @Column(name = "\"reminderType\"", nullable = false)
    public String reminderType; // 'ITP', 'INSURANCE', 'ROVINIETA'

    @Column(name = "\"expiryDate\"", nullable = false)
    public LocalDate expiryDate;

    @Column(name = "\"sentAt\"", nullable = false)
    public LocalDateTime sentAt;

    @Column(name = "\"messageContent\"", columnDefinition = "TEXT")
    public String messageContent;

    @Column(name = "\"createdAt\"", nullable = false)
    public LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"vehicleId\"", insertable = false, updatable = false)
    public Vehicle vehicle;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (sentAt == null) {
            sentAt = now;
        }
    }
}
