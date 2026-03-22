import i18n from './i18n';

/**
 * Safe translation function that prevents raw i18n keys from being displayed to users.
 * If a translation is missing, it logs a warning in development mode and returns
 * an empty string instead of the raw key.
 * 
 * @param key - The translation key to look up
 * @param options - Translation options (interpolation values, default value, etc.)
 * @returns Translated string or empty string if translation is missing
 */
export function safeTranslate(key: string, options?: any): string {
  const translated = i18n.t(key, options) as string;
  
  // Check if translation failed (i18next returns the key when translation is missing)
  if (translated === key) {
    // Log warning in development mode
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Missing translation for key: "${key}" (language: ${i18n.language})`);
    }
    
    // Return empty string instead of raw key to prevent displaying untranslated keys
    return "";
  }
  
  return translated;
}

/**
 * Safe translation function with fallback text.
 * Similar to safeTranslate but allows providing a fallback string.
 * 
 * @param key - The translation key to look up
 * @param fallback - Fallback text to show if translation is missing
 * @param options - Translation options (interpolation values, etc.)
 * @returns Translated string, fallback text, or empty string
 */
export function safeTranslateWithFallback(key: string, fallback: string = "", options?: any): string {
  const translated = i18n.t(key, options) as string;
  
  // Check if translation failed
  if (translated === key) {
    // Log warning in development mode
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Missing translation for key: "${key}" (language: ${i18n.language}), using fallback: "${fallback}"`);
    }
    
    return fallback;
  }
  
  return translated;
}

/**
 * Hook version of safe translate for React components.
 * This can be used as a drop-in replacement for useTranslation().
 */
export function useSafeTranslation() {
  return {
    t: safeTranslate,
    i18n
  };
}