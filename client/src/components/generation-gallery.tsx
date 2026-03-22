import { useState, useEffect, useMemo, useCallback } from "react";
import { Heart, ArrowDownToLine as Download, Trash as Trash2, Eye, EyeOff, CheckCircle, AlertCircle, Timer as Clock, X, Clipboard as Copy, ImageIcon, Maximize2, Clapperboard as VideoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Image } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { FavoriteIndicator } from "./favorite-indicator";
import { VisibilityToggle } from "./visibility-toggle";
import { useBulkFavoriteStatus } from "@/hooks/useBulkFavoriteStatus";
import ImageGenerationProgress from "./ImageGenerationProgress";
import { UpscaleProgressCard } from "./upscale-progress-card";
import { useUpscaleJobs } from "@/hooks/useUpscaleJobs";
import { HoverButtons } from "./HoverButtons";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { OptimizedImage } from "./OptimizedImage";
import Masonry from 'react-masonry-css';
import { cn } from "@/lib/utils";
import { usePromptStore } from "@/stores/prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { useLocation } from "wouter";
import { UpscaleModal } from "./upscale-modal";

export interface GenerationJob {
  id: string;
  prompt: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  imageId?: number;
  image?: Image;
  timestamp?: number;
}

// Individual image card with loading state
function GalleryImageCard({
  image,
  onImageClick,
  onDownload,
  onDelete,
  onVisibilityToggle,
  onFavoriteToggle,
  isFavorited,
  showInfoForImage,
  setShowInfoForImage,
  handleUseImage,
  handleUpscaleImage,
  handleGenerateVideo,
  isAuthenticated,
  getModelDisplayName,
  imageSize
}: {
  image: Image;
  onImageClick: (image: Image) => void;
  onDownload: (image: Image) => void;
  onDelete: (id: number) => void;
  onVisibilityToggle: (id: number, isPublic: boolean) => void;
  onFavoriteToggle: (id: number) => void;
  isFavorited: boolean;
  showInfoForImage: number | null;
  setShowInfoForImage: (id: number | null) => void;
  handleUseImage: (image: Image) => void;
  handleUpscaleImage: (image: Image) => void;
  handleGenerateVideo: (image: Image) => void;
  isAuthenticated: boolean;
  getModelDisplayName: (model: string) => string;
  imageSize: number;
}) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);

  // Calculate aspect ratio for placeholder sizing
  const aspectRatio = image.width && image.height ? image.width / image.height : 1;

  return (
    <div className="mb-6">
      <div
        className="group bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-lg overflow-hidden shadow-sm hover:shadow-md"
        onClick={() => onImageClick(image)}
      >
        <div className="p-0">
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: aspectRatio }}
          >
            {/* Skeleton placeholder until image loads */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/10 to-transparent skeleton-shimmer" />
                <svg
                  className="w-10 h-10 text-gray-700/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <img
              src={image.thumbnailUrl || image.url}
              alt={image.prompt}
              className={cn(
                "w-full h-auto object-contain rounded group-hover:scale-105 transition-all duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(image);
              }}
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

            {/* Upscaled badge - positioned at bottom left since icons are at top */}
            {(image.style === "upscaled" || image.tags?.includes("upscaled")) && (
              <div className="absolute bottom-2 left-2 z-20">
                <Badge variant="outline" className="!rounded-md !border-white/20 !bg-black/40 !text-white/85 !px-2 !py-0.5 !text-[11px] !font-normal shadow-none">
                  {t('landing.badges.upscaled')}
                </Badge>
              </div>
            )}

            {/* Bottom-right quick actions */}
            {isAuthenticated && (
              <div dir="ltr" className="absolute bottom-2 right-2 z-20 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseImage(image);
                  }}
                  className="w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 text-white border border-white/30 backdrop-blur-sm"
                  data-testid="button-use-image"
                  title={t('gallery.use', 'Use')}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpscaleImage(image);
                  }}
                  className="w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 text-white border border-white/30 backdrop-blur-sm"
                  data-testid="button-upscale-image"
                  title={t('tooltips.upscaleImage')}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateVideo(image);
                  }}
                  className="w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 text-white border border-white/30 backdrop-blur-sm"
                  data-testid="button-generate-video-image"
                  title={t('tooltips.generateVideo')}
                >
                  <VideoIcon className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Unified hover buttons */}
            <HoverButtons
              onInfoToggle={(e) => {
                if (e) e.stopPropagation();
                setShowInfoForImage(showInfoForImage === image.id ? null : image.id);
              }}
              onDownload={() => onDownload(image)}
              onDelete={() => {
                if (confirm('Are you sure you want to delete this image?')) {
                  onDelete(image.id);
                }
              }}
              isPublic={image.isPublic}
              onVisibilityToggle={() => onVisibilityToggle(image.id, !image.isPublic)}
              isFavorited={isFavorited}
              onFavoriteToggle={() => onFavoriteToggle(image.id)}
            />

            {/* Image info overlay - Hover only */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              {imageSize < 5 && (
                <p className="text-white text-xs font-light mb-2 drop-shadow-lg line-clamp-2">
                  {image.prompt.length > 120 ? `${image.prompt.substring(0, 120)}...` : image.prompt}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>{getModelDisplayName(image.model)}</span>
                <span>{image.isPublic ? 'Public' : 'Private'}</span>
              </div>
            </div>

            {/* Info tooltip - Card-relative positioning (top-right) like OptimizedPublicGallery */}
            {showInfoForImage === image.id && (
              <div
                className="prompt-tooltip"
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '16px',
                  minWidth: '200px',
                  maxWidth: '90vw',
                  zIndex: 50,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm break-words flex-1">{image.prompt}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfoForImage(null);
                    }}
                    className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label={t('accessibility.close')}
                    data-testid="button-close-info"
                    title={t('accessibility.close')}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span className="text-gray-300">{getModelDisplayName(image.model)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GenerationGalleryProps {
  images: Image[];
  generationJobs: GenerationJob[];
  isLoading: boolean;
  onImageClick: (image: Image) => void;
  onImageDeleted: () => void;
  onJobCancel: (jobId: string) => void;
  imageSize?: number;
}

export default function GenerationGallery({
  images,
  generationJobs,
  isLoading,
  onImageClick,
  onImageDeleted,
  onJobCancel,
  imageSize = 4
}: GenerationGalleryProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);
  const setReferenceImage = useVideoStore(state => state.setReferenceImage);
  const [forceRender, setForceRender] = useState(false);
  const [showInfoForImage, setShowInfoForImage] = useState<number | null>(null);
  const [upscaleImage, setUpscaleImage] = useState<Image | null>(null);
  const [showUpscaleModal, setShowUpscaleModal] = useState(false);

  // RTL detection for proper icon ordering
  const isRTL = i18n.dir() === 'rtl';

  // Upscale jobs tracking
  const { activeJobs: upscaleJobs, dismissJob: dismissUpscaleJob } = useUpscaleJobs();


  // Bulk favorite status optimization
  const imageIds = useMemo(() => images.map(img => img.id), [images]);
  const { data: bulkFavoriteStatus = {} } = useBulkFavoriteStatus(imageIds);

  // Use the centralized hook for model display names
  const { getDisplayName: getModelDisplayName } = useImageModelDisplayName();

  // Delete mutation with proper authentication handling
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to delete image");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription'),
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/public"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      onImageDeleted(); // Also call the parent callback for any additional cleanup
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: t('toasts.unauthorized'),
          description: t('toasts.unauthorizedDescription'),
          variant: "error-outline" as any,
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('toasts.failedToDeleteImage'),
        description: error.message || t('toasts.failedToDeleteImageDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  // Favorite toggle mutation
  const favoriteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/images/${id}/favorite`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('toasts.updated'),
        description: t('toasts.updatedDescription'),
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/bulk-favorite-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: t('toasts.unauthorized'),
          description: t('toasts.unauthorizedDescription'),
          variant: "error-outline" as any,
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: t('toasts.failedToUpdateFavorite'),
        description: error.message || t('toasts.failedToUpdateFavoriteDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  // Visibility toggle mutation
  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      const response = await apiRequest("PATCH", `/api/images/${id}/visibility`, { isPublic });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('toasts.visibilityUpdated'),
        description: t('toasts.visibilityUpdatedDescription'),
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/public"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: t('toasts.unauthorized'),
          description: t('toasts.unauthorizedDescription'),
          variant: "error-outline" as any,
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      const errorMessage = error.message || "";
      const isFeatureNotAvailable = errorMessage.includes("403") ||
        errorMessage.includes("FEATURE_NOT_AVAILABLE") ||
        errorMessage.includes("does not allow") ||
        errorMessage.includes("can_make_private") ||
        errorMessage.includes("upgrade");

      if (isFeatureNotAvailable) {
        toast({
          title: t('toasts.upgradeRequired', 'Upgrade Required'),
          description: t('toasts.privateContentUpgrade', 'Private content is available on paid plans. Upgrade to make your creations private.'),
          variant: "warning" as any,
          toastType: "error",
        });
        return;
      }

      toast({
        title: t('toasts.failedToUpdateVisibility'),
        description: t('toasts.failedToUpdateVisibilityDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  // Reset tooltip when items change (to prevent showing stale prompts)
  useEffect(() => {
    if (showInfoForImage !== null) {
      // Check if the image still exists in the current items
      const imageStillExists = images.some(img => img.id === showInfoForImage);
      if (!imageStillExists) {
        setShowInfoForImage(null);
      }
    }
  }, [images, showInfoForImage]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tooltip = target.closest('.prompt-tooltip');
      const isInfoButton = target.closest('[data-info-button="true"]');

      if (tooltip || isInfoButton) {
        return;
      }

      setShowInfoForImage(null);
    };

    if (showInfoForImage !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showInfoForImage]);

  const handleDownload = (image: Image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseImage = useCallback((image: Image) => {
    setSelectedImageReference({ url: image.url, id: image.id });
    if (image.prompt) {
      setSelectedPrompt(image.prompt);
    }
    setSelectedModel('nano-banana-pro');
    setOpenMobileForm(true);
    toast({
      title: t('toasts.imageReferenceApplied', 'Image reference applied'),
      description: t('toasts.imageReferenceAppliedDescription', 'Image has been added as a reference to the generation form'),
    });
  }, [setSelectedImageReference, setSelectedPrompt, setSelectedModel, setOpenMobileForm, toast, t]);

  const handleUpscaleImage = useCallback((image: Image) => {
    setUpscaleImage(image);
    setShowUpscaleModal(true);
  }, []);

  const handleGenerateVideo = useCallback((image: Image) => {
    setReferenceImage({
      url: image.url,
      prompt: image.prompt,
    });
    toast({
      title: t('toasts.imageLoadedForVideo'),
      description: t('toasts.imageReadyForVideo'),
    });
    setLocation('/video-studio');
  }, [setReferenceImage, toast, t, setLocation]);

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'queued': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  // Filter active generation jobs for progress display
  const activeJobs = generationJobs.filter(job =>
    job.status === 'running' ||
    job.status === 'queued' ||
    job.status === 'failed'
  );

  // Fixed masonry breakpoint columns matching History page exactly
  const breakpointColumnsObj = {
    default: 4,
    1280: 3,
    1024: 2,
    640: 1,
  };

  // Check if there are any active processing tasks (images or upscales)
  const hasActiveProcessing = activeJobs.length > 0 || upscaleJobs.length > 0;

  return (
    <div className="w-full h-full space-y-4 md:space-y-6">
      {/* Active Generation Jobs - Progress Display */}
      {hasActiveProcessing && (
        <div className="space-y-3 md:space-y-4">
          <h3 className="text-base md:text-lg font-semibold text-foreground">{t('pages.gallery.generating')}</h3>

          {/* Image Generation Progress */}
          {activeJobs.length > 0 && (
            <ImageGenerationProgress
              jobs={activeJobs}
              onCancel={onJobCancel}
              onImageClick={onImageClick}
            />
          )}

          {/* Upscale Jobs Progress */}
          {upscaleJobs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {upscaleJobs.map((job) => (
                <UpscaleProgressCard
                  key={job.id}
                  job={job}
                  onDismiss={job.state === 'failed' ? () => dismissUpscaleJob(job.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Gallery */}
      {images.length > 0 && (
        <div className="space-y-3 md:space-y-4">
          <h3 className="text-base md:text-lg font-semibold text-foreground">{t('pages.gallery.yourGallery')}</h3>
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6 bg-clip-padding"
          >
            {images.map((image) => (
              <GalleryImageCard
                key={`image-${image.id}`}
                image={image}
                onImageClick={onImageClick}
                onDownload={handleDownload}
                onDelete={(id) => deleteMutation.mutate(id)}
                onVisibilityToggle={(id, isPublic) => visibilityMutation.mutate({ id, isPublic })}
                onFavoriteToggle={(id) => favoriteMutation.mutate(id)}
                isFavorited={bulkFavoriteStatus[image.id]}
                showInfoForImage={showInfoForImage}
                setShowInfoForImage={setShowInfoForImage}
                handleUseImage={handleUseImage}
                handleUpscaleImage={handleUpscaleImage}
                handleGenerateVideo={handleGenerateVideo}
                isAuthenticated={isAuthenticated}
                getModelDisplayName={getModelDisplayName}
                imageSize={imageSize}
              />
            ))}
          </Masonry>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && images.length === 0 && activeJobs.length === 0 && upscaleJobs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground text-lg mb-2">{t('pages.imageStudio.noImagesYet')}</div>
          <div className="text-muted-foreground/50 text-sm">
            {t('pages.imageStudio.generateFirstImage')}
          </div>
        </div>
      )}

      {/* Loading state with skeleton placeholders */}
      {isLoading && (
        <div className="space-y-3 md:space-y-4">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6 bg-clip-padding"
          >
            {[200, 280, 240, 320, 180, 260, 300, 220, 250, 290, 210, 270].map((height, index) => (
              <div key={`skeleton-${index}`} className="mb-6">
                <div
                  className="relative bg-card/40 border border-white/5 rounded-lg overflow-hidden"
                  style={{ height: `${height}px` }}
                >
                  {/* Shimmer animation overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />

                  {/* Faint image icon placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-gray-700/50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </Masonry>
        </div>
      )}

      {upscaleImage && (
        <UpscaleModal
          open={showUpscaleModal}
          onOpenChange={(open) => {
            setShowUpscaleModal(open);
            if (!open) {
              setUpscaleImage(null);
            }
          }}
          imageId={upscaleImage.id}
          imageUrl={upscaleImage.url}
          imageWidth={upscaleImage.width || 1024}
          imageHeight={upscaleImage.height || 1024}
          isPublic={upscaleImage.isPublic}
        />
      )}
    </div>
  );
}
