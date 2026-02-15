import { Response } from 'express';
import { logger } from './logger';

// User-friendly error messages mapping
// PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const ERROR_MESSAGES: Record<string, string> = {
  // PostgreSQL error codes
  '23505': 'This record already exists. Please check for duplicates.', // unique_violation
  '23503': 'Cannot complete this action because it references data that doesn\'t exist.', // foreign_key_violation
  '23502': 'Some required information is missing.', // not_null_violation
  '22P02': 'The data format is incorrect.', // invalid_text_representation
  
  // Application error codes
  'NOT_FOUND': 'The requested record was not found.',
  'DUPLICATE': 'This record already exists. Please check for duplicates.',
  
  // Validation errors
  'VALIDATION_ERROR': 'Please check your input and try again.',
  'MISSING_REQUIRED_FIELD': 'Some required information is missing.',
  'INVALID_FORMAT': 'The data format is incorrect.',
  
  // SMS errors
  'SMS_RATE_LIMIT': 'Too many messages sent. Please wait before sending more.',
  'SMS_INVALID_PHONE': 'The phone number format is invalid.',
  'SMS_OPT_OUT': 'This recipient has opted out of receiving messages.',
  'SMS_GATEWAY_ERROR': 'Unable to send SMS at this time. The message has been queued for retry.',
  
  // File errors
  'FILE_NOT_FOUND': 'The requested file was not found.',
  'INVALID_FILE_TYPE': 'This file type is not supported.',
  'FILE_TOO_LARGE': 'The file is too large to process.',
  
  // Generic errors
  'NETWORK_ERROR': 'A network error occurred. Please check your connection and try again.',
  'TIMEOUT': 'The request took too long to complete. Please try again.',
  'UNAUTHORIZED': 'You don\'t have permission to perform this action.',
  'SERVER_ERROR': 'An unexpected error occurred. Our team has been notified.',
};

export interface AppError {
  code: string;
  message: string;
  details?: string;
  field?: string;
}

export interface ErrorResponse {
  success: false;
  error: AppError;
}

/**
 * Get a user-friendly error message based on error code or type
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for PostgreSQL error codes
    const pgError = error as { code?: string };
    if (pgError.code && ERROR_MESSAGES[pgError.code]) {
      return ERROR_MESSAGES[pgError.code];
    }
    
    // Check for specific error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('duplicate') || message.includes('unique constraint') || message.includes('unique_violation')) {
      return ERROR_MESSAGES['23505'];
    }
    if (message.includes('not found')) {
      return ERROR_MESSAGES['NOT_FOUND'];
    }
    if (message.includes('rate limit')) {
      return ERROR_MESSAGES['SMS_RATE_LIMIT'];
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ERROR_MESSAGES['TIMEOUT'];
    }
    if (message.includes('network') || message.includes('econnrefused')) {
      return ERROR_MESSAGES['NETWORK_ERROR'];
    }
  }
  
  return ERROR_MESSAGES['SERVER_ERROR'];
}

/**
 * Send a user-friendly error response
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  errorCode: string,
  customMessage?: string,
  details?: string,
  field?: string
): void {
  const message = customMessage || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['SERVER_ERROR'];
  
  const response: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
      ...(field && { field }),
    },
  };
  
  res.status(statusCode).json(response);
}

/**
 * Handle and send appropriate error response
 */
export function handleError(
  res: Response,
  error: unknown,
  context: string,
  defaultStatusCode: number = 500
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`${context}: ${errorMessage}`);
  
  // Determine status code and error type
  let statusCode = defaultStatusCode;
  let errorCode = 'SERVER_ERROR';
  let userMessage = getUserFriendlyMessage(error);
  
  if (error instanceof Error) {
    const pgError = error as { code?: string };
    
    // PostgreSQL "unique_violation" errors
    if (pgError.code === '23505') {
      statusCode = 409;
      errorCode = 'DUPLICATE';
      userMessage = ERROR_MESSAGES['23505'];
    }
    // PostgreSQL "foreign_key_violation" errors (referencing non-existent data)
    else if (pgError.code === '23503') {
      statusCode = 400;
      errorCode = 'INVALID_REFERENCE';
      userMessage = ERROR_MESSAGES['23503'];
    }
    // PostgreSQL "not_null_violation" errors
    else if (pgError.code === '23502') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      userMessage = ERROR_MESSAGES['23502'];
    }
    // Validation errors
    else if (errorMessage.toLowerCase().includes('validation') || 
             errorMessage.toLowerCase().includes('invalid') ||
             errorMessage.toLowerCase().includes('required')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    }
    // Not found patterns
    else if (errorMessage.toLowerCase().includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      userMessage = ERROR_MESSAGES['NOT_FOUND'];
    }
  }
  
  sendErrorResponse(res, statusCode, errorCode, userMessage);
}

/**
 * Validation error helper
 */
export function sendValidationError(
  res: Response,
  message: string,
  field?: string
): void {
  sendErrorResponse(res, 400, 'VALIDATION_ERROR', message, undefined, field);
}

/**
 * Not found error helper
 */
export function sendNotFoundError(
  res: Response,
  resource: string = 'Resource'
): void {
  sendErrorResponse(res, 404, 'NOT_FOUND', `${resource} was not found.`);
}

/**
 * Success response helper
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}
