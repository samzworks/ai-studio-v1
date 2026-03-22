import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Video, Timer as Clock, Loader2, Upload, X, RotateCcw, Shuffle, Coins, WandSparkles as Sparkles, Compass as Globe, ShieldX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ToggleSwitch from "@/components/ui/toggle-switch";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "./image-upload";
import FrameImageUpload from "./frame-image-upload";
import DurationSelector from "./duration-selector";
import PopupAspectRatioSelector from "./popup-aspect-ratio-selector";
import ResolutionSelector from "./resolution-selector";
import VideoModelSelector from "./video-model-selector";
import UnifiedModelSelector from "./unified-model-selector";
import type { VideoMode, BaseModel } from "@shared/model-routing";
import { resolveVariant, VIDEO_BASE_MODELS } from "@shared/model-routing";
import { useGalleryStore } from "@/stores/gallery-store";
import { useVideoPromptStore } from "@/stores/video-prompt-store";
import { useVideoJobPolling } from "@/hooks/useVideoJobPolling";
import PromptInputSection from "./prompt-input-section";
import { usePricingEstimate } from "@/hooks/use-pricing-estimate";
import { useVideoStore } from "@/stores/video-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToastPosition } from "@/contexts/toast-position-context";
import { useUserPlan } from "@/hooks/useUserPlan";
import FreeGenerationConsentModal from "./free-generation-consent-modal";

// Video generation schema
const videoGenerationSchema = z.object({
  prompt: z.string().min(10).max(10000),
  model: z.string().default("luma-ray-flash-2-540p"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:3", "3:4"]).default("9:16"),
  duration: z.number().min(4).max(15).default(5), // min 4 for VEO/Sora, max 15 for WAN 2.6
  resolution: z.string().default("540p"), // New resolution field
  audioEnabled: z.boolean().default(false), // Audio toggle for video generation
  style: z.string().optional(),
  startFrameImage: z.object({
    file: z.instanceof(File).nullable(),
    url: z.string().nullable()
  }).nullable().optional(),
  endFrameImage: z.object({
    file: z.instanceof(File).nullable(),
    url: z.string().nullable()
  }).nullable().optional(),
  videoReference: z.object({
    file: z.instanceof(File).nullable(),
    url: z.string().nullable()
  }).nullable().optional(),
  audioFile: z.object({
    file: z.instanceof(File).nullable(),
    url: z.string().nullable()
  }).nullable().optional(),
  characterOrientation: z.enum(["video", "image"]).default("video"),
  promptExpansion: z.boolean().default(true), // LLM prompt expansion for WAN 2.6
  multiShot: z.boolean().default(true), // Multi-shot generation for WAN 2.6
  tags: z.array(z.string()).default([])
});

type VideoGenerationData = z.infer<typeof videoGenerationSchema>;

interface VideoModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  maxDuration: number;
  supportedRatios: string[];
  supportedDurations: number[];
  supportedSizes: string[]; // New field for supported resolutions
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsLoop?: boolean;
  supportsFrameRate?: boolean;
  fpsFixed?: number; // Fixed FPS for this model
  framesByDuration?: Record<number, number>; // Maps duration to frame count
  supportsAudio?: boolean; // Whether this model supports native audio generation
  supportsVideoReference?: boolean; // Whether this model supports video reference input (Motion Control)
  supportsAudioFile?: boolean; // Whether this model supports audio file upload (e.g., WAN 2.6)
  supportsPromptExpansion?: boolean; // Whether this model supports LLM prompt expansion
  supportsMultiShot?: boolean; // Whether this model supports multi-shot generation
  modelGroup?: string; // Group ID for organizing related models (e.g., "kling-2.6")
  modelVariant?: "text-to-video" | "image-to-video" | "motion-control"; // Type of video generation
}

interface VideoGenerationFormProps {
  onVideoGenerated: (video: any) => void;
  onMobileClose?: () => void;
  onGenerationStart?: () => void;
  initialModel?: string;
}

