/**
 * Utility for consistent error logging that prevents [object Object] console messages
 */

export interface ErrorDetails {
  message?: string;
  code?: string | number;
  details?: any;
  hint?: string;
  timestamp?: string;
  context?: Record<string, any>;
}

/**
 * Safely extracts error details from any error object
 */
export const extractErrorDetails = (error: unknown, context?: Record<string, any>): ErrorDetails => {
  const details: ErrorDetails = {
    timestamp: new Date().toISOString(),
    context
  };

  try {
    if (error instanceof Error) {
      details.message = error.message || 'Error with no message';
      if ('code' in error && error.code) details.code = (error as any).code;
      if ('details' in error && error.details) details.details = (error as any).details;
      if ('hint' in error && error.hint) details.hint = (error as any).hint;
    } else if (error && typeof error === 'object') {
      const errorObj = error as any;
      details.message = (
        errorObj.message ||
        errorObj.error_description ||
        errorObj.details ||
        errorObj.hint ||
        'Unknown error'
      );
      if (errorObj.code) details.code = errorObj.code;
      if (errorObj.details && typeof errorObj.details === 'string') details.details = errorObj.details;
      if (errorObj.hint && typeof errorObj.hint === 'string') details.hint = errorObj.hint;
    } else if (typeof error === 'string') {
      details.message = error || 'Unknown error';
    } else {
      details.message = 'Unknown error type';
    }
  } catch (extractError) {
    details.message = 'Failed to extract error details';
  }

  return details;
};

/**
 * Safely serialize objects, handling circular references
 */
const safeStringify = (obj: any): string => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch {
    return String(obj);
  }
};

/**
 * Logs errors with proper formatting to prevent [object Object] issues
 */
export const logError = (label: string, error: unknown, context?: Record<string, any>) => {
  const errorDetails = extractErrorDetails(error, context);
  console.error(label, safeStringify(errorDetails));
};

/**
 * Logs warnings with proper formatting
 */
export const logWarning = (label: string, error: unknown, context?: Record<string, any>) => {
  const errorDetails = extractErrorDetails(error, context);
  console.warn(label, errorDetails);
};

/**
 * Gets a user-friendly error message from any error
 */
export const getUserFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  
  return 'An unexpected error occurred';
};

/**
 * Checks if an error is a specific type (e.g., auth, network, permission)
 */
export const isErrorType = (error: unknown, type: 'auth' | 'network' | 'permission' | 'validation'): boolean => {
  const message = getUserFriendlyErrorMessage(error).toLowerCase();
  
  switch (type) {
    case 'auth':
      return message.includes('jwt') || 
             message.includes('token') || 
             message.includes('unauthorized') ||
             message.includes('authentication') ||
             message.includes('invalid_token');
             
    case 'network':
      return message.includes('fetch') || 
             message.includes('network') || 
             message.includes('connection') ||
             message.includes('timeout');
             
    case 'permission':
      return message.includes('permission') || 
             message.includes('unauthorized') || 
             message.includes('row level security') ||
             message.includes('access denied');
             
    case 'validation':
      return message.includes('validation') || 
             message.includes('required') || 
             message.includes('invalid') ||
             message.includes('constraint');
             
    default:
      return false;
  }
};
