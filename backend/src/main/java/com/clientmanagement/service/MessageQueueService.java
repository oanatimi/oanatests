package com.clientmanagement.service;

import com.clientmanagement.config.QueueConfig;
import com.clientmanagement.config.SmsConfig;
import com.clientmanagement.dto.QueueStatusDto;
import com.clientmanagement.entity.Client;
import com.clientmanagement.entity.Message;
import com.clientmanagement.entity.MessageQueue;
import com.clientmanagement.entity.MessageStatus;
import com.clientmanagement.entity.QueueStatus;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service for managing the SMS message queue.
 */
@ApplicationScoped
public class MessageQueueService {

    private static final Logger LOG = Logger.getLogger(MessageQueueService.class);

    @Inject
    SmsService smsService;

    @Inject
    SmsConfig smsConfig;

    @Inject
    QueueConfig queueConfig;

    private volatile boolean isProcessing = false;

    /**
     * Add a message to the queue.
     */
    @Transactional
    public String addToQueue(String clientId, String phoneNumber, String content) {
        // Create message record
        Message message = new Message();
        message.id = UUID.randomUUID().toString();
        message.client = Client.findById(clientId);
        message.phoneNumber = phoneNumber;
        message.content = content;
        message.status = MessageStatus.QUEUED;
        message.retryCount = 0;
        message.createdAt = LocalDateTime.now();
        message.updatedAt = LocalDateTime.now();
        message.persist();

        // Create queue entry
        MessageQueue queueItem = new MessageQueue();
        queueItem.id = UUID.randomUUID().toString();
        queueItem.messageId = message.id;
        queueItem.priority = 0;
        queueItem.attempts = 0;
        queueItem.maxAttempts = smsConfig.rateLimit().maxRetries();
        queueItem.nextRetry = LocalDateTime.now();
        queueItem.status = QueueStatus.PENDING;
        queueItem.createdAt = LocalDateTime.now();
        queueItem.updatedAt = LocalDateTime.now();
        queueItem.persist();

        LOG.infof("Message %s added to queue for %s", message.id, phoneNumber);
        return message.id;
    }

    /**
     * Add multiple messages to the queue.
     */
    @Transactional
    public List<String> addBulkToQueue(List<BulkMessageItem> messages) {
        List<String> messageIds = new ArrayList<>();
        for (BulkMessageItem msg : messages) {
            String messageId = addToQueue(msg.clientId, msg.phoneNumber, msg.content);
            messageIds.add(messageId);
        }
        return messageIds;
    }

    public static class BulkMessageItem {
        public String clientId;
        public String phoneNumber;
        public String content;

        public BulkMessageItem(String clientId, String phoneNumber, String content) {
            this.clientId = clientId;
            this.phoneNumber = phoneNumber;
            this.content = content;
        }
    }

    /**
     * Process the message queue (scheduled task).
     */
    @Scheduled(every = "${queue.process-interval-seconds:5}s")
    @Transactional
    public void processQueue() {
        if (isProcessing) {
            return;
        }

        isProcessing = true;
        try {
            List<MessageQueue> queuedItems = MessageQueue.find(
                "status = ?1 AND nextRetry <= ?2 AND attempts < ?3 ORDER BY priority DESC, createdAt ASC",
                QueueStatus.PENDING,
                LocalDateTime.now(),
                smsConfig.rateLimit().maxRetries()
            ).page(0, queueConfig.batchSize()).list();

            for (MessageQueue queueItem : queuedItems) {
                processQueueItem(queueItem);
            }
        } catch (Exception e) {
            LOG.errorf("Error processing queue: %s", e.getMessage());
        } finally {
            isProcessing = false;
        }
    }

