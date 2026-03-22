// Theme service for dynamic CSS variable injection and real-time updates
let themeStyleElement: HTMLStyleElement | null = null;
let themeUpdateListener: (() => void) | null = null;

export interface ThemeColors {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  border_color: string;
  gradient_start: string;
  gradient_end: string;
  hero_gradient_start: string;
  hero_gradient_end: string;
}

/**
 * Load and apply dynamic theme CSS from the server
 */
export async function loadDynamicTheme(): Promise<boolean> {
  // FORCE NEON THEME: Bypass server fetch to ensure visual overhaul applies
  // TODO: Re-enable fetch once Admin Panel is updated with new presets
  const defaults = getThemeDefaults();
  applyThemeColors(defaults);
  return true;
  /*
  try {
    // Add cache-busting timestamp to force fresh load
    const timestamp = Date.now();
    const response = await fetch(`/api/theme.css?v=${timestamp}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) {
      return false;
    }
    
    const css = await response.text();
    injectThemeCSS(css);
    return true;
  } catch (error) {
    return false;
  }
  */
}

/**
 * Inject CSS directly into the document
 */
export function injectThemeCSS(css: string): void {
  // Remove existing theme style element
  if (themeStyleElement) {
    themeStyleElement.remove();
  }

  // Create new style element
  themeStyleElement = document.createElement('style');
  themeStyleElement.setAttribute('data-theme', 'dynamic');
  themeStyleElement.textContent = css;

  // Insert at the END of head for higher specificity
  document.head.appendChild(themeStyleElement);

}

/**
 * Apply theme colors directly as CSS variables
 */
export function applyThemeColors(colors: Partial<ThemeColors>): void {
  const root = document.documentElement;

  // Helper function to convert hex to HSL
  function hexToHsl(hex: string): string {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  // Apply color variables if provided
  if (colors.primary_color) {
    root.style.setProperty('--primary', hexToHsl(colors.primary_color), 'important');
    root.style.setProperty('--ring', hexToHsl(colors.primary_color), 'important');
    root.style.setProperty('--brand-primary', hexToHsl(colors.primary_color), 'important');
    root.style.setProperty('--accent-primary', hexToHsl(colors.primary_color), 'important');
  }

  if (colors.secondary_color) {
    root.style.setProperty('--secondary', hexToHsl(colors.secondary_color), 'important');
    root.style.setProperty('--brand-secondary', hexToHsl(colors.secondary_color), 'important');
    root.style.setProperty('--accent-secondary', hexToHsl(colors.secondary_color), 'important');
  }

  if (colors.accent_color) {
    root.style.setProperty('--accent', hexToHsl(colors.accent_color));
    root.style.setProperty('--brand-accent', hexToHsl(colors.accent_color));
  }

  if (colors.background_color) {
    root.style.setProperty('--background', hexToHsl(colors.background_color));
  }

  if (colors.surface_color) {
    root.style.setProperty('--surface', hexToHsl(colors.surface_color));
    root.style.setProperty('--card', hexToHsl(colors.surface_color));
    root.style.setProperty('--muted', hexToHsl(colors.surface_color));
    root.style.setProperty('--popover', hexToHsl(colors.surface_color));
    root.style.setProperty('--brand-surface', hexToHsl(colors.surface_color));
  }

  if (colors.text_color) {
    root.style.setProperty('--foreground', hexToHsl(colors.text_color));
    root.style.setProperty('--primary-foreground', hexToHsl(colors.text_color));
    root.style.setProperty('--secondary-foreground', hexToHsl(colors.text_color));
    root.style.setProperty('--card-foreground', hexToHsl(colors.text_color));
    root.style.setProperty('--popover-foreground', hexToHsl(colors.text_color));
    root.style.setProperty('--brand-text', hexToHsl(colors.text_color));
  }

  if (colors.border_color) {
    root.style.setProperty('--border', hexToHsl(colors.border_color));
    root.style.setProperty('--input', hexToHsl(colors.border_color));
  }

  // Apply gradient variables
  if (colors.gradient_start) {
    root.style.setProperty('--gradient-primary-start', colors.gradient_start);
  }

  if (colors.gradient_end) {
    root.style.setProperty('--gradient-primary-end', colors.gradient_end);
  }

  if (colors.hero_gradient_start) {
    root.style.setProperty('--gradient-hero-start', colors.hero_gradient_start);
  }

  if (colors.hero_gradient_end) {
    root.style.setProperty('--gradient-hero-end', colors.hero_gradient_end);
  }

  // Update computed gradients
  if (colors.gradient_start && colors.gradient_end) {
    root.style.setProperty('--bg-gradient', `linear-gradient(135deg, ${colors.gradient_start}, ${colors.gradient_end})`);
  }

  if (colors.hero_gradient_start && colors.hero_gradient_end) {
    root.style.setProperty('--hero-gradient', `linear-gradient(135deg, ${colors.hero_gradient_start}, ${colors.hero_gradient_end})`);
  }
}

/**
 * Set up polling for theme updates (fallback if WebSocket isn't available)
 */
export function setupThemePolling(intervalMs: number = 30000): void {
  themeUpdateListener = () => {
    loadDynamicTheme();
  };

  setInterval(themeUpdateListener, intervalMs);
}

/**
 * Manually trigger theme refresh
 */
export async function refreshTheme(): Promise<boolean> {
  return await loadDynamicTheme();
}

/**
 * Initialize theme system on app load
 */
export async function initializeTheme(): Promise<void> {
  // Load initial theme
  await loadDynamicTheme();

  // Set up polling for updates with longer interval for efficiency
  setupThemePolling(60000); // 1 minute instead of 30 seconds

  // Force immediate refresh to override static CSS
  setTimeout(() => {
    loadDynamicTheme();
  }, 100);


}

/**
 * Validate color format (hex)
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Get theme color fallbacks
 */
export function getThemeDefaults(): ThemeColors {
  return {
    primary_color: "#1F56F5",    // Brand Blue
    secondary_color: "#1F56F5",  // Brand Blue
    accent_color: "#7c3aed",     // Deep Purple
    background_color: "#030712", // Deepest Navy
    surface_color: "#0f172a",    // Deep Slate
    text_color: "#f8fafc",       // White/Slate-50
    border_color: "#1e293b",     // Slate-800
    gradient_start: "#1F56F5",
    gradient_end: "#1F56F5",
    hero_gradient_start: "#030712",
    hero_gradient_end: "#0f172a",
  };
}

/**
 * Preview theme changes temporarily without saving
 */
export function previewThemeColors(colors: Partial<ThemeColors>, duration: number = 5000): void {
  // Store current values
  const originalColors: Partial<ThemeColors> = {};
  const root = document.documentElement;

  // Store original values before applying preview
  Object.keys(colors).forEach(key => {
    const varName = `--${key.replace('_', '-')}`;
    originalColors[key as keyof ThemeColors] = root.style.getPropertyValue(varName);
  });

  // Apply preview colors
  applyThemeColors(colors);

  // Restore original values after duration
  setTimeout(() => {
    applyThemeColors(originalColors);
  }, duration);
}
