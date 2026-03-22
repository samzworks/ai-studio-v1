import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { insertImageSchema, AiStyle } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PromptInputSection from "./prompt-input-section";
import ModelSettingsPanel from "./model-settings-panel";
import GenerationControls from "./generation-controls";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Sparkles, X, RotateCcw, CheckCircle, AlertCircle, Timer as Clock, Loader2, Coins, Shield, ShieldX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ToggleSwitch from "@/components/ui/toggle-switch";
import ModelSelector, { ModelConfig } from "./model-selector";
import UnifiedModelSelector from "./unified-model-selector";
import type { VideoMode } from "@shared/model-routing";
import { resolveVariant, IMAGE_BASE_MODELS } from "@shared/model-routing";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useToastPosition } from "@/contexts/toast-position-context";

import StyleImageUpload from "./style-image-upload";
import { usePricingEstimate } from "@/hooks/use-pricing-estimate";
import { useCredits } from "@/contexts/CreditContext";
import {
  MemoizedGenerateButton,
  MemoizedCreditDisplay,
  MemoizedPricingBreakdown
} from "./memoized-components";

import PopupAspectRatioSelector from "./popup-aspect-ratio-selector";
import { useGenerationJobs } from "@/hooks/useGenerationJobs";
import { useUserPlan } from "@/hooks/useUserPlan";
import FreeGenerationConsentModal from "./free-generation-consent-modal";
import { useGalleryStore } from "@/stores/gallery-store";
import { usePromptStore } from "@/stores/prompt-store";

// Base limits - will be adjusted based on admin settings
const BUTTON_THROTTLE_MS = 1500;
import { z } from "zod";

const formSchema = insertImageSchema.pick({
  prompt: true,
  width: true,
  height: true,
  style: true,
  model: true,
  tags: true,
  provider: true,
  styleImageUrl: true,
  imageStrength: true,
}).extend({
  prompt: z.string().min(1).max(10000),
  tags: z.array(z.string()).optional().default([]),
  provider: z.string().optional().default("openai"),
  aspectRatio: z.string().optional(),
  enhancePrompt: z.boolean().optional().default(false),
  styleImageUrl: z.string().optional(),
  styleImageUrls: z.array(z.string()).optional(),
  imageStrength: z.number().min(0).max(1).optional(),
  imageSize: z.string().optional(),
  resolution: z.string().optional().default("1K"),
});

const GPT_IMAGE_SIZES = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
] as const;

const NANOBANANA_PRO_RESOLUTIONS = [
  { value: "1K", label: "1K (Standard)", description: "~1024px" },
  { value: "2K", label: "2K (High)", description: "~2048px" },
  { value: "4K", label: "4K (Ultra)", description: "~4096px" },
] as const;

type FormData = z.infer<typeof formSchema>;

interface QueuedJob {
  id: string;
  formData: FormData & { resolution?: string };
  prompt: string;
}

interface ParallelGenerationFormProps {
  onImageGenerated: () => void;
  selectedPrompt?: string;
  onJobsChange?: (activeJobCount: number) => void;
  onMobileClose?: () => void;
  initialModel?: string;
  onGenerationStart?: () => void;
}

