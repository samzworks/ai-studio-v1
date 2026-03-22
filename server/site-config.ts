import { storage } from "./storage";

// Site configuration cache
let configCache: Map<string, any> = new Map();

// Initialize configuration cache
export async function initializeConfig() {
  try {
    const settings = await storage.getSiteSettings();
    configCache.clear();
    settings.forEach(setting => {
      configCache.set(setting.key, setting.value);
    });
    console.log("Site configuration cache initialized");
  } catch (error) {
    console.error("Failed to initialize site configuration:", error);
  }
}

// Get a configuration value
export function getConfig(key: string, defaultValue: any = null): any {
  return configCache.get(key) ?? defaultValue;
}

// Update configuration cache
export function updateConfigCache(key: string, value: any) {
  configCache.set(key, value);
}

// Get all configuration
export function getAllConfig(): Record<string, any> {
  return Object.fromEntries(configCache);
}

// Default configuration values
export const DEFAULT_CONFIG = {
  // Branding
  site_name: "Tkoeen",
  site_logo: "",
  site_tagline: "Create amazing AI-generated images",
  favicon_url: "",
  
  // UI Copy
  generate_button_text: "Generate",
  reset_button_text: "Reset",
  stop_all_button_text: "Stop All",
  landing_headline: "AI Image Generation Platform",
  landing_subtext: "Create stunning images with the power of AI",
  my_gallery_text: "My Gallery",
  public_gallery_text: "Public Gallery",
  
  // Models - visibility and display names
  show_dall_e_3: true,
  show_flux_pro: true,
  show_flux_dev: true,
  show_flux_schnell: true,
  show_luma_ray_flash_2_540p: true,
  show_wan_2_2_i2v_fast: true,
  show_wan_2_2_t2v_fast: true,
  // fal.ai models (existing and new)
  show_fal_flux_schnell: true,
  show_fal_flux_dev: true,
  show_fal_flux_pro: true,
  show_fal_imagen_4_fast: true,
  show_fal_imagen_4: true,
  show_fal_nano_banana_txt2img: true,
  show_fal_nano_banana_img2img: true,
  show_fal_seedream_4_txt2img: true,
  show_fal_seedream_4_img2img: true,
  show_fal_sdxl: true,
  dall_e_3_display_name: "DALL-E 3",
  flux_pro_display_name: "Flux Pro",
  flux_dev_display_name: "Flux Dev",
  flux_schnell_display_name: "Flux Schnell",
  luma_ray_flash_2_540p_display_name: "Luma Ray Flash 2 540p",
  wan_2_2_i2v_fast_display_name: "WAN 2.2 Image-to-Video Fast",
  wan_2_2_t2v_fast_display_name: "WAN 2.2 Text-to-Video Fast",
  // WAN 2.5 Preview video models
  wan_2_5_preview_t2v_display_name: "WAN 2.5 Preview Text-to-Video",
  wan_2_5_preview_i2v_display_name: "WAN 2.5 Preview Image-to-Video",
  // VEO 3.1 video models
  fal_veo3_t2v_display_name: "VEO 3.1 (Text to Video)",
  fal_veo3_i2v_display_name: "VEO 3.1 (Image to Video)",
  fal_veo3_fast_t2v_display_name: "VEO 3.1 Fast (Text to Video)",
  fal_veo3_fast_i2v_display_name: "VEO 3.1 Fast (Image to Video)",
  // fal.ai model display names (existing and new)
  fal_flux_schnell_display_name: "FLUX Schnell (fal.ai)",
  fal_flux_dev_display_name: "FLUX Dev (fal.ai)",
  fal_flux_pro_display_name: "FLUX Pro (fal.ai)",
  fal_imagen_4_fast_display_name: "Imagen 4 Fast (fal.ai)",
  fal_imagen_4_display_name: "Imagen 4 (fal.ai)",
  fal_nano_banana_txt2img_display_name: "Nano Banana Text-to-Image (fal.ai)",
  fal_nano_banana_img2img_display_name: "Nano Banana Image-to-Image (fal.ai)",
  fal_seedream_4_txt2img_display_name: "SeeDream 4 Text-to-Image (fal.ai)",
  fal_seedream_4_img2img_display_name: "SeeDream 4 Image-to-Image (fal.ai)",
  fal_sdxl_display_name: "Stable Diffusion XL (fal.ai)",

  // Default Models
  default_image_model: "dall-e-3",
  default_video_model: "wan-2.5-preview-t2v",
  
  // Registration
  allow_registration: true,
  registration_message: "Join our AI image generation platform",
  
  // Theme Colors
  primary_color: "#083c4c",
  secondary_color: "#988484",
  accent_color: "#f59e0b",
  background_color: "#4a4a4a",
  surface_color: "#262626",
  text_color: "#fafafa",
  border_color: "#404040",
  
  // Gradient Colors
  gradient_start: "#083c4c",
  gradient_end: "#988484",
  hero_gradient_start: "#4a4a4a",
  hero_gradient_end: "#262626",
  
  // SEO
  meta_title: "Tkoeen - AI Image Generation",
  meta_description: "Create stunning AI-generated images with our advanced platform",
  og_image: "",
  
  // Advanced
  maintenance_mode: false,
  analytics_id: "",
  meta_pixel_id: "",
  footer_copyright: "© 2025 Tkoeen. All rights reserved.",
  style_upload_enabled: true,
  default_currency: "USD",
  
  // API Provider Settings
  primary_ai_provider: "replicate",
  fallback_ai_provider: "fal",
  enable_provider_fallback: true,
  replicate_api_status: "active",
  fal_api_status: "active",
  
  // Queue Settings - Simplified model
  max_active_jobs_per_user: 8,  // Total active jobs (running + queued) allowed per user
  max_queued_jobs_per_user: 4,  // Maximum jobs waiting in queue per user
  max_running_jobs_per_user: 4, // Maximum concurrent running jobs per user
  max_global_active_jobs: 100,
  jobs_per_minute_limit: 10,
  button_throttle_ms: 1500,
  
  // Model Family Icons - Image
  image_family_icon_gpt_image: '🎨',
  image_family_icon_flux: '⚡',
  image_family_icon_imagen: 'G',
  image_family_icon_nano_banana: '🍌',
  image_family_icon_seedream: '💫',
  
  // Model Family Icons - Video
  video_family_icon_sora: '🎬',
  video_family_icon_wan: '🎥',
  video_family_icon_veo: 'G',
  video_family_icon_luma: '✨',
  video_family_icon_kling: '🎞️',
  video_family_icon_hailuo: '🚀',
  video_family_icon_seedance: '🎭',
  video_family_icon_higgsfield: '⚡',
  
  // Content Moderation Settings
  moderation_enabled: true,
};

