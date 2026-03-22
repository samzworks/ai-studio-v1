import { useQuery } from "@tanstack/react-query";

export interface SiteConfig {
  // Branding
  site_name: string;
  site_logo: string;
  site_tagline: string;
  favicon_url: string;
  
  // UI Copy
  generate_button_text: string;
  reset_button_text: string;
  stop_all_button_text: string;
  landing_headline: string;
  landing_subtext: string;
  my_gallery_text: string;
  public_gallery_text: string;
  
  // Models
  show_dall_e_3: boolean;
  show_flux_pro: boolean;
  show_flux_dev: boolean;
  show_flux_schnell: boolean;
  dall_e_3_display_name: string;
  flux_pro_display_name: string;
  flux_dev_display_name: string;
  flux_schnell_display_name: string;
  
  // Registration
  allow_registration: boolean;
  registration_message: string;
  
  // Theme Colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  border_color: string;
  
  // Gradient Colors
  gradient_start: string;
  gradient_end: string;
  hero_gradient_start: string;
  hero_gradient_end: string;
  
  // SEO
  meta_title: string;
  meta_description: string;
  og_image: string;
  
  // Advanced
  maintenance_mode: boolean;
  analytics_id: string;
  meta_pixel_id: string;
  footer_copyright: string;
  style_upload_enabled: boolean;
  images_per_generation: number;
  
  // Service Card Images
  service_card_image_alfia_saudi: string;
  service_card_image_create_image: string;
  service_card_image_create_video: string;
  service_card_image_film_studio: string;
  
  [key: string]: any;
}

export function useSiteConfig() {
  const { data: config, isLoading, error } = useQuery<SiteConfig>({
    queryKey: ["/api/config"],
    staleTime: 1000 * 30, // 30 seconds - shorter for admin changes
    refetchInterval: 1000 * 60, // 1 minute - more frequent updates
    refetchOnWindowFocus: true, // Refetch when admin returns to tab
  });

  const getConfig = (key: string, defaultValue: any = "") => {
    return config?.[key] ?? defaultValue;
  };

  return {
    config,
    getConfig,
    isLoading,
    error,
  };
}