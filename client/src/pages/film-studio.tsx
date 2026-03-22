import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Plus, Film, Save, RefreshCw, ImageIcon, Clapperboard as Video, Timer as Clock, ChevronLeft, ChevronRight, ArrowDownToLine as Download, Trash as Trash2, WandSparkles as Sparkles, Pencil, FileText, ChevronDown, ChevronUp, Upload, X, Coins, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import { useVideoJobPolling } from "@/hooks/useVideoJobPolling";
import { usePricingEstimate } from "@/hooks/use-pricing-estimate";
import { useTranslation } from "react-i18next";
import Lightbox from "@/components/lightbox";
import type { FilmProject, StoryboardScene, SceneVersion } from "@shared/schema";

function ExpandablePrompt({ prompt }: { prompt: string }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate if prompt needs truncation (more than 2 lines - approximately 160 characters)
  const needsTruncation = prompt.length > 160;
  const displayPrompt = needsTruncation && !isExpanded
    ? prompt.substring(0, 160) + "..."
    : prompt;

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground italic leading-relaxed">
        {displayPrompt}
      </p>
      {needsTruncation && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-expand-prompt"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              {t('filmStudio.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              {t('filmStudio.showMore')}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function SceneTextSection({ sceneId, baseScene, onEditScene, onRegenerateText }: { sceneId: number; baseScene: StoryboardScene; onEditScene: (scene: StoryboardScene) => void; onRegenerateText: (sceneId: number, aiModel: "gpt-5-nano" | "gpt-5") => void }) {
  const { t } = useTranslation();
  const { data: textVersions = [] } = useQuery<SceneVersion[]>({
    queryKey: [`/api/film-studio/scenes/${sceneId}/versions/text`],
  });

  const activeTextVersion = textVersions.find(v => v.isActive);
  const currentVersionIndex = textVersions.findIndex(v => v.isActive);

  const { estimate: textRegeneratePricingEstimate } = usePricingEstimate({
    model: "gpt-5-scene-regenerate"
  });

  const activateVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/versions/${versionId}/activate`, {
        versionType: 'text'
      });
    },
    onMutate: async (versionId: number) => {
      await queryClient.cancelQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/text`] });
      const previousVersions = queryClient.getQueryData([`/api/film-studio/scenes/${sceneId}/versions/text`]);

      queryClient.setQueryData([`/api/film-studio/scenes/${sceneId}/versions/text`], (old: SceneVersion[] | undefined) => {
        if (!old) return old;
        return old.map(v => ({
          ...v,
          isActive: v.id === versionId
        }));
      });

      return { previousVersions };
    },
    onError: (error, versionId, context) => {
      if (context?.previousVersions) {
        queryClient.setQueryData([`/api/film-studio/scenes/${sceneId}/versions/text`], context.previousVersions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/text`] });
    }
  });

  const handlePreviousVersion = () => {
    if (currentVersionIndex > 0) {
      activateVersionMutation.mutate(textVersions[currentVersionIndex - 1].id);
    }
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < textVersions.length - 1) {
      activateVersionMutation.mutate(textVersions[currentVersionIndex + 1].id);
    }
  };

  const displayTitle = activeTextVersion?.title || baseScene.title;
  const displayDescription = activeTextVersion?.description || baseScene.description;
  const displayNotes = activeTextVersion?.notes || baseScene.notes;

  return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t('filmStudio.text')}
        </h4>
        {textVersions.length > 1 && (
          <Badge variant="outline" className="text-xs">{textVersions.length} {t('filmStudio.versions')}</Badge>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs font-semibold">{t('filmStudio.title_field')}</Label>
          <p className="text-sm font-medium mt-1">{displayTitle}</p>
        </div>
        <div>
          <Label className="text-xs font-semibold">{t('filmStudio.description')}</Label>
          <p className="text-sm text-muted-foreground mt-1">{displayDescription}</p>
        </div>
        {displayNotes && (
          <div>
            <Label className="text-xs font-semibold">{t('filmStudio.notes')}</Label>
            <p className="text-sm text-muted-foreground italic mt-1">{displayNotes}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEditScene(baseScene)}
          data-testid={`button-edit-scene-${sceneId}`}
          className="h-7 text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" />
          {t('filmStudio.edit')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRegenerateText(sceneId, "gpt-5")}
          data-testid={`button-regenerate-text-${sceneId}`}
          className="h-7 text-xs"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          <span className="flex items-center gap-1">
            {t('filmStudio.generateNewScene')} {textRegeneratePricingEstimate && <>{textRegeneratePricingEstimate.totalCost} <Coins className="h-3 w-3" /></>}
          </span>
        </Button>
      </div>

      {textVersions.length > 1 && (
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handlePreviousVersion}
            disabled={currentVersionIndex === 0 || activateVersionMutation.isPending}
            aria-label="Previous version"
            data-testid={`button-prev-text-version-${sceneId}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-medium">
            {currentVersionIndex + 1} / {textVersions.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handleNextVersion}
            disabled={currentVersionIndex === textVersions.length - 1 || activateVersionMutation.isPending}
            aria-label="Next version"
            data-testid={`button-next-text-version-${sceneId}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface AiStyle {
  id: number;
  name: string;
  promptText: string;
  isVisible: boolean;
}

function SceneImageSection({ sceneId, projectId, sceneDescription, onEditImagePrompt, onRegeneratePrompt }: { sceneId: number; projectId: number; sceneDescription: string; onEditImagePrompt: (sceneId: number, versionId: number, prompt: string) => void; onRegeneratePrompt: (sceneId: number, aiModel: "gpt-5-nano" | "gpt-5", onComplete?: () => void) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState("z-image-turbo");
  const [selectedStyle, setSelectedStyle] = useState("Realistic");
  const [selectedSize, setSelectedSize] = useState("1K");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);

  const { data: imageVersions = [] } = useQuery<SceneVersion[]>({
    queryKey: [`/api/film-studio/scenes/${sceneId}/versions/image`],
  });

  // Fetch AI styles from the API (same as main image generation form)
  const { data: aiStyles = [], isLoading: stylesLoading } = useQuery<AiStyle[]>({
    queryKey: ["/api/ai-styles"],
    queryFn: async () => {
      const response = await fetch("/api/ai-styles");
      if (!response.ok) {
        throw new Error("Failed to fetch AI styles");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });

  // Curated models for Film Studio image generation with internal model IDs for pricing
  const imageModels = [
    {
      id: "z-image-turbo",
      name: t('filmStudio.models.fast'),
      internalModelId: "fal-z-image-turbo",
      supportsSizes: false,
      supportsStyleUpload: false,
      supportsAspectRatio: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "9:21"]
    },
    {
      id: "nano-banana-pro",
      name: t('filmStudio.models.nanobananaProArabic'),
      internalModelId: "fal-nano-banana-pro-txt2img",
      supportsSizes: true,
      sizes: ["1K", "2K", "4K"],
      supportsStyleUpload: true,
      supportsAspectRatio: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]
    },
    {
      id: "gpt-image-1.5-fast",
      name: t('filmStudio.models.gptImageFast'),
      internalModelId: "fal-gpt-image-1.5-txt2img-low",
      supportsSizes: true,
      sizes: ["1024x1024", "1024x1536", "1536x1024"],
      supportsStyleUpload: true
    },
    {
      id: "gpt-image-1.5-pro",
      name: t('filmStudio.models.gptImagePro'),
      internalModelId: "fal-gpt-image-1.5-txt2img-high",
      supportsSizes: true,
      sizes: ["1024x1024", "1024x1536", "1536x1024"],
      supportsStyleUpload: true
    },
    {
      id: "seedream-4.5",
      name: t('filmStudio.models.seedream'),
      internalModelId: "fal-seedream-4.5-txt2img",
      supportsSizes: false,
      supportsStyleUpload: true,
      supportsAspectRatio: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]
    },
    {
      id: "saudi-model-pro",
      name: t('filmStudio.models.alfiaSaudiStylePro'),
      internalModelId: "fal-saudi-model-pro",
      supportsSizes: true,
      sizes: ["1K", "2K", "4K"],
      supportsStyleUpload: false, // TEMPORARY: Disabled - set to true to re-enable reference image upload
      supportsAspectRatio: true,
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]
    },
  ];

  const activeImageVersion = imageVersions.find(v => v.isActive);
  const currentVersionIndex = imageVersions.findIndex(v => v.isActive);

  // Get current model config
  const currentModelConfig = imageModels.find(m => m.id === selectedModel);
  const supportsSizes = currentModelConfig?.supportsSizes || false;
  const availableSizes = currentModelConfig?.sizes || [];
  const supportsStyleUpload = currentModelConfig?.supportsStyleUpload || false;
  const supportsAspectRatio = currentModelConfig?.supportsAspectRatio || false;
  const availableAspectRatios = currentModelConfig?.aspectRatios || [];

  // Update local state when active version changes
  useEffect(() => {
    if (activeImageVersion) {
      // Validate that the stored model exists in our model list
      const storedModel = activeImageVersion.imageModel;
      const isValidModel = storedModel && imageModels.some(m => m.id === storedModel);
      setSelectedModel(isValidModel ? storedModel : "z-image-turbo");
      setSelectedStyle(activeImageVersion.imageStyle || "Realistic");
      // Reset loading state when new version is loaded
      setIsRegeneratingPrompt(false);
    } else {
      // No active version, ensure defaults are set
      setSelectedModel("z-image-turbo");
      setSelectedStyle("Realistic");
    }
  }, [activeImageVersion?.id]);

  // Reset size when model changes to ensure valid selection
  useEffect(() => {
    if (supportsSizes && availableSizes.length > 0) {
      if (!availableSizes.includes(selectedSize)) {
        setSelectedSize(availableSizes[0]);
      }
    }
  }, [selectedModel, supportsSizes, availableSizes]);

  // Reset aspect ratio when model changes to ensure valid selection
  useEffect(() => {
    if (supportsAspectRatio && availableAspectRatios.length > 0) {
      if (!availableAspectRatios.includes(selectedAspectRatio)) {
        setSelectedAspectRatio(availableAspectRatios[0]);
      }
    }
  }, [selectedModel, supportsAspectRatio, availableAspectRatios]);

  // Use AI styles from the API, falling back to default styles if not loaded
  const imageStyles = aiStyles.length > 0
    ? aiStyles.filter(s => s.isVisible).map(s => ({ value: s.name, label: s.name, prompt: s.promptText }))
    : [
      { value: "Realistic", label: "Realistic", prompt: "" },
      { value: "Cinematic", label: "Cinematic", prompt: "" },
      { value: "Anime", label: "Anime", prompt: "" },
      { value: "Digital Art", label: "Digital Art", prompt: "" },
    ];

  // Get pricing estimate for image generation using internal model IDs (same as main form)
  const { estimate: imagePricingEstimate } = usePricingEstimate({
    model: currentModelConfig?.internalModelId || selectedModel,
    imageCount: 1,
    resolution: supportsSizes ? selectedSize : undefined
  });

  // Get pricing estimate for prompt regeneration
  const { estimate: promptRegeneratePricingEstimate } = usePricingEstimate({
    model: "gpt-5-image-prompt-regenerate"
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages = [...uploadedImages, ...files].slice(0, 5);
    setUploadedImages(newImages);

    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls(newPreviews);
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);

    URL.revokeObjectURL(previewUrls[index]);
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setPreviewUrls(newPreviews);
  };

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      let promptToUse = activeImageVersion?.imagePrompt || sceneDescription;
      if (!promptToUse || !promptToUse.trim()) {
        throw new Error("No image prompt available");
      }

      // Add style prompt to the image prompt if available
      const selectedStyleConfig = imageStyles.find(s => s.value === selectedStyle);
      if (selectedStyleConfig?.prompt) {
        promptToUse = `${promptToUse}\n\nStyle: ${selectedStyleConfig.prompt}`;
      }

      const formData = new FormData();
      formData.append('imagePrompt', promptToUse);
      formData.append('imageModel', selectedModel);
      formData.append('imageStyle', selectedStyle);

      // Add resolution/size if model supports it
      if (supportsSizes && selectedSize) {
        formData.append('resolution', selectedSize);
      }

      // Add aspect ratio if model supports it
      if (supportsAspectRatio && selectedAspectRatio) {
        formData.append('aspectRatio', selectedAspectRatio);
      }

      if (uploadedImages.length > 0 && supportsStyleUpload) {
        uploadedImages.forEach((file) => {
          formData.append('referenceImages', file);
        });
      }

      const response = await fetch(`/api/film-studio/scenes/${sceneId}/generate-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/image`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setUploadedImages([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      toast({
        title: t('toasts.imageGenerated'),
        description: t('toasts.imageGeneratedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (versionId: number) => {
      await apiRequest('DELETE', `/api/film-studio/scenes/${sceneId}/versions/${versionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/image`] });
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const activateVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/versions/${versionId}/activate`, {
        versionType: 'image'
      });
    },
    onMutate: async (versionId: number) => {
      await queryClient.cancelQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/image`] });
      const previousVersions = queryClient.getQueryData([`/api/film-studio/scenes/${sceneId}/versions/image`]);

      queryClient.setQueryData([`/api/film-studio/scenes/${sceneId}/versions/image`], (old: SceneVersion[] | undefined) => {
        if (!old) return old;
        return old.map(v => ({
          ...v,
          isActive: v.id === versionId
        }));
      });

      return { previousVersions };
    },
    onError: (error, versionId, context) => {
      if (context?.previousVersions) {
        queryClient.setQueryData([`/api/film-studio/scenes/${sceneId}/versions/image`], context.previousVersions);
      }
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/image`] });
    }
  });

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene-${sceneId}-image.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: t('toasts.downloadStarted'),
        description: t('toasts.imageDownloading')
      });
    } catch (error) {
      toast({
        title: t('toasts.error'),
        description: t('toasts.failedToDownloadImage'),
        variant: "destructive"
      });
    }
  };

  const handlePreviousVersion = () => {
    if (currentVersionIndex > 0) {
      activateVersionMutation.mutate(imageVersions[currentVersionIndex - 1].id);
    }
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < imageVersions.length - 1) {
      activateVersionMutation.mutate(imageVersions[currentVersionIndex + 1].id);
    }
  };

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleLightboxNavigate = (newIndex: number) => {
    setLightboxIndex(newIndex);
    // Also update the active version when navigating in lightbox
    if (imageVersions[newIndex]) {
      activateVersionMutation.mutate(imageVersions[newIndex].id);
    }
  };

  // Convert image versions to lightbox format
  const lightboxImages = imageVersions
    .filter(v => v.imageUrl)
    .map(v => ({
      id: v.id,
      url: v.imageUrl!,
      prompt: v.imagePrompt || sceneDescription,
    }));

  return (
    <div className="space-y-3 border border-secondary/20 rounded-lg p-3 bg-secondary/5">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-sm text-secondary-foreground">
          <ImageIcon className="h-4 w-4 text-secondary-foreground" />
          {t('filmStudio.image')}
        </h4>
        {imageVersions.length > 1 && (
          <Badge variant="outline" className="text-xs border-secondary/30 text-secondary-foreground">{imageVersions.length} {t('filmStudio.versions')}</Badge>
        )}
      </div>

      <div className="bg-secondary/10 rounded-lg p-4 min-h-[200px] flex items-center justify-center border border-secondary/10">
        {generateImageMutation.isPending ? (
          <div className="text-center space-y-2 w-full px-6">
            <div className="flex flex-col items-center gap-3 p-4 border border-secondary/30 rounded-lg bg-secondary/10">
              <RefreshCw className="h-8 w-8 text-secondary animate-spin" />
              <p className="text-sm font-medium text-foreground">{t('filmStudio.generatingImage')}</p>
              <p className="text-xs text-muted-foreground text-center">
                {t('filmStudio.generatingImageDescription')}
              </p>
            </div>
          </div>
        ) : activeImageVersion?.imageUrl ? (
          <div className="relative w-full max-w-xs">
            <img
              src={activeImageVersion.imageUrl}
              alt="Scene image"
              className="w-full max-h-[200px] object-contain rounded cursor-pointer"
              onClick={() => handleImageClick(currentVersionIndex)}
              data-testid={`img-scene-${sceneId}`}
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(activeImageVersion.imageUrl!);
                }}
                aria-label="Download image"
                data-testid={`button-download-image-${sceneId}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteImageMutation.mutate(activeImageVersion.id);
                }}
                disabled={deleteImageMutation.isPending}
                aria-label="Delete image"
                data-testid={`button-delete-image-${sceneId}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : activeImageVersion?.imagePrompt ? (
          <div className="text-center space-y-2 w-full px-6">
            <div className="flex flex-col items-center gap-2 p-4 border border-white/30 rounded-lg bg-black/40">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-white">{t('filmStudio.imagePromptReady')}</p>
              <p className="text-xs text-white/70 text-center">
                {t('filmStudio.imagePromptReadyDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-2 w-full px-6">
            <p className="text-sm text-muted-foreground">{t('filmStudio.noImageYet')}</p>
          </div>
        )}
      </div>

      {activeImageVersion && (
        <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/20">
          <Label className="text-xs font-semibold text-foreground">{t('filmStudio.prompt')}</Label>
          {activeImageVersion.imagePrompt ? (
            <ExpandablePrompt prompt={activeImageVersion.imagePrompt} />
          ) : (
            <p className="text-xs text-muted-foreground italic">{t('filmStudio.noPromptYet')}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditImagePrompt(sceneId, activeImageVersion.id, activeImageVersion.imagePrompt || "")}
              data-testid={`button-edit-image-prompt-${sceneId}`}
              className="h-7 text-xs"
              disabled={!activeImageVersion.imagePrompt}
            >
              <Pencil className="h-3 w-3 mr-1" />
              {t('filmStudio.edit')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsRegeneratingPrompt(true);
                onRegeneratePrompt(sceneId, "gpt-5", () => setIsRegeneratingPrompt(false));
              }}
              disabled={isRegeneratingPrompt}
              data-testid={`button-regenerate-image-prompt-${sceneId}`}
              className="h-7 text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              <span className="flex items-center gap-1">
                {isRegeneratingPrompt ? t('filmStudio.generating') : t('filmStudio.generateNewPrompt')} {!isRegeneratingPrompt && promptRegeneratePricingEstimate && <>{promptRegeneratePricingEstimate.totalCost} <Coins className="h-3 w-3" /></>}
              </span>
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border border-secondary/20 rounded-lg p-3 bg-secondary/5">
        <Label className="text-xs font-semibold text-foreground">{t('filmStudio.imageGeneration')}</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`image-model-${sceneId}`} className="text-xs">{t('filmStudio.model')}</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger id={`image-model-${sceneId}`} className="w-full text-xs h-8">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {imageModels.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`image-style-${sceneId}`} className="text-xs">{t('filmStudio.style')}</Label>
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger id={`image-style-${sceneId}`} className="w-full text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value} className="text-xs">
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {supportsSizes && availableSizes.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor={`image-size-${sceneId}`} className="text-xs">{t('filmStudio.imageSize')}</Label>
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger id={`image-size-${sceneId}`} className="w-full text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSizes.map((size: string) => (
                  <SelectItem key={size} value={size} className="text-xs">
                    {size === "1K" ? t('filmStudio.sizes.1k') :
                      size === "2K" ? t('filmStudio.sizes.2k') :
                        size === "4K" ? t('filmStudio.sizes.4k') :
                          size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsAspectRatio && availableAspectRatios.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor={`image-aspect-ratio-${sceneId}`} className="text-xs">{t('filmStudio.aspectRatio')}</Label>
            <Select value={selectedAspectRatio} onValueChange={setSelectedAspectRatio}>
              <SelectTrigger id={`image-aspect-ratio-${sceneId}`} className="w-full text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableAspectRatios.map((ratio: string) => (
                  <SelectItem key={ratio} value={ratio} className="text-xs">
                    {ratio === "1:1" ? t('aspectRatios.square') :
                      ratio === "16:9" ? t('aspectRatios.landscape') :
                        ratio === "9:16" ? t('aspectRatios.portrait') :
                          ratio === "4:3" ? t('aspectRatios.standard') :
                            ratio === "3:4" ? t('aspectRatios.standardPortrait') :
                              ratio === "3:2" ? t('aspectRatios.classic') :
                                ratio === "2:3" ? t('aspectRatios.classicPortrait') :
                                  ratio === "21:9" ? t('aspectRatios.ultraWide') :
                                    ratio === "9:21" ? t('aspectRatios.ultraTall') :
                                      ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsStyleUpload && (
          <div className="space-y-2">
            <Label htmlFor={`ref-image-upload-${sceneId}`} className="text-xs">
              {t('filmStudio.referenceImages')}
            </Label>
            <div className="flex flex-col gap-2">
              <label htmlFor={`ref-image-upload-${sceneId}`}>
                <div className="border-2 border-dashed border-border rounded-lg p-3 hover:border-secondary cursor-pointer transition-colors">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    <span>{t('filmStudio.uploadImages')}</span>
                  </div>
                </div>
                <input
                  id={`ref-image-upload-${sceneId}`}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  data-testid={`input-upload-ref-images-${sceneId}`}
                />
              </label>

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-16 object-cover rounded border border-border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                        data-testid={`button-remove-ref-image-${sceneId}-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={() => generateImageMutation.mutate()}
          disabled={generateImageMutation.isPending}
          data-testid={`button-generate-image-${sceneId}`}
        >
          <ImageIcon className="h-3 w-3 mr-1" />
          {generateImageMutation.isPending ? t('filmStudio.generatingImage') : (
            <span className="flex items-center gap-1">
              {t('filmStudio.generateImage')} {imagePricingEstimate && <>{imagePricingEstimate.totalCost} <Coins className="h-3 w-3" /></>}
            </span>
          )}
        </Button>
      </div>

      {imageVersions.length > 1 && (
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handlePreviousVersion}
            disabled={currentVersionIndex === 0 || activateVersionMutation.isPending}
            aria-label="Previous version"
            data-testid={`button-prev-image-version-${sceneId}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-medium">
            {currentVersionIndex + 1} / {imageVersions.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handleNextVersion}
            disabled={currentVersionIndex === imageVersions.length - 1 || activateVersionMutation.isPending}
            aria-label="Next version"
            data-testid={`button-next-image-version-${sceneId}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Lightbox
        image={lightboxImages[lightboxIndex] || null}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        showActions={false}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={handleLightboxNavigate}
      />
    </div>
  );
}

function SceneVideoSection({ sceneId, onEditVideoPrompt, onRegeneratePrompt }: { sceneId: number; onEditVideoPrompt: (sceneId: number, versionId: number, prompt: string) => void; onRegeneratePrompt: (sceneId: number, aiModel: "gpt-5-nano" | "gpt-5", onComplete?: () => void) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState("wan-2.5-preview-i2v");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
  const [motionReferenceFile, setMotionReferenceFile] = useState<File | null>(null);
  const [motionReferencePreview, setMotionReferencePreview] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const { data: videoVersions = [] } = useQuery<SceneVersion[]>({
    queryKey: [`/api/film-studio/scenes/${sceneId}/versions/video`],
  });

  const { data: videoModels = [] } = useQuery<any[]>({
    queryKey: ['/api/video-models'],
  });

  const activeVideoVersion = videoVersions.find(v => v.isActive);

  // Filter for image-to-video models (those that support start frame)
  const i2vModels = videoModels.filter((m: any) => m.supportsStartFrame === true);

  // Get selected video model details for pricing and motion control detection
  const selectedVideoModelData = videoModels.find((m: any) => m.id === selectedModel);
  const defaultDuration = selectedVideoModelData?.supportedDurations?.[0] || 5;
  const isMotionControlModel = selectedVideoModelData?.supportsVideoReference === true;
  const supportsAudio = selectedVideoModelData?.supportsAudio === true;

  // Get pricing estimate for video generation
  // Film Studio always uses images (start frames) for video generation, so we set hasImageInput: true
  const { estimate: videoPricingEstimate } = usePricingEstimate({
    model: selectedModel,
    duration: defaultDuration,
    hasImageInput: true,
    audioEnabled: supportsAudio ? audioEnabled : false
  });

  // Get pricing estimate for prompt regeneration
  const { estimate: videoPromptRegeneratePricingEstimate } = usePricingEstimate({
    model: "gpt-5-video-prompt-regenerate"
  });

  // Use video job polling hook
  const { jobStatus, isPolling } = useVideoJobPolling(currentJobId, !!currentJobId);

  // Reset loading state when video versions update
  useEffect(() => {
    if (activeVideoVersion) {
      setIsRegeneratingPrompt(false);
    }
  }, [activeVideoVersion?.id]);

  // Update video version when job completes
  useEffect(() => {
    if (jobStatus?.state === 'completed') {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/video`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setCurrentJobId(null);
      toast({
        title: t('toasts.videoReady'),
        description: t('toasts.videoReadyDescription')
      });
    } else if (jobStatus?.state === 'failed') {
      setCurrentJobId(null);
      toast({
        title: t('toasts.videoGenerationFailed'),
        description: jobStatus.error || t('toasts.videoGenerationFailedDescription'),
        variant: "destructive"
      });
    }
  }, [jobStatus?.state, sceneId, toast]);

  // Handle motion reference file upload
  const handleMotionReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMotionReferenceFile(file);
      const previewUrl = URL.createObjectURL(file);
      if (motionReferencePreview) {
        URL.revokeObjectURL(motionReferencePreview);
      }
      setMotionReferencePreview(previewUrl);
    }
  };

  const handleRemoveMotionReference = () => {
    if (motionReferencePreview) {
      URL.revokeObjectURL(motionReferencePreview);
    }
    setMotionReferenceFile(null);
    setMotionReferencePreview(null);
  };

  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      // For motion control models, we need to upload the motion reference video first
      let motionReferenceUrl: string | undefined;

      if (isMotionControlModel && motionReferenceFile) {
        // Upload motion reference video
        const formData = new FormData();
        formData.append('motionReference', motionReferenceFile);

        const uploadResponse = await fetch('/api/upload-motion-reference', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload motion reference video');
        }

        const uploadResult = await uploadResponse.json();
        motionReferenceUrl = uploadResult.url;
      }

      const response = await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/generate-video`, {
        model: selectedModel,
        videoReference: motionReferenceUrl,
        audioEnabled: supportsAudio ? audioEnabled : false
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/video`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      // Clear motion reference after successful generation start
      handleRemoveMotionReference();
      toast({
        title: t('toasts.videoGenerationStarted'),
        description: t('toasts.videoGenerationStartedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  // Version navigation
  const currentVersionIndex = videoVersions.findIndex(v => v.isActive);

  const activateVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const response = await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/versions/${versionId}/activate`, {
        versionType: 'video'
      });
      return await response.json();
    },
    onMutate: async (versionId) => {
      await queryClient.cancelQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/video`] });
      const previousVersions = queryClient.getQueryData<SceneVersion[]>([`/api/film-studio/scenes/${sceneId}/versions/video`]);

      queryClient.setQueryData<SceneVersion[]>(
        [`/api/film-studio/scenes/${sceneId}/versions/video`],
        (old = []) => old.map(v => ({ ...v, isActive: v.id === versionId }))
      );

      return { previousVersions };
    },
    onError: (_err, _versionId, context) => {
      if (context?.previousVersions) {
        queryClient.setQueryData([`/api/film-studio/scenes/${sceneId}/versions/video`], context.previousVersions);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${sceneId}/versions/video`] });
    }
  });

  const handlePreviousVersion = () => {
    if (currentVersionIndex > 0) {
      activateVersionMutation.mutate(videoVersions[currentVersionIndex - 1].id);
    }
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < videoVersions.length - 1) {
      activateVersionMutation.mutate(videoVersions[currentVersionIndex + 1].id);
    }
  };

  return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-card/10">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <Video className="h-4 w-4" />
          {t('filmStudio.video')}
        </h4>
        {videoVersions.length > 1 && (
          <Badge variant="outline" className="text-xs">{videoVersions.length} {t('filmStudio.versions')}</Badge>
        )}
      </div>

      <div className="bg-muted rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        {(generateVideoMutation.isPending || isPolling) ? (
          <div className="text-center space-y-2 w-full px-6">
            <div className="flex flex-col items-center gap-3 p-4 border border-primary/30 rounded-lg bg-primary/10">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">{t('filmStudio.generatingVideo')}</p>
              <p className="text-xs text-muted-foreground text-center">
                {isPolling && jobStatus?.progress ? `${jobStatus.progress}% - ${jobStatus.stage || t('filmStudio.generatingVideoDescription')}` : t('filmStudio.generatingVideoDescription')}
              </p>
            </div>
          </div>
        ) : activeVideoVersion?.videoUrl ? (
          <video
            src={activeVideoVersion.videoUrl}
            controls
            className="max-w-full max-h-[200px] rounded"
            data-testid={`video-scene-${sceneId}`}
          />
        ) : (
          <div className="text-center space-y-2 w-full px-6">
            {activeVideoVersion?.videoPrompt ? (
              <div className="flex flex-col items-center gap-2 p-4 border border-white/30 rounded-lg bg-black/40">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
                <p className="text-sm font-medium text-white">{t('filmStudio.videoPromptReady')}</p>
                <p className="text-xs text-white/70 text-center">
                  {t('filmStudio.videoPromptReadyDescription')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('filmStudio.noVideoYet')}</p>
            )}
          </div>
        )}
      </div>

      {activeVideoVersion && (
        <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/20">
          <Label className="text-xs font-semibold text-foreground">{t('filmStudio.prompt')}</Label>
          {activeVideoVersion.videoPrompt ? (
            <ExpandablePrompt prompt={activeVideoVersion.videoPrompt} />
          ) : (
            <p className="text-xs text-muted-foreground italic">{t('filmStudio.noPromptYet')}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditVideoPrompt(sceneId, activeVideoVersion.id, activeVideoVersion.videoPrompt || "")}
              data-testid={`button-edit-video-prompt-${sceneId}`}
              className="h-7 text-xs"
              disabled={!activeVideoVersion.videoPrompt}
            >
              <Pencil className="h-3 w-3 mr-1" />
              {t('filmStudio.edit')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsRegeneratingPrompt(true);
                onRegeneratePrompt(sceneId, "gpt-5", () => setIsRegeneratingPrompt(false));
              }}
              disabled={isRegeneratingPrompt}
              data-testid={`button-regenerate-video-prompt-${sceneId}`}
              className="h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              <span className="flex items-center gap-1">
                {isRegeneratingPrompt ? t('filmStudio.generating') : t('filmStudio.generateNewPrompt')} {!isRegeneratingPrompt && videoPromptRegeneratePricingEstimate && <>{videoPromptRegeneratePricingEstimate.totalCost} <Coins className="h-3 w-3" /></>}
              </span>
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/20">
        <Label className="text-xs font-semibold text-foreground">{t('filmStudio.videoGeneration')}</Label>
        <div className="space-y-2">
          <Label htmlFor={`video-model-${sceneId}`} className="text-xs">{t('filmStudio.model')}</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id={`video-model-${sceneId}`} className="w-full text-xs h-8">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {i2vModels.map((model: any) => (
                <SelectItem key={model.id} value={model.id} className="text-xs">
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Audio Toggle - Show for models that support audio (e.g., Kling 2.6 Pro) */}
        {supportsAudio && (
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-2">
            <Switch
              checked={audioEnabled}
              onCheckedChange={setAudioEnabled}
              data-testid={`audio-toggle-${sceneId}`}
              className="order-last rtl:order-first"
            />
            <div className="space-y-0.5">
              <Label className="text-xs font-medium">{t('forms.labels.enableAudio', 'Enable Audio')}</Label>
              <p className="text-xs text-muted-foreground">{t('forms.labels.enableAudioDescription', 'Generate video with native audio (higher cost)')}</p>
            </div>
          </div>
        )}

        {isMotionControlModel && (
          <div className="space-y-2">
            <Label htmlFor={`motion-reference-${sceneId}`} className="text-xs">
              {t('filmStudio.motionReference')} <span className="text-red-400">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('filmStudio.motionReferenceDescription')}
            </p>
            {motionReferencePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border bg-black/20">
                <video
                  src={motionReferencePreview}
                  controls
                  className="w-full max-h-32 object-contain"
                  data-testid={`motion-reference-preview-${sceneId}`}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 h-6 px-2 text-xs"
                  onClick={handleRemoveMotionReference}
                  data-testid={`button-remove-motion-reference-${sceneId}`}
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('filmStudio.removeMotionVideo')}
                </Button>
              </div>
            ) : (
              <label htmlFor={`motion-reference-${sceneId}`}>
                <div className="border-2 border-dashed border-border rounded-lg p-3 hover:border-primary cursor-pointer transition-colors">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    <span>{t('filmStudio.uploadMotionVideo')}</span>
                  </div>
                </div>
                <input
                  id={`motion-reference-${sceneId}`}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleMotionReferenceUpload}
                  data-testid={`input-motion-reference-${sceneId}`}
                />
              </label>
            )}
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={() => generateVideoMutation.mutate()}
          disabled={generateVideoMutation.isPending || isPolling || (isMotionControlModel && !motionReferenceFile)}
          data-testid={`button-generate-video-${sceneId}`}
        >
          <Video className="h-3 w-3 mr-1" />
          {generateVideoMutation.isPending || isPolling ? t('filmStudio.generatingVideo') : (
            <span className="flex items-center gap-1">
              {t('filmStudio.generateVideo')} {videoPricingEstimate && <>{videoPricingEstimate.totalCost} <Coins className="h-3 w-3" /></>}
            </span>
          )}
        </Button>
        {isMotionControlModel && !motionReferenceFile && (
          <p className="text-xs text-amber-400 text-center">
            {t('filmStudio.motionReferenceRequired')}
          </p>
        )}
      </div>

      {videoVersions.length > 1 && (
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handlePreviousVersion}
            disabled={currentVersionIndex === 0 || activateVersionMutation.isPending}
            aria-label="Previous version"
            data-testid={`button-prev-video-version-${sceneId}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-medium">
            {currentVersionIndex + 1} / {videoVersions.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-muted"
            onClick={handleNextVersion}
            disabled={currentVersionIndex === videoVersions.length - 1 || activateVersionMutation.isPending}
            aria-label="Next version"
            data-testid={`button-next-video-version-${sceneId}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FilmStudio() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<FilmProject | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    idea: "",
    style: "cinematic",
    mood: "dramatic",
    cutsStyle: "hard",
    targetDuration: 30,
    aspectRatio: "16:9",
    cameraLanguage: "cinematic",
    pacing: "medium",
    visualEra: "modern",
    scriptLanguage: "english"
  });

  // Get pricing estimate for storyboard generation
  const { estimate: storyboardPricingEstimate } = usePricingEstimate({
    model: "gpt-5-storyboard"
  });

  const { data: projects = [] } = useQuery<FilmProject[]>({
    queryKey: ['/api/film-studio/projects'],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/film-studio/projects', data);
      return await response.json();
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['/api/film-studio/projects'] });
      setSelectedProject(newProject);
      setShowNewProject(false);
      toast({
        title: t('toasts.projectCreated'),
        description: t('toasts.projectCreatedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const { data: scenes = [], refetch: refetchScenes } = useQuery<StoryboardScene[]>({
    queryKey: [`/api/film-studio/scenes/${selectedProject?.id}`],
    enabled: !!selectedProject
  });

  const generateStoryboardMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest('POST', `/api/film-studio/projects/${projectId}/generate-storyboard`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${selectedProject?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: t('toasts.storyboardGenerated'),
        description: t('toasts.storyboardGeneratedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const regenerateTextMutation = useMutation({
    mutationFn: async ({ sceneId, model }: { sceneId: number; model: "gpt-5-nano" | "gpt-5" }) => {
      const response = await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/regenerate-text`, { model });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${selectedProject?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${variables.sceneId}/versions/text`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: t('toasts.sceneTextRegenerated'),
        description: t('toasts.sceneTextRegeneratedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const regenerateImagePromptMutation = useMutation({
    mutationFn: async ({ sceneId, model }: { sceneId: number; model: "gpt-5-nano" | "gpt-5" }) => {
      const response = await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/regenerate-image-prompt`, { model });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${variables.sceneId}/versions/image`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: t('toasts.imagePromptRegenerated'),
        description: t('toasts.imagePromptRegeneratedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const regenerateVideoPromptMutation = useMutation({
    mutationFn: async ({ sceneId, model }: { sceneId: number; model: "gpt-5-nano" | "gpt-5" }) => {
      const response = await apiRequest('POST', `/api/film-studio/scenes/${sceneId}/regenerate-video-prompt`, { model });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${variables.sceneId}/versions/video`] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: t('toasts.videoPromptRegenerated'),
        description: t('toasts.videoPromptRegeneratedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  // Edit scene text state and mutations
  const [editingScene, setEditingScene] = useState<StoryboardScene | null>(null);
  const [editSceneData, setEditSceneData] = useState({
    title: "",
    description: "",
    notes: ""
  });

  const updateSceneMutation = useMutation({
    mutationFn: async ({ sceneId, data }: { sceneId: number; data: typeof editSceneData }) => {
      const response = await apiRequest('PATCH', `/api/film-studio/scenes/${sceneId}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${selectedProject?.id}`] });
      setEditingScene(null);
      toast({
        title: t('toasts.sceneUpdated'),
        description: t('toasts.sceneUpdatedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  // Edit video prompt state and mutations
  const [editingVideoPrompt, setEditingVideoPrompt] = useState<{ sceneId: number; versionId: number; prompt: string } | null>(null);

  const updateVideoPromptMutation = useMutation({
    mutationFn: async ({ sceneId, versionId, videoPrompt }: { sceneId: number; versionId: number; videoPrompt: string }) => {
      const response = await apiRequest('PATCH', `/api/film-studio/scenes/${sceneId}/versions/${versionId}`, { videoPrompt });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${variables.sceneId}/versions/video`] });
      setEditingVideoPrompt(null);
      toast({
        title: t('toasts.videoPromptUpdated'),
        description: t('toasts.videoPromptUpdatedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  // Edit image prompt state and mutations
  const [editingImagePrompt, setEditingImagePrompt] = useState<{ sceneId: number; versionId: number; prompt: string } | null>(null);

  const updateImagePromptMutation = useMutation({
    mutationFn: async ({ sceneId, versionId, imagePrompt }: { sceneId: number; versionId: number; imagePrompt: string }) => {
      const response = await apiRequest('PATCH', `/api/film-studio/scenes/${sceneId}/versions/${versionId}`, { imagePrompt });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/film-studio/scenes/${variables.sceneId}/versions/image`] });
      setEditingImagePrompt(null);
      toast({
        title: t('toasts.imagePromptUpdated'),
        description: t('toasts.imagePromptUpdatedDescription')
      });
    },
    onError: (error) => {
      toast({
        title: t('toasts.error'),
        description: getFriendlyErrorMessage(error),
        variant: "destructive"
      });
    }
  });

  const handleCreateProject = () => {
    if (!formData.title.trim() || !formData.idea.trim()) {
      toast({
        title: t('toasts.validationError'),
        description: t('toasts.titleAndIdeaRequired'),
        variant: "destructive"
      });
      return;
    }
    createProjectMutation.mutate(formData);
  };

  const handleGenerateStoryboard = () => {
    if (selectedProject) {
      generateStoryboardMutation.mutate(selectedProject.id);
    }
  };

  if (!showNewProject && !selectedProject && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
        <div className="container mx-auto px-4 md:px-6 py-12">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <Film className="w-16 md:w-24 h-16 md:h-24 mx-auto text-muted-foreground" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t('filmStudio.title')}</h1>
            <p className="text-base md:text-lg text-muted-foreground">
              {t('filmStudio.emptyStateDescription')}
            </p>
            <Button
              size="lg"
              onClick={() => setShowNewProject(true)}
              data-testid="button-create-first-project"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('filmStudio.createFirstProject')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #0a454e, #364d6a, #11457a)' }}>
      <div className="container mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('filmStudio.title')}</h1>
          <Button
            onClick={() => setShowNewProject(true)}
            data-testid="button-new-project"
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('filmStudio.newProject')}
          </Button>
        </div>

        {showNewProject && (
          <Card data-testid="card-new-project">
            <CardHeader>
              <CardTitle>{t('filmStudio.createFilmProject')}</CardTitle>
              <CardDescription>{t('filmStudio.startWithIdea')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">{t('filmStudio.projectTitle')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('filmStudio.projectTitlePlaceholder')}
                  data-testid="input-project-title"
                />
              </div>

              <div>
                <Label htmlFor="idea">{t('filmStudio.filmIdea')}</Label>
                <Textarea
                  id="idea"
                  value={formData.idea}
                  onChange={(e) => setFormData({ ...formData, idea: e.target.value })}
                  placeholder={t('filmStudio.filmIdeaPlaceholder')}
                  rows={4}
                  data-testid="input-film-idea"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>{t('filmStudio.style')}</Label>
                  <Select
                    value={formData.style}
                    onValueChange={(value) => setFormData({ ...formData, style: value })}
                  >
                    <SelectTrigger data-testid="select-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cinematic">{t('filmStudio.styles.cinematic')}</SelectItem>
                      <SelectItem value="documentary">{t('filmStudio.styles.documentary')}</SelectItem>
                      <SelectItem value="artistic">{t('filmStudio.styles.artistic')}</SelectItem>
                      <SelectItem value="commercial">{t('filmStudio.styles.commercial')}</SelectItem>
                      <SelectItem value="action">{t('filmStudio.styles.action')}</SelectItem>
                      <SelectItem value="drama">{t('filmStudio.styles.drama')}</SelectItem>
                      <SelectItem value="thriller">{t('filmStudio.styles.thriller')}</SelectItem>
                      <SelectItem value="horror">{t('filmStudio.styles.horror')}</SelectItem>
                      <SelectItem value="sci-fi">{t('filmStudio.styles.sciFi')}</SelectItem>
                      <SelectItem value="fantasy">{t('filmStudio.styles.fantasy')}</SelectItem>
                      <SelectItem value="romance">{t('filmStudio.styles.romance')}</SelectItem>
                      <SelectItem value="comedy">{t('filmStudio.styles.comedy')}</SelectItem>
                      <SelectItem value="animation">{t('filmStudio.styles.animation')}</SelectItem>
                      <SelectItem value="experimental">{t('filmStudio.styles.experimental')}</SelectItem>
                      <SelectItem value="noir">{t('filmStudio.styles.noir')}</SelectItem>
                      <SelectItem value="western">{t('filmStudio.styles.western')}</SelectItem>
                      <SelectItem value="musical">{t('filmStudio.styles.musical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.mood')}</Label>
                  <Select
                    value={formData.mood}
                    onValueChange={(value) => setFormData({ ...formData, mood: value })}
                  >
                    <SelectTrigger data-testid="select-mood">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dramatic">{t('filmStudio.moods.dramatic')}</SelectItem>
                      <SelectItem value="uplifting">{t('filmStudio.moods.uplifting')}</SelectItem>
                      <SelectItem value="mysterious">{t('filmStudio.moods.mysterious')}</SelectItem>
                      <SelectItem value="energetic">{t('filmStudio.moods.energetic')}</SelectItem>
                      <SelectItem value="calm">{t('filmStudio.moods.calm')}</SelectItem>
                      <SelectItem value="romantic">{t('filmStudio.moods.romantic')}</SelectItem>
                      <SelectItem value="suspenseful">{t('filmStudio.moods.suspenseful')}</SelectItem>
                      <SelectItem value="melancholic">{t('filmStudio.moods.melancholic')}</SelectItem>
                      <SelectItem value="comedic">{t('filmStudio.moods.comedic')}</SelectItem>
                      <SelectItem value="epic">{t('filmStudio.moods.epic')}</SelectItem>
                      <SelectItem value="intimate">{t('filmStudio.moods.intimate')}</SelectItem>
                      <SelectItem value="dark">{t('filmStudio.moods.dark')}</SelectItem>
                      <SelectItem value="inspirational">{t('filmStudio.moods.inspirational')}</SelectItem>
                      <SelectItem value="tense">{t('filmStudio.moods.tense')}</SelectItem>
                      <SelectItem value="nostalgic">{t('filmStudio.moods.nostalgic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.cutsStyle')}</Label>
                  <Select
                    value={formData.cutsStyle}
                    onValueChange={(value) => setFormData({ ...formData, cutsStyle: value })}
                  >
                    <SelectTrigger data-testid="select-cuts">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hard">{t('filmStudio.cuts.hard')}</SelectItem>
                      <SelectItem value="jump">{t('filmStudio.cuts.jump')}</SelectItem>
                      <SelectItem value="match">{t('filmStudio.cuts.match')}</SelectItem>
                      <SelectItem value="smash">{t('filmStudio.cuts.smash')}</SelectItem>
                      <SelectItem value="crossfade">{t('filmStudio.cuts.crossfade')}</SelectItem>
                      <SelectItem value="dissolve">{t('filmStudio.cuts.dissolve')}</SelectItem>
                      <SelectItem value="fade">{t('filmStudio.cuts.fade')}</SelectItem>
                      <SelectItem value="wipe">{t('filmStudio.cuts.wipe')}</SelectItem>
                      <SelectItem value="l-cut">{t('filmStudio.cuts.lCut')}</SelectItem>
                      <SelectItem value="j-cut">{t('filmStudio.cuts.jCut')}</SelectItem>
                      <SelectItem value="montage">{t('filmStudio.cuts.montage')}</SelectItem>
                      <SelectItem value="cinematic">{t('filmStudio.cuts.cinematic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.duration')}</Label>
                  <Input
                    type="number"
                    value={formData.targetDuration}
                    onChange={(e) => setFormData({ ...formData, targetDuration: parseInt(e.target.value) || 30 })}
                    min={10}
                    max={300}
                    data-testid="input-duration"
                  />
                </div>

                <div>
                  <Label>{t('filmStudio.aspectRatio')}</Label>
                  <Select
                    value={formData.aspectRatio}
                    onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}
                  >
                    <SelectTrigger data-testid="select-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">{t('filmStudio.aspectRatios.landscape')}</SelectItem>
                      <SelectItem value="9:16">{t('filmStudio.aspectRatios.portrait')}</SelectItem>
                      <SelectItem value="1:1">{t('filmStudio.aspectRatios.square')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.cameraLanguage')}</Label>
                  <Select
                    value={formData.cameraLanguage}
                    onValueChange={(value) => setFormData({ ...formData, cameraLanguage: value })}
                  >
                    <SelectTrigger data-testid="select-camera">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">{t('filmStudio.cameras.static')}</SelectItem>
                      <SelectItem value="handheld">{t('filmStudio.cameras.handheld')}</SelectItem>
                      <SelectItem value="dolly">{t('filmStudio.cameras.dolly')}</SelectItem>
                      <SelectItem value="crane">{t('filmStudio.cameras.crane')}</SelectItem>
                      <SelectItem value="drone">{t('filmStudio.cameras.drone')}</SelectItem>
                      <SelectItem value="cinematic">{t('filmStudio.cameras.cinematic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.pacing')}</Label>
                  <Select
                    value={formData.pacing}
                    onValueChange={(value) => setFormData({ ...formData, pacing: value })}
                  >
                    <SelectTrigger data-testid="select-pacing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">{t('filmStudio.pacings.slow')}</SelectItem>
                      <SelectItem value="medium">{t('filmStudio.pacings.medium')}</SelectItem>
                      <SelectItem value="fast">{t('filmStudio.pacings.fast')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.visualEra')}</Label>
                  <Select
                    value={formData.visualEra}
                    onValueChange={(value) => setFormData({ ...formData, visualEra: value })}
                  >
                    <SelectTrigger data-testid="select-visual-era">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="period">{t('filmStudio.eras.period')}</SelectItem>
                      <SelectItem value="classic">{t('filmStudio.eras.classic')}</SelectItem>
                      <SelectItem value="retro">{t('filmStudio.eras.retro')}</SelectItem>
                      <SelectItem value="80s">{t('filmStudio.eras.80s')}</SelectItem>
                      <SelectItem value="90s">{t('filmStudio.eras.90s')}</SelectItem>
                      <SelectItem value="contemporary">{t('filmStudio.eras.contemporary')}</SelectItem>
                      <SelectItem value="modern">{t('filmStudio.eras.modern')}</SelectItem>
                      <SelectItem value="futuristic">{t('filmStudio.eras.futuristic')}</SelectItem>
                      <SelectItem value="dystopian">{t('filmStudio.eras.dystopian')}</SelectItem>
                      <SelectItem value="cyberpunk">{t('filmStudio.eras.cyberpunk')}</SelectItem>
                      <SelectItem value="vintage">{t('filmStudio.eras.vintage')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('filmStudio.scriptLanguage')}</Label>
                  <Select
                    value={formData.scriptLanguage}
                    onValueChange={(value) => setFormData({ ...formData, scriptLanguage: value })}
                  >
                    <SelectTrigger data-testid="select-script-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">{t('filmStudio.scriptLanguages.english')}</SelectItem>
                      <SelectItem value="arabic">{t('filmStudio.scriptLanguages.arabic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleCreateProject}
                  disabled={createProjectMutation.isPending}
                  data-testid="button-create-project"
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createProjectMutation.isPending ? t('filmStudio.creating') : t('filmStudio.createProject')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewProject(false)}
                  data-testid="button-cancel"
                  className="w-full sm:w-auto"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedProject && (
          <>
            <Card data-testid="card-selected-project">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle>{selectedProject.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{selectedProject.idea}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProject(null)}
                    data-testid="button-back-to-projects"
                    className="w-full md:w-auto"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t('filmStudio.backToProjects')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleGenerateStoryboard}
                      disabled={generateStoryboardMutation.isPending}
                      data-testid="button-generate-storyboard"
                    >
                      <Film className="mr-2 h-4 w-4" />
                      {generateStoryboardMutation.isPending ? t('filmStudio.generatingStoryboard') : (
                        <span className="flex items-center gap-1">
                          {t('filmStudio.generateStoryboard')} {storyboardPricingEstimate && <>{storyboardPricingEstimate.totalCost} <Coins className="h-4 w-4" /></>}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {scenes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-white">{t('filmStudio.scene')}s</h2>
                  <Badge variant="secondary">{scenes.length} {t('filmStudio.scene').toLowerCase()}s</Badge>
                </div>

                {scenes.map((scene) => (
                  <Card key={scene.id} data-testid={`card-scene-${scene.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-base px-3 py-1">{t('filmStudio.scene')} {scene.sceneNumber}</Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {scene.suggestedDuration}s
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <SceneTextSection
                        sceneId={scene.id}
                        baseScene={scene}
                        onEditScene={(scene) => {
                          setEditSceneData({
                            title: scene.title,
                            description: scene.description,
                            notes: scene.notes || ""
                          });
                          setEditingScene(scene);
                        }}
                        onRegenerateText={(sceneId, model) => {
                          regenerateTextMutation.mutate({ sceneId, model });
                        }}
                      />

                      <div className="grid md:grid-cols-2 gap-4">
                        <SceneImageSection
                          sceneId={scene.id}
                          projectId={selectedProject.id}
                          sceneDescription={scene.description}
                          onEditImagePrompt={(sceneId, versionId, prompt) => {
                            setEditingImagePrompt({ sceneId, versionId, prompt });
                          }}
                          onRegeneratePrompt={(sceneId, model, onComplete) => {
                            regenerateImagePromptMutation.mutate({ sceneId, model }, {
                              onSettled: () => onComplete?.()
                            });
                          }}
                        />
                        <SceneVideoSection
                          sceneId={scene.id}
                          onEditVideoPrompt={(sceneId, versionId, prompt) => {
                            setEditingVideoPrompt({ sceneId, versionId, prompt });
                          }}
                          onRegeneratePrompt={(sceneId, model, onComplete) => {
                            regenerateVideoPromptMutation.mutate({ sceneId, model }, {
                              onSettled: () => onComplete?.()
                            });
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {!showNewProject && !selectedProject && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedProject(project)}
                data-testid={`card-project-${project.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{project.idea}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <div>{t('filmStudio.style')}: {project.style}</div>
                    <div>{t('filmStudio.duration')}: {project.targetDuration}s</div>
                    <div>{t('filmStudio.aspectRatio')}: {project.aspectRatio}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Scene Text Dialog */}
        <Dialog open={!!editingScene} onOpenChange={(open) => !open && setEditingScene(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('filmStudio.editScene')}</DialogTitle>
              <DialogDescription>
                {t('filmStudio.editSceneDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t('filmStudio.title_field')}</Label>
                <Input
                  id="edit-title"
                  value={editSceneData.title}
                  onChange={(e) => setEditSceneData({ ...editSceneData, title: e.target.value })}
                  placeholder={t('filmStudio.title_field')}
                  data-testid="input-edit-scene-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">{t('filmStudio.description')}</Label>
                <Textarea
                  id="edit-description"
                  value={editSceneData.description}
                  onChange={(e) => setEditSceneData({ ...editSceneData, description: e.target.value })}
                  placeholder={t('filmStudio.description')}
                  rows={4}
                  data-testid="textarea-edit-scene-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t('filmStudio.notes')}</Label>
                <Textarea
                  id="edit-notes"
                  value={editSceneData.notes}
                  onChange={(e) => setEditSceneData({ ...editSceneData, notes: e.target.value })}
                  placeholder={t('filmStudio.notes')}
                  rows={3}
                  data-testid="textarea-edit-scene-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingScene(null)} data-testid="button-cancel-edit-scene">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => editingScene && updateSceneMutation.mutate({ sceneId: editingScene.id, data: editSceneData })}
                disabled={updateSceneMutation.isPending || !editSceneData.title.trim() || !editSceneData.description.trim()}
                data-testid="button-save-scene-edits"
              >
                {updateSceneMutation.isPending ? t('filmStudio.generating') : t('filmStudio.saveChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Video Prompt Dialog */}
        <Dialog open={!!editingVideoPrompt} onOpenChange={(open) => !open && setEditingVideoPrompt(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('filmStudio.editVideoPrompt')}</DialogTitle>
              <DialogDescription>
                {t('filmStudio.editVideoPromptDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-video-prompt">{t('filmStudio.prompt')}</Label>
                <Textarea
                  id="edit-video-prompt"
                  value={editingVideoPrompt?.prompt || ""}
                  onChange={(e) => setEditingVideoPrompt(editingVideoPrompt ? { ...editingVideoPrompt, prompt: e.target.value } : null)}
                  placeholder={t('filmStudio.prompt')}
                  rows={6}
                  data-testid="textarea-edit-video-prompt"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingVideoPrompt(null)} data-testid="button-cancel-edit-video-prompt">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => editingVideoPrompt && updateVideoPromptMutation.mutate({
                  sceneId: editingVideoPrompt.sceneId,
                  versionId: editingVideoPrompt.versionId,
                  videoPrompt: editingVideoPrompt.prompt
                })}
                disabled={updateVideoPromptMutation.isPending || !editingVideoPrompt?.prompt.trim()}
                data-testid="button-save-video-prompt"
              >
                {updateVideoPromptMutation.isPending ? t('filmStudio.generating') : t('filmStudio.saveChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Image Prompt Dialog */}
        <Dialog open={!!editingImagePrompt} onOpenChange={(open) => !open && setEditingImagePrompt(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('filmStudio.editImagePrompt')}</DialogTitle>
              <DialogDescription>
                {t('filmStudio.editImagePromptDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-image-prompt">{t('filmStudio.prompt')}</Label>
                <Textarea
                  id="edit-image-prompt"
                  value={editingImagePrompt?.prompt || ""}
                  onChange={(e) => setEditingImagePrompt(editingImagePrompt ? { ...editingImagePrompt, prompt: e.target.value } : null)}
                  placeholder={t('filmStudio.prompt')}
                  rows={6}
                  data-testid="textarea-edit-image-prompt"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingImagePrompt(null)} data-testid="button-cancel-edit-image-prompt">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => editingImagePrompt && updateImagePromptMutation.mutate({
                  sceneId: editingImagePrompt.sceneId,
                  versionId: editingImagePrompt.versionId,
                  imagePrompt: editingImagePrompt.prompt
                })}
                disabled={updateImagePromptMutation.isPending || !editingImagePrompt?.prompt.trim()}
                data-testid="button-save-image-prompt"
              >
                {updateImagePromptMutation.isPending ? t('filmStudio.generating') : t('filmStudio.saveChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
