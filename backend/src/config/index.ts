import dotenv from 'dotenv';
dotenv.config();

// Helper function to get required env var
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Helper function to get numeric env var
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

// Helper function to get boolean env var
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

// Helper function to get SMS URL with validation
// Note: Uses console.warn instead of logger to avoid circular dependency (logger depends on config)
function getTraccarSmsUrl(): string {
  const cloudflareUrl = process.env.CLOUDFLARE_TUNNEL_URL || '';
  const traccarUrl = process.env.TRACCAR_SMS_URL || '';
  const url = cloudflareUrl || traccarUrl;
  
  // Store warning to be logged after app initialization
  if (!url && process.env.NODE_ENV !== 'test') {
    // Use setTimeout to defer logging until after the app is initialized
    // This avoids circular dependency with logger
    setTimeout(() => {
      console.warn('[Config] Warning: Neither CLOUDFLARE_TUNNEL_URL nor TRACCAR_SMS_URL is configured. SMS sending will fail until configured.');
    }, 0);
  }
  
  return url;
}

export const config = {
  port: getEnvNumber('PORT', 3001),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  
  database: {
    url: getEnvVar('DATABASE_URL', ''),
  },
  
  traccarSms: {
    // URL can be either direct Traccar URL or Cloudflare tunnel URL
    url: getTraccarSmsUrl(),
    deviceId: getEnvVar('TRACCAR_SMS_DEVICE_ID', ''),
    apiToken: getEnvVar('TRACCAR_API_TOKEN', ''),
  },
  
  rateLimits: {
    smsPerMinute: getEnvNumber('SMS_RATE_LIMIT_PER_MINUTE', 30),
    smsPerHour: getEnvNumber('SMS_RATE_LIMIT_PER_HOUR', 500),
    maxRetries: getEnvNumber('SMS_MAX_RETRIES', 5),
    retryDelayMs: getEnvNumber('SMS_RETRY_DELAY_MS', 60000),
    apiRateLimitMax: getEnvNumber('API_RATE_LIMIT_MAX', 100),
    apiRateLimitWindowMinutes: getEnvNumber('API_RATE_LIMIT_WINDOW_MINUTES', 15),
  },
  
  // SMS Best Practices Configuration
  smsBestPractices: {
    maxPerRecipientPerDay: getEnvNumber('SMS_MAX_PER_RECIPIENT_PER_DAY', 3),
    maxPerRecipientPerWeek: getEnvNumber('SMS_MAX_PER_RECIPIENT_PER_WEEK', 10),
    recipientCooldownHours: getEnvNumber('SMS_RECIPIENT_COOLDOWN_HOURS', 4),
    allowedStartHour: getEnvNumber('SMS_ALLOWED_START_HOUR', 9),
    allowedEndHour: getEnvNumber('SMS_ALLOWED_END_HOUR', 20),
    timezone: getEnvVar('SMS_TIMEZONE', 'Europe/Bucharest'),
    maxLength: getEnvNumber('SMS_MAX_LENGTH', 480),
    preventDuplicates: getEnvBoolean('SMS_PREVENT_DUPLICATES', true),
    duplicateWindowHours: getEnvNumber('SMS_DUPLICATE_WINDOW_HOURS', 24),
    senderName: getEnvVar('SMS_SENDER_NAME', 'YourCompany'),
    optOutKeyword: getEnvVar('SMS_OPT_OUT_KEYWORD', 'STOP'),
    requireOptOutInfo: getEnvBoolean('SMS_REQUIRE_OPT_OUT_INFO', true),
    defaultCountryCode: getEnvVar('SMS_DEFAULT_COUNTRY_CODE', '+40'), // Romanian default
  },
  
  cors: {
    origin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
  },
  
  cloudflare: {
    tunnelUrl: getEnvVar('CLOUDFLARE_TUNNEL_URL', ''),
  },
  
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
  
  excel: {
    dataDirectory: getEnvVar('EXCEL_DATA_DIRECTORY', './data'),
  },
  
  queue: {
    processIntervalMs: getEnvNumber('QUEUE_PROCESS_INTERVAL_MS', 5000),
    batchSize: getEnvNumber('QUEUE_BATCH_SIZE', 10),
  },
};
