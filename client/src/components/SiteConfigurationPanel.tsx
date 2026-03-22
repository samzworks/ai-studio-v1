import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Save, Upload, Trash as Trash2, Eye, SlidersHorizontal as Settings, Palette, Compass as Globe, Shield, FileText, ImageIcon, Timer, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import ModelManagement from "./ModelManagement";

interface SiteSetting {
  id: number;
  key: string;
  value: any;
  category: string;
  description?: string;
  updatedAt: string;
  updatedBy: string;
}

interface SettingFormData {
  [key: string]: any;
}

export default function SiteConfigurationPanel() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("branding");
  const [formData, setFormData] = useState<SettingFormData>({});
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  // Fetch all site settings
  const { data: settings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  // Clear formData when settings are refreshed to ensure UI reflects database state
  useEffect(() => {
    if (settings) {
      setFormData({});
      setPendingChanges(new Set());
    }
  }, [settings]);

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async (data: { key: string; value: any; category: string; description?: string }) => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update setting");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to trigger refetch with fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      
      toast({
        title: t("toasts.success"),
        description: t("toasts.updated"),
      });
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (data: { file: File; type: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      
      const response = await fetch(`/api/admin/upload/${data.type}`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload file");
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to trigger refetch with fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      
      toast({
        title: t("toasts.success"),
        description: t("toasts.updated"),
      });
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Delete setting mutation
  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch(`/api/admin/settings/${key}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete setting");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.deleted"),
      });
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Get settings by category
  const getSettingsByCategory = (category: string) => {
    return settings?.filter(setting => setting.category === category) || [];
  };

  // Get setting value with proper type handling
  const getSettingValue = (key: string, defaultValue: any = "") => {
    const setting = settings?.find(s => s.key === key);
    
    // Check formData first (for pending changes)
    if (formData[key] !== undefined) {
      return formData[key];
    }
    
    // Use database value if available
    if (setting?.value !== undefined) {
      // Handle boolean conversion properly
      if (typeof defaultValue === 'boolean') {
        return setting.value === true || setting.value === 'true';
      }
      return setting.value;
    }
    
    // Fall back to default
    return defaultValue;
  };

  // Handle form change
  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setPendingChanges(prev => new Set(Array.from(prev).concat([key])));
  };

  // Save setting
  const saveSetting = async (key: string, category: string, description?: string) => {
    const value = formData[key];
    if (value === undefined) return;

    try {
      await updateSettingMutation.mutateAsync({
        key,
        value,
        category,
        description,
      });

      // Clear from formData to reflect saved state
      setFormData(prev => {
        const newData = { ...prev };
        delete newData[key];
        return newData;
      });

      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File, type: string) => {
    try {
      await uploadFileMutation.mutateAsync({ file, type });
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  // Save all pending changes in a category
  const saveCategory = async (category: string) => {
    const categorySettings = defaultSettings[category as keyof typeof defaultSettings] || [];
    const pendingInCategory = Array.from(pendingChanges).filter(key => 
      categorySettings.some(s => s.key === key)
    );

    for (const key of pendingInCategory) {
      const setting = categorySettings.find(s => s.key === key);
      await saveSetting(key, category, setting?.description);
    }
  };

  // Initialize default settings if they don't exist
  const defaultSettings = {
    branding: [
      { key: "site_name", description: "Website name displayed in header", defaultValue: "Tkoeen" },
      { key: "site_logo", description: "Website logo URL", defaultValue: "" },
      { key: "site_tagline", description: "Tagline displayed on landing page", defaultValue: "Create amazing AI-generated images" },
    ],
    ui_copy: [
      { key: "generate_button_text", description: "Main generate button label", defaultValue: "Generate" },
      { key: "reset_button_text", description: "Reset form button label", defaultValue: "Reset" },
      { key: "stop_all_button_text", description: "Stop all jobs button label", defaultValue: "Stop All" },
      { key: "landing_headline", description: "Main headline for visitors", defaultValue: "AI Image Generation Platform" },
      { key: "landing_subtext", description: "Subtitle for visitors", defaultValue: "Create stunning images with the power of AI" },
      { key: "my_gallery_text", description: "My gallery menu item", defaultValue: "My Gallery" },
      { key: "public_gallery_text", description: "Public gallery menu item", defaultValue: "Public Gallery" },
    ],
    models: [
      { key: "show_dall_e_3", description: "Show DALL-E 3 model", defaultValue: true },
      { key: "show_flux_pro", description: "Show Flux Pro model", defaultValue: true },
      { key: "show_flux_dev", description: "Show Flux Dev model", defaultValue: true },
      { key: "show_flux_schnell", description: "Show Flux Schnell model", defaultValue: true },
      { key: "dall_e_3_display_name", description: "DALL-E 3 display name", defaultValue: "DALL-E 3" },
      { key: "flux_pro_display_name", description: "Flux Pro display name", defaultValue: "Flux Pro" },
      { key: "flux_dev_display_name", description: "Flux Dev display name", defaultValue: "Flux Dev" },
      { key: "flux_schnell_display_name", description: "Flux Schnell display name", defaultValue: "Flux Schnell" },
      { key: "flux_1_1_pro_ultra_display_name", description: "Flux Ultra display name", defaultValue: "Flux Ultra" },
    ],
    registration: [
      { key: "allow_registration", description: "Allow new user registrations", defaultValue: true },
      { key: "registration_message", description: "Message shown on registration", defaultValue: "Join our AI image generation platform" },
    ],
    theme: [
      { key: "primary_color", description: "Primary theme color", defaultValue: "#1F56F5" },
      { key: "secondary_color", description: "Secondary theme color", defaultValue: "#1F56F5" },
      { key: "favicon_url", description: "Favicon URL", defaultValue: "" },
    ],
    seo: [
      { key: "meta_title", description: "Default page title", defaultValue: "Tkoeen - AI Image Generation" },
      { key: "meta_description", description: "Default meta description", defaultValue: "Create stunning AI-generated images with our advanced platform" },
      { key: "og_image", description: "Open Graph image URL", defaultValue: "" },
    ],
    api_providers: [
      { key: "primary_ai_provider", description: "Primary AI provider for image/video generation", defaultValue: "replicate" },
      { key: "fallback_ai_provider", description: "Backup provider when primary is unavailable", defaultValue: "fal" },
      { key: "enable_provider_fallback", description: "Automatically switch to fallback provider on errors", defaultValue: true },
      { key: "replicate_api_status", description: "Current status of Replicate API", defaultValue: "active" },
      { key: "fal_api_status", description: "Current status of fal.ai API", defaultValue: "standby" },
    ],
    queue: [
      { key: "max_active_jobs_per_user", description: "Maximum active jobs (running + queued) per user", defaultValue: 8 },
      { key: "max_queued_jobs_per_user", description: "Maximum jobs waiting in queue per user", defaultValue: 4 },
      { key: "max_global_active_jobs", description: "Maximum total active jobs across all users", defaultValue: 100 },
      { key: "jobs_per_minute_limit", description: "Rate limit: max new jobs per user per minute", defaultValue: 10 },
      { key: "button_throttle_ms", description: "Frontend button throttle delay in milliseconds", defaultValue: 1500 },
    ],
    advanced: [
      { key: "maintenance_mode", description: "Enable maintenance mode", defaultValue: false },
      { key: "images_per_generation", description: "Number of images generated per request", defaultValue: 1 },
      { key: "style_upload_enabled", description: "Enable style image upload feature globally", defaultValue: true },
      { key: "analytics_id", description: "Google Analytics ID", defaultValue: "" },
      { key: "meta_pixel_id", description: "Meta Pixel ID", defaultValue: "" },
      { key: "footer_copyright", description: "Footer copyright text", defaultValue: "© 2025 Tkoeen. All rights reserved." },
      { key: "default_currency", description: "Default currency for pricing display", defaultValue: "USD", options: ["USD", "EUR", "SAR"] },
    ],
    model_groups: [
      // Image Model Family Icons
      { key: "image_family_icon_gpt_image", description: "GPT Image 1.5", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_flux", description: "FLUX", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_imagen", description: "Imagen 4", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_nano_banana", description: "Nano Banana", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_seedream", description: "SeeDream", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_alfia_saudi_style", description: "Tkoeen Saudi Style", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_alfia_saudi_style_pro", description: "Tkoeen Saudi Style Pro", defaultValue: "", isImageIcon: true },
      { key: "image_family_icon_other", description: "Other", defaultValue: "", isImageIcon: true },
      // Video Model Family Icons
      { key: "video_family_icon_sora", description: "OpenAI Sora", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_wan", description: "WAN", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_veo", description: "Google Veo", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_luma", description: "Luma Dream Machine", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_kling", description: "Kling", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_hailuo", description: "Minimax Hailuo", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_seedance", description: "Seedance", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_higgsfield", description: "Higgsfield", defaultValue: "", isImageIcon: true },
      { key: "video_family_icon_other", description: "Other Video Models", defaultValue: "", isImageIcon: true },
    ],
    service_cards: [
      { key: "service_card_image_alfia_saudi", description: "Tkoeen Saudi Style Card", defaultValue: "", isCardImage: true },
      { key: "service_card_image_create_image", description: "Create Image Card", defaultValue: "", isCardImage: true },
      { key: "service_card_image_create_video", description: "Create Video Card", defaultValue: "", isCardImage: true },
      { key: "service_card_image_film_studio", description: "Film Studio Card", defaultValue: "", isCardImage: true },
    ],
  };

  const renderSettingInput = (setting: any, category: string) => {
    const currentValue = getSettingValue(setting.key, setting.defaultValue);
    const isPending = pendingChanges.has(setting.key);

    if (typeof setting.defaultValue === "boolean") {
      return (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor={setting.key}>{setting.description}</Label>
            <p className="text-sm text-muted-foreground">Key: {setting.key}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={setting.key}
              checked={currentValue}
              onCheckedChange={(checked) => handleChange(setting.key, checked)}
              data-testid={`switch-${setting.key}`}
            />
            {isPending && (
              <Button
                size="sm"
                onClick={() => saveSetting(setting.key, category, setting.description)}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Special handling for file uploads
    if (setting.key === 'site_logo' || setting.key === 'favicon_url') {
      return (
        <div className="space-y-2">
          <Label htmlFor={setting.key}>{setting.description}</Label>
          <div className="flex gap-2">
            <Input
              id={setting.key}
              value={currentValue}
              onChange={(e) => handleChange(setting.key, e.target.value)}
              placeholder="Enter URL or upload file"
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const type = setting.key === 'site_logo' ? 'logo' : 'favicon';
                    handleFileUpload(file, type);
                  }
                }}
                className="hidden"
                id={`${setting.key}-upload`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.getElementById(`${setting.key}-upload`)?.click()}
                disabled={uploadFileMutation.isPending}
              >
                <Upload className="w-4 h-4" />
              </Button>
              {isPending && (
                <Button
                  size="sm"
                  onClick={() => saveSetting(setting.key, category, setting.description)}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {currentValue && (
            <div className="flex items-center gap-2 mt-2">
              <img 
                src={currentValue} 
                alt="Preview" 
                className="w-8 h-8 object-cover rounded border"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-xs text-muted-foreground">Current {setting.key === 'site_logo' ? 'logo' : 'favicon'}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
        </div>
      );
    }

    // Special handling for images_per_generation dropdown
    if (setting.key === 'images_per_generation') {
      return (
        <div className="space-y-2">
          <Label htmlFor={setting.key}>{setting.description}</Label>
          <div className="flex gap-2">
            <Select
              value={currentValue.toString()}
              onValueChange={(value) => handleChange(setting.key, parseInt(value))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select number of images" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 image</SelectItem>
                <SelectItem value="2">2 images</SelectItem>
                <SelectItem value="3">3 images</SelectItem>
                <SelectItem value="4">4 images</SelectItem>
              </SelectContent>
            </Select>
            {isPending && (
              <Button
                size="sm"
                onClick={() => saveSetting(setting.key, category, setting.description)}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
        </div>
      );
    }

    // Special handling for API provider dropdowns
    if (setting.key === 'primary_ai_provider' || setting.key === 'fallback_ai_provider') {
      return (
        <div className="space-y-2">
          <Label htmlFor={setting.key}>{setting.description}</Label>
          <div className="flex gap-2">
            <Select
              value={currentValue}
              onValueChange={(value) => handleChange(setting.key, value)}
            >
              <SelectTrigger className="flex-1" data-testid={`select-${setting.key}`}>
                <SelectValue placeholder="Select AI provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replicate">Replicate</SelectItem>
                <SelectItem value="fal">fal.ai</SelectItem>
              </SelectContent>
            </Select>
            {isPending && (
              <Button
                size="sm"
                onClick={() => saveSetting(setting.key, category, setting.description)}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
        </div>
      );
    }

    // Special handling for API status dropdowns
    if (setting.key === 'replicate_api_status' || setting.key === 'fal_api_status') {
      return (
        <div className="space-y-2">
          <Label htmlFor={setting.key}>{setting.description}</Label>
          <div className="flex gap-2">
            <Select
              value={currentValue}
              onValueChange={(value) => handleChange(setting.key, value)}
            >
              <SelectTrigger className="flex-1" data-testid={`select-${setting.key}`}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="standby">Standby</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {isPending && (
              <Button
                size="sm"
                onClick={() => saveSetting(setting.key, category, setting.description)}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
        </div>
      );
    }

    // Generic handling for settings with options array (e.g., currency selector)
    if (setting.options && Array.isArray(setting.options)) {
      return (
        <div className="space-y-2">
          <Label htmlFor={setting.key}>{setting.description}</Label>
          <div className="flex gap-2">
            <Select
              value={currentValue}
              onValueChange={(value) => handleChange(setting.key, value)}
            >
              <SelectTrigger className="flex-1" data-testid={`select-${setting.key}`}>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                {setting.options.map((option: string) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isPending && (
              <Button
                size="sm"
                onClick={() => saveSetting(setting.key, category, setting.description)}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
        </div>
      );
    }

    // Special handling for model group image icons
    if (setting.isImageIcon) {
      const isImage = setting.key.includes('image_family');
      const groupType = isImage ? 'Image' : 'Video';
      return (
        <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-background">
            {currentValue ? (
              <img 
                src={currentValue} 
                alt={setting.description} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex-1">
            <Label className="font-medium">{setting.description}</Label>
            <p className="text-xs text-muted-foreground">{groupType} Model Group</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file, `model-icon-${setting.key}`);
                }
              }}
              className="hidden"
              id={`${setting.key}-upload`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => document.getElementById(`${setting.key}-upload`)?.click()}
              disabled={uploadFileMutation.isPending}
              data-testid={`upload-${setting.key}`}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
            {currentValue && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Icon?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the custom icon for {setting.description}. The default icon will be used instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSettingMutation.mutate(setting.key)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      );
    }

    // Special handling for service card images
    if (setting.isCardImage) {
      return (
        <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
          <div className="w-24 h-18 aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-background">
            {currentValue ? (
              <img 
                src={currentValue} 
                alt={setting.description} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex-1">
            <Label className="font-medium">{setting.description}</Label>
            <p className="text-xs text-muted-foreground">Service Card Image (4:3 aspect ratio recommended)</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file, `service-card-${setting.key}`);
                }
              }}
              className="hidden"
              id={`${setting.key}-upload`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => document.getElementById(`${setting.key}-upload`)?.click()}
              disabled={uploadFileMutation.isPending}
              data-testid={`upload-${setting.key}`}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
            {currentValue && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Image?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the custom image for {setting.description}. The default icon will be shown instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSettingMutation.mutate(setting.key)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={setting.key}>{setting.description}</Label>
        <div className="flex gap-2">
          <Input
            id={setting.key}
            value={currentValue}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={`Enter ${setting.description.toLowerCase()}`}
            className="flex-1"
          />
          {isPending && (
            <Button
              size="sm"
              onClick={() => saveSetting(setting.key, category, setting.description)}
              disabled={updateSettingMutation.isPending}
            >
              <Save className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Key: {setting.key}</p>
      </div>
    );
  };

  const renderCategoryContent = (category: string, icon: React.ReactNode, title: string) => {
    const categorySettings = defaultSettings[category as keyof typeof defaultSettings] || [];
    const pendingInCategory = Array.from(pendingChanges).filter(key => 
      categorySettings.some(s => s.key === key)
    );

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle>{title}</CardTitle>
            </div>
            {pendingInCategory.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{pendingInCategory.length} pending</Badge>
                <Button
                  onClick={() => saveCategory(category)}
                  disabled={updateSettingMutation.isPending}
                >
                  Save All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {categorySettings.map((setting) => (
            <div key={setting.key}>
              {renderSettingInput(setting, category)}
              <Separator className="mt-4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading site configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Site Configuration</h2>
          <p className="text-muted-foreground">
            Manage your website's appearance, content, and behavior
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="ui_copy">UI Copy</TabsTrigger>
          <TabsTrigger value="models">AI Models</TabsTrigger>
          <TabsTrigger value="model_groups">Model Groups</TabsTrigger>
          <TabsTrigger value="service_cards">Service Cards</TabsTrigger>
          <TabsTrigger value="api_providers">API Providers</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          {renderCategoryContent("branding", <Globe className="w-5 h-5" />, "Branding")}
        </TabsContent>

        <TabsContent value="ui_copy">
          {renderCategoryContent("ui_copy", <FileText className="w-5 h-5" />, "UI Copy")}
        </TabsContent>

        <TabsContent value="models">
          <ModelManagement />
        </TabsContent>

        <TabsContent value="model_groups">
          {renderCategoryContent("model_groups", <ImageIcon className="w-5 h-5" />, "Model Group Icons")}
        </TabsContent>

        <TabsContent value="service_cards">
          {renderCategoryContent("service_cards", <LayoutGrid className="w-5 h-5" />, "Service Card Images")}
        </TabsContent>

        <TabsContent value="api_providers">
          {renderCategoryContent("api_providers", <Settings className="w-5 h-5" />, "API Providers")}
        </TabsContent>

        <TabsContent value="queue">
          {renderCategoryContent("queue", <Timer className="w-5 h-5" />, "Generation Queue")}
        </TabsContent>

        <TabsContent value="registration">
          {renderCategoryContent("registration", <Shield className="w-5 h-5" />, "User Registration")}
        </TabsContent>

        <TabsContent value="theme">
          {renderCategoryContent("theme", <Palette className="w-5 h-5" />, "Theme & Appearance")}
        </TabsContent>

        <TabsContent value="advanced">
          {renderCategoryContent("advanced", <Settings className="w-5 h-5" />, "Advanced Settings")}
        </TabsContent>
      </Tabs>

      {/* Live Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Header Preview</h3>
              <div className="flex items-center gap-4 p-3 bg-background rounded border">
                {getSettingValue("site_logo") && (
                  <img 
                    src={getSettingValue("site_logo")} 
                    alt="Logo" 
                    className="h-8 w-8 object-contain"
                  />
                )}
                <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-[#1F56F5] bg-clip-text text-transparent">
                  {getSettingValue("site_name", "Tkoeen")}
                </div>
                <div className="flex gap-2 ml-auto">
                  <div className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">
                    {getSettingValue("my_gallery_text", "My Gallery")}
                  </div>
                  <div className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm">
                    {getSettingValue("public_gallery_text", "Public Gallery")}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Landing Page Preview</h3>
              <div className="text-center p-6 bg-background rounded border">
                <h1 className="text-3xl font-bold mb-2">
                  {getSettingValue("landing_headline", "AI Image Generation Platform")}
                </h1>
                <p className="text-muted-foreground mb-4">
                  {getSettingValue("landing_subtext", "Create stunning images with the power of AI")}
                </p>
                <div className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded">
                  {getSettingValue("generate_button_text", "Generate")}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