    private void processQueueItem(MessageQueue queueItem) {
        try {
            // Update queue status
            queueItem.status = QueueStatus.PROCESSING;
            queueItem.updatedAt = LocalDateTime.now();
            queueItem.persist();

            // Get message details
            Message message = Message.findById(queueItem.messageId);
            if (message == null) {
                LOG.errorf("Message %s not found", queueItem.messageId);
                queueItem.status = QueueStatus.FAILED;
                queueItem.lastError = "Message not found";
                queueItem.updatedAt = LocalDateTime.now();
                queueItem.persist();
                return;
            }

            // Update message status
            message.status = MessageStatus.SENDING;
            message.updatedAt = LocalDateTime.now();
            message.persist();

            // Send SMS
            SmsService.SmsSendResult result = smsService.sendSms(message.phoneNumber, message.content);

            if (result.success) {
                // Success
                message.status = MessageStatus.SENT;
                message.sentAt = LocalDateTime.now();
                message.updatedAt = LocalDateTime.now();
                message.persist();

                queueItem.status = QueueStatus.COMPLETED;
                queueItem.updatedAt = LocalDateTime.now();
                queueItem.persist();

                LOG.infof("Message %s sent successfully", queueItem.messageId);
            } else if (result.retryable) {
                // Retryable error
                int newAttempts = queueItem.attempts + 1;
                boolean isDeadLetter = newAttempts >= smsConfig.rateLimit().maxRetries();
                long delayMs = smsConfig.rateLimit().retryDelayMs() * (long) Math.pow(2, newAttempts - 1);
                LocalDateTime nextRetry = LocalDateTime.now().plusNanos(delayMs * 1_000_000);

                queueItem.status = isDeadLetter ? QueueStatus.DEAD_LETTER : QueueStatus.PENDING;
                queueItem.attempts = newAttempts;
                queueItem.lastError = result.error;
                queueItem.nextRetry = nextRetry;
                queueItem.updatedAt = LocalDateTime.now();
                queueItem.persist();

                message.status = isDeadLetter ? MessageStatus.FAILED : MessageStatus.QUEUED;
                message.retryCount = newAttempts;
                message.errorMessage = result.error;
                message.updatedAt = LocalDateTime.now();
                message.persist();

                LOG.warnf("Message %s will be retried (attempt %d)", queueItem.messageId, newAttempts);
            } else {
                // Non-retryable error
                message.status = MessageStatus.FAILED;
                message.errorMessage = result.error;
                message.updatedAt = LocalDateTime.now();
                message.persist();

                queueItem.status = QueueStatus.FAILED;
                queueItem.lastError = result.error;
                queueItem.updatedAt = LocalDateTime.now();
                queueItem.persist();

                LOG.errorf("Message %s failed permanently: %s", queueItem.messageId, result.error);
            }
        } catch (Exception e) {
            LOG.errorf("Error processing queue item %s: %s", queueItem.id, e.getMessage());
            queueItem.status = QueueStatus.PENDING;
            queueItem.lastError = e.getMessage();
            queueItem.nextRetry = LocalDateTime.now().plusNanos(smsConfig.rateLimit().retryDelayMs() * 1_000_000);
            queueItem.updatedAt = LocalDateTime.now();
            queueItem.persist();
        }
    }

    /**
     * Get queue statistics.
     */
    public QueueStatusDto.QueueStats getQueueStats() {
        QueueStatusDto.QueueStats stats = new QueueStatusDto.QueueStats();
        stats.pending = (int) MessageQueue.count("status", QueueStatus.PENDING);
        stats.processing = (int) MessageQueue.count("status", QueueStatus.PROCESSING);
        stats.completed = (int) MessageQueue.count("status", QueueStatus.COMPLETED);
        stats.failed = (int) MessageQueue.count("status", QueueStatus.FAILED);
        stats.deadLetter = (int) MessageQueue.count("status", QueueStatus.DEAD_LETTER);
        return stats;
    }

    /**
     * Retry dead letter messages.
     */
    @Transactional
    public int retryDeadLetterMessages() {
        int count = MessageQueue.update(
            "status = ?1, attempts = 0, nextRetry = ?2, updatedAt = ?2 WHERE status = ?3",
            QueueStatus.PENDING,
            LocalDateTime.now(),
            QueueStatus.DEAD_LETTER
        );
        LOG.infof("Reset %d dead letter messages for retry", count);
        return count;
    }
}
