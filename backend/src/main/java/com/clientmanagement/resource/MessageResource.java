package com.clientmanagement.resource;

import com.clientmanagement.config.SmsConfig;
import com.clientmanagement.dto.*;
import com.clientmanagement.entity.Client;
import com.clientmanagement.entity.Message;
import com.clientmanagement.entity.MessageStatus;
import com.clientmanagement.entity.MessageTemplate;
import com.clientmanagement.service.MessageQueueService;
import com.clientmanagement.service.SmsService;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * REST resource for message management.
 */
@Path("/api/messages")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MessageResource {

    private static final Logger LOG = Logger.getLogger(MessageResource.class);

    // Phone number validation patterns
    private static final Pattern E164_PATTERN = Pattern.compile("^\\+[1-9]\\d{6,14}$");
    private static final Pattern LOCAL_PATTERN = Pattern.compile("^0[1-9]\\d{7,10}$");

    @Inject
    MessageQueueService messageQueueService;

    @Inject
    SmsService smsService;

    @Inject
    SmsConfig smsConfig;

    /**
     * Get all messages with pagination.
     */
    @GET
    public Response getMessages(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("status") String status,
            @QueryParam("clientId") String clientId) {

        try {
            StringBuilder queryBuilder = new StringBuilder("1=1");
            Map<String, Object> params = new HashMap<>();

            if (status != null && !status.isBlank()) {
                queryBuilder.append(" AND status = :status");
                params.put("status", MessageStatus.valueOf(status));
            }

            if (clientId != null && !clientId.isBlank()) {
                queryBuilder.append(" AND clientId = :clientId");
                params.put("clientId", clientId);
            }

            String query = queryBuilder.toString();

            long total = Message.count(query, params);
            List<Message> messages = Message.find(query, Sort.by("createdAt", Sort.Direction.Descending), params)
                .page(Page.of(page - 1, limit))
                .list();

            // Convert to DTOs with client info
            List<MessageDto> messageDtos = messages.stream()
                .map(message -> {
                    MessageDto dto = MessageDto.fromEntity(message);
                    Client client = Client.findById(message.clientId);
                    if (client != null) {
                        dto.client = new MessageDto.ClientInfo(client.id, client.companyName, client.phonePrimary);
                    }
                    return dto;
                })
                .collect(Collectors.toList());

            return Response.ok(ApiResponse.success(messageDtos, new PaginationInfo(page, limit, total))).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching messages: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching messages"))
                .build();
        }
    }

    /**
     * Send a message to a single client.
     */
    @POST
    @Path("/send")
    @Transactional
    public Response sendMessage(SendMessageRequest request) {
        try {
            if (request.clientId == null || request.clientId.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please provide a client ID."))
                    .build();
            }

            if (request.content == null || request.content.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please provide message content."))
                    .build();
            }

            if (request.content.length() > smsConfig.bestPractices().maxLength()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error(String.format(
                        "Your message is too long. Please keep it under %d characters (current: %d).",
                        smsConfig.bestPractices().maxLength(), request.content.length())))
                    .build();
            }

            // Get client phone if not provided
            String phone = request.phoneNumber;
            if (phone == null || phone.isBlank()) {
                Client client = Client.findById(request.clientId);
                if (client == null) {
                    return Response.status(Response.Status.NOT_FOUND)
                        .entity(ApiResponse.error("Client not found"))
                        .build();
                }
                phone = client.getEffectivePhoneNumber();
            }

            if (phone == null || phone.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("This client does not have a phone number. Please add a phone number first."))
                    .build();
            }

            // Validate phone number format
            if (!isValidPhoneNumber(phone)) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("The phone number format is invalid. Please use a valid phone number format."))
                    .build();
            }

            String messageId = messageQueueService.addToQueue(request.clientId, phone, request.content);

            Map<String, String> responseData = new HashMap<>();
            responseData.put("messageId", messageId);

            return Response.ok(ApiResponse.success(responseData, "Your message has been queued and will be sent shortly.")).build();
        } catch (Exception e) {
            LOG.errorf("Error sending message: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error sending message"))
                .build();
        }
    }

    /**
     * Send bulk messages.
     */
    @POST
    @Path("/bulk")
    @Transactional
    public Response sendBulkMessages(BulkMessageRequest request) {
        try {
            if (request.clientIds == null || request.clientIds.isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please select at least one client to send messages to."))
                    .build();
            }

            if (request.content == null || request.content.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please enter a message to send."))
                    .build();
            }

            if (request.content.length() > smsConfig.bestPractices().maxLength()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error(String.format(
                        "Your message is too long. Please keep it under %d characters (current: %d).",
                        smsConfig.bestPractices().maxLength(), request.content.length())))
                    .build();
            }

            // Get clients with phone numbers
            List<Client> clients = Client.find("id IN ?1", request.clientIds).list();

            List<MessageQueueService.BulkMessageItem> messages = clients.stream()
                .filter(c -> c.getEffectivePhoneNumber() != null)
                .map(c -> new MessageQueueService.BulkMessageItem(
                    c.id,
                    c.getEffectivePhoneNumber(),
                    request.content
                ))
                .collect(Collectors.toList());

            int skipped = clients.size() - messages.size();

            if (messages.isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("None of the selected clients have valid phone numbers. Please add phone numbers first."))
                    .build();
            }

            List<String> messageIds = messageQueueService.addBulkToQueue(messages);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("queued", messageIds.size());
            responseData.put("skipped", skipped);

            String message = String.format("%d message(s) queued for sending.", messageIds.size());
            if (skipped > 0) {
                message += String.format(" %d client(s) skipped due to missing phone numbers.", skipped);
            }

            return Response.ok(ApiResponse.success(responseData, message)).build();
        } catch (Exception e) {
            LOG.errorf("Error sending bulk messages: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error sending bulk messages"))
                .build();
        }
    }

    /**
     * Get queue status.
     */
    @GET
    @Path("/queue/status")
    public Response getQueueStatus() {
        try {
            QueueStatusDto status = new QueueStatusDto();
            status.queue = messageQueueService.getQueueStats();

            SmsService.RateLimitStatus rateLimitStatus = smsService.getRateLimitStatus();
            status.rateLimit = new QueueStatusDto.RateLimitStatus();
            status.rateLimit.currentReservoir = rateLimitStatus.currentReservoir;
            status.rateLimit.maxReservoir = rateLimitStatus.maxReservoir;
            status.rateLimit.queued = rateLimitStatus.queued;
            status.rateLimit.running = rateLimitStatus.running;

            return Response.ok(ApiResponse.success(status)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching queue status: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching queue status"))
                .build();
        }
    }

    /**
     * Retry dead letter messages.
     */
    @POST
    @Path("/queue/retry-dead-letters")
    @Transactional
    public Response retryDeadLetters() {
        try {
            int count = messageQueueService.retryDeadLetterMessages();

            Map<String, Integer> responseData = new HashMap<>();
            responseData.put("retriedCount", count);

            String message = count > 0
                ? String.format("%d failed message(s) have been queued for retry.", count)
                : "No failed messages to retry.";

            return Response.ok(ApiResponse.success(responseData, message)).build();
        } catch (Exception e) {
            LOG.errorf("Error retrying dead letters: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error retrying dead letters"))
                .build();
        }
    }

    /**
     * Get message templates.
     */
    @GET
    @Path("/templates")
    public Response getTemplates() {
        try {
            List<MessageTemplate> templates = MessageTemplate.findAll(Sort.by("name")).list();
            return Response.ok(ApiResponse.success(templates)).build();
        } catch (Exception e) {
            LOG.errorf("Error fetching templates: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error fetching templates"))
                .build();
        }
    }

    /**
     * Create a message template.
     */
    @POST
    @Path("/templates")
    @Transactional
    public Response createTemplate(TemplateRequest request) {
        try {
            if (request.name == null || request.name.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please provide a name for the template."))
                    .build();
            }

            if (request.content == null || request.content.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("Please provide content for the template."))
                    .build();
            }

            MessageTemplate template = new MessageTemplate();
            template.name = request.name;
            template.content = request.content;
            template.createdAt = LocalDateTime.now();
            template.updatedAt = LocalDateTime.now();
            template.persist();

            return Response.ok(ApiResponse.success(template, "Template created successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error creating template: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error creating template"))
                .build();
        }
    }

    /**
     * Update a message template.
     */
    @PUT
    @Path("/templates/{id}")
    @Transactional
    public Response updateTemplate(@PathParam("id") String id, TemplateRequest request) {
        try {
            MessageTemplate template = MessageTemplate.findById(id);
            if (template == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Template not found"))
                    .build();
            }

            template.name = request.name;
            template.content = request.content;
            template.updatedAt = LocalDateTime.now();
            template.persist();

            return Response.ok(ApiResponse.success(template, "Template updated successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error updating template: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error updating template"))
                .build();
        }
    }

    /**
     * Delete a message template.
     */
    @DELETE
    @Path("/templates/{id}")
    @Transactional
    public Response deleteTemplate(@PathParam("id") String id) {
        try {
            MessageTemplate template = MessageTemplate.findById(id);
            if (template == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiResponse.error("Template not found"))
                    .build();
            }

            template.delete();
            return Response.ok(ApiResponse.success(null, "Template deleted successfully.")).build();
        } catch (Exception e) {
            LOG.errorf("Error deleting template: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error deleting template"))
                .build();
        }
    }

    private boolean isValidPhoneNumber(String phone) {
        return E164_PATTERN.matcher(phone).matches() || LOCAL_PATTERN.matcher(phone).matches();
    }
}