// Initialize default settings if they don't exist
export async function ensureDefaultSettings(adminId: string) {
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    const existing = await storage.getSiteSetting(key);
    if (!existing) {
      await storage.setSiteSetting({
        key,
        value,
        category: getCategoryForKey(key),
        description: getDescriptionForKey(key),
        updatedBy: adminId,
      });
      configCache.set(key, value);
    }
  }
}

function getCategoryForKey(key: string): string {
  if (key.includes('site_') || key.includes('logo') || key.includes('tagline') || key.includes('favicon')) return 'branding';
  if (key.includes('button') || key.includes('landing') || key.includes('gallery')) return 'ui_text';
  if (key.includes('show_') || key.includes('display_name') || key.includes('default_')) return 'features';
  if (key.includes('registration') || key.includes('allow_')) return 'security';
  if (key.includes('color') || key.includes('gradient')) return 'branding';
  if (key.includes('meta_') || key.includes('og_')) return 'seo';
  if (key.includes('provider') || key.includes('api_')) return 'api_providers';
  if (key.includes('style_upload')) return 'advanced';
  if (key.includes('max_active_jobs') || key.includes('max_queued_jobs') || key.includes('max_running_jobs') || key.includes('max_global') || key.includes('jobs_per_minute') || key.includes('throttle')) return 'queue_settings';
  if (key.includes('family_icon')) return 'model_groups';
  return 'advanced';
}

