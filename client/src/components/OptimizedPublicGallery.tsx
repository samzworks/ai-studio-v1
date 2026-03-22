import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Heart, ArrowDownToLine as Download, Play, Eye, EyeOff, Maximize2, Clipboard as Copy, Star, Type, ImageIcon, Clapperboard as VideoIcon, WandSparkles as Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ModelConfig } from "./model-selector";
import { useVideoModelDisplayName } from "@/hooks/useVideoModelDisplayName";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { usePromptStore } from "@/stores/prompt-store";
import { useVideoPromptStore } from "@/stores/video-prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { useLocation } from "wouter";
import Masonry from 'react-masonry-css';
import { findBaseModelByVariantId } from "@shared/model-routing";

interface MediaAsset {
  id: number;
  type: 'image' | 'video';
  url: string | null;
  thumbnailUrl?: string | null;
  prompt: string;
  width: number;
  height: number;
  model?: string;
  ownerId: string;
  ownerName?: string;
  isPublic: boolean;
  createdAt: string;
  duration?: number;
  aspectRatio?: string;
  startFrameUrl?: string;
  tags?: string[];
  isFeatured?: boolean;
  isStickyTop?: boolean;
}

interface OptimizedPublicGalleryProps {
  assets: MediaAsset[];
  favoriteStatus: Record<number, boolean>;
  onAssetClick?: (asset: MediaAsset) => void;
  onFavoriteToggle?: (asset: MediaAsset, isFavorited: boolean) => void;
}

