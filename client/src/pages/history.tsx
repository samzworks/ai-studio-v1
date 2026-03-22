import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, ImagePlus as ImageIcon, Images as GalleryIcon, Clapperboard as VideoIcon, Heart, ArrowDownToLine as Download, Clipboard as Copy, Play, Type, WandSparkles as Sparkles } from "lucide-react";
import { usePromptStore } from "@/stores/prompt-store";
import { useVideoPromptStore } from "@/stores/video-prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { findBaseModelByVariantId } from "@shared/model-routing";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Image, Video } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import Lightbox from "@/components/lightbox";
import GalleryToolbar from "@/components/gallery-toolbar";
import { FavoriteIndicator } from "@/components/favorite-indicator";
import { VideoFavoriteIndicator } from "@/components/video-favorite-indicator";
import Masonry from 'react-masonry-css';
import { useTranslation } from 'react-i18next';
import { MasonryGallerySkeleton } from "@/components/GallerySkeleton";
import { useToast } from "@/hooks/use-toast";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { useVideoModelDisplayName } from "@/hooks/useVideoModelDisplayName";
import { useUpscaleJobs } from "@/hooks/useUpscaleJobs";
import { UpscaleProgressCard } from "@/components/upscale-progress-card";
import { VisibilityToggle } from "@/components/visibility-toggle";

// Combined content type for both images and videos with favorite status
type HistoryItem = (Image & { type: 'image'; isFavorited: boolean }) | (Video & { type: 'video'; isFavorited: boolean });

// Fallback placeholder for videos with no thumbnail/url - triggers imageLoaded on mount
function FallbackVideoPlaceholder({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center rounded">
      <VideoIcon className="w-16 h-16 text-gray-500" />
    </div>
  );
}

