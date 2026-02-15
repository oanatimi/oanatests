package com.clientmanagement.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Client entity representing companies in the CRM system.
 */
@Entity
@Table(name = "\"Client\"")
public class Client extends PanacheEntityBase {

    @Id
    @Column(name = "id")
    public String id;

    @Column(name = "\"companyName\"", nullable = false)
    public String companyName;

    @Column(name = "status")
    public String status;

    @Column(name = "category")
    public String category;

    @Column(name = "cui")
    public String cui;

    @Column(name = "\"registrationNumber\"")
    public String registrationNumber;

    @Column(name = "\"caenCode\"")
    public String caenCode;

    @Column(name = "\"caenSection\"")
    public String caenSection;

    @Column(name = "\"caenDivision\"")
    public String caenDivision;

    @Column(name = "\"caenGroup\"")
    public String caenGroup;

    @Column(name = "county")
    public String county;

    @Column(name = "locality")
    public String locality;

    @Column(name = "address")
    public String address;

    @Column(name = "\"postalCode\"")
    public String postalCode;

    @Column(name = "revenue")
    public Double revenue;

    @Column(name = "\"netProfit\"")
    public Double netProfit;

    @Column(name = "\"vatPayer\"")
    public Boolean vatPayer;

    @Column(name = "\"revenue2023\"")
    public Double revenue2023;

    @Column(name = "\"revenue2022\"")
    public Double revenue2022;

    @Column(name = "\"profit2023\"")
    public Double profit2023;

    @Column(name = "\"profit2022\"")
    public Double profit2022;

    @Column(name = "\"receivables2023\"")
    public Double receivables2023;

    @Column(name = "\"equity2023\"")
    public Double equity2023;

    @Column(name = "employees")
    public Integer employees;

    @Column(name = "\"foundingYear\"")
    public Integer foundingYear;

    @Column(name = "\"phoneVerified\"")
    public String phoneVerified;

    @Column(name = "\"phonePrimary\"")
    public String phonePrimary;

    @Column(name = "\"phoneSecondary\"")
    public String phoneSecondary;

    @Column(name = "\"phoneContact\"")
    public String phoneContact;

    @Column(name = "\"phoneMarketing\"")
    public String phoneMarketing;

    @Column(name = "\"phoneWebsite\"")
    public String phoneWebsite;

    @Column(name = "\"emailPrimary\"")
    public String emailPrimary;

    @Column(name = "\"emailSecondary\"")
    public String emailSecondary;

    @Column(name = "\"emailMarketing\"")
    public String emailMarketing;

    @Column(name = "\"emailWebsite\"")
    public String emailWebsite;

    @Column(name = "\"emailContact\"")
    public String emailContact;

    @Column(name = "websites")
    public String websites;

    @Column(name = "administrator")
    public String administrator;

    @Column(name = "\"contactPerson\"")
    public String contactPerson;

    @Column(name = "\"contactDate\"")
    public LocalDateTime contactDate;

    @Column(name = "\"dealId\"")
    public String dealId;

    @Column(name = "observations", columnDefinition = "TEXT")
    public String observations;

    @Column(name = "\"sourceFile\"")
    public String sourceFile;

    @Column(name = "\"sourceSheet\"")
    public String sourceSheet;

    @Column(name = "\"importedAt\"", nullable = false)
    public LocalDateTime importedAt;

    @Column(name = "\"createdAt\"", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "\"updatedAt\"", nullable = false)
    public LocalDateTime updatedAt;

    @OneToMany(mappedBy = "client", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<Message> messages;

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
        if (importedAt == null) {
            importedAt = now;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Helper method to get the primary phone number for messaging
    public String getEffectivePhoneNumber() {
        if (phonePrimary != null && !phonePrimary.isBlank()) {
            return phonePrimary;
        }
        return phoneContact;
    }
}