// Media Card Component
function MediaCard({ 
  asset, 
  isFavorited, 
  onFavoriteToggle,
  onClick,
  models,
  isFeatured
}: {
  asset: MediaAsset;
  isFavorited: boolean;
  onFavoriteToggle: (isFavorited: boolean) => void;
  onClick: () => void;
  models?: ModelConfig[];
  isFeatured?: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const infoTooltipRef = useRef<HTMLDivElement>(null);
  const { getDisplayName: getVideoDisplayName } = useVideoModelDisplayName();
  const { getDisplayName: getImageDisplayName } = useImageModelDisplayName();
  const [, setLocation] = useLocation();
  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);
  const setSelectedVideoPrompt = useVideoPromptStore(state => state.setSelectedVideoPrompt);
  const setSelectedVideoModel = useVideoPromptStore(state => state.setSelectedVideoModel);
  const setReferenceImage = useVideoStore(state => state.setReferenceImage);
  const minimalBadgeClass = "bg-black/40 text-white/85 border border-white/20 px-2 py-0.5 rounded-md text-[11px] font-normal shadow-none";
  const actionChipClass = "bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm";
  
  // Calculate aspect ratio for proper sizing
  const aspectRatio = asset.width / asset.height;

  // Handle video playback
  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.type !== 'video' || !videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {
        console.log('Autoplay prevented');
      });
      setIsPlaying(true);
    }
  }, [asset.type, isPlaying]);

  // Handle download
  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!asset.url) return;

    const link = document.createElement('a');
    link.href = asset.url;
    link.download = `${asset.type}-${asset.id}.${asset.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t('toasts.downloadStarted'),
      description: t('toasts.downloadDescription')
    });
  }, [asset, toast, t]);

  // Handle favorite toggle
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const endpoint = asset.type === 'video' 
        ? `/api/videos/${asset.id}/favorite`
        : `/api/images/${asset.id}/favorite`;
      
      return apiRequest('PATCH', endpoint);
    },
    onMutate: async () => {
      // Optimistic update - toggle the current state
      onFavoriteToggle(!isFavorited);
    },
    onSuccess: () => {
      // Comprehensive cache invalidation to ensure synchronization across all pages
      if (asset.type === 'video') {
        // Invalidate individual video favorite status
        queryClient.invalidateQueries({ queryKey: [`/api/videos/${asset.id}/favorite-status`] });
        // Invalidate bulk video favorite status queries (matches all query keys that start with this)
        queryClient.invalidateQueries({ queryKey: ["/api/videos/bulk-favorite-status"] });
        // Invalidate video favorites list
        queryClient.invalidateQueries({ queryKey: ["/api/videos/favorites"] });
        // Invalidate general videos queries
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        // Invalidate public videos queries  
        queryClient.invalidateQueries({ queryKey: ["/api/videos/public"] });
      } else {
        // Invalidate individual image favorite status
        queryClient.invalidateQueries({ queryKey: [`/api/images/${asset.id}/favorite-status`] });
        // Invalidate bulk image favorite status queries (matches all query keys that start with this)
        queryClient.invalidateQueries({ queryKey: ["/api/images/bulk-favorite-status"] });
        // Invalidate image favorites list
        queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
        // Invalidate general images queries
        queryClient.invalidateQueries({ queryKey: ["/api/images"] });
        // Invalidate public images queries
        queryClient.invalidateQueries({ queryKey: ["/api/images/public"] });
      }
    },
    onError: (error) => {
      // Revert on error
      onFavoriteToggle(!isFavorited);
      toast({
        title: t('toasts.error'),
        description: t('toasts.failedToUpdateFavoriteStatus'),
        variant: "destructive"
      });
    }
  });

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({
        title: t('toasts.unauthorized'),
        description: t('toasts.pleaseSignInToFavorite')
      });
      return;
    }
    favoriteMutation.mutate();
  }, [isAuthenticated, isFavorited, favoriteMutation, toast, t]);

  // Handle info tooltip
  const handleInfoToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  }, [showInfo]);

  // Handle copy prompt
  const handleCopyPrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(asset.prompt).then(() => {
      toast({
        title: "Copied!",
        description: "Prompt copied to clipboard"
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy prompt",
        variant: "destructive"
      });
    });
  }, [asset.prompt, toast]);

  // Handle use prompt - sets prompt and navigates to images page
  const handleUsePrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPrompt(asset.prompt);
    setShowInfo(false);
    toast({
      title: t('toasts.promptApplied', 'Prompt applied'),
      description: t('toasts.promptAppliedDescription', 'Prompt has been copied to the generation form'),
    });
    setLocation('/images');
  }, [asset.prompt, setSelectedPrompt, toast, t, setLocation]);

  // Handle use image - sets image reference, prompt, model, and navigates to images page
  const handleUseImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.type === 'image' && asset.url) {
      setSelectedImageReference({ url: asset.url, id: asset.id });
      if (asset.prompt) {
        setSelectedPrompt(asset.prompt);
      }
      setSelectedModel('nano-banana-pro');
      setOpenMobileForm(true);
      setShowInfo(false);
      toast({
        title: t('toasts.imageReferenceApplied', 'Image reference applied'),
        description: t('toasts.imageReferenceAppliedDescription', 'Image has been added as a reference to the generation form'),
      });
      setLocation('/images');
    }
  }, [asset, setSelectedImageReference, setSelectedPrompt, setSelectedModel, setOpenMobileForm, toast, t, setLocation]);

  const handleGenerateVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.type !== 'image' || !asset.url) return;

    setReferenceImage({
      url: asset.url,
      prompt: asset.prompt,
    });
    toast({
      title: t('toasts.imageLoadedForVideo'),
      description: t('toasts.imageReadyForVideo'),
    });
    setLocation('/video-studio');
  }, [asset, setReferenceImage, toast, t, setLocation]);

  // Handle regenerate video - apply prompt/model and navigate to video studio
  const handleRegenerateVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.type !== 'video') return;

    setSelectedVideoPrompt(asset.prompt);

    // Extract base model ID from variant ID (e.g., "wan-2.2-t2v-fast" -> "wan-2.2")
    const variantLookup = asset.model ? findBaseModelByVariantId(asset.model) : null;
    const baseModelId = variantLookup?.baseModel.id || asset.model || 'wan-2.2';
    setSelectedVideoModel(baseModelId);

    if (asset.startFrameUrl) {
      setReferenceImage({
        url: asset.startFrameUrl,
        prompt: asset.prompt,
        defaultModel: baseModelId,
      });
    }

    toast({
      title: t('toasts.videoSettingsApplied', 'Video settings applied'),
      description: t('toasts.videoSettingsAppliedDescription', 'Prompt and model have been applied to the video form'),
    });
    setLocation('/video-studio');
  }, [asset, setSelectedVideoPrompt, setSelectedVideoModel, setReferenceImage, toast, t, setLocation]);

  // Close info tooltip when clicking outside
  useEffect(() => {
    if (!showInfo) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isClickInsideButton = infoButtonRef.current?.contains(target);
      const isClickInsideTooltip = infoTooltipRef.current?.contains(target);
      
      if (!isClickInsideButton && !isClickInsideTooltip) {
        setShowInfo(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showInfo]);

  // Get model display name from centralized hooks
  const getModelName = () => {
    if (asset.model) {
      if (asset.type === 'video') {
        return getVideoDisplayName(asset.model);
      } else {
        return getImageDisplayName(asset.model);
      }
    }
    return asset.type === 'video' ? 'Video Model' : 'Image Model';
  };

  // Handle card click - close info box if open, otherwise open lightbox
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (showInfo) {
      // If info box is open, close it and don't open lightbox
      setShowInfo(false);
      e.stopPropagation();
      return;
    }
    // Otherwise, open the lightbox
    onClick();
  }, [showInfo, onClick]);

  return (
    <div 
      ref={cardRef}
      className={`group bg-gray-800/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-lg overflow-hidden relative ${
        isFeatured 
          ? 'border-2 border-amber-400/70 shadow-[0_0_15px_rgba(251,191,36,0.3)]' 
          : 'border border-gray-700 hover:border-gray-600'
      }`}
      onClick={handleCardClick}
    >
      {isFeatured && (
        <div className={`absolute top-2 left-2 z-20 inline-flex items-center gap-1 ${minimalBadgeClass}`}>
          <Star className="w-3 h-3" />
          <span>{t('gallery.featured')}</span>
        </div>
      )}
      <div className="p-0">
        {/* Media Container - Natural sizing */}
        <div className="relative w-full overflow-hidden">
        {asset.type === 'video' ? (
          <>
            {/* Video element with dynamic aspect ratio - use stored dimensions for immediate layout */}
            <video
              ref={videoRef}
              src={asset.url || undefined}
              className="w-full h-auto block"
              style={{ 
                aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : undefined,
                objectFit: 'contain',
                backgroundColor: '#000'
              }}
              poster={asset.thumbnailUrl || undefined}
              preload="metadata"
              loop
              muted
              playsInline
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                video.currentTime = 0.1;
              }}
            />
            
            {/* Play/Pause Overlay - Touch-friendly */}
            {!isPlaying && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                onClick={handlePlayPause}
                data-testid="button-video-play"
              >
                <div className="w-12 h-12 md:w-11 md:h-11 min-w-0 min-h-0 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center hover:scale-105 transition-transform">
                  <Play className="w-5 h-5 md:w-4 md:h-4 text-white/95 ml-0.5" fill="currentColor" />
                </div>
              </div>
            )}
            
            {/* Duration Badge */}
            {asset.duration && (
              <div className={`absolute top-2 left-2 ${minimalBadgeClass} pointer-events-none`}>
                {Math.floor(asset.duration)}s
              </div>
            )}
          </>
        ) : (
          /* Image with aspect-ratio to prevent CLS and fade-in on load */
          <div 
            className="relative w-full bg-gray-700/30"
            style={{ aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : '1 / 1' }}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700/50 to-gray-800/50 animate-pulse" />
            )}
            <img
              src={asset.thumbnailUrl || asset.url || ''}
              alt={asset.prompt}
              width={asset.width}
              height={asset.height}
              decoding="async"
              className={`w-full h-full object-cover rounded group-hover:scale-105 transition-all duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        )}

        {/* Action Buttons - Top Right, Mobile-friendly */}
      <div dir="ltr" className="absolute top-2 sm:top-3 right-2 sm:right-3 flex items-center gap-1 z-10">
        {/* Info Button - Always visible on mobile */}
        <button
          ref={infoButtonRef}
          className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full ${actionChipClass} flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all`}
          onClick={handleInfoToggle}
          aria-label="Show info"
          data-testid="button-media-info"
        >
          <Type className="w-4 h-4 text-white" />
        </button>

        {/* Download Button - Always visible on mobile */}
        <button
          className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full ${actionChipClass} flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all`}
          onClick={handleDownload}
          aria-label="Download"
          data-testid="button-media-download"
        >
          <Download className="w-4 h-4 text-white" />
        </button>

        {/* Favorite Button - always available for images; auth-gated for videos */}
        {(asset.type === 'image' || isAuthenticated) && (
          <button
            className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full flex items-center justify-center transition-all ${actionChipClass} opacity-100 md:opacity-0 md:group-hover:opacity-100`}
            onClick={handleFavorite}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            data-testid="button-media-favorite"
          >
            <Heart 
              className={`w-4 h-4 ${isFavorited ? 'text-red-400 fill-current' : 'text-white'}`} 
            />
          </button>
        )}
      </div>

        {/* Image action buttons - Bottom Right for images only */}
        {asset.type === 'image' && (
          <div dir="ltr" className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
            <button
              className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full ${actionChipClass} flex items-center justify-center`}
              onClick={handleUseImage}
              aria-label={t('accessibility.useImage', 'Use image')}
              data-testid="button-use-image"
              title={t('accessibility.useImage', 'Use image')}
            >
              <ImageIcon className="w-4 h-4 text-white" />
            </button>
            <button
              className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full ${actionChipClass} flex items-center justify-center`}
              onClick={handleGenerateVideo}
              aria-label={t('tooltips.generateVideo', 'Generate video')}
              data-testid="button-generate-video-image"
              title={t('tooltips.generateVideo', 'Generate video')}
            >
              <VideoIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Regenerate Video Button - Bottom Right for videos */}
        {asset.type === 'video' && (
          <button
            className={`absolute bottom-2 sm:bottom-3 right-2 sm:right-3 w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full ${actionChipClass} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10`}
            onClick={handleRegenerateVideo}
            aria-label={t('accessibility.regenerateVideo', 'Regenerate video')}
            data-testid="button-regenerate-video"
            title={t('accessibility.regenerateVideo', 'Regenerate video')}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Info Tooltip - Mobile-friendly positioning */}
        {showInfo && (
          <div 
            ref={infoTooltipRef}
            className="absolute z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl max-w-sm w-[90vw] md:w-auto pointer-events-auto"
            style={{
              top: '48px',
              right: '16px',
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm md:text-sm break-words flex-1 max-h-32 overflow-y-auto">{asset.prompt}</p>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={handleUsePrompt}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  aria-label={t('accessibility.usePrompt', 'Use prompt')}
                  data-testid="button-use-prompt"
                  title={t('accessibility.usePrompt', 'Use prompt')}
                >
                  <Type className="w-4 h-4 text-gray-300" />
                </button>
                <button
                  onClick={handleCopyPrompt}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  aria-label="Copy prompt"
                  data-testid="button-copy-prompt"
                >
                  <Copy className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-gray-300">{getModelName()}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// Masonry breakpoint columns matching history page
const breakpointColumnsObj = {
  default: 4,
  1280: 3,
  1024: 2,
  640: 1,
};

// Main Gallery Component
export function OptimizedPublicGallery({ 
  assets, 
  favoriteStatus,
  onAssetClick,
  onFavoriteToggle 
}: OptimizedPublicGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localFavorites, setLocalFavorites] = useState(favoriteStatus);

  // Fetch available models to get admin-configured display names
  // Handle errors gracefully to avoid toasts for anonymous users
  const { data: models } = useQuery<ModelConfig[]>({
    queryKey: ["/api/models"],
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch('/api/models', {
          credentials: 'include',
        });
        
        // Return empty array on any non-2xx response (no toasts)
        if (!res.ok) {
          console.debug(`Failed to fetch models (${res.status}), using fallbacks`);
          return [];
        }
        
        return await res.json();
      } catch (err) {
        console.debug('Failed to fetch models (network error), using fallbacks:', err);
        return [];
      }
    },
  });

  // Update local favorites when prop changes
  useEffect(() => {
    setLocalFavorites(favoriteStatus);
  }, [favoriteStatus]);

  // Handle local favorite toggle
  const handleFavoriteToggle = useCallback((asset: MediaAsset, isFavorited: boolean) => {
    setLocalFavorites(prev => ({
      ...prev,
      [asset.id]: isFavorited
    }));
    onFavoriteToggle?.(asset, isFavorited);
  }, [onFavoriteToggle]);

  return (
    <div ref={containerRef} className="w-full">
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex -ml-6 w-auto"
        columnClassName="pl-6 bg-clip-padding"
      >
        {assets.map((asset) => (
          <div key={`${asset.type}-${asset.id}`} className="mb-6">
            <MediaCard
              asset={asset}
              isFavorited={localFavorites[asset.id] || false}
              onFavoriteToggle={(isFavorited) => handleFavoriteToggle(asset, isFavorited)}
              onClick={() => onAssetClick?.(asset)}
              models={models}
              isFeatured={asset.isFeatured}
            />
          </div>
        ))}
      </Masonry>
    </div>
  );
}