// Component for rendering both image and video history items
function HistoryContentCard({ 
  item, 
  user, 
  onSelect 
}: { 
  item: HistoryItem; 
  user: any; 
  onSelect: (item: HistoryItem) => void; 
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showVideo, setShowVideo] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sourceImageLightbox, setSourceImageLightbox] = useState<string | null>(null);
  const infoOpenRef = useRef(false);
  const { getDisplayName: getImageDisplayName } = useImageModelDisplayName();
  const { getDisplayName: getVideoDisplayName } = useVideoModelDisplayName();
  const [, setLocation] = useLocation();
  const setSelectedPrompt = usePromptStore(state => state.setSelectedPrompt);
  const setSelectedImageReference = usePromptStore(state => state.setSelectedImageReference);
  const setSelectedModel = usePromptStore(state => state.setSelectedModel);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);
  const setSelectedVideoPrompt = useVideoPromptStore(state => state.setSelectedVideoPrompt);
  const setSelectedVideoModel = useVideoPromptStore(state => state.setSelectedVideoModel);
  const setReferenceImage = useVideoStore(state => state.setReferenceImage);
  const minimalBadgeClass = "!rounded-md !border-white/20 !bg-black/40 !text-white/85 !px-2 !py-0.5 !text-[11px] !font-normal shadow-none";
  const actionIconButtonClass = "w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm flex items-center justify-center opacity-100 transition-all";
  
  // Keep ref in sync with state
  useEffect(() => {
    infoOpenRef.current = infoOpen;
  }, [infoOpen]);
  
  // Handle copy prompt
  const handleCopyPrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.prompt);
    toast({
      title: "Prompt copied!",
      description: "The prompt has been copied to your clipboard"
    });
    setInfoOpen(false);
  }, [item.prompt, toast]);

  // Handle use prompt - sets prompt and navigates to images page
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

  // Handle use image - sets image reference, prompt, model, and navigates to images page
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
  
  // Handle download - matches public gallery implementation
  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.url) return;

    const link = document.createElement('a');
    link.href = item.url;
    link.download = `${item.type}-${item.id}.${item.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t('toasts.downloadStarted'),
      description: t('toasts.downloadDescription')
    });
  }, [item, toast, t]);

  // Handle regenerate video - sets video prompt, model, and reference image, navigates to video studio
  const handleRegenerateVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'video') {
      setSelectedVideoPrompt(item.prompt);
      
      // Extract base model ID from variant ID (e.g., "wan-2.2-t2v-fast" -> "wan-2.2")
      const variantLookup = findBaseModelByVariantId(item.model);
      const baseModelId = variantLookup?.baseModel.id || item.model;
      setSelectedVideoModel(baseModelId);
      
      // Set reference image if available
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

  // Handle card click - prevent opening lightbox if info popover is open
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (infoOpenRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setInfoOpen(false);
      return;
    }
    onSelect(item);
  }, [item, onSelect]);

  if (item.type === 'video') {
    const getThumbnailUrl = () => {
      if (item.thumbnailUrl && !item.thumbnailUrl.includes('placeholder')) {
        return item.thumbnailUrl;
      }
      return item.url;
    };

    return (
      <div 
        className={`group transition-all duration-300 cursor-pointer rounded-lg overflow-hidden ${
          imageLoaded || showVideo
            ? "bg-gray-800/50 border border-gray-700 hover:border-gray-600 hover:scale-[1.02]" 
            : "bg-gray-800/30 border border-gray-700/50"
        }`}
        onClick={handleCardClick}
        data-testid={`history-video-card-${item.id}`}
      >
        <div 
          className="relative w-full overflow-hidden bg-gray-900"
          style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '16 / 9' }}
        >
          {showVideo && item.url ? (
            <video 
              src={item.url}
              controls
              autoPlay
              className="w-full h-auto object-contain rounded"
              poster={getThumbnailUrl()}
            />
          ) : (
            <div 
              className="relative w-full h-full"
              onClick={(e) => {
                e.stopPropagation();
                if (infoOpenRef.current) {
                  setInfoOpen(false);
                  return;
                }
                setShowVideo(true);
              }}
            >
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800/50 rounded-lg">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/30 to-transparent skeleton-shimmer" />
                </div>
              )}
              {item.thumbnailUrl && !item.thumbnailUrl.includes('placeholder') ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.prompt}
                  className={`w-full h-full object-contain rounded transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                />
              ) : item.url ? (
                <video
                  src={item.url}
                  className={`w-full h-full object-contain rounded transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  muted
                  preload="metadata"
                  onLoadedMetadata={() => setImageLoaded(true)}
                />
              ) : (
                <FallbackVideoPlaceholder onMount={() => setImageLoaded(true)} />
              )}
              
              {/* Play overlay - only show when loaded */}
              {imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors duration-300">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 min-w-0 min-h-0 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center hover:scale-105 transition-transform duration-300">
                    <Play className="w-5 h-5 text-white/95 ml-0.5" fill="currentColor" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons - Top Right */}
          <div dir="ltr" className="absolute top-2 right-2 flex items-center gap-1 z-30">
            {/* Visibility Toggle */}
            <VisibilityToggle videoId={item.id} isPublic={item.isPublic} />

            {/* Info Button with Popover */}
            <Popover open={infoOpen} onOpenChange={setInfoOpen} modal={false}>
              <PopoverTrigger asChild>
                <button
                  className={actionIconButtonClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpen(prev => !prev);
                  }}
                  aria-label="Show info"
                  data-testid={`button-info-video-${item.id}`}
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
                      data-testid={`button-use-prompt-video-${item.id}`}
                      title={t('accessibility.usePrompt', 'Use prompt')}
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyPrompt}
                      className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                      aria-label="Copy prompt"
                      data-testid={`button-copy-prompt-video-${item.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-300 flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <p>{item.width}×{item.height}</p>
                    <p>{getVideoDisplayName(item.model)}</p>
                    <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  {item.startFrameUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceImageLightbox(item.startFrameUrl!);
                      }}
                      className="flex-shrink-0 group/img relative overflow-hidden rounded border border-white/20 hover:border-white/40 transition-all"
                      title={t('videoStudio.sourceImage', 'Source image')}
                    >
                      <img
                        src={item.startFrameUrl}
                        alt={t('videoStudio.sourceImage', 'Source image')}
                        className="w-10 h-10 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Download Button */}
            <button
              className={actionIconButtonClass}
              onClick={handleDownload}
              aria-label="Download"
              data-testid={`button-download-video-${item.id}`}
            >
              <Download className="w-4 h-4 text-white" />
            </button>

            {/* Favorite Button */}
            <VideoFavoriteIndicator 
              videoId={item.id}
              initialFavorited={item.isFavorited}
              showAlways={true}
              className="bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full"
            />
          </div>

          {/* Regenerate Button - Bottom Right (matches video gallery) */}
          <button
            className={`absolute bottom-2 right-2 z-30 ${actionIconButtonClass}`}
            onClick={handleRegenerateVideo}
            aria-label={t('accessibility.regenerateVideo', 'Regenerate video')}
            data-testid={`button-regenerate-video-${item.id}`}
            title={t('accessibility.regenerateVideo', 'Regenerate video')}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </button>

        </div>
        
        {/* Source Image Lightbox */}
        {sourceImageLightbox && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setSourceImageLightbox(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <Button
                onClick={() => setSourceImageLightbox(null)}
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                size="sm"
              >
                ×
              </Button>
              <img
                src={sourceImageLightbox}
                alt={t('videoStudio.sourceImage', 'Source image')}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Image card
  return (
    <div 
      className={`group transition-all duration-300 cursor-pointer rounded-lg overflow-hidden ${
        imageLoaded 
          ? "bg-gray-800/50 border border-gray-700 hover:border-gray-600 hover:scale-[1.02]" 
          : "bg-gray-800/30 border border-gray-700/50"
      }`}
      onClick={handleCardClick}
      data-testid={`history-image-card-${item.id}`}
    >
      <div className="p-0">
        <div 
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '1 / 1' }}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800/50 rounded-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/30 to-transparent skeleton-shimmer" />
            </div>
          )}
          <img
            src={item.thumbnailUrl || item.url}
            alt={item.prompt}
            className={`w-full h-full object-contain rounded transition-all duration-300 ${
              imageLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* Action Buttons - Top Right */}
          <div dir="ltr" className="absolute top-2 right-2 flex items-center gap-1 z-30">
            {/* Visibility Toggle */}
            <VisibilityToggle imageId={item.id} isPublic={item.isPublic} />

            {/* Info Button with Popover */}
            <Popover open={infoOpen} onOpenChange={setInfoOpen} modal={false}>
              <PopoverTrigger asChild>
                <button
                  className={actionIconButtonClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpen(prev => !prev);
                  }}
                  aria-label="Show info"
                  data-testid={`button-info-image-${item.id}`}
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
                      data-testid={`button-use-prompt-image-${item.id}`}
                      title={t('accessibility.usePrompt', 'Use prompt')}
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyPrompt}
                      className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                      aria-label="Copy prompt"
                      data-testid={`button-copy-prompt-image-${item.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-gray-300 text-xs">
                  <p>{item.width}×{item.height}</p>
                  <p>{getImageDisplayName(item.model)}</p>
                  <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </PopoverContent>
            </Popover>

            {/* Download Button */}
            <button
              className={actionIconButtonClass}
              onClick={handleDownload}
              aria-label="Download"
              data-testid={`button-download-image-${item.id}`}
            >
              <Download className="w-4 h-4 text-white" />
            </button>

            {/* Favorite Button */}
            <FavoriteIndicator 
              imageId={item.id}
              initialFavorited={item.isFavorited}
              showAlways={true}
              className="bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full"
            />
          </div>

          {/* Bottom row - badges and buttons */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
            {/* Left side: Upscaled badge */}
            <div className="flex items-center gap-2">
              {(item.style === "upscaled" || item.tags?.includes("upscaled")) && (
                <Badge variant="outline" className={minimalBadgeClass}>{t('landing.badges.upscaled')}</Badge>
              )}
            </div>
            
            {/* Right side: Image action buttons */}
            <div dir="ltr" className="flex items-center gap-1">
              <button
                className={actionIconButtonClass}
                onClick={handleUseImage}
                aria-label={t('accessibility.useImage', 'Use image')}
                data-testid={`button-use-image-${item.id}`}
                title={t('accessibility.useImage', 'Use image')}
              >
                <ImageIcon className="w-4 h-4 text-white" />
              </button>
              <button
                className={actionIconButtonClass}
                onClick={handleGenerateVideo}
                aria-label={t('tooltips.generateVideo', 'Generate video')}
                data-testid={`button-generate-video-image-${item.id}`}
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
  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div 
        className="relative bg-black rounded-lg overflow-hidden max-w-4xl max-h-[90vh]"
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
            src={video.url}
            controls
            autoPlay
            className="w-full h-full object-contain"
            poster={video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder') ? video.thumbnailUrl : video.url}
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

export default function History() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [contentType, setContentType] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [previousActiveJobIds, setPreviousActiveJobIds] = useState<string[]>([]);

  // Upscale jobs for progress cards
  const { activeJobs, dismissJob } = useUpscaleJobs();

  // Masonry breakpoint configuration
  const breakpointColumnsObj = {
    default: 4,
    1280: 3,
    1024: 2,
    640: 1,
  };

  // Fetch user's history with filters
  const { data: historyItems = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history", { search: searchQuery, type: contentType, favoritesOnly, sort: sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (contentType !== 'all') params.set('type', contentType);
      if (favoritesOnly) params.set('favoritesOnly', 'true');
      if (sortBy) params.set('sort', sortBy);
      
      const url = `/api/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Auto-refresh history when upscale jobs complete (job disappears from active list)
  const currentActiveJobIds = activeJobs.map(job => job.id);
  useEffect(() => {
    // Check if any previously active job is no longer in the active list
    const completedJobIds = previousActiveJobIds.filter(id => !currentActiveJobIds.includes(id));
    
    if (completedJobIds.length > 0 && previousActiveJobIds.length > 0) {
      console.log("[History] Upscale jobs completed, refreshing history:", completedJobIds);
      // Invalidate all history queries with predicate
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/history";
        }
      });
    }
    
    setPreviousActiveJobIds(currentActiveJobIds);
  }, [currentActiveJobIds.join(","), queryClient]);

  const handleDownload = (item: HistoryItem) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.download = `ai-studio-${item.type}-${item.id}.${item.type === 'image' ? 'png' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput]);

  const handleClearAll = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setContentType("all");
    setFavoritesOnly(false);
    setSortBy("newest");
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">Please Log In</h1>
          <p className="text-gray-300">You need to be logged in to view your history</p>
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
            {t('navigation.myGallery', 'My Gallery')}
          </h1>
          <p className="text-gray-300 text-lg">
            {t('pages.history.description')}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <GalleryToolbar
            searchPlaceholder={t("pages.history.searchPlaceholder")}
            searchValue={searchQuery}
            searchDraftValue={searchInput}
            onSearchDraftChange={setSearchInput}
            onSearchCommit={executeSearch}
            toggles={[
              { id: "favoritesOnly", label: t("pages.history.favoritesOnly"), icon: Heart },
            ]}
            activeToggleIds={favoritesOnly ? ["favoritesOnly"] : []}
            onToggleChange={(nextIds) => setFavoritesOnly(nextIds.includes("favoritesOnly"))}
            sortValue={sortBy}
            sortOptions={[
              { value: "newest", label: t("pages.history.newestFirst") },
              { value: "oldest", label: t("pages.history.oldestFirst") },
            ]}
            onSortChange={setSortBy}
            extraSelects={[
              {
                id: "contentType",
                label: t("pages.history.allContent", "All Content"),
                value: contentType,
                options: [
                  { value: "all", label: t("pages.history.allContent", "All Content") },
                  { value: "image", label: t("pages.history.imagesOnly", "Images Only") },
                  { value: "video", label: t("pages.history.videosOnly", "Videos Only") },
                  { value: "upscaled", label: t("filters.upscaled") },
                ],
              },
            ]}
            onExtraSelectChange={(id, value) => {
              if (id === "contentType") {
                setContentType(value);
              }
            }}
            countLabel={
              isLoading
                ? t("common.loading")
                : t("pages.history.itemsFound", { count: historyItems.length })
            }
            onClearAll={handleClearAll}
            isMobile={isMobile}
          />
        </div>

        {/* Gallery */}
        {isLoading ? (
          <MasonryGallerySkeleton count={12} />
        ) : historyItems.length === 0 ? (
          <div className="text-center py-16">
            <GalleryIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold mb-2 text-gray-300">
              {favoritesOnly ? t('pages.history.noFavoritesYet') : t('pages.history.noHistoryYet')}
            </h3>
            <p className="text-gray-500">
              {favoritesOnly 
                ? t('pages.history.startFavoriting')
                : t('pages.history.contentWillAppear')}
            </p>
          </div>
        ) : (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="flex -ml-6 w-auto"
            columnClassName="pl-6 bg-clip-padding"
          >
            {/* Active upscale job progress cards */}
            {activeJobs.map((job) => (
              <div key={`upscale-${job.id}`} className="mb-6">
                <UpscaleProgressCard 
                  job={job} 
                  onDismiss={() => dismissJob(job.id)} 
                />
              </div>
            ))}
            {historyItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="mb-6">
                <HistoryContentCard
                  item={item}
                  user={user}
                  onSelect={(selectedItem) => {
                    if (selectedItem.type === 'image') {
                      setSelectedImage(selectedItem as Image);
                    } else {
                      setSelectedVideo(selectedItem as Video);
                    }
                  }}
                />
              </div>
            ))}
          </Masonry>
        )}

        {/* Lightbox for images */}
        {selectedImage && (
          <Lightbox
            image={selectedImage}
            isOpen={!!selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}

        {/* Video Modal */}
        <VideoModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      </div>
    </div>
  );
}



