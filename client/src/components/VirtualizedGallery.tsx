import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import type { Image } from '@shared/schema';
import { GenerationJob } from './generation-gallery';
import { cn } from '@/lib/utils';
import { Heart, ArrowDownToLine as Download, Trash as Trash2, X, Timer as Clock, CheckCircle, AlertCircle, Eye, EyeOff, Info, Clipboard as Copy, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FavoriteIndicator } from "./favorite-indicator";
import { VisibilityToggle } from "./visibility-toggle";
import { useBulkFavoriteStatus } from "@/hooks/useBulkFavoriteStatus";
import { useAuth } from "@/hooks/useAuth";
import { HoverButtons } from "./HoverButtons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { useGalleryStore, type ModerationPlaceholder } from "@/stores/gallery-store";
import { usePromptStore } from "@/stores/prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { Type, ImageIcon, Maximize2, Clapperboard as VideoIcon } from "lucide-react";
import { useLocation } from "wouter";
import { UpscaleModal } from "./upscale-modal";

// Persistent progress storage across component re-renders
const progressStore = new Map<string, number>();

// Utility function to cleanup stale entries from progressStore
// Uses a timestamp-based approach: entries older than 5 minutes with no corresponding active job are removed
const progressTimestamps = new Map<string, number>();

function trackProgressEntry(jobId: string) {
  progressTimestamps.set(jobId, Date.now());
}

function cleanupStaleProgressEntries(activeJobIds: Set<string>) {
  const now = Date.now();
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
  const staleIds: string[] = [];

  progressStore.forEach((_, jobId) => {
    // Only remove if: not in active jobs AND older than 5 minutes
    const timestamp = progressTimestamps.get(jobId) || 0;
    const age = now - timestamp;
    if (!activeJobIds.has(jobId) && age > MAX_AGE_MS) {
      staleIds.push(jobId);
    }
  });

  staleIds.forEach(id => {
    progressStore.delete(id);
    progressTimestamps.delete(id);
  });

  if (staleIds.length > 0) {
    console.log(`[ImageProgress Cleanup] Removed ${staleIds.length} stale entries (older than 5 min)`);
  }
}

// Hook to provide smooth progress animation for running jobs
function useSmoothProgress(job: GenerationJob): number {
  const initialProgress = progressStore.get(job.id) ?? job.progress;
  const [displayProgress, setDisplayProgress] = useState(initialProgress);
  const animationFrameRef = useRef<number>();
  const lastJobProgressRef = useRef(job.progress);

  // Persist progress to store whenever it changes, and track timestamp for cleanup
  useEffect(() => {
    progressStore.set(job.id, displayProgress);
    trackProgressEntry(job.id);
  }, [job.id, displayProgress]);

  // Sync with job progress when it updates
  useEffect(() => {
    if (job.progress !== lastJobProgressRef.current) {
      setDisplayProgress(prev => Math.max(prev, job.progress));
      lastJobProgressRef.current = job.progress;
    }
  }, [job.progress]);

  // Clean up from store when job reaches terminal state
  useEffect(() => {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      progressStore.delete(job.id);
      progressTimestamps.delete(job.id);
    }
  }, [job.id, job.status]);

  useEffect(() => {
    if (job.status !== 'running') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      setDisplayProgress(prev => {
        const realProgress = lastJobProgressRef.current;

        if (prev >= realProgress) {
          if (prev >= 95) {
            return prev;
          }
          const increment = (delta / 1000) * 3;
          const fallbackProgress = prev + increment;
          return Math.min(fallbackProgress, 95);
        } else {
          const catchUpIncrement = Math.min((realProgress - prev) * 0.1, 5);
          return Math.min(prev + catchUpIncrement, realProgress);
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [job.status]);

  // Cleanup animation on unmount, but PRESERVE progress in store for active jobs
  // This allows progress to persist when navigating away and back
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // NOTE: We intentionally do NOT delete from progressStore here
      // The progress should persist for active jobs when component unmounts due to navigation
      // Progress is only deleted when job reaches terminal state in the effect above
    };
  }, [job.id]);

  return displayProgress;
}

// Component for rendering a moderation placeholder card
function ModerationPlaceholderCard({ placeholder }: { placeholder: ModerationPlaceholder }) {
  const { t } = useTranslation();

  return (
    <div className="group relative gradient-border rounded-xl overflow-hidden">
      <div className="aspect-square bg-card/40 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center relative">
        <div className="relative mb-3">
          <Shield className="w-8 h-8 text-blue-400" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-2 border-gray-800 border-t-blue-400 rounded-full animate-spin"></div>
        </div>

        <div className="text-white text-xs font-medium mb-1 text-center px-4">
          {t('moderation.checkingContent', 'Checking content safety...')}
        </div>

        <div className="text-gray-400 text-xs text-center px-4">
          {t('moderation.pleaseWait', 'Please wait')}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-white text-xs font-light line-clamp-1">
          {placeholder.prompt}
        </p>
      </div>
    </div>
  );
}

