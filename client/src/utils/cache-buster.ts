// Cache busting utilities for session-specific issues

/**
 * Clear browser cache related data that might cause display issues
 */
export function clearBrowserCache(): void {
  try {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage  
    sessionStorage.clear();
    
    // Force reload all stylesheets
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    stylesheets.forEach((sheet: any) => {
      const href = sheet.href;
      sheet.href = href + (href.includes('?') ? '&' : '?') + 'v=' + Date.now();
    });
    
    // Force reload dynamic theme
    const themeElement = document.querySelector('style[data-theme="dynamic"]');
    if (themeElement) {
      themeElement.remove();
    }
    
    console.log('Browser cache cleared for fresh session');
  } catch (error) {
    console.warn('Cache clearing failed:', error);
  }
}

/**
 * Add cache-busting parameters to URLs
 */
export function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

/**
 * Detect if we're in a potentially cached/problematic session
 */
export function isProblemSession(): boolean {
  try {
    // Check for signs of cached session issues
    const hasOldCache = localStorage.getItem('last_cache_clear');
    const sessionAge = Date.now() - (parseInt(hasOldCache || '0') || 0);
    
    // If last cache clear was more than 1 hour ago, or never
    return !hasOldCache || sessionAge > 3600000;
  } catch {
    return true; // Default to clearing if we can't check
  }
}

/**
 * Auto-clear cache if session seems problematic
 */
export function autoFixSession(): void {
  if (isProblemSession()) {
    clearBrowserCache();
    localStorage.setItem('last_cache_clear', Date.now().toString());
  }
}

/**
 * Force clear specific user state issues
 */
export function forceUserStateReset(): void {
  try {
    // Clear all user-specific localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('user') || key.includes('auth') || key.includes('favorite') || key.includes('gallery'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage completely
    sessionStorage.clear();
    
    // Force refresh authentication state
    const authEvent = new CustomEvent('auth-reset');
    window.dispatchEvent(authEvent);
    
    console.log('User state reset completed');
  } catch (error) {
    console.warn('User state reset failed:', error);
  }
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).clearBrowserCache = clearBrowserCache;
  (window as any).forceUserStateReset = forceUserStateReset;
  (window as any).autoFixSession = autoFixSession;
}