import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import Bottleneck from 'bottleneck';

interface TraccarSmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable: boolean;
}

export class TraccarSmsService {
  private client: AxiosInstance;
  private limiter: Bottleneck;
  
  constructor() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    
    // Add API token if configured
    if (config.traccarSms.apiToken) {
      headers['Authorization'] = `Bearer ${config.traccarSms.apiToken}`;
    }
    
    this.client = axios.create({
      baseURL: config.traccarSms.url,
      timeout: 30000,
      headers,
    });
    
    // Rate limiter: configurable per minute limit
    this.limiter = new Bottleneck({
      reservoir: config.rateLimits.smsPerMinute,
      reservoirRefreshAmount: config.rateLimits.smsPerMinute,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
      maxConcurrent: 1,
      minTime: Math.ceil(60000 / config.rateLimits.smsPerMinute), // Spread evenly
    });
    
    this.limiter.on('failed', async (error, jobInfo) => {
      logger.warn(`SMS job ${jobInfo.options.id} failed: ${error}`);
      if (jobInfo.retryCount < config.rateLimits.maxRetries) {
        return config.rateLimits.retryDelayMs;
      }
    });
    
    this.limiter.on('retry', (error, jobInfo) => {
      logger.info(`Retrying SMS job ${jobInfo.options.id}`);
    });
  }
  
  async sendSms(phoneNumber: string, message: string): Promise<SmsSendResult> {
    return this.limiter.schedule(async () => {
      try {
        logger.info(`Sending SMS to ${phoneNumber}`);
        
        // Traccar SMS Gateway expects the following format:
        // POST to / with form data: id=deviceId&phone=+40xxx&message=text
        const response = await this.client.post<TraccarSmsResponse>('/', null, {
          params: {
            id: config.traccarSms.deviceId,
            phone: phoneNumber,
            message: message,
          },
        });
        
        if (response.status === 200) {
          logger.info(`SMS sent successfully to ${phoneNumber}`);
          return {
            success: true,
            messageId: response.data?.messageId,
            retryable: false,
          };
        }
        
        return {
          success: false,
          error: 'Unexpected response status',
          retryable: true,
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        
        // Determine if error is retryable
        const isNetworkError = axiosError.code === 'ECONNREFUSED' || 
                               axiosError.code === 'ETIMEDOUT' ||
                               axiosError.code === 'ENOTFOUND';
        const isServerError = axiosError.response && axiosError.response.status >= 500;
        const retryable = isNetworkError || Boolean(isServerError);
        
        const errorMessage = axiosError.message || 'Unknown error';
        logger.error(`SMS sending failed to ${phoneNumber}: ${errorMessage}`);
        
        return {
          success: false,
          error: errorMessage,
          retryable,
        };
      }
    });
  }
  
  async sendBulkSms(
    recipients: Array<{ phoneNumber: string; message: string }>,
    onProgress?: (sent: number, total: number, failed: number) => void
  ): Promise<{
    sent: number;
    failed: number;
    errors: Array<{ phoneNumber: string; error: string }>;
  }> {
    let sent = 0;
    let failed = 0;
    const errors: Array<{ phoneNumber: string; error: string }> = [];
    const total = recipients.length;
    
    for (const recipient of recipients) {
      const result = await this.sendSms(recipient.phoneNumber, recipient.message);
      
      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push({
          phoneNumber: recipient.phoneNumber,
          error: result.error || 'Unknown error',
        });
      }
      
      if (onProgress) {
        onProgress(sent, total, failed);
      }
    }
    
    return { sent, failed, errors };
  }
  
  getRateLimitStatus(): {
    currentReservoir: number;
    maxReservoir: number;
    queued: number;
    running: number;
  } {
    const counts = this.limiter.counts();
    return {
      currentReservoir: config.rateLimits.smsPerMinute,
      maxReservoir: config.rateLimits.smsPerMinute,
      queued: counts.QUEUED,
      running: counts.RUNNING,
    };
  }
}

export const smsService = new TraccarSmsService();