// Component for rendering a progress card with smooth animation
function ProgressCard({ job, onJobCancel }: { job: GenerationJob; onJobCancel: (jobId: string) => void }) {
  const smoothProgress = useSmoothProgress(job);

  const getProgressColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]';
      default: return 'bg-gray-500';
    }
  }, []);

  return (
    <div className="group relative gradient-border rounded-xl overflow-hidden">
      <div className="aspect-square bg-card/40 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center relative">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin mb-2"></div>

        <div className="text-white text-xs font-medium mb-2">
          {job.status === 'running' ? 'Generating...' : job.status === 'queued' ? 'Queued...' : job.status}
        </div>

        <div className="w-3/4 bg-gray-700 rounded-full h-1.5 mb-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(job.status)}`}
            style={{ width: `${smoothProgress}%` }}
          ></div>
        </div>

        <div className="text-gray-400 text-xs">
          {Math.round(smoothProgress)}%
        </div>

        {(job.status === 'queued' || job.status === 'running') && (
          <div className="absolute top-1 right-1 z-30">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onJobCancel(job.id);
              }}
              className="bg-white/10 hover:bg-white/20 text-white hover:text-red-400 w-6 h-6 p-0 flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {job.error && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/20 border-t border-red-500/50 p-1">
            <div className="text-red-400 text-xs text-center line-clamp-1">
              {job.error}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-white text-xs font-light line-clamp-1">
          {job.prompt}
        </p>
      </div>
    </div>
  );
}