function getDescriptionForKey(key: string): string {
  const descriptions: Record<string, string> = {
    site_name: "Website name displayed in header",
    site_logo: "Website logo URL",
    site_tagline: "Tagline displayed on landing page",
    favicon_url: "Favicon URL",
    generate_button_text: "Main generate button label",
    reset_button_text: "Reset form button label",
    stop_all_button_text: "Stop all jobs button label",
    landing_headline: "Main headline for visitors",
    landing_subtext: "Subtitle for visitors",
    my_gallery_text: "My gallery menu item",
    public_gallery_text: "Public gallery menu item",
    show_dall_e_3: "Show DALL-E 3 model",
    show_flux_pro: "Show Flux Pro model",
    show_flux_dev: "Show Flux Dev model",
    show_flux_schnell: "Show Flux Schnell model",
    show_fal_flux_schnell: "Show FLUX Schnell (fal.ai) model",
    show_fal_flux_dev: "Show FLUX Dev (fal.ai) model",
    show_fal_flux_pro: "Show FLUX Pro (fal.ai) model",
    show_fal_imagen_4_fast: "Show Imagen 4 Fast (fal.ai) model",
    show_fal_imagen_4: "Show Imagen 4 (fal.ai) model",
    show_fal_nano_banana_txt2img: "Show Nano Banana Text-to-Image (fal.ai) model",
    show_fal_nano_banana_img2img: "Show Nano Banana Image-to-Image (fal.ai) model",
    show_fal_seedream_4_txt2img: "Show SeeDream 4 Text-to-Image (fal.ai) model",
    show_fal_seedream_4_img2img: "Show SeeDream 4 Image-to-Image (fal.ai) model",
    show_fal_sdxl: "Show Stable Diffusion XL (fal.ai) model",
    dall_e_3_display_name: "DALL-E 3 display name",
    flux_pro_display_name: "Flux Pro display name",
    flux_dev_display_name: "Flux Dev display name",
    flux_schnell_display_name: "Flux Schnell display name",
    fal_flux_schnell_display_name: "FLUX Schnell (fal.ai) display name",
    fal_flux_dev_display_name: "FLUX Dev (fal.ai) display name",
    fal_flux_pro_display_name: "FLUX Pro (fal.ai) display name",
    fal_imagen_4_fast_display_name: "Imagen 4 Fast (fal.ai) display name",
    fal_imagen_4_display_name: "Imagen 4 (fal.ai) display name",
    fal_nano_banana_txt2img_display_name: "Nano Banana Text-to-Image (fal.ai) display name",
    fal_nano_banana_img2img_display_name: "Nano Banana Image-to-Image (fal.ai) display name",
    fal_seedream_4_txt2img_display_name: "SeeDream 4 Text-to-Image (fal.ai) display name",
    fal_seedream_4_img2img_display_name: "SeeDream 4 Image-to-Image (fal.ai) display name",
    fal_sdxl_display_name: "Stable Diffusion XL (fal.ai) display name",
    wan_2_5_preview_t2v_display_name: "WAN 2.5 Preview Text-to-Video display name",
    wan_2_5_preview_i2v_display_name: "WAN 2.5 Preview Image-to-Video display name",
    fal_veo3_t2v_display_name: "VEO 3.1 Text-to-Video display name",
    fal_veo3_i2v_display_name: "VEO 3.1 Image-to-Video display name",
    fal_veo3_fast_t2v_display_name: "VEO 3.1 Fast Text-to-Video display name",
    fal_veo3_fast_i2v_display_name: "VEO 3.1 Fast Image-to-Video display name",
    allow_registration: "Allow new user registrations",
    registration_message: "Message shown on registration",
    primary_color: "Primary brand color for buttons and accents",
    secondary_color: "Secondary color for subtle elements",
    accent_color: "Accent color for highlights and call-to-actions",
    background_color: "Main background color",
    surface_color: "Card and component background color",
    text_color: "Main text color",
    border_color: "Border and divider color",
    gradient_start: "Primary gradient start color",
    gradient_end: "Primary gradient end color",
    hero_gradient_start: "Hero section gradient start color",
    hero_gradient_end: "Hero section gradient end color",
    meta_title: "Default page title",
    meta_description: "Default meta description",
    og_image: "Open Graph image URL",
    maintenance_mode: "Enable maintenance mode",
    analytics_id: "Google Analytics ID",
    meta_pixel_id: "Meta Pixel ID",
    footer_copyright: "Footer copyright text",
    style_upload_enabled: "Enable style image upload feature globally",
    primary_ai_provider: "Primary AI provider for image/video generation",
    fallback_ai_provider: "Backup provider when primary is unavailable",
    enable_provider_fallback: "Automatically switch to fallback provider on errors",
    replicate_api_status: "Current status of Replicate API",
    fal_api_status: "Current status of fal.ai API",
    max_active_jobs_per_user: "Maximum active jobs (running + queued) per user",
    max_queued_jobs_per_user: "Maximum jobs waiting in queue per user",
    max_running_jobs_per_user: "Maximum concurrent running jobs per user",
    max_global_active_jobs: "Maximum total active jobs across all users",
    jobs_per_minute_limit: "Rate limit: max new jobs per user per minute",
    button_throttle_ms: "Frontend button throttle delay in milliseconds",
    // Image Model Family Icons
    image_family_icon_gpt_image: "Icon for GPT Image model group",
    image_family_icon_flux: "Icon for FLUX model group",
    image_family_icon_imagen: "Icon for Imagen model group",
    image_family_icon_nano_banana: "Icon for Nano Banana model group",
    image_family_icon_seedream: "Icon for SeeDream model group",
    // Video Model Family Icons
    video_family_icon_sora: "Icon for OpenAI Sora model group",
    video_family_icon_wan: "Icon for WAN model group",
    video_family_icon_veo: "Icon for Google Veo model group",
    video_family_icon_luma: "Icon for Luma Dream Machine model group",
    video_family_icon_kling: "Icon for Kling model group",
    video_family_icon_hailuo: "Icon for Minimax Hailuo model group",
    video_family_icon_seedance: "Icon for Seedance model group",
    video_family_icon_higgsfield: "Icon for Higgsfield model group",
    // Content Moderation
    moderation_enabled: "Enable AI prompt moderation for Saudi/GCC cultural safety",
  };
  return descriptions[key] || `Configuration for ${key}`;
}

