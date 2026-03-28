package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Vehicle entity representing vehicles with ITP/insurance tracking.
 */
@Entity
@Table(name = "\"Vehicle\"")
public class Vehicle extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"clientId\"")
    public String clientId;

    @Column(name = "\"licensePlate\"", nullable = false)
    public String licensePlate;

    @Column(name = "brand")
    public String brand;

    @Column(name = "model")
    public String model;

    @Column(name = "vin")
    public String vin;

    @Column(name = "\"itpExpiryDate\"")
    public LocalDate itpExpiryDate;

    @Column(name = "\"insuranceExpiryDate\"")
    public LocalDate insuranceExpiryDate;

    @Column(name = "\"rovinietaExpiryDate\"")
    public LocalDate rovinietaExpiryDate;

    @Column(name = "observations", columnDefinition = "TEXT")
    public String observations;

    @Column(name = "\"createdAt\"", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "\"updatedAt\"", nullable = false)
    public LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"clientId\"", insertable = false, updatable = false)
    public Client client;

    @OneToMany(mappedBy = "vehicle", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<VehicleReminder> reminders;

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