// Image Card Component - matches History page styling with natural aspect ratio
function ImageCard({
  image,
  isFavorite,
  onImageClick,
  onDelete,
  onVisibilityToggle,
  onFavoriteToggle,
  onDownload,
  showInfoForImage,
  setShowInfoForImage,
  handleCopyPrompt,
  handleUsePrompt,
  handleUseImage,
  handleUpscaleImage,
  handleGenerateVideo,
  isOwner,
  isAuthenticated,
  getModelDisplayName
}: {
  image: Image;
  isFavorite: boolean;
  onImageClick: (image: Image) => void;
  onDelete?: (id: number) => void;
  onVisibilityToggle?: (id: number, isPublic: boolean) => void;
  onFavoriteToggle: (id: number) => void;
  onDownload: (image: Image) => void;
  showInfoForImage: number | null;
  setShowInfoForImage: (id: number | null) => void;
  handleCopyPrompt: (prompt: string) => void;
  handleUsePrompt: (prompt: string) => void;
  handleUseImage: (image: Image) => void;
  handleUpscaleImage: (image: Image) => void;
  handleGenerateVideo: (image: Image) => void;
  isOwner: boolean;
  isAuthenticated: boolean;
  getModelDisplayName: (model: string) => string;
}) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className={cn(
        "group transition-all duration-300 cursor-pointer rounded-lg overflow-hidden mb-4",
        imageLoaded
          ? "bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:scale-[1.02] shadow-sm hover:shadow-md"
          : "bg-transparent border-transparent"
      )}
      onClick={() => onImageClick(image)}
      data-testid={`gallery-image-card-${image.id}`}
    >
      <div className="p-0">
        <div className="relative w-full overflow-hidden">
          {/* Image always in flow to maintain stable masonry column heights */}
          <img
            src={image.thumbnailUrl || image.url}
            alt={image.prompt}
            className={cn(
              "block w-full h-auto rounded transition-all duration-300",
              imageLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
            )}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
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
          {isAuthenticated && (
            <HoverButtons
              onInfoToggle={(e) => {
                if (e) e.stopPropagation();
                setShowInfoForImage(showInfoForImage === image.id ? null : image.id);
              }}
              onDownload={() => onDownload(image)}
              onDelete={isOwner ? () => {
                if (confirm('Are you sure you want to delete this image?')) {
                  onDelete?.(image.id);
                }
              } : undefined}
              isPublic={image.isPublic}
              onVisibilityToggle={isOwner ? () => onVisibilityToggle?.(image.id, !image.isPublic) : undefined}
              isFavorited={isFavorite}
              onFavoriteToggle={() => onFavoriteToggle(image.id)}
            />
          )}

          {/* Info tooltip */}
          {showInfoForImage === image.id && (
            <div
              className="prompt-tooltip absolute z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl max-w-sm w-[90vw] md:w-auto pointer-events-auto"
              style={{
                top: '48px',
                right: '16px',
                minWidth: '200px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm break-words flex-1 max-h-48 overflow-y-auto">{image.prompt}</p>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPrompt(image.prompt);
                    }}
                    className="h-6 w-6 p-0"
                    data-testid="button-copy-prompt"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUsePrompt(image.prompt);
                    }}
                    className="h-6 w-6 p-0"
                    data-testid="button-use-prompt"
                    title="Use prompt"
                  >
                    <Type className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfoForImage(null);
                    }}
                    className="h-6 w-6 p-0"
                    data-testid="button-close-info"
                    aria-label={t('accessibility.close')}
                    title={t('accessibility.close')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-gray-300">
                {getModelDisplayName(image.model)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {image.width}x{image.height}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VirtualizedGalleryProps {
  images: Image[];
  generationJobs: GenerationJob[];
  isLoading: boolean;
  onImageClick: (image: Image) => void;
  onImageDeleted: () => void;
  onJobCancel: (jobId: string) => void;
  imageSize: number;
  containerWidth: number;
  containerHeight: number;
}

export default function VirtualizedGallery({
  images,
  generationJobs,
  isLoading,
  onImageClick,
  onImageDeleted,
  onJobCancel,
  imageSize,
  containerWidth,
  containerHeight
}: VirtualizedGalleryProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const setReferenceImage = useVideoStore(state => state.setReferenceImage);
  const [showInfoForImage, setShowInfoForImage] = useState<number | null>(null);
  const [upscaleImage, setUpscaleImage] = useState<Image | null>(null);
  const [showUpscaleModal, setShowUpscaleModal] = useState(false);
  const { getDisplayName: getModelDisplayName } = useImageModelDisplayName();

  // Get moderation placeholders from gallery store
  const moderationPlaceholders = useGalleryStore(state => state.moderationPlaceholders);

  // ✅ CLEANUP: Remove stale entries from progressStore
  // Only run when we have jobs (empty = skip cleanup to avoid wiping during fetch gaps)
  // The 5-minute timestamp guard in cleanupStaleProgressEntries provides additional safety
  useEffect(() => {
    // Only cleanup when we have active jobs - this prevents wiping during loading/fetch gaps
    if (generationJobs.length > 0) {
      const activeJobIds = new Set(generationJobs.map(j => j.id));
      cleanupStaleProgressEntries(activeJobIds);
    }
  }, [generationJobs]);

  // Masonry breakpoint configuration - matches History page
  const breakpointColumnsObj = useMemo(() => {
    // Adjust columns based on imageSize preference (higher = fewer columns)
    const baseColumns = Math.max(1, Math.min(6, Math.floor(12 / imageSize)));
    return {
      default: Math.min(baseColumns, 4),
      1280: Math.min(baseColumns, 3),
      1024: Math.min(baseColumns, 2),
      640: 1,
    };
  }, [imageSize]);

  // Mutations for button functionality
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/images/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      onImageDeleted();
    },
    onError: (error: Error) => {
      toast({
        title: t('toasts.deleteFailed'),
        description: error.message || t('toasts.deleteFailedDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/images/${id}/favorite`);
      const data = await response.json();
      return data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/bulk-favorite-status"] });
      onImageDeleted();
    },
    onError: (error: Error) => {
      toast({
        title: t('toasts.favoriteFailed'),
        description: error.message || t('toasts.favoriteFailedDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      const response = await apiRequest("PATCH", `/api/images/${id}/visibility`, { isPublic });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: t('toasts.visibilityUpdated'),
        description: t('toasts.visibilityUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      onImageDeleted();
    },
    onError: (error: Error) => {
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
        title: t('toasts.updateFailed'),
        description: t('toasts.updateFailedDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  // Reset tooltip when items change
  useEffect(() => {
    if (showInfoForImage !== null) {
      const imageStillExists = images.some(img => img.id === showInfoForImage);
      if (!imageStillExists) {
        setShowInfoForImage(null);
      }
    }
  }, [images, showInfoForImage]);

  // Close tooltip with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showInfoForImage !== null) {
        setShowInfoForImage(null);
      }
    };

    if (showInfoForImage !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showInfoForImage]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showInfoForImage !== null) {
        const target = e.target as HTMLElement;
        const tooltip = target.closest('.prompt-tooltip');
        if (!tooltip) {
          setShowInfoForImage(null);
        }
      }
    };

    if (showInfoForImage !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInfoForImage]);

  // Remove progress cards when matching images are found
  useEffect(() => {
    if (images.length === 0 || generationJobs.length === 0) return;

    const imageJobIds = new Set(
      images
        .map((img: any) => img.jobId)
        .filter((jobId): jobId is string => !!jobId)
    );

    const jobsToRemove = generationJobs.filter(job =>
      imageJobIds.has(job.id)
    );

    if (jobsToRemove.length > 0) {
      jobsToRemove.forEach(job => {
        onJobCancel(job.id);
      });
    }
  }, [images, generationJobs, onJobCancel]);

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      toast({
        title: t('toasts.promptCopied'),
        description: t('toasts.promptCopiedDescription'),
      });
    }).catch((error) => {
      toast({
        title: t('toasts.copyFailed'),
        description: t('toasts.copyFailedDescription'),
        variant: "error-outline" as any,
      });
    });
  }, [toast, t]);

  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);

  const handleUsePrompt = useCallback((prompt: string) => {
    setSelectedPrompt(prompt);
    setShowInfoForImage(null);
    toast({
      title: t('toasts.promptApplied', 'Prompt applied'),
      description: t('toasts.promptAppliedDescription', 'Prompt has been copied to the generation form'),
    });
  }, [setSelectedPrompt, toast, t]);

  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);

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

  // Combine moderation placeholders, generation jobs and images
  const allItems = useMemo(() => {
    const items: Array<{ type: 'moderation' | 'job' | 'image'; data: ModerationPlaceholder | GenerationJob | Image }> = [];

    // Add moderation placeholders first (at the top)
    Object.values(moderationPlaceholders).forEach((placeholder) => {
      items.push({ type: 'moderation', data: placeholder });
    });

    const visibleJobs = generationJobs.filter(job =>
      job.status === 'running' ||
      job.status === 'queued' ||
      job.status === 'completed' ||
      job.status === 'failed'
    );

    visibleJobs.forEach((job) => {
      if (job.status === 'completed' && job.image) {
        items.push({ type: 'image', data: job.image });
      } else {
        items.push({ type: 'job', data: job });
      }
    });

    const jobImageIds = new Set(
      visibleJobs
        .filter(job => job.status === 'completed' && job.image)
        .map(job => job.image!.id)
    );

    const jobIds = new Set(generationJobs.map(job => job.id));

    images.forEach((image) => {
      const imageJobId = (image as any).jobId;
      if (!jobImageIds.has(image.id) && (!imageJobId || !jobIds.has(imageJobId))) {
        items.push({ type: 'image', data: image });
      }
    });

    return items;
  }, [moderationPlaceholders, generationJobs, images]);

  // Bulk favorite status for images
  const imageIds = useMemo(() => images.map(img => img.id), [images]);
  const { data: bulkFavoriteStatus = {} } = useBulkFavoriteStatus(imageIds);

  const handleDownload = useCallback((image: Image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Skeleton placeholder for loading state
  const skeletonHeights = useMemo(() => {
    // Generate varied heights for natural masonry look
    return Array.from({ length: 12 }, (_, i) => {
      const heights = [200, 280, 240, 320, 180, 260, 300, 220, 250, 290, 210, 270];
      return heights[i % heights.length];
    });
  }, []);

  if (isLoading) {
    return (
      <div className="w-full px-2">
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="flex -ml-4 w-auto"
          columnClassName="pl-4 bg-clip-padding"
        >
          {skeletonHeights.map((height, index) => (
            <div key={`skeleton-${index}`} className="mb-4">
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
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No images found</div>
      </div>
    );
  }

  return (
    <div className="w-full px-2">
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex -ml-4 w-auto"
        columnClassName="pl-4 bg-clip-padding"
      >
        {allItems.map((item, index) => {
          if (item.type === 'moderation') {
            const placeholder = item.data as ModerationPlaceholder;
            return (
              <div key={`moderation-${placeholder.id}`} className="mb-4">
                <ModerationPlaceholderCard placeholder={placeholder} />
              </div>
            );
          }

          if (item.type === 'job') {
            const job = item.data as GenerationJob;
            return (
              <div key={`job-${job.id}`} className="mb-4">
                <ProgressCard job={job} onJobCancel={onJobCancel} />
              </div>
            );
          }

          const image = item.data as Image;
          const isFavorite = bulkFavoriteStatus[image.id] || false;
          const isOwner = user?.id === image.ownerId;

          return (
            <ImageCard
              key={`image-${image.id}`}
              image={image}
              isFavorite={isFavorite}
              onImageClick={onImageClick}
              onDelete={isOwner ? (id) => deleteMutation.mutate(id) : undefined}
              onVisibilityToggle={isOwner ? (id, isPublic) => visibilityMutation.mutate({ id, isPublic }) : undefined}
              onFavoriteToggle={(id) => favoriteMutation.mutate(id)}
              onDownload={handleDownload}
              showInfoForImage={showInfoForImage}
              setShowInfoForImage={setShowInfoForImage}
              handleCopyPrompt={handleCopyPrompt}
              handleUsePrompt={handleUsePrompt}
              handleUseImage={handleUseImage}
              handleUpscaleImage={handleUpscaleImage}
              handleGenerateVideo={handleGenerateVideo}
              isOwner={isOwner}
              isAuthenticated={isAuthenticated}
              getModelDisplayName={getModelDisplayName}
            />
          );
        })}
      </Masonry>

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