// Helper function to convert hex color to HSL values for CSS variables
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
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

  // Convert to percentages and return as space-separated values for CSS
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Generate dynamic CSS variables based on current configuration
export function generateThemeCSS(): string {
  const primaryColor = getConfig("primary_color", DEFAULT_CONFIG.primary_color);
  const secondaryColor = getConfig("secondary_color", DEFAULT_CONFIG.secondary_color);
  const accentColor = getConfig("accent_color", DEFAULT_CONFIG.accent_color);
  const backgroundColor = getConfig("background_color", DEFAULT_CONFIG.background_color);
  const surfaceColor = getConfig("surface_color", DEFAULT_CONFIG.surface_color);
  const textColor = getConfig("text_color", DEFAULT_CONFIG.text_color);
  const borderColor = getConfig("border_color", DEFAULT_CONFIG.border_color);
  const gradientStart = getConfig("gradient_start", DEFAULT_CONFIG.gradient_start);
  const gradientEnd = getConfig("gradient_end", DEFAULT_CONFIG.gradient_end);
  const heroGradientStart = getConfig("hero_gradient_start", DEFAULT_CONFIG.hero_gradient_start);
  const heroGradientEnd = getConfig("hero_gradient_end", DEFAULT_CONFIG.hero_gradient_end);

  return `
/* Dynamic Theme Variables - Higher Specificity */
:root, html, body {
  /* Dynamic Brand Colors - Override with !important */
  --primary: ${hexToHsl(primaryColor)} !important;
  --primary-foreground: ${hexToHsl(textColor)} !important;
  --secondary: ${hexToHsl(secondaryColor)} !important;
  --secondary-foreground: ${hexToHsl(textColor)} !important;
  --accent: ${hexToHsl(accentColor)} !important;
  --accent-foreground: ${hexToHsl(backgroundColor)} !important;
  --background: ${hexToHsl(backgroundColor)} !important;
  --foreground: ${hexToHsl(textColor)} !important;
  --muted: ${hexToHsl(surfaceColor)} !important;
  --card: ${hexToHsl(surfaceColor)} !important;
  --popover: ${hexToHsl(surfaceColor)} !important;
  --border: ${hexToHsl(borderColor)} !important;
  --input: ${hexToHsl(borderColor)} !important;
  --ring: ${hexToHsl(primaryColor)} !important;
  
  /* Custom Dynamic Colors */
  --brand-primary: ${hexToHsl(primaryColor)} !important;
  --brand-secondary: ${hexToHsl(secondaryColor)} !important;
  --brand-accent: ${hexToHsl(accentColor)} !important;
  --brand-surface: ${hexToHsl(surfaceColor)} !important;
  --brand-text: ${hexToHsl(textColor)} !important;
  
  /* Override legacy custom variables */
  --accent-primary: ${hexToHsl(primaryColor)} !important;
  --accent-secondary: ${hexToHsl(secondaryColor)} !important;
  --accent-amber: ${hexToHsl(accentColor)} !important;
  --dark-bg: ${hexToHsl(backgroundColor)} !important;
  --dark-surface: ${hexToHsl(surfaceColor)} !important;
  --dark-elevated: ${hexToHsl(surfaceColor)} !important;
  
  /* Dynamic Gradient Variables - Almost transparent */
  --gradient-primary-start: rgba(0, 0, 0, 0.1) !important;
  --gradient-primary-end: rgba(0, 0, 0, 0.1) !important;
  --gradient-hero-start: rgba(0, 0, 0, 0.05) !important;
  --gradient-hero-end: rgba(0, 0, 0, 0.05) !important;
  
  /* Computed gradient values */
  --bg-gradient: linear-gradient(135deg, var(--gradient-primary-start), var(--gradient-primary-end)) !important;
  --hero-gradient: linear-gradient(135deg, var(--gradient-hero-start), var(--gradient-hero-end)) !important;
}

.dark, .dark *, [data-theme="dark"], html.dark {
  --primary: ${hexToHsl(primaryColor)} !important;
  --primary-foreground: ${hexToHsl(textColor)} !important;
  --secondary: ${hexToHsl(secondaryColor)} !important;
  --secondary-foreground: ${hexToHsl(textColor)} !important;
  --accent: ${hexToHsl(accentColor)} !important;
  --accent-foreground: ${hexToHsl(backgroundColor)} !important;
  --background: ${hexToHsl(backgroundColor)} !important;
  --foreground: ${hexToHsl(textColor)} !important;
  --muted: ${hexToHsl(surfaceColor)} !important;
  --card: ${hexToHsl(surfaceColor)} !important;
  --popover: ${hexToHsl(surfaceColor)} !important;
  --border: ${hexToHsl(borderColor)} !important;
  --input: ${hexToHsl(borderColor)} !important;
  --ring: ${hexToHsl(primaryColor)} !important;
}
`.trim();
}