export default function ParallelGenerationForm({ onImageGenerated, selectedPrompt, onJobsChange, onMobileClose, initialModel, onGenerationStart }: ParallelGenerationFormProps) {
  const { showRoleBasedErrorToast, showSuccessToast } = useAuthAwareToast();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const { setGenerationFormActive } = useToastPosition();

  useEffect(() => {
    if (isMobile) {
      setGenerationFormActive(true);
      return () => setGenerationFormActive(false);
    }
  }, [isMobile, setGenerationFormActive]);

  // Detect RTL based on current language
  const isRTL = i18n.language === 'ar';
  const { getConfig } = useSiteConfig();
  const [selectedModelConfig, setSelectedModelConfig] = useState<ModelConfig | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("1:1");
  const [selectedMode, setSelectedMode] = useState<VideoMode>("pro");
  // Removed selectedImageSize state - models ignore size when aspect ratio is set

  // Prompt enhancement states
  const [enhancePrompt, setEnhancePrompt] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);

  // Enhancement session state for pre-generation UX
  const [enhancementSession, setEnhancementSession] = useState<{
    stage: 'idle' | 'enhancing' | 'ready' | 'failed';
    enhancedPrompt?: string;
    progressText?: string;
    error?: string;
    startedAt?: number;
    abortController?: AbortController;
  }>({ stage: 'idle' });

  // Style image upload states
  const [styleImage, setStyleImage] = useState<{
    file: File | null;
    url: string | null;
    strength: number;
  }[] | null>(null);

  // Fetch AI styles from the API
  const { data: aiStyles = [], isLoading: stylesLoading } = useQuery<AiStyle[]>({
    queryKey: ["/api/ai-styles"],
    staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity, so styles refresh properly
    refetchOnMount: 'always', // Always refetch on mount to get latest styles
  });

  // Fetch available models for style upload logic
  const { data: availableModels = [] } = useQuery<ModelConfig[]>({
    queryKey: ["/api/models"],
  });

  // Fetch site config to get default image model
  const { data: config } = useQuery({
    queryKey: ["/api/config"],
  });

  // Check if style upload is enabled globally
  const isStyleUploadEnabled = getConfig("style_upload_enabled", true);

  // Use shared credits context instead of duplicate query
  const { credits: userCredits, refetchCredits } = useCredits();

  // Client-side button throttle state
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const throttleMs = parseInt(getConfig("button_throttle_ms", String(BUTTON_THROTTLE_MS))) || BUTTON_THROTTLE_MS;
  const timeSinceLastSubmit = Date.now() - lastSubmitTime;
  const isButtonThrottled = lastSubmitTime > 0 && timeSinceLastSubmit < throttleMs;

  // Get queue status for enhanced feedback
  const { queueStatus, activeJobs: serverActiveJobs, hasActiveJobs: hasServerJobs } = useGenerationJobs();

  // Get user plan info for consent and disclosure
  const { isFreeUser, needsConsent } = useUserPlan();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  // Track number of jobs currently being submitted (for UI feedback)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingCount, setSubmittingCount] = useState(0);
  const [moderatingCount, setModeratingCount] = useState(0);
  const isModerating = moderatingCount > 0;
  const nextJobIdRef = useRef(1);
  const initialModelAppliedRef = useRef(false);
  const previousInitialModelRef = useRef(initialModel);

  // Reset the initialModelAppliedRef when initialModel changes
  if (initialModel !== previousInitialModelRef.current) {
    previousInitialModelRef.current = initialModel;
    initialModelAppliedRef.current = false;
  }

  // Default form values with fallback model
  const defaultFormState: FormData = {
    prompt: "",
    width: 1024,
    height: 1024,
    style: "Realistic", // Default to "Realistic" AI style
    model: "flux-pro", // Will be updated by useEffect when config loads
    tags: [],
    provider: "replicate",
    aspectRatio: "1:1",
    enhancePrompt: false,
    imageSize: "1024x1024",
    resolution: "1K",
  };

  // Check if selected model is GPT Image 1.5
  const isGptImageModel = (modelId: string) => modelId?.includes('gpt-image-1.5');

  // Persistent form state - this is our source of truth
  const [formState, setFormState] = useState<FormData>({
    ...defaultFormState,
    prompt: selectedPrompt || "",
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: formState,
  });

  // Watch the model ID for use in various computed values
  const currentModelId = form.watch("model");

  // Get the current base model from routing
  const currentBaseModel = useMemo(() => {
    const modelId = currentModelId || "nano-banana";
    return IMAGE_BASE_MODELS.find(m => m.id === modelId) || null;
  }, [currentModelId]);

  // Check if selected model supports resolution options
  const hasResolutionOptions = currentBaseModel?.supportedSizes && currentBaseModel.supportedSizes.length > 1;

  // Update form when config loads with default image model (but not if initialModel is provided)
  useEffect(() => {
    // Skip if initialModel is provided - it takes priority
    if (initialModel) return;

    const configObj = config as any;

    if (configObj?.default_image_model && configObj.default_image_model !== formState.model) {
      const newFormState = { ...defaultFormState, model: configObj.default_image_model, prompt: formState.prompt };
      setFormState(newFormState);
      form.reset(newFormState);
    }
  }, [config, form, initialModel]);

  // Ensure "Realistic" style is selected by default when AI styles load
  useEffect(() => {
    if (aiStyles.length > 0 && !stylesLoading) {
      const currentStyle = form.getValues('style');
      const realisticStyle = aiStyles.find(s => s.name === 'Realistic');

      // If no style is set or current style doesn't exist in aiStyles, default to "Realistic"
      const currentStyleExists = aiStyles.some(s => s.name === currentStyle);

      if (!currentStyle || (!currentStyleExists && realisticStyle)) {
        form.setValue('style', realisticStyle?.name || aiStyles[0]?.name || 'Realistic');
      }
    }
  }, [aiStyles, stylesLoading, form]);

  // Resolve variant for pricing - need to pass mode and hasImage to get correct variant
  const hasImageForPricing = !!(styleImage && styleImage.length > 0);
  const resolvedPricingVariant = useMemo(() => {
    if (!currentModelId) return null;
    const result = resolveVariant({
      baseModelId: currentModelId,
      mediaType: "image",
      hasInputImage: hasImageForPricing,
      mode: selectedMode
    });
    return result?.variant?.id || currentModelId;
  }, [currentModelId, hasImageForPricing, selectedMode]);

  // Get pricing estimate based on form values with resolved variant
  const { estimate: pricingEstimate } = usePricingEstimate({
    model: resolvedPricingVariant || currentModelId,
    enhancePrompt: enhancePrompt,
    imageCount: parseInt(getConfig("images_per_generation", "1")) || 1,
    aspectRatio: selectedAspectRatio,
    styleImageUrl: (styleImage && styleImage.length > 0 ? styleImage[0].url : undefined) || undefined,
    imageSize: form.watch("imageSize") || "1024x1024",
    resolution: form.watch("resolution") || undefined
  });

  // Update form when selectedPrompt prop changes
  useEffect(() => {
    if (selectedPrompt && selectedPrompt !== form.getValues('prompt')) {
      form.setValue('prompt', selectedPrompt);
      setFormState(prev => ({ ...prev, prompt: selectedPrompt }));
    }
  }, [selectedPrompt, form]);

  // Listen to prompt store for "use prompt" feature from gallery
  const storePrompt = usePromptStore(state => state.selectedPrompt);
  const clearSelectedPrompt = usePromptStore(state => state.clearSelectedPrompt);

  useEffect(() => {
    if (storePrompt && storePrompt !== form.getValues('prompt')) {
      form.setValue('prompt', storePrompt);
      setFormState(prev => ({ ...prev, prompt: storePrompt }));
      clearSelectedPrompt();
    }
  }, [storePrompt, form, clearSelectedPrompt]);

  // Listen to prompt store for "use image" feature from gallery
  const storeImageReference = usePromptStore(state => state.selectedImageReference);
  const clearSelectedImageReference = usePromptStore(state => state.clearSelectedImageReference);

  useEffect(() => {
    if (storeImageReference && storeImageReference.url) {
      // Create a style image entry from the image URL
      setStyleImage([{
        file: null,
        url: storeImageReference.url,
        strength: 0.8, // Default strength
      }]);
      clearSelectedImageReference();
    }
  }, [storeImageReference, clearSelectedImageReference]);

  // Listen to prompt store for "use image" model selection from gallery
  const storeSelectedModel = usePromptStore(state => state.selectedModel);
  const clearSelectedModel = usePromptStore(state => state.clearSelectedModel);

  useEffect(() => {
    if (storeSelectedModel) {
      form.setValue('model', storeSelectedModel);
      setFormState(prev => ({ ...prev, model: storeSelectedModel }));

      // Find the base model config and set it for aspect ratio support
      const baseModel = IMAGE_BASE_MODELS.find(m => m.id === storeSelectedModel);
      if (baseModel) {
        const modelConfig: ModelConfig = {
          id: baseModel.id,
          name: baseModel.name,
          provider: baseModel.provider,
          category: baseModel.category || "general",
          description: baseModel.displayName || baseModel.name,
          supportedRatios: baseModel.supportedRatios || ["1:1"],
          maxWidth: 1440,
          maxHeight: 1440,
          supportsStyleUpload: baseModel.supportsImageInput || false
        };
        setSelectedModelConfig(modelConfig);
      }
      clearSelectedModel();
    }
  }, [storeSelectedModel, clearSelectedModel, form]);

  // Keep formState synced with form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      setFormState(prev => ({ ...prev, ...value as FormData }));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Initialize with Flux Pro model on mount - need to get full model config from API
  // Skip if initialModel is provided (it will be applied by the initialModel effect below)
  useEffect(() => {
    // Don't set default if initialModel is provided
    if (initialModel) return;

    // Set a temporary config to prevent null reference errors
    const tempFluxProModel = {
      id: "flux-pro",
      name: "Flux Pro",
      provider: "replicate",
      category: "general",
      description: "High-quality image generation",
      supportedRatios: ["1:1", "16:9", "9:16", "21:9", "9:21", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3"],
      maxWidth: 1440,
      maxHeight: 1440,
      supportsStyleUpload: false // Flux Pro is text-to-image only
    } as ModelConfig;
    setSelectedModelConfig(tempFluxProModel);
  }, [initialModel]);

  // Handle initialModel prop - select the model when component mounts with an initialModel
  useEffect(() => {
    if (initialModel && !initialModelAppliedRef.current) {
      initialModelAppliedRef.current = true;
      // Set the base model ID directly - the UnifiedModelSelector will handle the display
      form.setValue('model', initialModel);
      setFormState(prev => ({ ...prev, model: initialModel }));

      // Find the base model config and set it for aspect ratio support
      const baseModel = IMAGE_BASE_MODELS.find(m => m.id === initialModel);
      if (baseModel) {
        // Create a ModelConfig-like object from the base model
        const modelConfig: ModelConfig = {
          id: baseModel.id,
          name: baseModel.name,
          provider: baseModel.provider,
          category: baseModel.category || "general",
          description: baseModel.displayName || baseModel.name,
          supportedRatios: baseModel.supportedRatios || ["1:1"],
          maxWidth: 1440,
          maxHeight: 1440,
          supportsStyleUpload: baseModel.supportsImageInput || false
        };
        setSelectedModelConfig(modelConfig);
      }
    }
  }, [initialModel, form]);

  // Handle aspect ratio changes
  const handleAspectRatioChange = (ratio: string) => {
    setSelectedAspectRatio(ratio);
    form.setValue('aspectRatio', ratio);

    // When using aspect ratio, let the model determine optimal dimensions
    // Remove width/height from form data to let API use aspect ratio only
    form.setValue('width', undefined);
    form.setValue('height', undefined);
  };

  // Removed handleImageSizeChange - models ignore size when aspect ratio is set

  // Update dimensions when model changes (but preserve them if already set)
  useEffect(() => {
    if (selectedModelConfig && selectedModelConfig.supportedRatios && selectedAspectRatio) {
      // Check if current aspect ratio is supported by the new model
      if (!selectedModelConfig.supportedRatios.includes(selectedAspectRatio)) {
        // Use the first supported ratio as fallback
        const fallbackRatio = selectedModelConfig.supportedRatios[0] || "1:1";
        setSelectedAspectRatio(fallbackRatio);
        form.setValue('aspectRatio', fallbackRatio);
      }

      // Only clear width/height if they're currently undefined (not explicitly set)
      // This preserves regenerate dimensions while still allowing aspect-ratio-only mode
      const currentWidth = form.getValues('width');
      const currentHeight = form.getValues('height');

      if (currentWidth === undefined && currentHeight === undefined) {
        // When using aspect ratio without explicit dimensions, let the model determine optimal size
        form.setValue('width', undefined);
        form.setValue('height', undefined);
      }
    }
  }, [selectedModelConfig, selectedAspectRatio, form]);

  // Notify parent component about active job count changes
  useEffect(() => {
    if (onJobsChange) {
      onJobsChange(serverActiveJobs.length + submittingCount);
    }
  }, [serverActiveJobs.length, submittingCount, onJobsChange]);

  // Auto-dismiss enhancement failure state after 3 seconds
  useEffect(() => {
    if (enhancementSession.stage === 'failed') {
      const timer = setTimeout(() => {
        setEnhancementSession({ stage: 'idle' });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [enhancementSession.stage]);

  // Generate unique job ID
  const generateJobId = () => {
    return `job_${nextJobIdRef.current++}_${Date.now()}`;
  };

  // Submit a single job to the backend (enqueue + generate)
  const submitSingleJob = async (job: QueuedJob, abortSignal?: AbortSignal): Promise<boolean> => {
    // Resolve the base model to variant ID before submitting
    // Use the job's own style image URLs to determine if image input is present
    const baseModelId = job.formData.model || "nano-banana";
    const hasImage = !!(job.formData.styleImageUrl || (job.formData.styleImageUrls && job.formData.styleImageUrls.length > 0));
    const resolved = resolveVariant({
      baseModelId,
      mediaType: "image",
      hasInputImage: hasImage,
      mode: selectedMode,
    });

    // Handle resolution errors
    if (!resolved || resolved.error || !resolved.variant) {
      const errorMsg = resolved?.fallbackMessage || 'Could not resolve model variant';
      toast({
        variant: "destructive",
        title: t('errors.invalidModelConfiguration', 'Invalid model configuration'),
        description: errorMsg,
      });
      return false;
    }

    // Use the resolved variant ID and provider
    const resolvedModelId = resolved.variant.id;

    // Prepare form data for submission with resolved variant ID
    const submitData = {
      ...job.formData,
      model: resolvedModelId,
      provider: resolved.baseModel.provider,
      jobId: job.id,
      // Resolution is already included in job.formData when the job was created
    };

    // Moderation happens during enqueue, so show placeholder before calling enqueue
    // Use flags to ensure we only cleanup what we've set up
    let moderationIncremented = false;
    let placeholderAdded = false;
    const moderationPlaceholderId = `mod-${job.id}`;
    const { addModerationPlaceholder, removeModerationPlaceholder } = useGalleryStore.getState();

    try {
      // Add placeholder immediately before enqueue (moderation happens during enqueue)
      setModeratingCount(c => c + 1);
      moderationIncremented = true;

      addModerationPlaceholder({
        id: moderationPlaceholderId,
        prompt: job.formData.prompt.substring(0, 100),
        startedAt: Date.now()
      });
      placeholderAdded = true;

      // First, enqueue the job - this includes moderation check
      const enqueueResponse = await apiRequest("POST", "/api/generation-jobs/enqueue", submitData, {
        signal: abortSignal
      });
      const enqueueResult = await enqueueResponse.json();

      // Remove placeholder after moderation completes (enqueue returns)
      if (placeholderAdded) {
        removeModerationPlaceholder(moderationPlaceholderId);
        placeholderAdded = false;
      }
      if (moderationIncremented) {
        setModeratingCount(c => Math.max(0, c - 1));
        moderationIncremented = false;
      }

      if (!enqueueResult.success || !enqueueResult.job?.id) {
        // Server rejected the job
        console.warn('[Queue] Server rejected job:', enqueueResult.error, 'errorCode:', enqueueResult.errorCode);

        let errorTitle = t('errors.generationFailed', 'Generation failed');
        let errorDescription = enqueueResult.error || t('errors.queueFullDescription', 'Please try again later.');

        if (enqueueResult.errorCode === 'QUEUE_FULL') {
          errorTitle = t('errors.queueFullTitle', 'Queue is full');
        } else if (enqueueResult.errorCode === 'RATE_LIMITED') {
          errorTitle = t('errors.rateLimitTitle', 'Too many requests');
        } else if (enqueueResult.errorCode === 'GLOBAL_LIMIT') {
          errorTitle = t('errors.systemBusy', 'System is busy');
        }

        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDescription,
        });
        return false;
      }

      const queueJobId = enqueueResult.job.id;
      console.log(`[Queue] Job ${queueJobId} enqueued successfully`);

      // Update submit data with queue job ID
      (submitData as any).queueJobId = queueJobId;

      // Invalidate jobs query to show the new job
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });

      // Now call generate API (moderation already passed)
      const response = await apiRequest("POST", "/api/images/generate", submitData, {
        signal: abortSignal
      });
      const result = await response.json();

      // Invalidate queries to update status
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });

      console.log(`[Queue] Job ${job.id} completed successfully`);
      return true;

    } catch (error: any) {
      // Invalidate jobs query to update status on failure
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });

      if (error.name === 'AbortError') {
        console.log(`[Queue] Job ${job.id} was cancelled`);
        return false;
      }

      // Handle errors with user-friendly messages
      const errorMessage = error.message || '';

      // Check for moderation block (403 with PROMPT_BLOCKED code)
      const is403Error = errorMessage.startsWith('403:');
      if (is403Error && errorMessage.includes('PROMPT_BLOCKED')) {
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
        return false;
      }

      const is429Error = errorMessage.startsWith('429:') ||
        errorMessage.includes('Too many') ||
        errorMessage.toLowerCase().includes('rate limit');

      if (is429Error) {
        let retryAfter: number | null = null;
        try {
          const jsonStart = errorMessage.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(errorMessage.substring(jsonStart));
            if (parsed.retryAfter && typeof parsed.retryAfter === 'number') {
              retryAfter = parsed.retryAfter;
            }
          }
        } catch (e) { }

        toast({
          variant: "destructive",
          title: t('errors.rateLimitTitle', 'Generation limit reached'),
          description: retryAfter
            ? t('errors.rateLimitWithRetry', 'You\'re generating images too quickly. Please wait {{seconds}} seconds and try again.', { seconds: retryAfter })
            : t('errors.rateLimitGeneric', 'You\'re generating images too quickly. Please wait a moment and try again.'),
        });
      } else {
        showRoleBasedErrorToast({
          title: "Generation failed",
          error: error,
          fallbackTitle: "Generation failed"
        });
      }

      return false;
    } finally {
      // Ensure cleanup happens on any error path
      if (placeholderAdded) {
        removeModerationPlaceholder(moderationPlaceholderId);
      }
      if (moderationIncremented) {
        setModeratingCount(c => Math.max(0, c - 1));
      }
    }
  };



  // Cancel enhancement session
  const cancelEnhancement = () => {
    if (enhancementSession.abortController) {
      enhancementSession.abortController.abort();
    }
    setEnhancementSession({ stage: 'idle' });
    setIsEnhancing(false);
    toast({
      title: t('toasts.enhancementCancelled', 'Enhancement cancelled'),
      description: t('toasts.enhancementCancelledDescription', 'Prompt enhancement has been cancelled'),
    });
  };



  // Handle form submission - check for consent first
  const onSubmit = async (data: FormData) => {
    // Client-side button throttle check - prevent rapid clicking
    const now = Date.now();
    if (lastSubmitTime > 0 && (now - lastSubmitTime) < throttleMs) {
      toast({
        title: t('toasts.pleaseWait', 'Please wait'),
        description: t('toasts.generatingTooFast', 'Please wait a moment before generating again.'),
        variant: "default",
        duration: 2000,
      });
      return;
    }
    setLastSubmitTime(now);

    // Check if free user needs to consent first
    if (needsConsent) {
      setPendingFormData(data);
      setShowConsentModal(true);
      return;
    }

    // Proceed with generation
    await processGeneration(data);
  };

  // Handle consent accept - continue with generation
  const handleConsentAccept = () => {
    setShowConsentModal(false);
    if (pendingFormData) {
      processGeneration(pendingFormData);
      setPendingFormData(null);
    }
  };

  // Handle consent decline - cancel generation
  const handleConsentDecline = () => {
    setShowConsentModal(false);
    setPendingFormData(null);
  };

  // Process the actual generation after consent (if needed)
  const processGeneration = async (data: FormData) => {
    // Show disclosure notification for free users at generation time
    if (isFreeUser) {
      toast({
        title: t('freeDisclosure.title', 'Public Generation'),
        description: t('freeDisclosure.message', 'Free plan generations are public by default.'),
        duration: 4000,
      });
    }

    // Continue with the rest of the generation logic
    await executeGeneration(data);
  };

  // Main generation execution logic
  const executeGeneration = async (data: FormData) => {

    // Get the number of images to generate from admin setting (bulk count)
    const imagesPerGeneration = parseInt(getConfig("images_per_generation", "1")) || 1;

    // Check if user has enough credits
    if (pricingEstimate && userCredits) {
      const totalCost = pricingEstimate.totalCost;
      const balance = userCredits.balance;

      if (balance < totalCost) {
        toast({
          title: t('toasts.insufficientCreditsTitle'),
          description: t('toasts.insufficientCreditsDescription', { totalCost, balance }),
          variant: "error-outline" as any,
        });
        return;
      }
    }

    // Check server queue capacity - simplified model uses single limit for all active jobs
    if (queueStatus && !queueStatus.canEnqueue) {
      const maxActive = queueStatus.limits.maxActiveJobsPerUser;
      const currentActive = queueStatus.userCounts.total;

      toast({
        variant: "destructive",
        title: t('errors.queueFullTitle', 'Queue is full'),
        description: t('errors.queueFullDescription', 'You have {{current}}/{{max}} active jobs. Please wait for some to complete.', {
          current: currentActive,
          max: maxActive
        }),
      });
      return;
    }

    // Process the prompt: first translate if needed, then enhance if enabled
    let finalPrompt = data.prompt;

    // Step 1: Handle translation if needed (skip for models that support Arabic natively)
    finalPrompt = await translatePrompt(finalPrompt, data.model);

    // Step 2: Handle enhancement if enabled with session tracking
    if (enhancePrompt) {
      // Initialize enhancement session immediately to show progress
      const abortController = new AbortController();
      setEnhancementSession({
        stage: 'enhancing',
        progressText: t('progress.enhancingPrompt', 'Enhancing prompt...'),
        startedAt: Date.now(),
        abortController
      });
      setIsEnhancing(true);

      try {
        finalPrompt = await enhancePromptText(finalPrompt, data.style, abortController.signal, data.model);

        // Safeguard: Truncate enhanced prompt if it exceeds maximum length (5000 chars)
        const MAX_PROMPT_LENGTH = 5000;
        const originalLength = finalPrompt.length;
        const wasTruncated = originalLength > MAX_PROMPT_LENGTH;

        if (wasTruncated) {
          console.warn(`Enhanced prompt too long (${originalLength} chars), truncating to ${MAX_PROMPT_LENGTH}`);
          finalPrompt = finalPrompt.substring(0, MAX_PROMPT_LENGTH);

          toast({
            title: t('toasts.promptTruncated', 'Prompt truncated'),
            description: t('toasts.promptTruncatedDescription', `Enhanced prompt was ${originalLength} characters and has been shortened to fit the ${MAX_PROMPT_LENGTH} character limit.`),
            variant: "default",
            duration: 4000,
          });
        } else {
          // Show success toast only if not truncated
          toast({
            title: t('toasts.enhancementComplete', 'Enhancement complete'),
            description: t('toasts.enhancementCompleteDescription', 'Enhanced prompt will be used for generation'),
            duration: 2000,
          });
        }

        // Enhancement succeeded - set to ready and show feedback
        setEnhancementSession({
          stage: 'ready',
          enhancedPrompt: finalPrompt,
          startedAt: Date.now()
        });
      } catch (error) {
        console.error('Enhancement failed:', error);

        // Check if it was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          setEnhancementSession({ stage: 'idle' });
          setIsEnhancing(false);
          return; // Don't continue with generation
        }

        // Enhancement failed, show error state (auto-dismiss handled by useEffect)
        setEnhancementSession({
          stage: 'failed',
          error: getFriendlyErrorMessage(error),
          startedAt: Date.now()
        });
        setIsEnhancing(false);

        // Continue with translated prompt if enhancement fails (skip for models that support Arabic natively)
        finalPrompt = await translatePrompt(data.prompt, data.model);
      } finally {
        setIsEnhancing(false);
      }
    }

    // Step 3: Handle style image upload if present (upload all images)
    let styleImageUrls: string[] = [];
    if (styleImage && styleImage.length > 0) {
      try {
        // Upload all files and get the server URLs (not blob URLs)
        const filesToUpload = styleImage.map(img => img.file).filter(file => file !== null) as File[];
        if (filesToUpload.length > 0) {
          styleImageUrls = await uploadStyleImageFiles(filesToUpload);
          console.log('Style images uploaded successfully:', styleImageUrls);

          // Validate that we got proper server URLs, not blob URLs
          for (const url of styleImageUrls) {
            if (url.startsWith('blob:')) {
              throw new Error('Server returned blob URL instead of actual file URL');
            }
          }
        }
      } catch (error) {
        console.error('Style images upload failed:', error);
        showRoleBasedErrorToast({
          title: "Upload failed",
          error: error instanceof Error ? error : new Error("Failed to upload style images. Please try again."),
          fallbackTitle: "Upload failed"
        });
        return;
      }
    }

    // Create multiple jobs based on admin setting
    const jobsToCreate: QueuedJob[] = [];
    for (let i = 0; i < imagesPerGeneration; i++) {
      const newJob: QueuedJob = {
        id: generateJobId(),
        formData: {
          ...data,
          prompt: finalPrompt,
          enhancePrompt: enhancePrompt,  // Include enhancePrompt parameter
          styleImageUrls: styleImageUrls,  // Include all uploaded image URLs
          styleImageUrl: styleImageUrls.length > 0 ? styleImageUrls[0] : '',  // Keep backward compatibility with first image
          imageStrength: (styleImage && styleImage.length > 0 ? styleImage[0].strength : undefined),  // Include image strength
          resolution: data.resolution  // Include resolution for models that support it
        },
        prompt: finalPrompt,
      };
      jobsToCreate.push(newJob);
    }

    // Submit all jobs directly to the backend in parallel
    // Backend enforces max_queue limit, frontend just submits
    setIsSubmitting(true);
    setSubmittingCount(jobsToCreate.length);

    // Show immediate feedback
    toast({
      title: t('toasts.imagesGenerating'),
      description: t('toasts.startedGenerating', { count: jobsToCreate.length }),
    });

    // Notify parent that generation is starting (for immediate navigation)
    if (onGenerationStart) {
      onGenerationStart();
    }

    // Reset enhancement session now that jobs have started (only if in ready state)
    setEnhancementSession(prev => prev.stage === 'ready' ? { stage: 'idle' } : prev);

    // Auto-close mobile sidebar after generation starts
    if (isMobile && onMobileClose) {
      onMobileClose();
    }

    // Submit all jobs in parallel - backend controls concurrency via max_queue
    const abortController = new AbortController();

    try {
      // Fire all jobs in parallel
      const results = await Promise.allSettled(
        jobsToCreate.map(job => submitSingleJob(job, abortController.signal))
      );

      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failures = results.length - successes;

      if (successes > 0) {
        onImageGenerated();
        refetchCredits();

        if (failures > 0) {
          toast({
            title: t('toasts.partialSuccess', 'Partial success'),
            description: t('toasts.partialSuccessDescription', '{{success}} images generated, {{failed}} failed', { success: successes, failed: failures }),
          });
        } else {
          toast({
            title: t('toasts.imageGeneratedSuccess'),
            description: t('toasts.imageGeneratedSuccessDescription'),
          });
        }
      }
    } finally {
      setIsSubmitting(false);
      setSubmittingCount(0);
    }
  };

  // GENERATE BUTTON LOGIC - uses server queue limits
  // Active jobs now tracked by backend, not local worker slots

  // Get the number of images to generate from admin setting (bulk count)
  const imagesPerGeneration = parseInt(getConfig("images_per_generation", "1")) || 1;

  // Button is disabled when server queue is full (not based on local workers)
  // This allows users to queue jobs even when all parallel slots are busy
  const isGenerateDisabled = queueStatus ? !queueStatus.canEnqueue : false;

  // Generate button text with cost - shows limit status when at max jobs
  const getButtonText = () => {
    // Check if at max jobs limit and show the count
    if (queueStatus && !queueStatus.canEnqueue) {
      const currentActive = queueStatus.userCounts.total;
      const maxActive = queueStatus.limits.maxActiveJobsPerUser;
      return (
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
          {currentActive}/{maxActive} {t("jobs.inProgress", "in progress")}
        </span>
      );
    }

    if (pricingEstimate) {
      return (
        <span className="flex items-center gap-1">
          {t("forms.buttons.generate")} {pricingEstimate.totalCost} <Coins className="w-4 h-4" />
        </span>
      );
    }

    return t("forms.buttons.generate");
  };

  // Reset form to default values
  const handleReset = () => {
    setFormState(defaultFormState);
    setSelectedAspectRatio("1:1");
    const fluxProModel = { id: "flux-pro", provider: "replicate" } as ModelConfig;
    setSelectedModelConfig(fluxProModel);

    // Clear style image upload
    setStyleImage(null);

    // Reset form values including style image fields
    form.reset(defaultFormState);
    form.setValue('styleImageUrl', '');
    form.setValue('imageStrength', undefined);

    // Reset enhance prompt toggle
    setEnhancePrompt(false);

    toast({
      title: t('toasts.formReset'),
      description: t('toasts.formResetDescription'),
    });
  };

  const handleModelConfigChange = (config: ModelConfig | null) => {
    setSelectedModelConfig(config);
    if (config?.provider) {
      form.setValue('provider', config.provider);
    }
  };

  // Style image change handler with auto-selection logic
  const handleStyleImageChange = useCallback((value: { file: File | null; url: string | null; strength: number }[] | null) => {
    const previousStyleImage = styleImage;
    setStyleImage(value);

    // Use first file for logic and form data
    const firstImage = value && value.length > 0 ? value[0] : null;

    if (firstImage && firstImage.file) {
      // Only show toast and auto-select model if this is a new file upload
      // (not just a strength change)
      const previousFirstImage = previousStyleImage && previousStyleImage.length > 0 ? previousStyleImage[0] : null;
      const isNewFileUpload = !previousFirstImage || previousFirstImage.file !== firstImage.file;

      if (isNewFileUpload) {
        // Auto-select Flux Ultra when style image is uploaded
        const fluxUltraModel = availableModels.find(model => model.id === "flux-1.1-pro-ultra");
        if (fluxUltraModel) {
          form.setValue('model', fluxUltraModel.id);
          form.setValue('provider', fluxUltraModel.provider);
          setSelectedModelConfig(fluxUltraModel);

          toast({
            title: t('toasts.styleImagesUploaded'),
            description: t('toasts.styleImagesUploadedDescription', {
              modelName: getConfig(`${fluxUltraModel.id.replace(/-/g, '_')}_display_name`, fluxUltraModel.name)
            }),
          });
        }
      }

      // Always update the strength value using first image
      form.setValue('imageStrength', firstImage.strength);
    } else {
      // Clear style image values when removed
      form.setValue('styleImageUrl', '');
      form.setValue('imageStrength', undefined);
    }
  }, [availableModels, form, toast, getConfig, styleImage]);

  // Upload multiple style image files if present
  const uploadStyleImageFiles = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('styleImages', file);
    });

    const response = await fetch('/api/upload-style-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload style images');
    }

    const result = await response.json();
    return result.images.map((img: any) => img.url);
  };

  // Function to detect Arabic script locally
  const containsArabicScript = (text: string): boolean => {
    // Arabic Unicode range: U+0600 to U+06FF (Arabic block)
    // Arabic Supplement: U+0750 to U+077F
    // Arabic Extended-A: U+08A0 to U+08FF
    // Arabic Presentation Forms-A: U+FB50 to U+FDFF
    // Arabic Presentation Forms-B: U+FE70 to U+FEFF
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRegex.test(text);
  };

  // Models that support Arabic prompts natively - skip translation for these
  const ARABIC_SUPPORTING_MODELS = [
    // GPT Image 1.5 models
    'fal-gpt-image-1.5-txt2img-low',
    'fal-gpt-image-1.5-txt2img-high',
    'fal-gpt-image-1.5-edit-low',
    'fal-gpt-image-1.5-edit-high',
    // Nano Banana Pro models
    'fal-nano-banana-pro-txt2img',
    'fal-nano-banana-pro-edit',
    // Nano Banana models
    'fal-nano-banana-txt2img',
    'fal-nano-banana-edit',
    'fal-nano-banana-img2img',
    // Z-Image Turbo
    'fal-z-image-turbo',
    // SeeDream 4.5 models
    'fal-seedream-4.5-txt2img',
    'fal-seedream-4.5-img2img',
  ];

  // Check if the current model supports Arabic prompts
  const modelSupportsArabic = (modelId: string | undefined): boolean => {
    if (!modelId) return false;
    return ARABIC_SUPPORTING_MODELS.includes(modelId);
  };

  // Translation function - returns translated text without modifying form
  // Skips translation for models that support Arabic natively
  const translatePrompt = async (text: string, modelId?: string): Promise<string> => {
    if (!text.trim() || text.trim().length < 3) return text;

    // Local Arabic detection - only translate if Arabic script is detected
    if (!containsArabicScript(text)) {
      console.log('No Arabic script detected, skipping translation');
      return text;
    }

    // Skip translation for models that support Arabic natively
    if (modelSupportsArabic(modelId)) {
      console.log(`Model ${modelId} supports Arabic natively, skipping translation`);
      return text;
    }

    console.log('Arabic script detected, proceeding with translation');

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Translation request failed');
      }

      const data = await response.json();

      if (data.wasTranslated) {
        return data.translatedText;
      }
      return text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text if translation fails
    }
  };

  // Enhanced prompt function using OpenAI
  const enhancePromptText = async (originalPrompt: string, selectedStyle?: string, signal?: AbortSignal, modelId?: string): Promise<string> => {
    try {
      setEnhancementError(null);

      console.log('🔄 Enhancement starting:', { originalPrompt, selectedStyle, aiStylesCount: aiStyles.length });

      // First, translate if Arabic is detected (skip for models that support Arabic natively)
      let processedPrompt = originalPrompt;
      if (containsArabicScript(originalPrompt)) {
        processedPrompt = await translatePrompt(originalPrompt, modelId);
        console.log('🌐 After translation:', processedPrompt);
      }

      // Append style text if a style is selected
      if (selectedStyle && selectedStyle !== "" && aiStyles.length > 0) {
        const styleObj = aiStyles.find(style => style.name.toLowerCase() === selectedStyle.toLowerCase());
        console.log('🎨 Style lookup:', { selectedStyle, foundStyle: !!styleObj, styleObj });
        if (styleObj && styleObj.promptText) {
          const beforeStyle = processedPrompt;
          processedPrompt = `${processedPrompt}, ${styleObj.promptText}`;
          console.log('🎨 Style added:', { before: beforeStyle, after: processedPrompt });
        }
      } else {
        console.log('🎨 Style not added:', { selectedStyle, hasStyle: !!selectedStyle, aiStylesLength: aiStyles.length });
      }

      // Call OpenAI API to enhance the prompt with abort signal
      console.log('🤖 Sending to OpenAI for enhancement:', processedPrompt);
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: processedPrompt }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Enhancement failed: ${response.statusText}`);
      }

      const data = await response.json();
      const finalPrompt = data.enhancedPrompt || processedPrompt;
      console.log('✨ Enhancement complete:', { original: originalPrompt, final: finalPrompt });
      return finalPrompt;
    } catch (error) {
      console.error('Prompt enhancement error:', error);
      setEnhancementError(getFriendlyErrorMessage(error));
      throw error; // Re-throw to let caller handle it
    }
  };

  const glassSelectTriggerClass = "h-12 rounded-[10px] border border-white/20 bg-white/[0.08] text-white focus:ring-[#5fb6ff] focus:ring-offset-0 hover:bg-white/[0.14] pr-10";
  const glassSelectContentClass = "rounded-[10px] border-white/20 bg-[linear-gradient(170deg,rgba(82,130,185,0.32)_0%,rgba(35,57,90,0.88)_45%,rgba(17,29,50,0.94)_100%)] text-white backdrop-blur-xl";
  const glassSelectItemClass = "rounded-[10px] text-white/90 focus:bg-white/[0.14] focus:text-white data-[state=checked]:bg-white/[0.18] data-[state=checked]:text-white";

  const handleRandomPrompt = async () => {
    try {
      const response = await fetch('/api/random-prompt');
      if (response.ok) {
        const randomPrompt = await response.json();
        form.setValue("prompt", randomPrompt.prompt, { shouldDirty: true, shouldValidate: true });
        setFormState(prev => ({ ...prev, prompt: randomPrompt.prompt }));
      }
    } catch (error) {
      console.error('Failed to fetch random prompt:', error);
    }
  };

  return (
    <div className="relative pb-6">
      <div className="relative overflow-hidden rounded-[10px] border border-white/12 bg-[linear-gradient(165deg,rgba(22,45,88,0.34)_0%,rgba(12,30,62,0.56)_35%,rgba(7,17,36,0.76)_68%,rgba(3,7,15,0.9)_100%)] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_46%,rgba(255,255,255,0.02)_100%)]" />
        <div className="relative">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <h2 className="text-[16px] leading-[1.1] font-semibold text-white tracking-tight">
                {"What's your idea?"}
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
                        onRandomPrompt={handleRandomPrompt}
                        isGenerating={isSubmitting || hasServerJobs}
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
                                  id="enhance-toggle"
                                  size="sm"
                                />
                                {isEnhancing && <Loader2 className="h-4 w-4 animate-spin text-[#7ac8ff]" />}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("forms.enhancePromptTooltip")}</p>
                            </TooltipContent>
                          </Tooltip>
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {enhancementError && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-300">{t("forms.enhancementFailed")}: {enhancementError}</p>
                </div>
              )}

              {isStyleUploadEnabled && currentBaseModel?.supportsStyleUpload === true && (
                <StyleImageUpload
                  value={styleImage}
                  onChange={handleStyleImageChange}
                  supportedModelName={currentBaseModel?.name || "This model"}
                  disabled={isGenerateDisabled || isSubmitting || hasServerJobs}
                  supportsImage={true}
                />
              )}

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <UnifiedModelSelector
                        value={field.value || "nano-banana"}
                        onValueChange={field.onChange}
                        onModeChange={setSelectedMode}
                        mode={selectedMode}
                        mediaType="image"
                        hasImageInput={!!styleImage && styleImage.length > 0}
                        variant="glass"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isGenerateDisabled || isModerating}
                  className="parallel-generate-btn inline-flex h-12 w-full items-center justify-center !rounded-[10px] border border-white/20 bg-[linear-gradient(90deg,#2d66f5_0%,#2599f6_100%)] px-4 text-[15px] font-medium text-white shadow-[0_9px_20px_rgba(44,149,255,0.35)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fd3ff] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:brightness-75 disabled:shadow-none"
                >
                  <div className="flex items-center justify-center space-x-2">
                    {isModerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isModerating ? t('progress.checkingContentSafety', 'Checking content safety...') : getButtonText()}</span>
                  </div>
                </button>

                {isFreeUser && (
                  <div className="text-center text-xs text-white/70">
                    <span>Free plan generations are public</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white/85">{t('forms.labels.style')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={glassSelectTriggerClass}>
                            <SelectValue placeholder="Select a style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className={glassSelectContentClass}>
                          {stylesLoading ? (
                            <SelectItem value="loading" disabled className={glassSelectItemClass}>{t("forms.loadingStyles")}</SelectItem>
                          ) : aiStyles.length === 0 ? (
                            <SelectItem value="Realistic" className={glassSelectItemClass}>Realistic</SelectItem>
                          ) : (
                            aiStyles.map((style) => (
                              <SelectItem key={style.id} value={style.name} className={glassSelectItemClass}>
                                {style.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PopupAspectRatioSelector
                  selectedRatio={selectedAspectRatio}
                  supportedRatios={selectedModelConfig?.supportedRatios || ["1:1"]}
                  onRatioChange={handleAspectRatioChange}
                  disabled={!selectedModelConfig}
                  variant="glass"
                />
              </div>

              {isGptImageModel(form.watch("model") || "") && (
                <FormField
                  control={form.control}
                  name="imageSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white/85">{t('forms.labels.imageSize', 'Image Size')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "1024x1024"}>
                        <FormControl>
                          <SelectTrigger className={glassSelectTriggerClass}>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className={glassSelectContentClass}>
                          {GPT_IMAGE_SIZES.map((size) => (
                            <SelectItem key={size.value} value={size.value} className={glassSelectItemClass}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {hasResolutionOptions && currentBaseModel?.supportedSizes && (
                <FormField
                  control={form.control}
                  name="resolution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-white/85">{t('forms.labels.resolution', 'Resolution')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || currentBaseModel.supportedSizes![0]}>
                        <FormControl>
                          <SelectTrigger className={glassSelectTriggerClass}>
                            <SelectValue placeholder="Select resolution" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className={glassSelectContentClass}>
                          {currentBaseModel.supportedSizes.map((size) => (
                            <SelectItem key={size} value={size} className={glassSelectItemClass}>
                              <div className="flex items-center gap-2">
                                <span>{size}</span>
                                <span className="text-xs text-gray-400">
                                  {size === "1K" ? "Standard resolution" : size === "4K" ? "High resolution" : ""}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
