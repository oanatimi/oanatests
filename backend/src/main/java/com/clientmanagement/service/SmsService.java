package com.clientmanagement.service;

import com.clientmanagement.config.SmsConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
     * Send an SMS message via Cloudflare tunnel → Traccar SMS Gateway on phone.
     *
     * Flow: Railway backend → cloudflared URL → your PC → phone (Traccar SMS Gateway)
     *
     * Traccar SMS Gateway API:
     *   POST / with JSON body: {"to":"phone","message":"text"}
     *   Authorization header: direct token (no Bearer prefix)
     */
    public SmsSendResult sendSms(String phoneNumber, String message) {
        String baseUrl = smsConfig.cloudflare().tunnelUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            LOG.error("SMS not configured! Set CLOUDFLARE_TUNNEL_URL in Railway environment variables.");
            return SmsSendResult.failure("SMS URL not configured. Set CLOUDFLARE_TUNNEL_URL.", false);
        }

        String apiToken = smsConfig.traccar().apiToken();
        if (apiToken == null || apiToken.isBlank()) {
            LOG.error("SMS token not configured! Set TRACCAR_API_TOKEN in Railway environment variables.");
            return SmsSendResult.failure("SMS token not configured. Set TRACCAR_API_TOKEN.", false);
        }

        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        queued.incrementAndGet();
        try {
            rateLimiter.acquire();
            running.incrementAndGet();
            queued.decrementAndGet();

            // Normalize phone number
            String normalizedPhone = normalizePhoneNumber(phoneNumber);

            // Strip emoji - SMS gateways don't support Unicode emoji
            String cleanMessage = stripEmoji(message);

            // Escape quotes in message for JSON
            String escapedMessage = cleanMessage.replace("\\", "\\\\").replace("\"", "\\\"");

            // Build JSON body like the working project
            String json = String.format("{\"to\":\"%s\",\"message\":\"%s\"}", normalizedPhone, escapedMessage);

            String url = baseUrl + "/";

            LOG.infof("Sending SMS to %s via cloudflared tunnel: %s", normalizedPhone, url);
            LOG.infof("SMS request: POST %s  Authorization=%s...  JSON=%s",
                url, apiToken.substring(0, Math.min(8, apiToken.length())), json);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", apiToken)  // Direct token, no "Bearer" prefix
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            LOG.infof("SMS response for %s: status=%d, body='%s'", normalizedPhone, response.statusCode(), response.body());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                LOG.infof("SMS sent successfully to %s", normalizedPhone);
                return SmsSendResult.success(null);
            }

            String errorMsg = String.format("SMS gateway returned status %d: %s", response.statusCode(), response.body());
            LOG.errorf("SMS FAILED for %s: %s", normalizedPhone, errorMsg);
            return SmsSendResult.failure(errorMsg, true);

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
     * Normalize phone number format.
     * Ensures + prefix and removes spaces/dashes.
     */
    private String normalizePhoneNumber(String phoneNumber) {
        String normalized = phoneNumber.trim().replaceAll("[\\s-]", "");
        if (!normalized.startsWith("+")) {
            if (normalized.startsWith("0")) {
                normalized = "+4" + normalized;
            } else if (!normalized.startsWith("40")) {
                normalized = "+40" + normalized;
            } else {
                normalized = "+" + normalized;
            }
        }
        return normalized;
    }

    /**
     * Strip emoji and emoticon characters from SMS message.
     * SMS gateways don't support Unicode emoji which can cause delivery failures.
     */
    private String stripEmoji(String text) {
        if (text == null) return null;
        return text.replaceAll("[\\x{1F000}-\\x{1FFFF}]|[\\x{2600}-\\x{27BF}]|[\\x{2300}-\\x{23FF}]|[\\x{FE00}-\\x{FE0F}]|[\\x{200D}]|[\\x{20E3}]|[\\x{2B50}-\\x{2B55}]", "")
                   .replaceAll("\\s+", " ")
                   .trim();
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
