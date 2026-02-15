import prisma from '../config/database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MessageStatus } from '@prisma/client';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface MessageValidation {
  canSend: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * SMS Validation Service
 * Implements best practices to avoid getting banned by SMS providers
 */
export class SmsValidationService {
  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): ValidationResult {
    if (!phoneNumber) {
      return { valid: false, error: 'Phone number is required' };
    }

    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Check if it starts with + and has 10-15 digits
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(cleaned)) {
      return { valid: false, error: 'Invalid phone number format' };
    }

    // Check for Romanian phone numbers specifically
    if (cleaned.startsWith('+40') || cleaned.startsWith('40')) {
      const roNumber = cleaned.replace(/^\+?40/, '');
      if (roNumber.length !== 9) {
        return { valid: false, error: 'Invalid Romanian phone number' };
      }
      // Romanian mobile numbers start with 7
      if (!roNumber.startsWith('7')) {
        return { valid: false, warning: 'This may not be a mobile number' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate message content
   */
  validateMessageContent(content: string): ValidationResult {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'Message content is required' };
    }

    // Check message length
    if (content.length > config.smsBestPractices.maxLength) {
      return {
        valid: false,
        error: `Message exceeds maximum length of ${config.smsBestPractices.maxLength} characters`,
      };
    }

    // Check for spam-like content patterns
    const spamPatterns = [
      /FREE\s+[A-Z]/i,
      /WINNER/i,
      /CONGRATULATIONS.*WON/i,
      /URGENT.*REPLY/i,
      /CLICK\s+HERE/i,
      /https?:\/\/bit\.ly/i,
      /https?:\/\/tinyurl/i,
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        return {
          valid: true,
          warning: 'Message contains patterns that may be flagged as spam',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if current time is within allowed sending hours
   */
  isWithinAllowedHours(): boolean {
    const now = new Date();
    
    // Get current hour in configured timezone
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      hour12: false,
      timeZone: config.smsBestPractices.timezone,
    };
    
    const currentHour = parseInt(
      new Intl.DateTimeFormat('en-US', options).format(now),
      10
    );

    return (
      currentHour >= config.smsBestPractices.allowedStartHour &&
      currentHour < config.smsBestPractices.allowedEndHour
    );
  }

  /**
   * Check if recipient has opted out
   */
  async isOptedOut(phoneNumber: string): Promise<boolean> {
    const optOut = await prisma.optOut.findUnique({
      where: { phoneNumber },
    });
    return !!optOut;
  }

  /**
   * Check daily message limit for recipient
   */
  async checkDailyLimit(phoneNumber: string): Promise<ValidationResult> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const count = await prisma.message.count({
      where: {
        phoneNumber,
        createdAt: { gte: todayStart },
        status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.QUEUED, MessageStatus.SENDING] },
      },
    });

    if (count >= config.smsBestPractices.maxPerRecipientPerDay) {
      return {
        valid: false,
        error: `Daily limit of ${config.smsBestPractices.maxPerRecipientPerDay} messages reached for this recipient`,
      };
    }

    return { valid: true };
  }

  /**
   * Check weekly message limit for recipient
   */
  async checkWeeklyLimit(phoneNumber: string): Promise<ValidationResult> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const count = await prisma.message.count({
      where: {
        phoneNumber,
        createdAt: { gte: weekStart },
        status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.QUEUED, MessageStatus.SENDING] },
      },
    });

    if (count >= config.smsBestPractices.maxPerRecipientPerWeek) {
      return {
        valid: false,
        error: `Weekly limit of ${config.smsBestPractices.maxPerRecipientPerWeek} messages reached for this recipient`,
      };
    }

    return { valid: true };
  }

  /**
   * Check cooldown period between messages to same recipient
   */
  async checkCooldown(phoneNumber: string): Promise<ValidationResult> {
    const cooldownTime = new Date();
    cooldownTime.setHours(
      cooldownTime.getHours() - config.smsBestPractices.recipientCooldownHours
    );

    const recentMessage = await prisma.message.findFirst({
      where: {
        phoneNumber,
        createdAt: { gte: cooldownTime },
        status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentMessage) {
      const nextAllowed = new Date(recentMessage.createdAt);
      nextAllowed.setHours(
        nextAllowed.getHours() + config.smsBestPractices.recipientCooldownHours
      );
      
      return {
        valid: false,
        error: `Cooldown period active. Next message allowed after ${nextAllowed.toLocaleString()}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check for duplicate messages
   */
  async checkDuplicate(
    phoneNumber: string,
    content: string
  ): Promise<ValidationResult> {
    if (!config.smsBestPractices.preventDuplicates) {
      return { valid: true };
    }

    const windowStart = new Date();
    windowStart.setHours(
      windowStart.getHours() - config.smsBestPractices.duplicateWindowHours
    );

    const duplicate = await prisma.message.findFirst({
      where: {
        phoneNumber,
        content,
        createdAt: { gte: windowStart },
      },
    });

    if (duplicate) {
      return {
        valid: false,
        error: 'Duplicate message detected within the configured time window',
      };
    }

    return { valid: true };
  }

  /**
   * Add opt-out information to message if required
   */
  formatMessageWithOptOut(content: string): string {
    if (!config.smsBestPractices.requireOptOutInfo) {
      return content;
    }

    const optOutText = `Reply ${config.smsBestPractices.optOutKeyword} to unsubscribe.`;
    
    // Check if opt-out info already exists
    if (content.toLowerCase().includes(config.smsBestPractices.optOutKeyword.toLowerCase())) {
      return content;
    }

    // Add sender name and opt-out info
    const senderPrefix = `[${config.smsBestPractices.senderName}] `;
    const formattedContent = content.startsWith('[') ? content : senderPrefix + content;
    
    return `${formattedContent}\n${optOutText}`;
  }

  /**
   * Comprehensive validation before sending
   */
  async validateBeforeSend(
    phoneNumber: string,
    content: string
  ): Promise<MessageValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate phone number
    const phoneValidation = this.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      errors.push(phoneValidation.error!);
    }
    if (phoneValidation.warning) {
      warnings.push(phoneValidation.warning);
    }

    // Validate message content
    const contentValidation = this.validateMessageContent(content);
    if (!contentValidation.valid) {
      errors.push(contentValidation.error!);
    }
    if (contentValidation.warning) {
      warnings.push(contentValidation.warning);
    }

    // Check sending hours
    if (!this.isWithinAllowedHours()) {
      errors.push(
        `SMS can only be sent between ${config.smsBestPractices.allowedStartHour}:00 and ${config.smsBestPractices.allowedEndHour}:00 (${config.smsBestPractices.timezone})`
      );
    }

    // Check opt-out status
    try {
      const optedOut = await this.isOptedOut(phoneNumber);
      if (optedOut) {
        errors.push('Recipient has opted out of receiving messages');
      }
    } catch {
      // OptOut table might not exist yet, skip this check
      logger.debug('OptOut check skipped - table may not exist');
    }

    // Check daily limit
    const dailyLimitCheck = await this.checkDailyLimit(phoneNumber);
    if (!dailyLimitCheck.valid) {
      errors.push(dailyLimitCheck.error!);
    }

    // Check weekly limit
    const weeklyLimitCheck = await this.checkWeeklyLimit(phoneNumber);
    if (!weeklyLimitCheck.valid) {
      errors.push(weeklyLimitCheck.error!);
    }

    // Check cooldown
    const cooldownCheck = await this.checkCooldown(phoneNumber);
    if (!cooldownCheck.valid) {
      warnings.push(cooldownCheck.error!); // Make cooldown a warning, not error
    }

    // Check duplicate
    const duplicateCheck = await this.checkDuplicate(phoneNumber, content);
    if (!duplicateCheck.valid) {
      errors.push(duplicateCheck.error!);
    }

    return {
      canSend: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Record opt-out for a phone number
   */
  async recordOptOut(phoneNumber: string): Promise<void> {
    await prisma.optOut.upsert({
      where: { phoneNumber },
      create: { phoneNumber },
      update: { updatedAt: new Date() },
    });
    logger.info(`Opt-out recorded for ${phoneNumber}`);
  }

  /**
   * Remove opt-out for a phone number
   */
  async removeOptOut(phoneNumber: string): Promise<void> {
    await prisma.optOut.delete({
      where: { phoneNumber },
    }).catch(() => {
      // Ignore if doesn't exist
    });
    logger.info(`Opt-out removed for ${phoneNumber}`);
  }
}

export const smsValidationService = new SmsValidationService();
