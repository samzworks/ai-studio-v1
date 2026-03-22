import { useState, useEffect } from "react";
import { X, Heart, ArrowDownToLine as Download, Share2, Flag, Edit3, Trash as Trash2, RotateCcw, Clapperboard as Video, FileText, Clipboard as Copy, ChevronLeft, ChevronRight, ZoomIn, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useVideoStore } from "@/stores/video-store";
import { useGenerationJobs } from "@/hooks/useGenerationJobs";
import { LoginRequiredModal } from "@/components/login-required-modal";
import { UpscaleModal } from "@/components/upscale-modal";
import { usePromptStore } from "@/stores/prompt-store";

interface LightboxProps {
  image: {
    id: number;
    url: string;
    prompt: string;
    model?: string;
    ownerId?: string;
    ownerName?: string;
    isPublic?: boolean;
    quality?: string;
    style?: string;
    width?: number;
    height?: number;
    styleImageUrl?: string;
    imageStrength?: number;
    aspectRatio?: string;
    provider?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  showActions?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: (imageId: number, isFavorited: boolean) => void;
  onImageDeleted?: () => void;
  onEdit?: () => void;
  onUpscale?: () => void;
  onVariation?: (prompt: string, model: string, styleImageUrl?: string, imageStrength?: number) => void;
  isOwner?: boolean;
  // Navigation props for gallery
  images?: Array<{
    id: number;
    url: string;
    prompt: string;
    model?: string;
    ownerId?: string;
    ownerName?: string;
    isPublic?: boolean;
    quality?: string;
    style?: string;
    width?: number;
    height?: number;
    styleImageUrl?: string;
    imageStrength?: number;
    aspectRatio?: string;
    provider?: string;
  }>;
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export default function Lightbox({
  image,
  isOpen,
  onClose,
  showActions = true,
  isFavorited = false,
  onFavoriteToggle,
  onImageDeleted,
  onEdit,
  onUpscale,
  onVariation,
  isOwner = false,
  images = [],
  currentIndex = 0,
  onNavigate
}: LightboxProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { setReferenceImage } = useVideoStore();
  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);
  const { enqueueJob, isEnqueuing } = useGenerationJobs();
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [currentFavoriteState, setCurrentFavoriteState] = useState(isFavorited);
  const [isMobile, setIsMobile] = useState(false);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [isFullSize, setIsFullSize] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUpscaleModal, setShowUpscaleModal] = useState(false);

