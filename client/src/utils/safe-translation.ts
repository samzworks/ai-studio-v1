import { TFunction } from 'i18next';

/**
 * Extract a clean error message from various error object structures
 * @param error - Error object from API call or other source
 * @returns Clean error message string
 */
export function extractErrorMessage(error: any): string {
  // Try to extract from structured API response (fetch/axios style)
  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (data.details?.message) return data.details.message;
  }
  
  // Try standard error fields
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }
  
  if (error?.statusText && typeof error.statusText === 'string') {
    return error.statusText;
  }
  
  // If error is already a string
  if (typeof error === 'string') {
    return error;
  }
  
  // Final fallback
  return 'An unexpected error occurred';
}

/**
 * Safe translation utility that prevents raw translation keys from being displayed to users.
 * Falls back to user-friendly messages when translations are missing.
 */
export function createSafeTranslation(t: TFunction) {
  /**
   * Safely translate a key with fallback handling
   * @param key - Translation key
   * @param options - Translation options (interpolation variables)
   * @param fallback - Custom fallback message (optional)
   * @returns Translated text or fallback message, never raw keys
   */
  function safeT(key: string, options: any = {}, fallback?: string): string {
    try {
      const translated = t(key, options);
      const translatedStr = String(translated);
      
      // Check if translation failed (key returned as-is)
      if (translatedStr === key || !translatedStr || translatedStr.trim() === '') {
        // Log missing translation in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[i18n-missing] Translation key "${key}" is missing or empty`);
        }
        
        // Return custom fallback or generic message
        return fallback || getGenericFallback(key, options);
      }
      
      return translatedStr;
    } catch (error) {
      // Log translation error in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`[i18n-error] Failed to translate "${key}":`, error);
      }
      
      // Return custom fallback or generic message
      return fallback || getGenericFallback(key, options);
    }
  }

  /**
   * Generate a generic fallback message based on the translation key pattern
   */
  function getGenericFallback(key: string, options: any = {}): string {
    // Extract error code if available
    const errorCode = options.code || '500';
    
    // Provide contextual fallbacks based on key patterns
    if (key.includes('contactSupportWithCode') || key.includes('generationError')) {
      return `An error occurred (Error ${errorCode}). Please contact support if the issue persists.`;
    }
    
    if (key.includes('generationFailed') || key.includes('failed')) {
      return 'Operation failed. Please try again.';
    }
    
    if (key.includes('unauthorized') || key.includes('login')) {
      return 'Please sign in to continue.';
    }
    
    if (key.includes('progress.failed')) {
      return 'Generation failed. Please try again.';
    }
    
    if (key.includes('success')) {
      return 'Operation completed successfully.';
    }
    
    // Generic fallback for unknown keys
    return 'An error occurred. Please try again or contact support.';
  }

  /**
   * Safe translation specifically for error messages with role-based display
   * @param key - Translation key for error message
   * @param error - Error object
   * @param isAdmin - Whether user is admin
   * @param options - Additional translation options
   */
  function safeErrorT(key: string, error: any, isAdmin: boolean, options: any = {}): string {
    const errorCode = error?.response?.status || error?.status || error?.code || '500';
    const translationOptions = { ...options, code: errorCode };
    
    if (isAdmin) {
      // For admins, extract and show clean technical error message
      return extractErrorMessage(error);
    } else {
      // For regular users, always use safe translated user-friendly messages
      return safeT(key, translationOptions);
    }
  }

  return {
    safeT,
    safeErrorT
  };
}