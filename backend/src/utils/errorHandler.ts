import { Response } from 'express';
import { logger } from './logger';

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<string, string> = {
  // Database errors
  'P2002': 'This record already exists. Please check for duplicates.',
  'P2025': 'The requested record was not found.',
  'P2003': 'Cannot complete this action because it references data that doesn\'t exist.',
  'P2014': 'This action would violate a required relationship.',
  
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
    // Check for Prisma error codes
    const prismaError = error as { code?: string };
    if (prismaError.code && ERROR_MESSAGES[prismaError.code]) {
      return ERROR_MESSAGES[prismaError.code];
    }
    
    // Check for specific error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('duplicate') || message.includes('unique constraint')) {
      return ERROR_MESSAGES['P2002'];
    }
    if (message.includes('not found')) {
      return ERROR_MESSAGES['P2025'];
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
    const prismaError = error as { code?: string };
    
    // Prisma "not found" errors
    if (prismaError.code === 'P2025') {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      userMessage = ERROR_MESSAGES['P2025'];
    }
    // Prisma "duplicate" errors
    else if (prismaError.code === 'P2002') {
      statusCode = 409;
      errorCode = 'DUPLICATE';
      userMessage = ERROR_MESSAGES['P2002'];
    }
    // Validation errors
    else if (errorMessage.toLowerCase().includes('validation') || 
             errorMessage.toLowerCase().includes('invalid') ||
             errorMessage.toLowerCase().includes('required')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
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