export default function VideoGenerationForm({ onVideoGenerated, onMobileClose, onGenerationStart, initialModel }: VideoGenerationFormProps) {
  const { t } = useTranslation();
  const { showRoleBasedErrorToast, showSuccessToast } = useAuthAwareToast();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const { referenceImage, clearReferenceImage } = useVideoStore();
  const isMobile = useIsMobile();
  const { setGenerationFormActive } = useToastPosition();
  
  useEffect(() => {
    if (isMobile) {
      setGenerationFormActive(true);
      return () => setGenerationFormActive(false);
    }
  }, [isMobile, setGenerationFormActive]);
  
  // Enhancement state
  const [enhancePrompt, setEnhancePrompt] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<VideoMode>("pro");
  
  // Moderation state - show "Checking content safety" during API call
  const [isModerating, setIsModerating] = useState<boolean>(false);
  
  // Get user plan info for consent and disclosure
  const { isFreeUser, needsConsent } = useUserPlan();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<VideoGenerationData | null>(null);
  
  // Track if this is the initial load to prevent unwanted toast notifications
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Lock to prevent other effects from overwriting reference image settings
  const referenceImageLockRef = useRef<boolean>(false);
  const referenceImageLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Pending model to set when video models finish loading
  const pendingModelRef = useRef<string | null>(null);
  
  // Track current job for polling
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // Start polling when we have a job ID
  const { jobStatus, isPolling } = useVideoJobPolling(currentJobId, !!currentJobId);
  
  // Clear job ID when job completes to stop polling - with delay to allow cleanup animations
  useEffect(() => {
    if (jobStatus?.state === 'completed' || jobStatus?.state === 'failed') {
      console.log(`Job ${currentJobId} finished with state: ${jobStatus.state}`);
      // Delay clearing the job ID to allow the completion timeout to run first
      const clearJobTimeout = setTimeout(() => {
        setCurrentJobId(null);
      }, 2000); // 2 seconds - enough time for the 1.5s completion animation
      
      return () => clearTimeout(clearJobTimeout);
    }
  }, [jobStatus?.state, currentJobId]);
  
  // Fetch site config to get default video model - moved up before form init
  const { data: config } = useQuery({
    queryKey: ["/api/config"],
  });
  
  const form = useForm<VideoGenerationData>({
    resolver: zodResolver(videoGenerationSchema),
    defaultValues: {
      prompt: "",
      model: "wan-2.2-t2v-fast", // Use text-to-video model as default
      aspectRatio: "9:16" as const,
      duration: 5,
      resolution: "480p", // Match WAN model's default resolution
      audioEnabled: false,
      style: "none",
      startFrameImage: null,
      endFrameImage: null,
      videoReference: null,
      audioFile: null,
      characterOrientation: "video",
      promptExpansion: true,
      multiShot: true,
      tags: []
    }
  });

  // Handle initialModel prop - takes priority over config default
  useEffect(() => {
    if (initialModel) {
      console.log('[VideoForm] Setting initial model from prop:', initialModel);
      form.setValue('model', initialModel);
      pendingModelRef.current = initialModel;
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [initialModel, form]);

  // Update form when config loads with default video model
  useEffect(() => {
    // Skip if initialModel prop is provided - it takes priority
    if (initialModel) {
      return;
    }
    
    // Skip if reference image is being processed - don't overwrite its model selection
    if (referenceImageLockRef.current) {
      console.log('[VideoForm] Skipping config default model - reference image lock active');
      return;
    }
    
    const currentModel = form.getValues('model');
    const configObj = config as any;
    
    if (configObj?.default_video_model && configObj.default_video_model !== currentModel) {
      form.setValue('model', configObj.default_video_model);
      // Set a timeout to mark initial load as complete after model adjustments
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [config, form, initialModel]);

  // Handle reference image from store (when navigating from image lightbox)
  useEffect(() => {
    if (referenceImage) {
      console.log('[VideoForm] Processing reference image:', {
        url: referenceImage.url?.substring(0, 50),
        defaultModel: referenceImage.defaultModel,
        prompt: referenceImage.prompt?.substring(0, 30)
      });
      
      // Set the lock to prevent other effects from overwriting our settings
      referenceImageLockRef.current = true;
      
      // Clear any existing timeout
      if (referenceImageLockTimeoutRef.current) {
        clearTimeout(referenceImageLockTimeoutRef.current);
      }
      
      // Set model - use defaultModel from store if provided, otherwise use config default
      const configObj = config as any;
      const configDefaultModel = configObj?.default_video_model || 'wan-2.2-fast';
      const modelToSet = referenceImage.defaultModel || configDefaultModel;
      console.log('[VideoForm] Setting model to:', modelToSet, '(config default:', configDefaultModel, ')');
      
      // Store as pending model in case video models haven't loaded yet
      pendingModelRef.current = modelToSet;
      form.setValue('model', modelToSet);
      
      // Set the prompt if available
      if (referenceImage.prompt) {
        console.log('[VideoForm] Setting prompt');
        form.setValue('prompt', referenceImage.prompt);
      }
      
      // Set the start frame image
      console.log('[VideoForm] Setting start frame image');
      form.setValue('startFrameImage', {
        file: null,
        url: referenceImage.url
      });
      
      // Detect aspect ratio from reference image and preselect it
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        const ratio = width / height;
        
        // Determine the closest aspect ratio
        let closestRatio = "1:1";
        if (ratio > 1.7) closestRatio = "16:9";
        else if (ratio > 1.2) closestRatio = "4:3";
        else if (ratio > 0.9) closestRatio = "1:1";
        else if (ratio > 0.6) closestRatio = "3:4";
        else closestRatio = "9:16";
        
        console.log('[VideoForm] Detected aspect ratio from reference image:', closestRatio, 'from dimensions:', width, 'x', height);
        form.setValue("aspectRatio", closestRatio as any);
      };
      img.src = referenceImage.url;
      
      // Mark initial load as complete since we're setting values from reference
      setIsInitialLoad(false);
      
      // Release the lock and clear reference image together after form values are settled
      // Using a single timeout ensures the lock is always released
      referenceImageLockTimeoutRef.current = setTimeout(() => {
        console.log('[VideoForm] Releasing reference image lock and clearing store');
        referenceImageLockRef.current = false;
        clearReferenceImage();
      }, 300);
    }
    
    // Cleanup timeout on unmount - also release lock to prevent stuck state
    return () => {
      if (referenceImageLockTimeoutRef.current) {
        clearTimeout(referenceImageLockTimeoutRef.current);
        // Always release lock on cleanup to prevent stuck state
        referenceImageLockRef.current = false;
      }
    };
  }, [referenceImage, form, clearReferenceImage]);

  // Handle video prompt from store (when using "Use prompt" button from video gallery)
  const selectedVideoPrompt = useVideoPromptStore(state => state.selectedVideoPrompt);
  const clearSelectedVideoPrompt = useVideoPromptStore(state => state.clearSelectedVideoPrompt);
  const selectedVideoModel = useVideoPromptStore(state => state.selectedVideoModel);
  const clearSelectedVideoModel = useVideoPromptStore(state => state.clearSelectedVideoModel);
  
  useEffect(() => {
    if (selectedVideoPrompt && selectedVideoPrompt.trim().length > 0) {
      console.log('[VideoForm] Applying video prompt from store:', selectedVideoPrompt.substring(0, 50));
      form.setValue('prompt', selectedVideoPrompt);
      clearSelectedVideoPrompt();
    }
  }, [selectedVideoPrompt, form, clearSelectedVideoPrompt]);
  
  // Handle video model from store (when using "Regenerate" button from video gallery)
  useEffect(() => {
    if (selectedVideoModel && selectedVideoModel.trim().length > 0) {
      console.log('[VideoForm] Applying video model from store:', selectedVideoModel);
      pendingModelRef.current = selectedVideoModel;
      form.setValue('model', selectedVideoModel);
      clearSelectedVideoModel();
    }
  }, [selectedVideoModel, form, clearSelectedVideoModel]);

  // State for duration and resolution selection
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [selectedResolution, setSelectedResolution] = useState<string>("480p");

  // Video prompt enhancement function
  const enhanceVideoPrompt = async (prompt: string, selectedStyle?: string): Promise<string> => {
    setIsEnhancing(true);
    try {
      // Get the selected video style prompt text if style is selected
      let styleText = '';
      if (selectedStyle && selectedStyle !== 'none' && videoStyles) {
        const styleObj = videoStyles.find((s: any) => s.id.toString() === selectedStyle);
        styleText = styleObj?.promptText || '';
      }

      console.log("Attempting to enhance video prompt...");
      const response = await apiRequest("POST", "/api/enhance-video-prompt", { 
        prompt: prompt.trim(),
        style: styleText
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Enhancement API failed:", response.status, errorData);
        
        // Use backend-provided error message or create specific message based on status
        let userMessage = errorData.message || t("toasts.enhancementUnavailable", "Prompt enhancement unavailable");
        
        // Show a non-intrusive info toast that generation will continue with original prompt
        toast({
          title: userMessage,
          description: t("toasts.continuingWithOriginal", "Continuing with your original prompt..."),
          variant: "default",
          duration: 3000,
        });
        
        // If backend provided a fallback prompt, use it; otherwise use original
        return errorData.enhancedPrompt || prompt;
      }

      const result = await response.json();
      if (result.enhancedPrompt && result.enhancedPrompt !== prompt) {
        console.log("Video prompt enhanced successfully");
        toast({
          title: t("toasts.promptEnhanced", "Prompt enhanced"),
          description: t("toasts.promptOptimized", "Your prompt has been optimized for better results"),
          variant: "default",
          duration: 2000,
        });
        return result.enhancedPrompt;
      }

      console.warn("No enhanced prompt returned, using original");
      return prompt; // Fallback to original
    } catch (error) {
      console.error("Enhancement failed:", error);
      
      // Show informative message instead of error - enhancement failure shouldn't block generation
      toast({
        title: t("toasts.enhancementUnavailable", "Enhancement unavailable"),
        description: t("toasts.continuingWithOriginal", "Continuing with your original prompt..."),
        variant: "default",
        duration: 3000,
      });
      
      return prompt; // Always fallback to original prompt
    } finally {
      setIsEnhancing(false);
    }
  };

  // Fetch video base models (for unified model selector compatibility)
  const { data: videoBaseModels, isLoading: baseModelsLoading } = useQuery<BaseModel[]>({
    queryKey: ["/api/base-models/video"],
    staleTime: 30000,
  });
  
  // Legacy video models query for backward compatibility
  const { data: videoModels, isLoading: modelsLoading } = useQuery({
    queryKey: ["/api/video-models"],
    select: (models: VideoModel[]) => models || []
  });

  // Set first model when models load if current model is not valid
  // Also apply pending model from reference image if one exists
  useEffect(() => {
    if (!videoBaseModels || videoBaseModels.length === 0) {
      return;
    }
    
    // Check if there's a pending model from reference image
    if (pendingModelRef.current) {
      const pendingModel = pendingModelRef.current;
      const modelExists = videoBaseModels.some(m => m.id === pendingModel);
      
      if (modelExists) {
        console.log('[VideoForm] Applying pending model from reference image:', pendingModel);
        form.setValue('model', pendingModel);
        pendingModelRef.current = null; // Clear the pending model
        return;
      } else {
        console.log('[VideoForm] Pending model not found in available models:', pendingModel);
        pendingModelRef.current = null; // Clear invalid pending model
      }
    }
    
    // Skip further validation if reference image is being processed
    if (referenceImageLockRef.current) {
      console.log('[VideoForm] Skipping model validation - reference image lock active');
      return;
    }
    
    const currentModelValue = form.getValues('model');
    // Check if current model exists in loaded base models
    const modelExists = videoBaseModels.some(m => m.id === currentModelValue);
    
    // If model doesn't exist, set to first model
    if (!modelExists) {
      const firstModel = videoBaseModels[0];
      form.setValue('model', firstModel.id);
      console.log(`[VideoForm] Set default video model to: ${firstModel.id}`);
    }
  }, [videoBaseModels, form]);

  // Fetch video styles - try direct fetch approach
  const { data: videoStyles, isLoading: stylesLoading, error: stylesError, refetch: refetchStyles } = useQuery({
    queryKey: ["/api/video-styles"],
    queryFn: async () => {
      const response = await fetch("/api/video-styles", {
        credentials: "include",
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    staleTime: 0, // Force fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Force refetch on mount to ensure fresh data
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["/api/video-styles"] });
    refetchStyles();
  }, [refetchStyles, queryClient]);

  // Fetch user credits
  const { data: credits } = useQuery({
    queryKey: ["/api/credits"]
  }) as { data: { balance: number } | undefined };

  // Use videoBaseModels for the unified model selector (matches base model IDs like "kling-2.6")
  const selectedBaseModel = videoBaseModels?.find(m => m.id === form.watch("model"));
  // For backward compatibility, also check videoModels (variant-level models)
  const selectedLegacyModel = videoModels?.find(m => m.id === form.watch("model"));
  // Prefer base model, fallback to legacy model
  const selectedModel = selectedBaseModel || selectedLegacyModel;
  
  const currentAspectRatio = form.watch("aspectRatio");
  const currentDuration = form.watch("duration");
  const currentResolution = form.watch("resolution");
  const currentModel = form.watch("model");
  
  // Check if any image is uploaded (for disabling aspect ratio and size controls)
  // Includes startFrameImage, endFrameImage, and videoReference (for motion control)
  const hasUploadedImage = Boolean(form.watch("startFrameImage")) || Boolean(form.watch("endFrameImage")) || Boolean(form.watch("videoReference"));

  // Handle duration changes 
  const handleDurationChange = (duration: number) => {
    setSelectedDuration(duration);
    form.setValue('duration', duration);
    
    // Compute frames if model supports it
    if (selectedModel?.framesByDuration) {
      const frames = selectedModel.framesByDuration[duration];
      if (frames) {
        console.log(`Duration ${duration}s → ${frames} frames (${selectedModel.name})`);
      }
    }
  };

  // Handle resolution changes
  const handleResolutionChange = (resolution: string) => {
    setSelectedResolution(resolution);
    form.setValue('resolution', resolution);
  };

  // Handle image upload and adapt aspect ratio/resolution based on image dimensions
  const handleImageUpload = (value: { file: File | null; url: string | null } | null, onChange: (value: any) => void) => {
    onChange(value);
    
    if (value?.url && value?.file) {
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        const ratio = width / height;
        
        // Determine the closest aspect ratio
        let closestRatio = "1:1";
        if (ratio > 1.7) closestRatio = "16:9";
        else if (ratio > 1.2) closestRatio = "4:3";
        else if (ratio > 0.9) closestRatio = "1:1";
        else if (ratio > 0.6) closestRatio = "3:4";
        else closestRatio = "9:16";
        
        // Check if this ratio is supported by the current model
        const supportedRatios = selectedModel?.supportedRatios || [];
        if (supportedRatios.includes(closestRatio)) {
          form.setValue("aspectRatio", closestRatio as any);
        } else if (supportedRatios.length > 0) {
          // Find the closest supported ratio
          const ratioValues: Record<string, number> = {
            "16:9": 16/9,
            "4:3": 4/3,
            "1:1": 1,
            "3:4": 3/4,
            "9:16": 9/16,
            "21:9": 21/9,
          };
          let minDiff = Infinity;
          let bestRatio = supportedRatios[0];
          for (const sr of supportedRatios) {
            const diff = Math.abs(ratio - (ratioValues[sr] || 1));
            if (diff < minDiff) {
              minDiff = diff;
              bestRatio = sr;
            }
          }
          form.setValue("aspectRatio", bestRatio as any);
        }
        
        // Determine resolution based on image dimensions
        const maxDim = Math.max(width, height);
        let closestResolution = "720p";
        if (maxDim >= 1080) closestResolution = "1080p";
        else if (maxDim >= 720) closestResolution = "720p";
        else if (maxDim >= 540) closestResolution = "540p";
        else closestResolution = "480p";
        
        // Check if this resolution is supported
        const supportedSizes = selectedModel?.supportedSizes || [];
        if (supportedSizes.includes(closestResolution)) {
          setSelectedResolution(closestResolution);
          form.setValue("resolution", closestResolution);
        } else if (supportedSizes.length > 0) {
          // Find the closest supported resolution
          const resValues: Record<string, number> = {
            "480p": 480,
            "540p": 540,
            "720p": 720,
            "1080p": 1080,
          };
          let minDiff = Infinity;
          let bestRes = supportedSizes[0];
          for (const sr of supportedSizes) {
            const diff = Math.abs(maxDim - (resValues[sr] || 720));
            if (diff < minDiff) {
              minDiff = diff;
              bestRes = sr;
            }
          }
          setSelectedResolution(bestRes);
          form.setValue("resolution", bestRes);
        }
      };
      img.src = value.url;
    }
  };

  // Auto-correction logic when model changes
  useEffect(() => {
    if (!selectedModel) return;
    
    let hasChanges = false;

    // Auto-correct duration if current selection is not supported
    if (selectedModel.supportedDurations && !selectedModel.supportedDurations.includes(currentDuration)) {
      const firstValidDuration = selectedModel.supportedDurations[0];
      setSelectedDuration(firstValidDuration);
      form.setValue('duration', firstValidDuration);
      hasChanges = true;
    }

    // Auto-correct aspect ratio if current selection is not supported  
    if (!selectedModel.supportedRatios.includes(currentAspectRatio)) {
      const firstValidRatio = selectedModel.supportedRatios[0];
      form.setValue('aspectRatio', firstValidRatio as any);
      hasChanges = true;
    }

    // Auto-correct resolution if current selection is not supported
    if (selectedModel.supportedSizes && !selectedModel.supportedSizes.includes(currentResolution)) {
      const firstValidSize = selectedModel.supportedSizes[0];
      setSelectedResolution(firstValidSize);
      form.setValue('resolution', firstValidSize);
      hasChanges = true;
    }

    // Auto-set audioEnabled based on model type
    // VEO models: User can toggle (keep current value)
    // Sora/WAN models: Always enable audio (force to true)
    const isVeoModel = currentModel === 'fal-veo3-t2v' || 
                       currentModel === 'fal-veo3-i2v' || 
                       currentModel === 'fal-veo3-fast-t2v' || 
                       currentModel === 'fal-veo3-fast-i2v';
    
    if (!isVeoModel) {
      // For non-VEO models (Sora, WAN), audio is always on
      form.setValue('audioEnabled', true);
    }
    // For VEO models, keep the user's toggle setting (don't auto-change)

    // Show toast notification for auto-corrections (but not during initial load)
    if (hasChanges && !isInitialLoad) {
      toast({
        title: t("toasts.info"),
        description: t("toasts.updated"),
        duration: 4000,
      });
    }
  }, [currentModel, selectedModel, currentDuration, currentAspectRatio, currentResolution, form, toast, isInitialLoad, t]);

  // Reset form to default values
  const handleReset = () => {
    // Get the first available video model or fallback
    const firstModel = videoBaseModels?.[0];
    const defaultModelId = firstModel?.id || "wan-2.2-t2v-fast";
    const defaultDuration = firstModel?.supportedDurations?.[0] || 5;
    const defaultResolution = firstModel?.supportedSizes?.[0] || "480p";
    const defaultAspectRatio = firstModel?.supportedRatios?.[0] || "9:16";
    
    const defaultValues = {
      prompt: "",
      model: defaultModelId,
      aspectRatio: defaultAspectRatio as any,
      duration: defaultDuration,
      resolution: defaultResolution,
      style: "none",
      startFrameImage: null,
      endFrameImage: null,
      tags: []
    };
    
    form.reset(defaultValues);
    setSelectedDuration(defaultDuration);
    setSelectedResolution(defaultResolution);
    
    toast({
      title: t("toasts.success"),
      description: t("toasts.updated"),
    });
  };


  // Video generation mutation
  const generateVideoMutation = useMutation({
    mutationFn: async (data: VideoGenerationData) => {
      // Set moderation state to show "Checking content safety" in UI
      setIsModerating(true);
      
      // Upload images first if they exist
      let startFrameUrl = null;
      let endFrameUrl = null;
      
      try {
        // Upload start frame if provided
        if (data.startFrameImage?.file) {
          console.log("Uploading start frame image...");
          const formData = new FormData();
          formData.append('styleImages', data.startFrameImage.file);
          
          const uploadResponse = await fetch("/api/upload-style-image", {
            method: "POST",
            body: formData,
            credentials: "include"
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            startFrameUrl = uploadResult.images[0].url;
            console.log("Uploaded start frame image:", startFrameUrl);
          } else {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error("Start frame upload failed:", errorData);
            throw new Error(`Failed to upload start frame image: ${errorData.message || uploadResponse.statusText}`);
          }
        } else if (data.startFrameImage?.url) {
          // Use existing URL if no new file was uploaded
          startFrameUrl = data.startFrameImage.url;
          console.log("Using existing start frame image URL:", startFrameUrl);
        }
        
        // Upload end frame if provided
        if (data.endFrameImage?.file) {
          console.log("Uploading end frame image...");
          const formData = new FormData();
          formData.append('styleImages', data.endFrameImage.file);
          
          const uploadResponse = await fetch("/api/upload-style-image", {
            method: "POST",
            body: formData,
            credentials: "include"
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            endFrameUrl = uploadResult.images[0].url;
            console.log("Uploaded end frame image:", endFrameUrl);
          } else {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error("End frame upload failed:", errorData);
            throw new Error(`Failed to upload end frame image: ${errorData.message || uploadResponse.statusText}`);
          }
        } else if (data.endFrameImage?.url) {
          // Use existing URL if no new file was uploaded
          endFrameUrl = data.endFrameImage.url;
          console.log("Using existing end frame image URL:", endFrameUrl);
        }
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        throw uploadError;
      }
      
      // Upload video reference for motion control models
      let videoReferenceUrl: string | undefined;
      if (data.videoReference?.file) {
        try {
          console.log("Uploading video reference...");
          const formData = new FormData();
          formData.append('video', data.videoReference.file);
          
          const uploadResponse = await fetch("/api/upload-video", {
            method: "POST",
            body: formData,
            credentials: "include"
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            videoReferenceUrl = uploadResult.url;
            console.log("Uploaded video reference:", videoReferenceUrl);
          } else {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error("Video reference upload failed:", errorData);
            throw new Error(`Failed to upload video reference: ${errorData.message || uploadResponse.statusText}`);
          }
        } catch (uploadError) {
          console.error("Video reference upload error:", uploadError);
          throw uploadError;
        }
      }
      
      // Upload audio file for WAN 2.6 if provided
      let audioFileUrl: string | undefined;
      if (data.audioFile?.file && selectedModel?.supportsAudioFile) {
        console.log("Uploading audio file for WAN 2.6:", data.audioFile.file.name);
        try {
          const audioFormData = new FormData();
          audioFormData.append("audio", data.audioFile.file);
          
          const audioUploadResponse = await fetch("/api/video/upload-audio", {
            method: "POST",
            body: audioFormData,
            credentials: "include"
          });
          
          if (audioUploadResponse.ok) {
            const audioResult = await audioUploadResponse.json();
            audioFileUrl = audioResult.audioUrl;
            console.log("Audio file uploaded successfully:", audioFileUrl);
          } else {
            const errorData = await audioUploadResponse.json().catch(() => ({}));
            console.error("Audio file upload failed:", errorData);
            throw new Error(`Failed to upload audio file: ${errorData.message || audioUploadResponse.statusText}`);
          }
        } catch (uploadError) {
          console.error("Audio file upload error:", uploadError);
          throw uploadError;
        }
      }
      
      // Prepare the video generation data
      const videoData = {
        prompt: data.prompt,
        model: data.model,
        aspectRatio: data.aspectRatio,
        duration: data.duration,
        resolution: data.resolution, // Include resolution in request
        audioEnabled: data.audioEnabled, // Include audio setting for pricing and generation
        style: data.style,
        tags: data.tags || [],
        startFrameUrl,
        endFrameUrl,
        videoReferenceUrl,
        characterOrientation: data.characterOrientation,
        frames: selectedModel?.framesByDuration ? selectedModel.framesByDuration[data.duration] : undefined,
        fps: selectedModel?.fpsFixed,
        // WAN 2.6 specific parameters
        audioFileUrl,
        promptExpansion: data.promptExpansion,
        multiShot: data.multiShot,
        negativePrompt: (data as any).negativePrompt
      };
      
      console.log("Sending video generation request with data:", videoData);
      
      const response = await fetch("/api/video/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(videoData),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for moderation block (403 with PROMPT_BLOCKED code)
        if (response.status === 403 && errorData.error?.code === 'PROMPT_BLOCKED') {
          const error = new Error('PROMPT_BLOCKED');
          (error as any).status = 403;
          (error as any).isModerationBlock = true;
          (error as any).data = errorData;
          throw error;
        }
        
        // Extract meaningful error message
        let errorMessage = errorData.message || (typeof errorData.error === 'string' ? errorData.error : null) || response.statusText;
        
        // Add specific context for common error codes
        if (response.status === 402) {
          errorMessage = `Insufficient credits. You need ${errorData.required || 0} credits but only have ${errorData.balance || 0}.`;
        } else if (response.status === 429) {
          errorMessage = "Rate limit reached. Please wait a moment and try again.";
        } else if (response.status === 400) {
          // Provide more context for validation errors
          if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessage = `Invalid request: ${errorData.errors.map((e: any) => e.message || e).join(', ')}`;
          }
        }
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).data = errorData;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (jobData) => {
      setIsModerating(false);
      console.log('Video job created successfully:', jobData);
      
      // Verify we got a proper job response
      if (!jobData.jobId) {
        console.error('No jobId received from API response:', jobData);
        toast({
          title: t("toasts.error"),
          description: t("toasts.failed"),
          variant: "destructive"
        });
        return;
      }
      
      // Add progress card ONLY after successful API response
      const currentFormData = form.getValues();
      useGalleryStore.getState().setVideoProgress(jobData.jobId, {
        id: jobData.jobId,
        modelId: jobData.model || currentFormData.model,
        startedAt: Date.now(),
        prompt: jobData.prompt || currentFormData.prompt,
        status: 'queued',
        progress: 0,
        stage: 'Initializing...',
        etaSeconds: 60,
        isJob: true
      });
      
      console.log('Added video progress card for job:', jobData.jobId);
      
      // Start polling ONLY after successful job creation
      setCurrentJobId(jobData.jobId);
      
      showSuccessToast(
        "Video generation started",
        "Your video is being generated and will appear in your gallery when complete."
      );
      form.reset();
      
      // Close mobile sidebar after successful generation start
      if (isMobile && onMobileClose) {
        onMobileClose();
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    },
    onError: (error: any) => {
      setIsModerating(false);
      console.error('Video job creation failed:', error);
      
      // Check for moderation block using the flag we set in the mutation function
      if (error.isModerationBlock || (error.status === 403 && error.message === 'PROMPT_BLOCKED')) {
        // Always use the translated generic message for user-friendly display
        const reasonText = t('errors.promptBlockedGeneric', 'Your prompt could not be processed due to content policy. Please modify and try again.');
        
        toast({
          title: (
            <span className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 flex-shrink-0" />
              {t('errors.contentPolicyTitle', 'Content Policy Notice')}
            </span>
          ) as unknown as string,
          description: reasonText,
          variant: "warning",
          duration: 10000,
        });
        return;
      }
      
      showRoleBasedErrorToast({
        title: t("toasts.generationFailed"),
        error: error,
        fallbackTitle: t("toasts.generationFailed")
      });
    },
    onSettled: () => {
      // Always ensure moderation state is cleared (safety net for edge cases)
      setIsModerating(false);
    }
  });

  // Models that allow aspect ratio selection when using image-to-video
  // Based on model capabilities:
  // - WAN 2.2 Fast, Sora 2, VEO 3.1: Allow aspect ratio selection with image
  // - Kling 2.6, Kling 2.6 Motion Control, WAN 2.6, WAN 2.5: Do NOT allow aspect ratio selection with image
  // Use BASE model IDs since the form stores base model IDs (resolved to variants at submission)
  const BASE_MODEL_IDS_ALLOWING_ASPECT_RATIO_WITH_IMAGE = [
    'wan-2.2-fast',  // WAN 2.2 Fast
    'sora-2',        // Sora 2
    'veo-3.1'        // VEO 3.1
  ];
  const allowsAspectRatioWithImage = BASE_MODEL_IDS_ALLOWING_ASPECT_RATIO_WITH_IMAGE.includes(currentModel);
  
  // Disable aspect ratio selection when image is uploaded AND model doesn't support it
  const isAspectRatioDisabled = generateVideoMutation.isPending || (hasUploadedImage && !allowsAspectRatioWithImage);

  // Resolve variant for pricing - need to pass mode and hasImage to get correct variant
  const currentVideoModelId = form.watch("model");
  const hasVideoImageForPricing = !!(form.watch("startFrameImage")?.url || form.watch("videoReference")?.url);
  const resolvedVideoPricingVariant = useMemo(() => {
    if (!currentVideoModelId) return null;
    const result = resolveVariant({
      baseModelId: currentVideoModelId,
      mediaType: "video",
      hasInputImage: hasVideoImageForPricing,
      mode: selectedMode
    });
    return result?.variant?.id || currentVideoModelId;
  }, [currentVideoModelId, hasVideoImageForPricing, selectedMode]);

  // Get pricing estimate based on form values with resolved variant
  const { estimate: pricingEstimate } = usePricingEstimate({
    model: resolvedVideoPricingVariant || currentVideoModelId,
    duration: form.watch("duration"),
    resolution: form.watch("resolution"),
    aspectRatio: form.watch("aspectRatio"),
    audioEnabled: form.watch("audioEnabled"),
    mode: selectedMode
  });

  // Handle consent accept - continue with generation
  const handleConsentAccept = () => {
    setShowConsentModal(false);
    if (pendingFormData) {
      processVideoGeneration(pendingFormData);
      setPendingFormData(null);
    }
  };

  // Handle consent decline - cancel generation
  const handleConsentDecline = () => {
    setShowConsentModal(false);
    setPendingFormData(null);
  };

  const onSubmit = async (data: VideoGenerationData) => {
    // Check if free user needs to consent first
    if (needsConsent) {
      setPendingFormData(data);
      setShowConsentModal(true);
      return;
    }

    // Proceed with generation
    await processVideoGeneration(data);
  };

  const processVideoGeneration = async (data: VideoGenerationData) => {
    // Show disclosure notification for free users at generation time
    if (isFreeUser) {
      toast({
        title: t('freeDisclosure.title', 'Public Generation'),
        description: t('freeDisclosure.message', 'Free plan generations are public by default.'),
        duration: 4000,
      });
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("Video generation starting:", { model: selectedModel?.id, modelsCount: videoModels?.length });
      }
      
      // Defensive validation - check if selections are valid for current model
      if (selectedModel) {
        const validationErrors: string[] = [];
        
        if (selectedModel.supportedDurations && !selectedModel.supportedDurations.includes(data.duration)) {
          validationErrors.push(`Duration ${data.duration}s not supported by ${selectedModel.name}`);
        }
        
        if (!selectedModel.supportedRatios.includes(data.aspectRatio)) {
          validationErrors.push(`Aspect ratio ${data.aspectRatio} not supported by ${selectedModel.name}`);
        }
        
        if (selectedModel.supportedSizes && !selectedModel.supportedSizes.includes(data.resolution)) {
          validationErrors.push(`Resolution ${data.resolution} not supported by ${selectedModel.name}`);
        }
        
        if (validationErrors.length > 0) {
          const validationError = new Error(validationErrors.join(". "));
          showRoleBasedErrorToast({
            title: t("toasts.invalidConfiguration"),
            error: validationError,
            fallbackTitle: t("toasts.invalidConfiguration")
          });
          return;
        }
      }
      
      let finalPrompt = data.prompt;
      
      // Enhance prompt if toggle is enabled
      if (enhancePrompt && data.prompt.trim().length > 0) {
        console.log("Enhancement enabled, enhancing prompt...");
        try {
          finalPrompt = await enhanceVideoPrompt(data.prompt, data.style);
        } catch (enhancementError) {
          console.warn("Prompt enhancement failed, using original prompt:", enhancementError);
          // Continue with original prompt
        }
      }
      
      // Resolve the base model to variant ID before submitting
      const hasImage = !!(data.startFrameImage?.url || data.videoReference?.url);
      const resolved = resolveVariant({
        baseModelId: data.model,
        mediaType: "video",
        hasInputImage: hasImage,
        mode: selectedMode,
      });
      
      // Handle resolution errors
      if (!resolved || resolved.error || !resolved.variant) {
        const errorMsg = resolved?.fallbackMessage || 'Could not resolve model variant';
        showRoleBasedErrorToast({
          title: t("toasts.invalidModelConfiguration", "Invalid model configuration"),
          error: new Error(errorMsg),
          fallbackTitle: t("toasts.invalidModelConfiguration", "Invalid model configuration")
        });
        return;
      }
      
      // Use the resolved variant ID
      const resolvedModelId = resolved.variant.id;
      
      // Create final data with enhanced prompt and resolved model
      const finalData = {
        ...data,
        prompt: finalPrompt,
        model: resolvedModelId,
      };
      
      console.log("Submitting video generation with data:", {
        prompt: finalData.prompt.substring(0, 100) + "...",
        model: finalData.model,
        duration: finalData.duration,
        resolution: finalData.resolution,
        aspectRatio: finalData.aspectRatio,
        hasStartFrame: !!finalData.startFrameImage?.file,
        hasEndFrame: !!finalData.endFrameImage?.file
      });
      
      console.log("About to call video generation API with final data:", finalData);
      
      // Notify parent that generation is starting (for immediate navigation)
      if (onGenerationStart) {
        onGenerationStart();
      }
      
      generateVideoMutation.mutate(finalData);
    } catch (error) {
      console.error("Error in form submission:", error);
      showRoleBasedErrorToast({
        title: t("toasts.submissionFailed"),
        error: error,
        fallbackTitle: t("toasts.submissionFailed")
      });
    }
  };

  const estimatedCost = pricingEstimate?.totalCost || 25; // Use catalog pricing, fallback to 25
  const hasEnoughCredits = credits ? credits.balance >= estimatedCost : false;

  // Validation for Kling Motion Control models - require both start frame image AND video reference
  const isKlingMotionControl = selectedModel?.id?.includes('motion');
  const hasStartFrameImage = Boolean(form.watch("startFrameImage")?.url || form.watch("startFrameImage")?.file);
  const hasVideoReference = Boolean(form.watch("videoReference")?.url || form.watch("videoReference")?.file);
  const motionControlMissingInputs = isKlingMotionControl && (!hasStartFrameImage || !hasVideoReference);
  const motionControlErrorMessage = isKlingMotionControl && !hasStartFrameImage && !hasVideoReference
    ? t("forms.messages.motionControlRequiresBoth", "Motion Control requires both a start frame image and a video reference")
    : isKlingMotionControl && !hasStartFrameImage
    ? t("forms.messages.motionControlRequiresImage", "Motion Control requires a start frame image")
    : isKlingMotionControl && !hasVideoReference
    ? t("forms.messages.motionControlRequiresVideo", "Motion Control requires a video reference")
    : null;

  const glassSelectTriggerClass = "h-12 rounded-[10px] border border-white/20 bg-white/[0.08] text-white focus:ring-[#5fb6ff] focus:ring-offset-0 hover:bg-white/[0.14] pr-10";
  const glassSelectContentClass = "rounded-[10px] border-white/20 bg-[linear-gradient(170deg,rgba(82,130,185,0.32)_0%,rgba(35,57,90,0.88)_45%,rgba(17,29,50,0.94)_100%)] text-white backdrop-blur-xl";
  const glassSelectItemClass = "rounded-[10px] text-white/90 focus:bg-white/[0.14] focus:text-white data-[state=checked]:bg-white/[0.18] data-[state=checked]:text-white";

  return (
    <div className="relative pb-6">
      <div className="relative overflow-hidden rounded-[10px] border border-white/12 bg-[linear-gradient(165deg,rgba(22,45,88,0.34)_0%,rgba(12,30,62,0.56)_35%,rgba(7,17,36,0.76)_68%,rgba(3,7,15,0.9)_100%)] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_46%,rgba(255,255,255,0.02)_100%)]" />
        <div className="relative">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <h2 className="text-[16px] leading-[1.1] font-semibold text-white tracking-tight">
                {t("forms.labels.describeYourVideo")}
              </h2>
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PromptInputSection
                        prompt={field.value}
                        onPromptChange={field.onChange}
                        onRandomPrompt={async () => {
                          try {
                            const response = await fetch('/api/random-prompt');
                            if (response.ok) {
                              const randomPrompt = await response.json();
                              field.onChange(randomPrompt.prompt);
                            }
                          } catch (error) {
                            console.error('Failed to fetch random prompt:', error);
                          }
                        }}
                        isGenerating={generateVideoMutation.isPending || isModerating}
                        variant="glass"
                        showLabel={false}
                        enhanceToggle={
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2.5">
                                <span className="whitespace-nowrap text-[12px] font-medium text-white/90">Enhance prompt</span>
                                <ToggleSwitch
                                  checked={enhancePrompt}
                                  onCheckedChange={setEnhancePrompt}
                                  id="enhance-video-toggle"
                                  size="sm"
                                  disabled={isEnhancing}
                                />
                                {isEnhancing && <Loader2 className="h-4 w-4 animate-spin text-[#7ac8ff]" />}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("forms.tooltip.enhanceVideoPrompt")}</p>
                            </TooltipContent>
                          </Tooltip>
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

          {/* Start and End Frame - minimal stacked design above model */}
          {(selectedModel?.supportsStartFrame || selectedModel?.supportsEndFrame) && (
            <div className="flex flex-col gap-3">
              {selectedModel?.supportsStartFrame && (
                <FormField
                  control={form.control}
                  name="startFrameImage"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-sm font-medium text-white/85 whitespace-nowrap">{t("forms.labels.startFrameImage")}</FormLabel>
                      <FormControl>
                        <FrameImageUpload 
                          value={field.value || null}
                          onChange={(value) => handleImageUpload(value, field.onChange)}
                          label={t("forms.labels.uploadStartFrame")}
                          disabled={generateVideoMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              {selectedModel?.supportsEndFrame && (
                <FormField
                  control={form.control}
                  name="endFrameImage"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className="text-sm font-medium text-white/85 whitespace-nowrap">{t("forms.labels.endFrameImage")}</FormLabel>
                      <FormControl>
                        <FrameImageUpload 
                          value={field.value || null}
                          onChange={(value) => handleImageUpload(value, field.onChange)}
                          label={t("forms.labels.uploadEndFrame")}
                          disabled={generateVideoMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {/* Video Reference Upload - for Motion Control models */}
          {selectedModel?.supportsVideoReference && (
            <FormField
              control={form.control}
              name="videoReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-white/85">
                    {t("forms.labels.motionReferenceVideo")} ({t("common.required")})
                  </FormLabel>
                  <FormControl>
                    <ImageUpload 
                      value={field.value || null}
                      onChange={field.onChange}
                      label={t("forms.labels.uploadVideo")}
                      accept="video/*"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-white/65 mt-1">
                    {t("forms.labels.motionReferenceDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Character Orientation - for Kling Motion Control models only (not Grok) */}
          {selectedModel?.supportsVideoReference && !selectedModel?.id?.startsWith('grok-imagine') && (
            <FormField
              control={form.control}
              name="characterOrientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.characterOrientation")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className={glassSelectTriggerClass}>
                        <SelectValue placeholder={t("forms.labels.selectOrientation")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className={glassSelectContentClass}>
                      <SelectItem value="video" className={glassSelectItemClass}>{t("forms.labels.followVideoOrientation")}</SelectItem>
                      <SelectItem value="image" className={glassSelectItemClass}>{t("forms.labels.followImageOrientation")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs text-white/65 mt-1">
                    {t("forms.labels.orientationDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Model Selection - moved to top */}
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.model")}</FormLabel>
                <FormControl>
                  <UnifiedModelSelector
                    value={field.value}
                    onValueChange={field.onChange}
                    onModeChange={setSelectedMode}
                    mode={selectedMode}
                    mediaType="video"
                    hasImageInput={!!form.watch("startFrameImage")?.url || !!form.watch("videoReference")?.url}
                    disabled={generateVideoMutation.isPending}
                    variant="glass"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Audio Toggle - Show for models that support audio toggle (VEO, Kling) */}
          {selectedModel?.supportsAudio && (currentModel === 'veo-3.1' || currentModel === 'kling-2.6') && (
            <FormField
              control={form.control}
              name="audioEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-[10px] border border-white/20 bg-white/[0.07] p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-white/85">
                      {t("forms.labels.enableAudio")}
                    </FormLabel>
                    <FormDescription className="text-xs text-white/65">
                      {t("forms.labels.enableAudioDescription")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <ToggleSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="audio-enabled-toggle"
                      data-testid="toggle-audio-enabled"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {/* Generate Button - moved below model selector */}
          <button
            type="submit"
            disabled={generateVideoMutation.isPending || isModerating || !hasEnoughCredits || motionControlMissingInputs}
            className="parallel-generate-btn inline-flex h-12 w-full items-center justify-center !rounded-[10px] border border-white/20 bg-[linear-gradient(90deg,#2d66f5_0%,#2599f6_100%)] px-4 text-[15px] font-medium text-white shadow-[0_9px_20px_rgba(44,149,255,0.35)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fd3ff] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:brightness-75 disabled:shadow-none"
          >
            <div className="flex items-center justify-center gap-2">
              {(isModerating || generateVideoMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="flex items-center gap-1">
                {isModerating ? (
                  t("progress.checkingContentSafety", "Checking content safety...")
                ) : generateVideoMutation.isPending ? (
                  t("forms.buttons.startingGeneration")
                ) : motionControlMissingInputs ? (
                  t("forms.buttons.uploadRequired", "Upload Required")
                ) : !hasEnoughCredits ? (
                  t("forms.buttons.insufficientCredits")
                ) : (
                  <>
                    {t("forms.buttons.generate")} {estimatedCost} <Coins className="w-4 h-4" />
                  </>
                )}
              </span>
            </div>
          </button>

          {isFreeUser && (
            <div className="text-center text-xs text-white/70">
              <span>Free plan generations are public</span>
            </div>
          )}

          {motionControlErrorMessage && (
            <p className="text-amber-400 text-sm text-center">
              {motionControlErrorMessage}
            </p>
          )}

          {!hasEnoughCredits && !motionControlMissingInputs && (
            <p className="text-red-300 text-sm text-center">
              {t("forms.messages.needCreditsForVideo", { amount: estimatedCost })}
            </p>
          )}

              {/* Style and Resolution Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Video Style Selection */}
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.style")} ({t("common.optional")})</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={glassSelectTriggerClass}>
                            <SelectValue placeholder={t("forms.placeholder.selectStyle")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className={glassSelectContentClass}>
                          <SelectItem value="none" className={glassSelectItemClass}>{t("common.none")}</SelectItem>
                          {stylesLoading ? (
                            <SelectItem value="loading" disabled className={glassSelectItemClass}>{t("forms.loadingStyles")}</SelectItem>
                          ) : videoStyles && videoStyles.length > 0 ? (
                            videoStyles.map((style: any) => (
                              <SelectItem key={style.id} value={style.id.toString()} className={glassSelectItemClass}>
                                {style.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-styles" disabled className={glassSelectItemClass}>{t("forms.noStylesAvailable")}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Resolution Selector */}
                <ResolutionSelector
                  selectedResolution={selectedResolution}
                  supportedResolutions={selectedModel?.supportedSizes || []}
                  onResolutionChange={handleResolutionChange}
                  disabled={generateVideoMutation.isPending}
                  variant="glass"
                />
              </div>

              {/* Aspect Ratio and Duration Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Aspect Ratio Selector */}
                <PopupAspectRatioSelector
                  selectedRatio={form.watch("aspectRatio")}
                  supportedRatios={selectedModel?.supportedRatios || []}
                  onRatioChange={(ratio) => form.setValue("aspectRatio", ratio as any)}
                  disabled={isAspectRatioDisabled}
                  variant="glass"
                />

                {/* Duration Selector */}
                <DurationSelector
                  selectedDuration={selectedDuration}
                  supportedDurations={selectedModel?.supportedDurations || []}
                  onDurationChange={handleDurationChange}
                  disabled={generateVideoMutation.isPending}
                  variant="glass"
                />
              </div>

              {/* Audio File Upload - for WAN 2.6 */}
              {selectedModel?.supportsAudioFile && (
                <FormField
                  control={form.control}
                  name="audioFile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.backgroundAudio")} ({t("forms.optional")})</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="audio/wav,audio/mp3,audio/mpeg"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                field.onChange({ file, url: null });
                              }
                            }}
                            className="rounded-[10px] border-white/20 bg-white/[0.08] text-white file:mr-2 file:rounded-[8px] file:border-0 file:bg-white/15 file:text-white hover:bg-white/[0.12]"
                          />
                          {field.value?.file && (
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <span>{field.value.file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange(null)}
                                className="h-6 rounded-[8px] px-2 text-white/70 hover:bg-white/10 hover:text-white"
                              >
                                {t("common.delete")}
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-white/65 mt-1">
                        {t("forms.labels.backgroundAudioDescription")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Prompt Expansion Toggle - for WAN 2.6 */}
              {selectedModel?.supportsPromptExpansion && (
                <FormField
                  control={form.control}
                  name="promptExpansion"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-[10px] border border-white/20 bg-white/[0.07] p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.promptExpansion")}</FormLabel>
                        <FormDescription className="text-xs text-white/65">
                          {t("forms.labels.promptExpansionDescription")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Multi-Shot Toggle - for WAN 2.6 */}
              {selectedModel?.supportsMultiShot && (
                <FormField
                  control={form.control}
                  name="multiShot"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-[10px] border border-white/20 bg-white/[0.07] p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium text-white/85">{t("forms.labels.multiShotGeneration")}</FormLabel>
                        <FormDescription className="text-xs text-white/65">
                          {t("forms.labels.multiShotDescription")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Reset Button */}
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="h-11 w-full rounded-[10px] border border-white/15 bg-white/5 text-white/85 hover:bg-white/12 hover:text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("common.reset")}
              </Button>
        </form>
      </Form>
        </div>
      </div>

      {/* Free Generation Consent Modal */}
      <FreeGenerationConsentModal
        open={showConsentModal}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
    </div>
  );
}
