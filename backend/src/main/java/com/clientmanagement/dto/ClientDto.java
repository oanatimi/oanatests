package com.clientmanagement.dto;

import com.clientmanagement.entity.Client;
import com.clientmanagement.entity.Message;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Client DTO with optional message count and messages.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClientDto {
    public String id;
    public String companyName;
    public String status;
    public String category;
    public String cui;
    public String registrationNumber;
    public String caenCode;
    public String caenSection;
    public String caenDivision;
    public String caenGroup;
    public String county;
    public String locality;
    public String address;
    public String postalCode;
    public Double revenue;
    public Double netProfit;
    public Boolean vatPayer;
    public Double revenue2023;
    public Double revenue2022;
    public Double profit2023;
    public Double profit2022;
    public Double receivables2023;
    public Double equity2023;
    public Integer employees;
    public Integer foundingYear;
    public String phoneVerified;
    public String phonePrimary;
    public String phoneSecondary;
    public String phoneContact;
    public String phoneMarketing;
    public String phoneWebsite;
    public String emailPrimary;
    public String emailSecondary;
    public String emailMarketing;
    public String emailWebsite;
    public String emailContact;
    public String websites;
    public String administrator;
    public String contactPerson;
    public LocalDateTime contactDate;
    public String dealId;
    public String observations;
    public String sourceFile;
    public String sourceSheet;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public MessageCount _count;
    public List<MessageDto> messages;

    public static class MessageCount {
        public int messages;

        public MessageCount() {}

        public MessageCount(int messages) {
            this.messages = messages;
        }
    }

    public static ClientDto fromEntity(Client client) {
        ClientDto dto = new ClientDto();
        dto.id = client.id;
        dto.companyName = client.companyName;
        dto.status = client.status;
        dto.category = client.category;
        dto.cui = client.cui;
        dto.registrationNumber = client.registrationNumber;
        dto.caenCode = client.caenCode;
        dto.caenSection = client.caenSection;
        dto.caenDivision = client.caenDivision;
        dto.caenGroup = client.caenGroup;
        dto.county = client.county;
        dto.locality = client.locality;
        dto.address = client.address;
        dto.postalCode = client.postalCode;
        dto.revenue = client.revenue;
        dto.netProfit = client.netProfit;
        dto.vatPayer = client.vatPayer;
        dto.revenue2023 = client.revenue2023;
        dto.revenue2022 = client.revenue2022;
        dto.profit2023 = client.profit2023;
        dto.profit2022 = client.profit2022;
        dto.receivables2023 = client.receivables2023;
        dto.equity2023 = client.equity2023;
        dto.employees = client.employees;
        dto.foundingYear = client.foundingYear;
        dto.phoneVerified = client.phoneVerified;
        dto.phonePrimary = client.phonePrimary;
        dto.phoneSecondary = client.phoneSecondary;
        dto.phoneContact = client.phoneContact;
        dto.phoneMarketing = client.phoneMarketing;
        dto.phoneWebsite = client.phoneWebsite;
        dto.emailPrimary = client.emailPrimary;
        dto.emailSecondary = client.emailSecondary;
        dto.emailMarketing = client.emailMarketing;
        dto.emailWebsite = client.emailWebsite;
        dto.emailContact = client.emailContact;
        dto.websites = client.websites;
        dto.administrator = client.administrator;
        dto.contactPerson = client.contactPerson;
        dto.contactDate = client.contactDate;
        dto.dealId = client.dealId;
        dto.observations = client.observations;
        dto.sourceFile = client.sourceFile;
        dto.sourceSheet = client.sourceSheet;
        dto.createdAt = client.createdAt;
        dto.updatedAt = client.updatedAt;
        return dto;
    }

    public static ClientDto fromEntityWithCount(Client client, int messageCount) {
        ClientDto dto = fromEntity(client);
        dto._count = new MessageCount(messageCount);
        return dto;
    }

    public static ClientDto fromEntityWithMessages(Client client, List<Message> messages) {
        ClientDto dto = fromEntity(client);
        dto.messages = messages.stream()
            .map(MessageDto::fromEntity)
            .collect(Collectors.toList());
        return dto;
    }
}
