package com.clientmanagement.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * SMS configuration properties.
 */
@ConfigMapping(prefix = "sms")
public interface SmsConfig {

    Traccar traccar();
    Cloudflare cloudflare();
    RateLimit rateLimit();
    BestPractices bestPractices();

    interface Traccar {
        @WithDefault("")
        String url();

        @WithName("device-id")
        @WithDefault("")
        String deviceId();

        @WithName("api-token")
        @WithDefault("")
        String apiToken();
    }

    interface Cloudflare {
        @WithName("tunnel-url")
        @WithDefault("")
        String tunnelUrl();
    }

    interface RateLimit {
        @WithName("per-minute")
        @WithDefault("30")
        int perMinute();

        @WithName("per-hour")
        @WithDefault("500")
        int perHour();

        @WithName("max-retries")
        @WithDefault("5")
        int maxRetries();

        @WithName("retry-delay-ms")
        @WithDefault("60000")
        long retryDelayMs();
    }

    interface BestPractices {
        @WithName("max-per-recipient-per-day")
        @WithDefault("3")
        int maxPerRecipientPerDay();

        @WithName("max-per-recipient-per-week")
        @WithDefault("10")
        int maxPerRecipientPerWeek();

        @WithName("recipient-cooldown-hours")
        @WithDefault("4")
        int recipientCooldownHours();

        @WithName("allowed-start-hour")
        @WithDefault("9")
        int allowedStartHour();

        @WithName("allowed-end-hour")
        @WithDefault("20")
        int allowedEndHour();

        @WithDefault("Europe/Bucharest")
        String timezone();

        @WithName("max-length")
        @WithDefault("480")
        int maxLength();

        @WithName("prevent-duplicates")
        @WithDefault("true")
        boolean preventDuplicates();

        @WithName("duplicate-window-hours")
        @WithDefault("24")
        int duplicateWindowHours();

        @WithName("sender-name")
        @WithDefault("YourCompany")
        String senderName();

        @WithName("opt-out-keyword")
        @WithDefault("STOP")
        String optOutKeyword();

        @WithName("require-opt-out-info")
        @WithDefault("true")
        boolean requireOptOutInfo();

        @WithName("default-country-code")
        @WithDefault("+40")
        String defaultCountryCode();
    }

    /**
     * Get the effective SMS URL (Cloudflare tunnel URL or direct Traccar URL).
     */
    default String getEffectiveUrl() {
        String cloudflareUrl = cloudflare().tunnelUrl();
        if (cloudflareUrl != null && !cloudflareUrl.isBlank()) {
            return cloudflareUrl;
        }
        return traccar().url();
    }
}
