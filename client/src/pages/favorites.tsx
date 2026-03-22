import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, ArrowDownToLine as Download, Play, Clapperboard as VideoIcon, Clipboard as Copy, Type, ImagePlus as ImageIcon, WandSparkles as Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Image, Video } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import GalleryToolbar from "@/components/gallery-toolbar";
import Lightbox from "@/components/lightbox";
import { FavoriteIndicator } from "@/components/favorite-indicator";
import { VideoFavoriteIndicator } from "@/components/video-favorite-indicator";
import { useBulkFavoriteStatus } from "@/hooks/useBulkFavoriteStatus";
import { useBulkVideoFavoriteStatus } from "@/hooks/useBulkVideoFavoriteStatus";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { useToast } from "@/hooks/use-toast";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { useVideoModelDisplayName } from "@/hooks/useVideoModelDisplayName";
import { usePromptStore } from "@/stores/prompt-store";
import { useVideoPromptStore } from "@/stores/video-prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { useLocation } from "wouter";
import { findBaseModelByVariantId } from "@shared/model-routing";
import Masonry from 'react-masonry-css';
import { useTranslation } from 'react-i18next';

// Combined content type for both images and videos
type ContentItem = (Image & { type: 'image' }) | (Video & { type: 'video' });

// Component for rendering both image and video favorites
function FavoriteContentCard({ 
  item, 
  user, 
  onSelect, 
  isFavorited 
}: { 
  item: ContentItem; 
  user: any; 
  onSelect: (item: ContentItem) => void; 
  isFavorited?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showVideo, setShowVideo] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const infoOpenRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { getDisplayName: getImageDisplayName } = useImageModelDisplayName();
  const { getDisplayName: getVideoDisplayName } = useVideoModelDisplayName();
  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);
  const setSelectedVideoPrompt = useVideoPromptStore(state => state.setSelectedVideoPrompt);
  const setSelectedVideoModel = useVideoPromptStore(state => state.setSelectedVideoModel);
  const setReferenceImage = useVideoStore(state => state.setReferenceImage);
  const minimalBadgeClass = "!rounded-md !border-white/20 !bg-black/40 !text-white/85 !px-2 !py-0.5 !text-[11px] !font-normal shadow-none";
  const actionIconButtonClass = "w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm flex items-center justify-center opacity-100 transition-all";

  useEffect(() => {
    infoOpenRef.current = infoOpen;
  }, [infoOpen]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (infoOpenRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setInfoOpen(false);
      return;
    }
    onSelect(item);
  }, [item, onSelect]);

  const handleCopyPrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.prompt);
    toast({
      title: t('toasts.copied'),
      description: t('toasts.promptCopied'),
    });
    setInfoOpen(false);
  }, [item.prompt, toast, t]);

  const handleUsePrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPrompt(item.prompt);
    setInfoOpen(false);
    toast({
      title: t('toasts.promptApplied', 'Prompt applied'),
      description: t('toasts.promptAppliedDescription', 'Prompt has been copied to the generation form'),
    });
    setLocation('/images');
  }, [item.prompt, setSelectedPrompt, toast, t, setLocation]);

  const handleUseImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'image' && item.url) {
      setSelectedImageReference({ url: item.url, id: item.id });
      if (item.prompt) {
        setSelectedPrompt(item.prompt);
      }
      setSelectedModel('nano-banana-pro');
      setOpenMobileForm(true);
      setInfoOpen(false);
      toast({
        title: t('toasts.imageReferenceApplied', 'Image reference applied'),
        description: t('toasts.imageReferenceAppliedDescription', 'Image has been added as a reference to the generation form'),
      });
      setLocation('/images');
    }
  }, [item, setSelectedImageReference, setSelectedPrompt, setSelectedModel, setOpenMobileForm, toast, t, setLocation]);

  const handleGenerateVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== 'image' || !item.url) return;

    setReferenceImage({
      url: item.url,
      prompt: item.prompt,
    });
    toast({
      title: t('toasts.imageLoadedForVideo'),
      description: t('toasts.imageReadyForVideo'),
    });
    setLocation('/video-studio');
  }, [item, setReferenceImage, toast, t, setLocation]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.url) return;
    const link = document.createElement('a');
    link.href = item.url;
    link.download = `${item.type}-${item.id}.${item.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [item]);

  const handleRegenerateVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'video') {
      setSelectedVideoPrompt(item.prompt);
      const variantLookup = findBaseModelByVariantId(item.model);
      const baseModelId = variantLookup?.baseModel.id || item.model;
      setSelectedVideoModel(baseModelId);
      if (item.startFrameUrl) {
        setReferenceImage({
          url: item.startFrameUrl,
          prompt: item.prompt,
          defaultModel: baseModelId,
        });
      }
      toast({
        title: t('toasts.videoSettingsApplied', 'Video settings applied'),
        description: t('toasts.videoSettingsAppliedDescription', 'Prompt and model have been applied to the video form'),
      });
      setLocation('/video-studio');
    }
  }, [item, setSelectedVideoPrompt, setSelectedVideoModel, setReferenceImage, toast, t, setLocation]);

  if (item.type === 'video') {
    // Get optimal thumbnail URL with proper fallback logic
    const getThumbnailUrl = () => {
      if (item.thumbnailUrl && !item.thumbnailUrl.includes('placeholder') && !thumbnailError) {
        return item.thumbnailUrl;
      }
      // Fallback to video URL - browser will show first frame
      return item.url;
    };

    // Get dynamic aspect ratio - prefer video metadata, fallback to stored data
    const getAspectRatio = () => {
      // Use video element's natural dimensions if available
      if (videoAspectRatio) {
        return videoAspectRatio;
      }
      // Fallback to stored metadata if valid
      if (item.width && item.height && item.width > 0 && item.height > 0) {
        return item.width / item.height;
      }
      // Final fallback
      return 16 / 9;
    };

    // Handle video metadata loaded
    const handleVideoMetadata = (video: HTMLVideoElement) => {
      if (video.videoWidth && video.videoHeight) {
        const actualAspectRatio = video.videoWidth / video.videoHeight;
        setVideoAspectRatio(actualAspectRatio);
        console.log(`Video ${item.id} natural dimensions: ${video.videoWidth}x${video.videoHeight}, aspect ratio: ${actualAspectRatio}`);
      }
    };

    const aspectRatio = getAspectRatio();

    return (
      <div 
        className="group bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-lg overflow-hidden"
        onClick={handleCardClick}
      >
        <div className="relative w-full overflow-hidden bg-gray-900">
            {showVideo && item.url ? (
              <video 
                ref={videoRef}
                src={item.url}
                controls
                autoPlay
                className="w-full h-auto object-contain rounded"
                poster={getThumbnailUrl()}
                onLoadedMetadata={(e) => {
                  const videoEl = e.target as HTMLVideoElement;
                  handleVideoMetadata(videoEl);
                }}
                onLoadedData={(e) => {
                  const videoEl = e.target as HTMLVideoElement;
                  videoEl.play().catch(() => {
                    console.log('Auto-play blocked by browser');
                  });
                }}
              />
            ) : (
              <div 
                className="relative w-full bg-gradient-to-br from-gray-800 to-gray-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVideo(true);
                }}
              >
                {/* Background preview - improved thumbnail logic */}
                {!thumbnailError && item.thumbnailUrl && !item.thumbnailUrl.includes('placeholder') ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.prompt}
                    className="w-full h-auto object-contain rounded"
                    onLoad={() => setThumbnailLoaded(true)}
                    onError={() => {
                      setThumbnailError(true);
                      setThumbnailLoaded(false);
                    }}
                    style={{ opacity: thumbnailLoaded ? 1 : 0 }}
                  />
                ) : item.url ? (
                  <video
                    src={item.url}
                    className="w-full h-auto object-contain rounded"
                    muted
                    preload="metadata"
                    poster=""
                    onLoadedMetadata={(e) => {
                      const videoEl = e.target as HTMLVideoElement;
                      handleVideoMetadata(videoEl);
                    }}
                  />
                ) : (
                  <div 
                    className="w-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center rounded"
                    style={{ aspectRatio: aspectRatio, minHeight: '200px' }}
                  >
                    <VideoIcon className="w-16 h-16 text-gray-500" />
                  </div>
                )}
                
                {/* Loading state for thumbnails */}
                {!thumbnailLoaded && !thumbnailError && item.thumbnailUrl && !item.thumbnailUrl.includes('placeholder') && (
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <div className="animate-pulse bg-gray-700 w-full h-32" />
                  </div>
                )}
                
                {/* Play overlay - Touch-friendly */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors duration-300">
                  <div className="w-12 h-12 md:w-11 md:h-11 min-w-0 min-h-0 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center hover:scale-105 transition-transform duration-300">
                    <Play className="w-5 h-5 md:w-4 md:h-4 text-white/95 ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons - Top Right */}
            <div dir="ltr" className="absolute top-2 right-2 flex items-center gap-1 z-30">
              {item.ownerId === user?.id && (
                <VisibilityToggle videoId={item.id} isPublic={item.isPublic} />
              )}
              <Popover open={infoOpen} onOpenChange={setInfoOpen} modal={false}>
                <PopoverTrigger asChild>
                  <button
                    className={actionIconButtonClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoOpen(prev => !prev);
                    }}
                    aria-label="Show info"
                    data-testid={`button-info-favorite-video-${item.id}`}
                  >
                    <Type className="w-4 h-4 text-white" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="bg-gray-900/95 text-white p-4 rounded-lg shadow-xl min-w-[280px] max-w-[320px] text-sm border border-gray-700"
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium break-words flex-1 max-h-32 overflow-y-auto">{item.prompt}</p>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={handleUsePrompt}
                        className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                        aria-label={t('accessibility.usePrompt', 'Use prompt')}
                        data-testid={`button-use-prompt-favorite-video-${item.id}`}
                      >
                        <Type className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCopyPrompt}
                        className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                        aria-label={t('accessibility.copyPrompt', 'Copy prompt')}
                        data-testid={`button-copy-prompt-favorite-video-${item.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-gray-300 text-xs">
                    <p>{item.width}x{item.height}</p>
                    <p>{getVideoDisplayName(item.model)}</p>
                    <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                </PopoverContent>
              </Popover>
              <button
                className={actionIconButtonClass}
                onClick={handleDownload}
                aria-label="Download"
                data-testid={`button-download-favorite-video-${item.id}`}
              >
                <Download className="w-4 h-4 text-white" />
              </button>
              <VideoFavoriteIndicator 
                videoId={item.id}
                initialFavorited={isFavorited}
                showAlways={true}
                className="bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full"
              />
            </div>

            {/* Bottom row - badges and regenerate */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                {item.ownerId === user?.id ? (
                  <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.yours')}</Badge>
                ) : (
                  <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.community')}</Badge>
                )}
                {!item.isPublic && (
                  <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.private')}</Badge>
                )}
              </div>
              <button
                className={actionIconButtonClass}
                onClick={handleRegenerateVideo}
                aria-label={t('accessibility.regenerateVideo', 'Regenerate video')}
                data-testid={`button-regenerate-favorite-video-${item.id}`}
                title={t('accessibility.regenerateVideo', 'Regenerate video')}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
      </div>
    );
  }

  // Image card
  return (
    <div 
      className="group bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-lg overflow-hidden"
      onClick={handleCardClick}
    >
      <div className="p-0">
        <div className="relative w-full overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800/50 rounded-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/30 to-transparent skeleton-shimmer" />
            </div>
          )}
          <img
            src={item.thumbnailUrl || item.url}
            alt={item.prompt}
            className={`w-full h-auto object-contain rounded transition-all duration-300 ${
              imageLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* Action Buttons - Top Right */}
          <div dir="ltr" className="absolute top-2 right-2 flex items-center gap-1 z-30">
            {item.ownerId === user?.id && (
              <VisibilityToggle imageId={item.id} isPublic={item.isPublic} />
            )}
            <Popover open={infoOpen} onOpenChange={setInfoOpen} modal={false}>
              <PopoverTrigger asChild>
                <button
                  className={actionIconButtonClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpen(prev => !prev);
                  }}
                  aria-label="Show info"
                  data-testid={`button-info-favorite-image-${item.id}`}
                >
                  <Type className="w-4 h-4 text-white" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="bg-gray-900/95 text-white p-4 rounded-lg shadow-xl min-w-[280px] max-w-[320px] text-sm border border-gray-700"
                align="end"
                side="bottom"
                sideOffset={8}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium break-words flex-1 max-h-32 overflow-y-auto">{item.prompt}</p>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={handleUsePrompt}
                      className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                      aria-label={t('accessibility.usePrompt', 'Use prompt')}
                      data-testid={`button-use-prompt-favorite-image-${item.id}`}
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyPrompt}
                      className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                      aria-label={t('accessibility.copyPrompt', 'Copy prompt')}
                      data-testid={`button-copy-prompt-favorite-image-${item.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-gray-300 text-xs">
                  <p>{item.width}x{item.height}</p>
                  <p>{getImageDisplayName(item.model)}</p>
                  <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </PopoverContent>
            </Popover>
            <button
              className={actionIconButtonClass}
              onClick={handleDownload}
              aria-label="Download"
              data-testid={`button-download-favorite-image-${item.id}`}
            >
              <Download className="w-4 h-4 text-white" />
            </button>
            <FavoriteIndicator 
              imageId={item.id}
              initialFavorited={isFavorited}
              showAlways={true}
              className="bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full"
            />
          </div>

          {/* Bottom row - badges and image actions */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              {item.ownerId === user?.id ? (
                <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.yours')}</Badge>
              ) : (
                <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.community')}</Badge>
              )}
              {!item.isPublic && (
                <Badge variant="outline" className={minimalBadgeClass}>{t('pages.favorites.private')}</Badge>
              )}
            </div>
            <div dir="ltr" className="flex items-center gap-1">
              <button
                className={actionIconButtonClass}
                onClick={handleUseImage}
                aria-label={t('accessibility.useImage', 'Use image')}
                data-testid={`button-use-image-favorite-${item.id}`}
                title={t('accessibility.useImage', 'Use image')}
              >
                <ImageIcon className="w-4 h-4 text-white" />
              </button>
              <button
                className={actionIconButtonClass}
                onClick={handleGenerateVideo}
                aria-label={t('tooltips.generateVideo', 'Generate video')}
                data-testid={`button-generate-video-favorite-${item.id}`}
                title={t('tooltips.generateVideo', 'Generate video')}
              >
                <VideoIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Video Modal Component
function VideoModal({ 
  video, 
  isOpen, 
  onClose 
}: { 
  video: Video | null; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [modalAspectRatio, setModalAspectRatio] = useState<number | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen || !video) return null;

  // Get dynamic aspect ratio for modal
  const getModalAspectRatio = () => {
    // Use video element's natural dimensions if available
    if (modalAspectRatio) {
      return modalAspectRatio;
    }
    // Fallback to stored metadata if valid
    if (video.width && video.height && video.width > 0 && video.height > 0) {
      return video.width / video.height;
    }
    // Final fallback
    return 16 / 9;
  };

  // Handle video metadata loaded for modal
  const handleModalVideoMetadata = (videoEl: HTMLVideoElement) => {
    if (videoEl.videoWidth && videoEl.videoHeight) {
      const actualAspectRatio = videoEl.videoWidth / videoEl.videoHeight;
      setModalAspectRatio(actualAspectRatio);
      console.log(`Modal video ${video.id} natural dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}, aspect ratio: ${actualAspectRatio}`);
    }
  };

  const aspectRatio = getModalAspectRatio();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxModalWidth = Math.min(viewportWidth * 0.9, 1200);
  const maxModalHeight = viewportHeight * 0.9;

  // Calculate optimal dimensions while preserving aspect ratio
  let modalWidth = maxModalWidth;
  let modalHeight = modalWidth / aspectRatio;

  if (modalHeight > maxModalHeight) {
    modalHeight = maxModalHeight;
    modalWidth = modalHeight * aspectRatio;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div 
        className="relative bg-black rounded-lg overflow-hidden" 
        style={{ 
          width: `${modalWidth}px`, 
          height: `${modalHeight}px`,
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
          size="sm"
        >
          ×
        </Button>
        
        {video.url ? (
          <video 
            ref={modalVideoRef}
            src={video.url}
            controls
            autoPlay
            className="w-full h-full object-contain"
            poster={video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder') ? video.thumbnailUrl : video.url}
            style={{ aspectRatio: aspectRatio }}
            onLoadedMetadata={(e) => {
              const videoEl = e.target as HTMLVideoElement;
              handleModalVideoMetadata(videoEl);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <VideoIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <p className="text-white">Video not available</p>
            </div>
          </div>
        )}

        {/* Video info overlay */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-4">
          <p className="text-white font-medium mb-2">{video.prompt}</p>
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>{video.width}×{video.height}</span>
            <span>{video.model}</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Favorites() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [contentType, setContentType] = useState("all"); // New filter for content type
  const [sortBy, setSortBy] = useState("newest");
  const [isFavorited, setIsFavorited] = useState(false);

  // Masonry breakpoint configuration - Mobile optimized
  const breakpointColumnsObj = {
    default: 4,
    1280: 3,
    1024: 2,
    640: 1,
  };

  // Fetch user's favorite images
  const { data: favoriteImages = [], isLoading: imagesLoading } = useQuery<Image[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  // Fetch user's favorite videos  
  const { data: favoriteVideos = [], isLoading: videosLoading } = useQuery<Video[]>({
    queryKey: ["/api/videos/favorites"], 
    enabled: isAuthenticated,
  });

  const isLoading = imagesLoading || videosLoading;

  // Memoized IDs for bulk favorite status checking
  const imageIds = useMemo(() => {
    return favoriteImages.map(img => img.id).sort((a, b) => a - b);
  }, [favoriteImages]);
  
  const videoIds = useMemo(() => {
    return favoriteVideos.map(video => video.id).sort((a, b) => a - b);
  }, [favoriteVideos]);
  
  const { data: bulkFavoriteStatus = {} } = useBulkFavoriteStatus(imageIds);
  const { data: bulkVideoFavoriteStatus = {} } = useBulkVideoFavoriteStatus(videoIds);

  // Combine images and videos into unified content array
  const allFavorites: ContentItem[] = useMemo(() => {
    const images: ContentItem[] = favoriteImages.map(img => ({ ...img, type: 'image' as const }));
    const videos: ContentItem[] = favoriteVideos.map(video => ({ ...video, type: 'video' as const }));
    return [...images, ...videos];
  }, [favoriteImages, favoriteVideos]);

  // Update isFavorited when selectedImage changes - use bulk data
  useEffect(() => {
    if (selectedImage && bulkFavoriteStatus) {
      setIsFavorited(bulkFavoriteStatus[selectedImage.id] || false);
    }
  }, [selectedImage, bulkFavoriteStatus]);

  const filteredFavorites = useMemo(() => {
    return allFavorites
      .filter((item: ContentItem) => {
        // Search filter
        const matchesSearch = !searchQuery || 
          item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));

        // Ownership filter
        const matchesOwnership = filterBy === "all" || 
          (filterBy === "mine" && item.ownerId === user?.id) ||
          (filterBy === "others" && item.ownerId !== user?.id);

        // Content type filter
        const matchesContentType = contentType === "all" || 
          (contentType === "images" && item.type === "image") ||
          (contentType === "videos" && item.type === "video");

        return matchesSearch && matchesOwnership && matchesContentType;
      })
      .sort((a: ContentItem, b: ContentItem) => {
        switch (sortBy) {
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "prompt":
            return a.prompt.localeCompare(b.prompt);
          case "newest":
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [allFavorites, searchQuery, filterBy, contentType, sortBy, user?.id]);

  const executeSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleClearAll = () => {
    setSearchInput("");
    setSearchQuery("");
    setContentType("all");
    setFilterBy("all");
    setSortBy("newest");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">{t('pages.favorites.pleaseLogIn')}</h1>
          <p className="text-gray-300">{t('pages.favorites.needToBeLoggedIn')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#21B0F8] to-[#21B0F8] bg-clip-text text-transparent mb-4">
            {t('pages.favorites.title')}
          </h1>
          <p className="text-gray-300 text-lg">
            {t('pages.favorites.description')}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <GalleryToolbar
            searchPlaceholder={t("pages.favorites.searchPlaceholder")}
            searchValue={searchQuery}
            searchDraftValue={searchInput}
            onSearchDraftChange={setSearchInput}
            onSearchCommit={executeSearch}
            toggles={[]}
            activeToggleIds={[]}
            onToggleChange={() => {}}
            sortValue={sortBy}
            sortOptions={[
              { value: "newest", label: t("pages.favorites.newestFirst") },
              { value: "oldest", label: t("pages.favorites.oldestFirst") },
              { value: "prompt", label: t("pages.favorites.byPrompt") },
            ]}
            onSortChange={setSortBy}
            extraSelects={[
              {
                id: "contentType",
                label: t("pages.favorites.allContent"),
                value: contentType,
                options: [
                  { value: "all", label: t("pages.favorites.allContent") },
                  { value: "images", label: t("pages.favorites.imagesOnly") },
                  { value: "videos", label: t("pages.favorites.videosOnly") },
                ],
              },
              {
                id: "filterBy",
                label: t("pages.favorites.allFavorites"),
                value: filterBy,
                options: [
                  { value: "all", label: t("pages.favorites.allFavorites") },
                  { value: "mine", label: t("pages.favorites.myContent") },
                  { value: "others", label: t("pages.favorites.fromOthers") },
                ],
              },
            ]}
            onExtraSelectChange={(id, value) => {
              if (id === "contentType") {
                setContentType(value);
              }
              if (id === "filterBy") {
                setFilterBy(value);
              }
            }}
            countLabel={
              isLoading
                ? t("common.loading")
                : filteredFavorites.length === 1
                  ? t("pages.favorites.favoriteCount", { count: filteredFavorites.length })
                  : t("pages.favorites.favoriteCount_plural", { count: filteredFavorites.length })
            }
            onClearAll={handleClearAll}
            isMobile={isMobile}
          />
        </div>

        {/* Gallery */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700 animate-pulse">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gray-700 rounded-t-lg" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-700 rounded" />
                    <div className="h-3 bg-gray-700 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allFavorites.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="text-center py-12">
              <Heart className="w-16 h-16 mx-auto mb-4 text-red-400 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">{t('pages.favorites.noFavoritesYet')}</h3>
              <p className="text-gray-400 mb-4">
                {t('pages.favorites.startExploring')}
              </p>
            </CardContent>
          </Card>
        ) : filteredFavorites.length > 0 ? (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="flex w-auto gap-6"
            columnClassName="space-y-6"
          >
            {filteredFavorites.map((item) => (
              <FavoriteContentCard 
                key={`${item.type}-${item.id}`}
                item={item}
                user={user}
                onSelect={(selectedItem: ContentItem) => {
                  if (selectedItem.type === 'image') {
                    setSelectedImage(selectedItem as Image);
                  } else {
                    setSelectedVideo(selectedItem as Video);
                  }
                }}
                isFavorited={item.type === 'image' ? bulkFavoriteStatus[item.id] : bulkVideoFavoriteStatus[item.id]}
              />
            ))}
          </Masonry>
        ) : (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-medium mb-2">{t('pages.favorites.noMatchingFavorites')}</h3>
            <p className="text-gray-400 mb-4">
              {t('pages.favorites.adjustFilters')}
            </p>
          </div>
        )}
      </div>
      {/* Lightbox Modal */}
      {selectedImage && (
        <Lightbox
          image={{
            id: selectedImage.id,
            url: selectedImage.url,
            prompt: selectedImage.prompt,
            ownerId: selectedImage.ownerId,
            ownerName: (selectedImage as any).ownerName,
            isPublic: selectedImage.isPublic,
            quality: selectedImage.quality,
            style: selectedImage.style,
            width: selectedImage.width,
            height: selectedImage.height,
            styleImageUrl: selectedImage.styleImageUrl ?? undefined,
            imageStrength: selectedImage.imageStrength ?? undefined,
            aspectRatio: selectedImage.aspectRatio ?? undefined,
            provider: selectedImage.provider ?? undefined
          }}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          showActions={true}
          isFavorited={isFavorited}
          onFavoriteToggle={(imageId, newIsFavorited) => {
            setIsFavorited(newIsFavorited);
          }}
          isOwner={user?.id === selectedImage.ownerId}
          images={filteredFavorites.filter(item => item.type === 'image').map((img: ContentItem) => ({
            id: img.id,
            url: img.url,
            prompt: img.prompt,
            ownerId: img.ownerId,
            ownerName: (img as any).ownerName,
            isPublic: img.isPublic,
            quality: (img as any).quality || 'standard',
            style: img.style,
            width: img.width,
            height: img.height,
            styleImageUrl: (img as Image).styleImageUrl ?? undefined,
            imageStrength: (img as Image).imageStrength ?? undefined,
            aspectRatio: (img as Image).aspectRatio ?? undefined,
            provider: (img as Image).provider ?? undefined
          }))}
          currentIndex={filteredFavorites.filter(item => item.type === 'image').findIndex((img: ContentItem) => img.id === selectedImage.id)}
          onNavigate={(newIndex) => {
            const imageItems = filteredFavorites.filter(item => item.type === 'image');
            const newImage = imageItems[newIndex];
            if (newImage) {
              setSelectedImage(newImage as Image);
            }
          }}
        />
      )}
      
      {/* Video Modal */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
