export interface ApiErrorInfo {
  message: string;
  errorCode?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  "FEATURE_NOT_AVAILABLE": "This feature is not included in your current plan. Upgrade your subscription to unlock this feature.",
  "INSUFFICIENT_CREDITS": "You don't have enough credits for this action. Please add more credits to continue.",
  "AUTH_REQUIRED": "Please sign in to continue.",
  "RATE_LIMITED": "You're making requests too quickly. Please wait a moment and try again.",
  "QUEUE_FULL": "Our servers are busy right now. Please try again in a few moments.",
  "GLOBAL_LIMIT": "Service is temporarily at capacity. Please try again shortly.",
  "CONFIG_ERROR": "Service configuration issue. Please try again later.",
  "TIMEOUT": "The request took too long. Please try again.",
  "NETWORK_ERROR": "Network connection issue. Please check your connection and try again.",
};

const FRIENDLY_STATUS_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your input and try again.",
  401: "Please sign in to continue.",
  402: "You don't have enough credits for this action. Please add more credits to continue.",
  403: "This feature is not included in your current plan. Please upgrade to access it.",
  404: "The requested resource was not found.",
  429: "Too many requests. Please wait and try again.",
  500: "Something went wrong on our end. Please try again later.",
  502: "Server is temporarily unavailable. Please try again.",
  503: "Service is temporarily unavailable. Please try again later.",
  504: "Request timed out. Please try again.",
};

export function parseApiError(error: Error | string): ApiErrorInfo {
  const errorStr = typeof error === "string" ? error : error.message;
  
  const statusMatch = errorStr.match(/^(\d{3}):\s*(.+)$/s);
  if (statusMatch) {
    const statusCode = parseInt(statusMatch[1], 10);
    const bodyText = statusMatch[2].trim();
    
    try {
      const jsonBody = JSON.parse(bodyText);
      const errorCode = jsonBody.errorCode || jsonBody.code;
      const rawMessage = jsonBody.error || jsonBody.message || jsonBody.msg;
      
      let friendlyMessage = rawMessage;
      
      if (errorCode && FRIENDLY_ERROR_MESSAGES[errorCode]) {
        friendlyMessage = FRIENDLY_ERROR_MESSAGES[errorCode];
      } else if (rawMessage && rawMessage.includes("plan does not include")) {
        friendlyMessage = FRIENDLY_ERROR_MESSAGES["FEATURE_NOT_AVAILABLE"];
      } else if (rawMessage && rawMessage.includes("Insufficient credits")) {
        friendlyMessage = FRIENDLY_ERROR_MESSAGES["INSUFFICIENT_CREDITS"];
      } else if (!friendlyMessage && FRIENDLY_STATUS_MESSAGES[statusCode]) {
        friendlyMessage = FRIENDLY_STATUS_MESSAGES[statusCode];
      }
      
      return {
        message: friendlyMessage || "An unexpected error occurred. Please try again.",
        errorCode,
        statusCode,
        details: jsonBody,
      };
    } catch {
      return {
        message: FRIENDLY_STATUS_MESSAGES[statusCode] || bodyText || "An unexpected error occurred.",
        statusCode,
      };
    }
  }
  
  return {
    message: errorStr || "An unexpected error occurred. Please try again.",
  };
}

export function getFriendlyErrorMessage(error: Error | string | unknown): string {
  if (!error) return "An unexpected error occurred. Please try again.";
  
  if (error instanceof Error) {
    const errObj = error as any;
    if (errObj.status && typeof errObj.status === "number") {
      if (errObj.data?.errorCode && FRIENDLY_ERROR_MESSAGES[errObj.data.errorCode]) {
        return FRIENDLY_ERROR_MESSAGES[errObj.data.errorCode];
      }
      if (errObj.data?.message) {
        if (errObj.data.message.includes("plan does not include")) {
          return FRIENDLY_ERROR_MESSAGES["FEATURE_NOT_AVAILABLE"];
        }
        if (errObj.data.message.includes("Insufficient credits") || errObj.status === 402) {
          return FRIENDLY_ERROR_MESSAGES["INSUFFICIENT_CREDITS"];
        }
      }
      if (FRIENDLY_STATUS_MESSAGES[errObj.status]) {
        return FRIENDLY_STATUS_MESSAGES[errObj.status];
      }
    }
    return parseApiError(error).message;
  }
  
  if (typeof error === "string") {
    return parseApiError(error).message;
  }
  
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, any>;
    if (obj.status && typeof obj.status === "number") {
      if (obj.data?.errorCode && FRIENDLY_ERROR_MESSAGES[obj.data.errorCode]) {
        return FRIENDLY_ERROR_MESSAGES[obj.data.errorCode];
      }
      if (FRIENDLY_STATUS_MESSAGES[obj.status]) {
        return FRIENDLY_STATUS_MESSAGES[obj.status];
      }
    }
    if (obj.message) {
      return parseApiError(obj.message).message;
    }
    if (obj.error) {
      return typeof obj.error === "string" ? obj.error : "An error occurred.";
    }
  }
  
  return "An unexpected error occurred. Please try again.";
}

export function isUpgradeRequiredError(error: Error | string | unknown): boolean {
  if (!error) return false;
  
  const parsed = error instanceof Error || typeof error === "string" 
    ? parseApiError(error as Error | string)
    : null;
    
  return parsed?.errorCode === "FEATURE_NOT_AVAILABLE" || 
         parsed?.errorCode === "INSUFFICIENT_CREDITS" ||
         parsed?.message?.includes("upgrade") ||
         parsed?.message?.includes("plan does not include");
}
