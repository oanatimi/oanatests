package com.clientmanagement.service;

import com.clientmanagement.config.SmsConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Service for sending SMS messages via Traccar SMS Gateway.
 */
@ApplicationScoped
public class SmsService {

    private static final Logger LOG = Logger.getLogger(SmsService.class);

    @Inject
    SmsConfig smsConfig;

    private final HttpClient httpClient;
    private final Semaphore rateLimiter;
    private final AtomicInteger queued = new AtomicInteger(0);
    private final AtomicInteger running = new AtomicInteger(0);

    public SmsService() {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        // Initialize with default rate limit, will be reconfigured when config is available
        this.rateLimiter = new Semaphore(30);
    }

    /**
     * Result of an SMS send operation.
     */
    public static class SmsSendResult {
        public final boolean success;
        public final String messageId;
        public final String error;
        public final boolean retryable;

        private SmsSendResult(boolean success, String messageId, String error, boolean retryable) {
            this.success = success;
            this.messageId = messageId;
            this.error = error;
            this.retryable = retryable;
        }

        public static SmsSendResult success(String messageId) {
            return new SmsSendResult(true, messageId, null, false);
        }

        public static SmsSendResult failure(String error, boolean retryable) {
            return new SmsSendResult(false, null, error, retryable);
        }
    }

    /**
     * Send an SMS message.
     */
    public SmsSendResult sendSms(String phoneNumber, String message) {
        String url = smsConfig.getEffectiveUrl();
        if (url == null || url.isBlank()) {
            LOG.warn("SMS URL not configured");
            return SmsSendResult.failure("SMS URL not configured", false);
        }

        queued.incrementAndGet();
        try {
            rateLimiter.acquire();
            running.incrementAndGet();
            queued.decrementAndGet();

            LOG.infof("Sending SMS to %s", phoneNumber);

            String params = String.format("id=%s&phone=%s&message=%s",
                URLEncoder.encode(smsConfig.traccar().deviceId(), StandardCharsets.UTF_8),
                URLEncoder.encode(phoneNumber, StandardCharsets.UTF_8),
                URLEncoder.encode(message, StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url + "?" + params))
                .POST(HttpRequest.BodyPublishers.noBody())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Bearer " + smsConfig.traccar().apiToken())
                .timeout(Duration.ofSeconds(30))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                LOG.infof("SMS sent successfully to %s", phoneNumber);
                return SmsSendResult.success(null);
            }

            return SmsSendResult.failure("Unexpected response status: " + response.statusCode(), true);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SmsSendResult.failure("Interrupted", true);
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Unknown error";
            LOG.errorf("SMS sending failed to %s: %s", phoneNumber, errorMessage);

            boolean retryable = errorMessage.contains("Connection refused") ||
                               errorMessage.contains("timed out") ||
                               errorMessage.contains("UnknownHost");

            return SmsSendResult.failure(errorMessage, retryable);
        } finally {
            running.decrementAndGet();
            rateLimiter.release();
        }
    }

    /**
     * Get rate limit status information.
     */
    public RateLimitStatus getRateLimitStatus() {
        RateLimitStatus status = new RateLimitStatus();
        status.currentReservoir = smsConfig.rateLimit().perMinute();
        status.maxReservoir = smsConfig.rateLimit().perMinute();
        status.queued = queued.get();
        status.running = running.get();
        return status;
    }

    public static class RateLimitStatus {
        public int currentReservoir;
        public int maxReservoir;
        public int queued;
        public int running;
    }
}
