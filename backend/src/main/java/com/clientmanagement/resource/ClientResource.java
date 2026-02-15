package com.clientmanagement.resource;

import com.clientmanagement.dto.ApiResponse;
import com.clientmanagement.dto.ClientDto;
import com.clientmanagement.dto.PaginationInfo;
import com.clientmanagement.entity.Client;
import com.clientmanagement.entity.Message;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST resource for client management.
 */
@Path("/api/clients")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ClientResource {

    private static final Logger LOG = Logger.getLogger(ClientResource.class);

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
        "companyName", "county", "createdAt", "updatedAt", "category", "administrator"
    );

    /**
     * Get all clients with pagination and filtering.
     */
    @GET
    public Response getClients(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("search") String search,
            @QueryParam("county") String county,
            @QueryParam("category") String category,
            @QueryParam("sortBy") @DefaultValue("companyName") String sortBy,
            @QueryParam("sortOrder") @DefaultValue("asc") String sortOrder) {

        try {
            // Validate sort field
            String sortField = ALLOWED_SORT_FIELDS.contains(sortBy) ? sortBy : "companyName";
            Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder) ? Sort.Direction.Descending : Sort.Direction.Ascending;

            // Build query
            StringBuilder queryBuilder = new StringBuilder("1=1");
            Map<String, Object> params = new HashMap<>();

            if (search != null && !search.isBlank()) {
                queryBuilder.append(" AND (companyName LIKE :search OR cui LIKE :search OR caenCode LIKE :search OR phonePrimary LIKE :search OR emailPrimary LIKE :search OR administrator LIKE :search OR observations LIKE :search)");
                params.put("search", "%" + search + "%");
            }

            if (county != null && !county.isBlank()) {
                queryBuilder.append(" AND county = :county");
                params.put("county", county);
            }

            if (category != null && !category.isBlank()) {
                queryBuilder.append(" AND category = :category");
                params.put("category", category);
            }

            String query = queryBuilder.toString();

            // Get paginated results
            long total = Client.count(query, params);
            List<Client> clients = Client.find(query, Sort.by(sortField, direction), params)
                .page(Page.of(page - 1, limit))
                .list();

            // Convert to DTOs with message count
            List<ClientDto> clientDtos = clients.stream()
                .map(client -> {
                    int messageCount = (int) Message.count("clientId", client.id);
                    return ClientDto.fromEntityWithCount(client, messageCount);
                })
                .collect(Collectors.toList());

            return Response.ok(ApiResponse.success(clientDtos, new PaginationInfo(page, limit, total))).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching clients: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching clients"))
                .build();
        }
    }

    /**
     * Get distinct counties for filtering.
     */
    @GET
    @Path("/counties")
    public Response getCounties() {
        try {
            List<String> counties = Client.find("SELECT DISTINCT c.county FROM Client c WHERE c.county IS NOT NULL ORDER BY c.county")
                .project(String.class)
                .list();
            return Response.ok(ApiResponse.success(counties)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching counties: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching counties"))
                .build();
        }
    }

    /**
     * Get distinct categories for filtering.
     */
    @GET
    @Path("/categories")
    public Response getCategories() {
        try {
            List<String> categories = Client.find("SELECT DISTINCT c.category FROM Client c WHERE c.category IS NOT NULL ORDER BY c.category")
                .project(String.class)
                .list();
            return Response.ok(ApiResponse.success(categories)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching categories: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching categories"))
                .build();
        }
    }

    /**
     * Get a single client with message history.
     */
    @GET
    @Path("/{id}")
    public Response getClient(@PathParam("id") String id) {
        try {
            Client client = Client.findById(id);
            if (client == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Client not found"))
                    .build();
            }

            List<Message> messages = Message.find("clientId = ?1 ORDER BY createdAt DESC", id)
                .page(Page.of(0, 50))
                .list();

            ClientDto dto = ClientDto.fromEntityWithMessages(client, messages);
            return Response.ok(ApiResponse.success(dto)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching client: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching client"))
                .build();
        }
    }

    /**
     * Update a client.
     */
    @PUT
    @Path("/{id}")
    @Transactional
    public Response updateClient(@PathParam("id") String id, ClientDto updateData) {
        try {
            Client client = Client.findById(id);
            if (client == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Client not found"))
                    .build();
            }

            // Update allowed fields
            if (updateData.companyName != null) client.companyName = updateData.companyName;
            if (updateData.status != null) client.status = updateData.status;
            if (updateData.category != null) client.category = updateData.category;
            if (updateData.cui != null) client.cui = updateData.cui;
            if (updateData.registrationNumber != null) client.registrationNumber = updateData.registrationNumber;
            if (updateData.caenCode != null) client.caenCode = updateData.caenCode;
            if (updateData.caenSection != null) client.caenSection = updateData.caenSection;
            if (updateData.caenDivision != null) client.caenDivision = updateData.caenDivision;
            if (updateData.caenGroup != null) client.caenGroup = updateData.caenGroup;
            if (updateData.county != null) client.county = updateData.county;
            if (updateData.locality != null) client.locality = updateData.locality;
            if (updateData.address != null) client.address = updateData.address;
            if (updateData.postalCode != null) client.postalCode = updateData.postalCode;
            if (updateData.revenue != null) client.revenue = updateData.revenue;
            if (updateData.netProfit != null) client.netProfit = updateData.netProfit;
            if (updateData.vatPayer != null) client.vatPayer = updateData.vatPayer;
            if (updateData.revenue2023 != null) client.revenue2023 = updateData.revenue2023;
            if (updateData.revenue2022 != null) client.revenue2022 = updateData.revenue2022;
            if (updateData.profit2023 != null) client.profit2023 = updateData.profit2023;
            if (updateData.profit2022 != null) client.profit2022 = updateData.profit2022;
            if (updateData.receivables2023 != null) client.receivables2023 = updateData.receivables2023;
            if (updateData.equity2023 != null) client.equity2023 = updateData.equity2023;
            if (updateData.employees != null) client.employees = updateData.employees;
            if (updateData.foundingYear != null) client.foundingYear = updateData.foundingYear;
            if (updateData.phoneVerified != null) client.phoneVerified = updateData.phoneVerified;
            if (updateData.phonePrimary != null) client.phonePrimary = updateData.phonePrimary;
            if (updateData.phoneSecondary != null) client.phoneSecondary = updateData.phoneSecondary;
            if (updateData.phoneContact != null) client.phoneContact = updateData.phoneContact;
            if (updateData.phoneMarketing != null) client.phoneMarketing = updateData.phoneMarketing;
            if (updateData.phoneWebsite != null) client.phoneWebsite = updateData.phoneWebsite;
            if (updateData.emailPrimary != null) client.emailPrimary = updateData.emailPrimary;
            if (updateData.emailSecondary != null) client.emailSecondary = updateData.emailSecondary;
            if (updateData.emailMarketing != null) client.emailMarketing = updateData.emailMarketing;
            if (updateData.emailWebsite != null) client.emailWebsite = updateData.emailWebsite;
            if (updateData.emailContact != null) client.emailContact = updateData.emailContact;
            if (updateData.websites != null) client.websites = updateData.websites;
            if (updateData.administrator != null) client.administrator = updateData.administrator;
            if (updateData.contactPerson != null) client.contactPerson = updateData.contactPerson;
            if (updateData.contactDate != null) client.contactDate = updateData.contactDate;
            if (updateData.dealId != null) client.dealId = updateData.dealId;
            if (updateData.observations != null) client.observations = updateData.observations;
            if (updateData.sourceFile != null) client.sourceFile = updateData.sourceFile;
            if (updateData.sourceSheet != null) client.sourceSheet = updateData.sourceSheet;

            client.updatedAt = LocalDateTime.now();
            client.persist();

            return Response.ok(ApiResponse.success(ClientDto.fromEntity(client), "Client updated successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error updating client: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error updating client"))
                .build();
        }
    }

    /**
     * Delete a client.
     */
    @DELETE
    @Path("/{id}")
    @Transactional
    public Response deleteClient(@PathParam("id") String id) {
        try {
            Client client = Client.findById(id);
            if (client == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Client not found"))
                    .build();
            }

            // Messages will be deleted by cascade
            client.delete();

            return Response.ok(ApiResponse.success(null, "Client deleted successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error deleting client: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error deleting client"))
                .build();
        }
    }
}