  // Pinch-to-zoom states
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);
  const [lastPanPosition, setLastPanPosition] = useState<{ x: number; y: number } | null>(null);

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;

  // Query the current favorite status directly in the lightbox
  const { data: lightboxFavoriteStatus } = useQuery({
    queryKey: [`/api/images/${image?.id}/favorite-status`],
    enabled: isOpen && !!image?.id && isAuthenticated,
  });

  // Update local state based on server data or prop
  useEffect(() => {
    if (lightboxFavoriteStatus !== undefined) {
      // Use server data if available
      setCurrentFavoriteState((lightboxFavoriteStatus as any)?.isFavorited || false);
    } else {
      // Fall back to prop
      setCurrentFavoriteState(isFavorited);
    }
  }, [lightboxFavoriteStatus, isFavorited]);

  // Detect if user is on mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Show action buttons on mobile by default, or on hover for desktop
  useEffect(() => {
    if (isMobile) {
      setShowActionButtons(true);
    } else {
      setShowActionButtons(false);
    }
  }, [isMobile]);

  const handleImageContainerHover = () => {
    if (!isMobile) {
      setShowActionButtons(true);
    }
  };

  const handleImageContainerLeave = () => {
    if (!isMobile) {
      setShowActionButtons(false);
    }
  };

  // Handle keyboard navigation (ESC, left/right arrows)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImage();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, onClose, images, currentIndex, onNavigate]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Reset zoom when image changes or lightbox closes
  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setInitialDistance(null);
    setInitialScale(1);
    setLastPanPosition(null);
  }, [image?.id, isOpen]);

  const favoriteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      const response = await apiRequest("PATCH", `/api/images/${imageId}/favorite`);
      return await response.json();
    },
    onSuccess: (data: any) => {
      const newIsFavorited = data?.isFavorited;

      // Update local state immediately for UI responsiveness
      setCurrentFavoriteState(newIsFavorited);

      if (onFavoriteToggle) {
        onFavoriteToggle(image!.id, newIsFavorited);
      }

      // Invalidate specific queries to refresh state
      queryClient.invalidateQueries({ queryKey: [`/api/images/${image!.id}/favorite-status`] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: any) => {
      // Silent failure - no toast messages
      console.error("Failed to update favorite status:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/images/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription'),
      });
      if (onImageDeleted) {
        onImageDeleted();
      }
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: t('toasts.deleteFailed'),
        description: error.message || t('toasts.deleteFailedDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    if (!image) return;

    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t('toasts.downloadStarted'),
      description: t('toasts.downloadDescription'),
    });
  };

  const handleShare = async () => {
    if (!image) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Generated Image',
          text: image.prompt,
          url: image.url,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(image.url);
        toast({
          title: t('toasts.urlCopied'),
          description: t('toasts.urlCopiedDescription'),
        });
      } catch (error) {
        toast({
          title: t('toasts.shareFailed'),
          description: t('toasts.shareFailedDescription'),
          variant: "error-outline" as any,
        });
      }
    }
  };

  const handleFavoriteToggle = () => {
    if (!image || !isAuthenticated) {
      toast({
        title: t('toasts.loginRequired'),
        description: t('toasts.loginRequiredDescription'),
        variant: "error-outline" as any,
      });
      return;
    }
    favoriteMutation.mutate(image.id);
  };

  const handleDelete = () => {
    if (!image) return;
    if (confirm(t('toasts.confirmDelete'))) {
      deleteMutation.mutate(image.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      // Show message without closing lightbox
      toast({
        title: t('toasts.editFeature'),
        description: t('toasts.editFeatureDescription'),
      });
    }
  };

  const handleUpscale = () => {
    // Upscale feature is coming soon - button shows this in UI
  };

  const handleVariation = async () => {
    if (!image) return;

    if (onVariation && image.prompt && image.model) {
      onVariation(image.prompt, image.model, image.styleImageUrl, image.imageStrength);
    } else if (image.prompt && image.model) {
      try {
        // Generate a unique client-side job ID (like parallel-generation-form does)
        const clientJobId = `regen_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        // Prepare generation data with jobId for backend tracking
        const generateData = {
          prompt: image.prompt,
          model: image.model,
          style: image.style,
          width: image.width || 1024,
          height: image.height || 1024,
          quality: image.quality,
          aspectRatio: image.aspectRatio,
          styleImageUrl: image.styleImageUrl,
          styleImageUrls: image.styleImageUrl ? [image.styleImageUrl] : undefined,
          imageStrength: image.imageStrength,
          provider: image.provider || "fal", // Use stored provider or default to fal
          jobId: clientJobId, // Client-side job ID for progress tracking
        };

        // Step 1: Enqueue the job to create a tracking entry in the notification panel
        const result = await enqueueJob(generateData);

        if (!result.success || !result.job?.id) {
          toast({
            title: t('toasts.regenerateFailed'),
            description: result.error || t('toasts.regenerateFailedDescription'),
            variant: "error-outline" as any,
          });
          return;
        }

        const queueJobId = result.job.id;
        console.log(`[Lightbox] Job ${queueJobId} enqueued (client jobId: ${clientJobId}), starting generation...`);

        // Invalidate jobs query to show the new job in progress panel
        queryClient.invalidateQueries({ queryKey: ["/api/generation-jobs"] });

        toast({
          title: t('toasts.regenerating'),
          description: t('toasts.regeneratingDescription'),
        });

        // Step 2: Actually call the generate API to trigger fal.ai
        try {
          const response = await apiRequest("POST", "/api/images/generate", {
            ...generateData,
            queueJobId, // Link the result to the queue job
          });
          const generateResult = await response.json();

          console.log(`[Lightbox] Job ${queueJobId} generation completed`);

          // Invalidate queries to update the gallery and job status
          queryClient.invalidateQueries({ queryKey: ["/api/generation-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["/api/images"] });
        } catch (generateError: any) {
          console.error(`[Lightbox] Job ${queueJobId} generation failed:`, generateError);
          // Job will be marked as failed by the backend
          queryClient.invalidateQueries({ queryKey: ["/api/generation-jobs"] });

          toast({
            title: t('toasts.regenerateFailed'),
            description: generateError.message || t('toasts.regenerateFailedDescription'),
            variant: "error-outline" as any,
          });
        }
      } catch (error: any) {
        toast({
          title: t('toasts.regenerateFailed'),
          description: error.message || t('toasts.regenerateFailedDescription'),
          variant: "error-outline" as any,
        });
      }
    } else {
      toast({
        title: t('toasts.cannotRegenerate'),
        description: t('toasts.cannotRegenerateDescription'),
        variant: "destructive",
      });
    }
  };

  const handleUseImage = () => {
    if (!image || !isAuthenticated) {
      toast({
        title: t('toasts.loginRequired'),
        description: t('toasts.loginRequiredDescription'),
        variant: "error-outline" as any,
      });
      return;
    }

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

    navigate('/images');
  };

  const handleCopyPrompt = async () => {
    if (!image?.prompt) return;

    try {
      await navigator.clipboard.writeText(image.prompt);
      toast({
        title: t('toasts.promptCopied'),
        description: t('toasts.promptCopiedDescription'),
      });
    } catch (error) {
      toast({
        title: t('toasts.copyFailed'),
        description: t('toasts.copyFailedDescription'),
        variant: "error-outline" as any,
      });
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only toggle full size if not zoomed in
    if (scale === 1) {
      setIsFullSize(!isFullSize);
    }
  };

  // Calculate distance between two touch points
  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start for pinch-to-zoom and panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    if (e.touches.length === 2) {
      // Two fingers - pinch zoom
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      setInitialDistance(distance);
      setInitialScale(scale);
    } else if (e.touches.length === 1 && scale > 1) {
      // One finger and zoomed in - panning
      setLastPanPosition({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
    }
  };

  // Handle touch move for pinch-to-zoom and panning
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;

    if (e.touches.length === 2 && initialDistance) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = currentDistance / initialDistance;
      const newScale = Math.min(Math.max(initialScale * scaleChange, 1), 5); // Limit between 1x and 5x
      setScale(newScale);
    } else if (e.touches.length === 1 && scale > 1 && lastPanPosition) {
      // Panning when zoomed
      e.preventDefault();
      const deltaX = e.touches[0].clientX - lastPanPosition.x;
      const deltaY = e.touches[0].clientY - lastPanPosition.y;

      setTranslateX(translateX + deltaX);
      setTranslateY(translateY + deltaY);

      setLastPanPosition({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
    }
  };

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    if (e.touches.length < 2) {
      setInitialDistance(null);
    }

    if (e.touches.length === 0) {
      setLastPanPosition(null);

      // Reset zoom if scaled back to 1 or less
      if (scale <= 1) {
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      }
    }
  };

  // Navigation helper functions
  const handlePreviousImage = () => {
    if (onNavigate && images.length > 1 && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (onNavigate && images.length > 1 && currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  // Check if navigation is available
  const hasPrevious = images.length > 1 && currentIndex > 0;
  const hasNext = images.length > 1 && currentIndex < images.length - 1;
  const topRightActionChipClasses = "w-7 h-7 sm:w-8 sm:h-8 md:w-7 md:h-7 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm flex items-center justify-center transition-all duration-200 flex-shrink-0";
  const topRightActionIconClasses = "w-3 h-3 sm:w-3.5 sm:h-3.5 text-white";
  const topRightActionsVisible = isMobile || showActionButtons;

  if (!isOpen || !image) return null;

  return (
    <div
      className={`fixed inset-0 bg-background/95 backdrop-blur-xl z-[9999] ${isFullSize ? 'overflow-auto p-4' : 'flex items-center justify-center overflow-hidden'
        }`}
      onClick={handleBackdropClick}
    >
      {/* Close button - always visible */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="fixed top-6 right-6 bg-primary/20 hover:bg-primary/40 text-foreground rounded-full p-3 transition-all duration-300 z-50 opacity-100"
        onMouseEnter={(e) => {
          const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(31, 86, 245, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '';
          }
        }}
      >
        <X className="w-6 h-6" />
      </Button>
      {/* Image container */}
      <div
        className={`relative ${isFullSize
            ? 'min-h-fit w-fit mx-auto my-4'
            : 'flex flex-col max-w-[95vw] max-h-[95vh]'
          }`}
        onMouseEnter={handleImageContainerHover}
        onMouseLeave={handleImageContainerLeave}
      >
        {/* Top-right action icons - match gallery card icon style */}
        {!isFullSize && (
          <div
            className={`absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-nowrap items-center justify-end gap-1 z-30 max-w-[calc(100%-0.5rem)] transition-all duration-200 ${topRightActionsVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
            onClick={(e) => e.stopPropagation()}
            dir="ltr"
          >
            <button
              className={topRightActionChipClasses}
              onClick={() => setShowPromptOverlay(true)}
              title={t('tooltips.showPrompt')}
              aria-label={t('tooltips.showPrompt')}
              data-testid="button-show-prompt"
            >
              <FileText className={topRightActionIconClasses} />
            </button>

            {showActions && (
              <button
                className={topRightActionChipClasses}
                onClick={handleDownload}
                title={t('tooltips.downloadImage')}
                aria-label={t('tooltips.downloadImage')}
                data-testid="button-download-image"
              >
                <Download className={topRightActionIconClasses} />
              </button>
            )}

            {showActions && isOwner && (
              <button
                className={topRightActionChipClasses}
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                title={t('tooltips.deleteImage')}
                aria-label={t('tooltips.deleteImage')}
                data-testid="button-delete-image"
              >
                <Trash2 className={topRightActionIconClasses} />
              </button>
            )}

            {showActions && !isOwner && image.ownerId && isAuthenticated && (
              <button
                className={topRightActionChipClasses}
                title={t('tooltips.reportImage')}
                aria-label={t('tooltips.reportImage')}
                data-testid="button-report-image"
              >
                <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-300" />
              </button>
            )}

            {showActions && (
              <button
                className={topRightActionChipClasses}
                onClick={handleFavoriteToggle}
                disabled={favoriteMutation.isPending}
                title={currentFavoriteState ? t('accessibility.removeFromFavorites') : t('accessibility.addToFavorites')}
                aria-label={currentFavoriteState ? t('accessibility.removeFromFavorites') : t('accessibility.addToFavorites')}
                data-testid="button-favorite-image"
              >
                <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${currentFavoriteState ? "text-red-400 fill-current" : "text-white"}`} />
              </button>
            )}
          </div>
        )}
        {/* Previous image button */}
        {hasPrevious && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-primary/20 hover:bg-primary/40 text-foreground rounded-full p-3 transition-all duration-300 z-10"
            title={t('tooltips.previousImage')}
            onMouseEnter={(e) => {
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(31, 86, 245, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
                (e.currentTarget as HTMLElement).style.backgroundColor = '';
              }
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}

        {/* Next image button */}
        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary/20 hover:bg-primary/40 text-foreground rounded-full p-3 transition-all duration-300 z-10"
            title={t('tooltips.nextImage')}
            onMouseEnter={(e) => {
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(31, 86, 245, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              if (!isTouchDevice && window.matchMedia('(hover: hover)').matches) {
                (e.currentTarget as HTMLElement).style.backgroundColor = '';
              }
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        )}

        {/* Main image */}
        <img
          src={image.url}
          alt={image.prompt}
          className={`rounded-lg shadow-2xl ${isFullSize
              ? 'block cursor-zoom-out'
              : 'max-w-full max-h-[85vh] object-contain cursor-zoom-in'
            } ${scale === 1 ? 'transition-all duration-300' : ''}`}
          onClick={handleImageClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          loading="eager"
          decoding="async"
          style={{
            transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
            transformOrigin: 'center center',
            touchAction: scale > 1 ? 'none' : 'auto',
          }}
        />

        {/* Prompt overlay */}
        {showPromptOverlay && (
          <div
            className="absolute inset-0 z-20"
            onClick={() => setShowPromptOverlay(false)}
          >
            <div
              className="absolute top-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-gray-600/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-relaxed break-words max-h-32 overflow-y-auto">
                    {image.prompt}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyPrompt}
                    className="w-6 h-6 p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                    title={t('tooltips.copyPromptToClipboard')}
                    data-testid="button-copy-prompt"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPromptOverlay(false)}
                    className="w-6 h-6 p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                    title={t('tooltips.closePromptOverlay')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gradient background for action buttons */}
        {showActions && (
          <div
            className={`absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 ${isMobile || showActionButtons ? 'opacity-100' : 'opacity-0'
              }`}
          />
        )}

        {/* Action buttons overlay - bottom of image */}
        {showActions && (
          <div
            className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 transition-all duration-300 w-full max-w-lg z-10 ${showActionButtons ? 'opacity-100 translate-y-0' : isMobile ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-center gap-0.5 px-2">
              {/* Upscale button */}
              <Button
                variant="ghost"
                onClick={() => setShowUpscaleModal(true)}
                className="flex items-center gap-1 px-1 py-1 bg-transparent hover:bg-transparent text-white/90 hover:text-white transition-all duration-200 text-[10px]"
                title={t('tooltips.upscaleImage') || 'Upscale image to higher resolution'}
                data-testid="button-upscale"
              >
                <ZoomIn className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">{t('actions.upscale')}</span>
              </Button>

              {/* Regenerate button */}
              <Button
                variant="ghost"
                onClick={handleVariation}
                className="flex items-center gap-1 px-1 py-1 bg-transparent hover:bg-transparent text-white/90 hover:text-white transition-all duration-200 text-[10px]"
                title={t('tooltips.regenerateImage')}
                data-testid="button-regenerate"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">{t('actions.regenerate')}</span>
              </Button>

              {/* Video button */}
              <Button
                variant="ghost"
                onClick={() => {
                  if (!image) return;

                  // Don't specify defaultModel - let the video form use the site's configured default
                  setReferenceImage({
                    url: image.url,
                    prompt: image.prompt
                  });

                  toast({
                    title: t('toasts.imageLoadedForVideo'),
                    description: t('toasts.imageReadyForVideo'),
                  });

                  navigate('/video-studio');
                }}
                className="flex items-center gap-1 px-1 py-1 bg-transparent hover:bg-transparent text-white/90 hover:text-white transition-all duration-200 text-[10px]"
                title={t('tooltips.generateVideo')}
                data-testid="button-generate-video"
              >
                <Video className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">{t('actions.video')}</span>
              </Button>

              <Button
                variant="ghost"
                onClick={handleUseImage}
                className="flex items-center gap-1 px-1 py-1 bg-transparent hover:bg-transparent text-white/90 hover:text-white transition-all duration-200 text-[10px]"
                title={t('gallery.use', 'Use Image')}
                data-testid="button-use-image-lightbox"
              >
                <ImagePlus className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">{t('gallery.use', 'Use Image')}</span>
              </Button>

            </div>
          </div>
        )}

        {/* Get Started button for unauthenticated users viewing public gallery */}
        {!showActions && !isAuthenticated && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2"
              data-testid="button-get-started-lightbox"
            >
              Get Started
            </Button>
          </div>
        )}
      </div>

      {/* Login Required Modal */}
      <LoginRequiredModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />

      {/* Upscale Modal */}
      {image && (
        <UpscaleModal
          open={showUpscaleModal}
          onOpenChange={setShowUpscaleModal}
          imageId={image.id}
          imageUrl={image.url}
          imageWidth={image.width || 1024}
          imageHeight={image.height || 1024}
          isPublic={image.isPublic}
        />
      )}
    </div>
  );
}
