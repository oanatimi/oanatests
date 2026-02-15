package com.clientmanagement.dto;

/**
 * Queue status information.
 */
public class QueueStatusDto {
    public QueueStats queue;
    public RateLimitStatus rateLimit;

    public static class QueueStats {
        public int pending;
        public int processing;
        public int completed;
        public int failed;
        public int deadLetter;
    }

    public static class RateLimitStatus {
        public int currentReservoir;
        public int maxReservoir;
        public int queued;
        public int running;
    }
}
