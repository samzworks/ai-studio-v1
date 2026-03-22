import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Video as VideoIcon, ArrowDownToLine as Download, Trash as Trash2, Play, Loader2, XCircle, CheckCircle, AlertCircle, Timer as Clock, Info, Heart, Eye, EyeOff, X, Clipboard as Copy, Type, ImagePlus as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VisibilityToggle } from "./visibility-toggle";
import { VideoFavoriteIndicator } from "./video-favorite-indicator";
import { useAuth } from "@/hooks/useAuth";
import { HoverButtons } from "./HoverButtons";
import VideoModal from "./VideoModal";
import EnhancedVideoCard from "./EnhancedVideoCard";
import { useTranslation } from "react-i18next";
import { useGalleryStore } from "@/stores/gallery-store";
import { useVideoPromptStore } from "@/stores/video-prompt-store";
import { useVideoStore } from "@/stores/video-store";
import { useVideoModelDisplayName } from "@/hooks/useVideoModelDisplayName";
import { useActiveJobsPolling } from "@/hooks/useVideoJobPolling";
import type { PendingVideoProgress } from "@/stores/gallery-store";
import Masonry from 'react-masonry-css';
import { findBaseModelByVariantId } from "@shared/model-routing";

// Concurrent video load limiter - prevents browser overload when scrolling
const MAX_CONCURRENT_LOADS = 4;
const loadQueue: Set<string> = new Set();
const loadingVideos: Set<string> = new Set();
const waitingCallbacks: Map<string, () => void> = new Map();

function requestVideoLoad(videoId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (loadingVideos.size < MAX_CONCURRENT_LOADS) {
      loadingVideos.add(videoId);
      resolve(true);
    } else {
      loadQueue.add(videoId);
      waitingCallbacks.set(videoId, () => {
        loadQueue.delete(videoId);
        loadingVideos.add(videoId);
        resolve(true);
      });
    }
  });
}

function releaseVideoLoad(videoId: string) {
  loadingVideos.delete(videoId);
  // Process next in queue
  const nextInQueue = loadQueue.values().next().value;
  if (nextInQueue) {
    const callback = waitingCallbacks.get(nextInQueue);
    if (callback) {
      waitingCallbacks.delete(nextInQueue);
      callback();
    }
  }
}

function cancelVideoLoad(videoId: string) {
  loadQueue.delete(videoId);
  waitingCallbacks.delete(videoId);
  loadingVideos.delete(videoId);
}

// Persistent progress storage across component re-renders (same pattern as Image Studio)
const videoProgressStore = new Map<string, number>();

// Utility function to cleanup stale entries from progressStore
// This is called periodically to prevent memory leaks for jobs that completed while unmounted
// Uses a timestamp-based approach: entries older than 5 minutes with no corresponding active job are removed
const videoProgressTimestamps = new Map<string, number>();

function trackVideoProgressEntry(jobId: string) {
  videoProgressTimestamps.set(jobId, Date.now());
}

function cleanupStaleVideoProgressEntries(activeJobIds: Set<string>) {
  const now = Date.now();
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
  const staleIds: string[] = [];
  
  videoProgressStore.forEach((_, jobId) => {
    // Only remove if: not in active jobs AND older than 5 minutes
    const timestamp = videoProgressTimestamps.get(jobId) || 0;
    const age = now - timestamp;
    if (!activeJobIds.has(jobId) && age > MAX_AGE_MS) {
      staleIds.push(jobId);
    }
  });
  
  staleIds.forEach(id => {
    videoProgressStore.delete(id);
    videoProgressTimestamps.delete(id);
  });
  
  if (staleIds.length > 0) {
    console.log(`[VideoProgress Cleanup] Removed ${staleIds.length} stale entries (older than 5 min)`);
  }
}

// Hook to provide smooth progress animation for video jobs (prevents reset on re-render)
// Uses setInterval instead of requestAnimationFrame for mobile compatibility (rAF is throttled in background)
function useSmoothVideoProgress(job: PendingVideoProgress): number {
  // Initialize from store if available (for persistence), otherwise start fresh at ≤5%
  const initialProgress = videoProgressStore.get(job.id) ?? Math.min(job.progress, 5);
  const [displayProgress, setDisplayProgress] = useState(initialProgress);
  // Start with null to ensure reset effect runs on first render
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastJobProgressRef = useRef(job.progress);
  
  // Reset when job ID changes (new job) or on first render
  useEffect(() => {
    if (job.id !== currentJobId) {
      // Clean up old job's timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // For new jobs (not in store), start fresh at ≤5%
      // For persisted jobs (in store), use stored value
      const storedProgress = videoProgressStore.get(job.id);
      const newProgress = storedProgress !== undefined ? storedProgress : Math.min(job.progress, 5);
      
      setDisplayProgress(newProgress);
      setCurrentJobId(job.id);
      lastJobProgressRef.current = job.progress;
    }
  }, [job.id, currentJobId]);
  
  // Persist progress to store whenever it changes, and track timestamp for cleanup
  useEffect(() => {
    videoProgressStore.set(job.id, displayProgress);
    trackVideoProgressEntry(job.id);
  }, [job.id, displayProgress]);
  
  useEffect(() => {
    // Sync with job progress when it updates - always take the max to never decrease
    if (job.progress !== lastJobProgressRef.current) {
      setDisplayProgress(prev => Math.max(prev, job.progress));
      lastJobProgressRef.current = job.progress;
    }
  }, [job.progress]);
  
  // Clean up from store when job reaches terminal state
  useEffect(() => {
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      videoProgressStore.delete(job.id);
      videoProgressTimestamps.delete(job.id);
    }
  }, [job.id, job.status]);
  
  // ✅ MOBILE FIX: Use setInterval instead of requestAnimationFrame
  // setInterval continues even when tab is backgrounded (at reduced frequency)
  // This ensures mobile users see progress updates even when screen dims
  useEffect(() => {
    // Animate for all active job states (including queued for mobile visibility)
    if (job.status !== 'processing' && job.status !== 'starting' && job.status !== 'queued') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    // Use 500ms interval - frequent enough for smooth updates, but not too aggressive
    const UPDATE_INTERVAL_MS = 500;
    
    intervalRef.current = setInterval(() => {
      setDisplayProgress(prev => {
        // Only use fallback animation if we're below the real job progress
        const realProgress = lastJobProgressRef.current;
        
        if (prev >= realProgress) {
          // We're ahead of or at the real progress, use fallback animation
          if (prev >= 95) {
            // Already at or above 95%, hold steady (don't decrease)
            return prev;
          }
          // For queued status: slower but noticeable progress (1% per second up to 15%)
          // For processing: faster progress (2% per second up to 95%)
          const incrementRate = job.status === 'queued' ? 1 : 2;
          const increment = (UPDATE_INTERVAL_MS / 1000) * incrementRate;
          const fallbackProgress = prev + increment;
          // Cap at 15% for queued (shows meaningful progress while waiting), 95% for processing
          const maxProgress = job.status === 'queued' ? 15 : 95;
          return Math.min(fallbackProgress, maxProgress);
        } else {
          // We're behind real progress, catch up smoothly
          const catchUpIncrement = Math.min((realProgress - prev) * 0.15, 5);
          return Math.min(prev + catchUpIncrement, realProgress);
        }
      });
    }, UPDATE_INTERVAL_MS);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [job.status, currentJobId]);
  
  // Cleanup interval on unmount, but PRESERVE progress in store for active jobs
  // This allows progress to persist when navigating away and back
  useEffect(() => {
    return () => {
      // Clear the interval timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // NOTE: We intentionally do NOT delete from videoProgressStore here
      // The progress should persist for active jobs when component unmounts due to navigation
      // Progress is only deleted when job reaches terminal state (succeeded/failed) in the effect above
    };
  }, [job.id]);
  
  return displayProgress;
}

interface Video {
  id: number;
  url?: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  duration: number;
  status: string;
  isPublic: boolean;
  createdAt: string;
  replicateId?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  jobId?: string; // Link back to job for job-based system
  startFrameUrl?: string; // Source image used for video generation
}

interface VideoGalleryProps {
  videos: Video[];
  isLoading: boolean;
  onVideoDeleted: () => void;
  videoSize?: number;
  bulkVideoFavoriteStatus?: Record<number, boolean>;
}

// Get resolution presets for each model
const getModelResolution = (model: string, resolution?: string) => {
  // WAN models
  if (model.includes('wan')) {
    if (resolution === '720p') return { w: 1280, h: 720 }; // 16:9
    return { w: 854, h: 480 }; // 16:9 (480p default)
  }
  // Luma models
  if (model.includes('luma')) {
    return { w: 540, h: 960 }; // 9:16 (540p only)
  }
  // Fallback
  return { w: 854, h: 480 };
};

// Component for rendering a video progress card with smooth animation
function VideoProgressCard({ job, onDismiss }: { job: PendingVideoProgress; onDismiss?: () => void }) {
  const smoothProgress = useSmoothVideoProgress(job);
  const modelRes = getModelResolution(job.modelId || 'luma-ray-flash-2-540p');
  const progressPercent = Math.round(Math.max(0, Math.min(100, smoothProgress)));
  const isFailed = job.status === 'failed';
  
  return (
    <div
      className={`masonry-item group relative overflow-visible transition-all duration-300 animate-fade-in mb-4 z-10 border rounded-[8px] ${
        isFailed
          ? "bg-slate-800/90 border-amber-500/20"
          : "bg-[#0a1442b3] border-white/15 hover:border-white/25"
      }`}
      style={{ breakInside: "avoid" }}
    >
      {/* Dismiss button for failed jobs - friendly style */}
      {isFailed && onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors pointer-events-auto"
          aria-label="Dismiss"
          data-testid="button-dismiss-error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="overflow-visible w-full" style={{ borderRadius: '8px', zIndex: 0 }}>
        <div 
          className="media bg-transparent"
          style={{ aspectRatio: `${modelRes.w} / ${modelRes.h}`, overflow: 'hidden' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
            <div className="flex flex-col items-center space-y-3 px-3">
              {/* Status Icon */}
              {job.status === 'queued' && <Clock className="w-8 h-8 text-blue-500" />}
              {job.status === 'starting' && <Play className="w-8 h-8 text-blue-500" />}
              {job.status === 'processing' && <VideoIcon className="w-8 h-8 text-blue-500 animate-pulse" />}
              {job.status === 'failed' && <AlertCircle className="w-8 h-8 text-amber-400" />}
              {job.status === 'succeeded' && <CheckCircle className="w-8 h-8 text-green-500" />}
              
              {/* Status Text - friendly style for failed state */}
              {isFailed ? (
                <div className="text-center space-y-3 max-w-[220px] flex flex-col items-center">
                  <span className="text-slate-200 text-sm font-medium block leading-relaxed text-center">
                    {(job.stage || 'Generation failed.').replace(/\s*Credits refunded\.?/gi, '').trim() || 'Generation failed.'}
                  </span>
                  <span className="text-emerald-400 text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Credits returned to your account
                  </span>
                </div>
              ) : (
                <span className="text-white text-sm font-medium text-center">
                  {job.stage || (job.status === 'queued' ? 'In Queue' : 
                    job.status === 'starting' ? 'Starting...' :
                    job.status === 'processing' ? 'Generating video...' :
                    job.status === 'succeeded' ? 'Video Ready!' : 'Processing...')}
                </span>
              )}
              
              {/* Progress Bar - show for all active states including queued */}
              {(job.status === 'processing' || job.status === 'starting' || job.status === 'queued') && (
                <div className="w-full max-w-32">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        job.status === 'queued' 
                          ? 'bg-blue-500/70' 
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.max(progressPercent, 3)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center mt-1">
                    {job.status === 'queued' 
                      ? `Waiting... ${progressPercent}%` 
                      : `${progressPercent}%`}
                  </div>
                </div>
              )}
              
              {/* ETA - show for all active states */}
              {job.etaSeconds > 0 && (job.status === 'processing' || job.status === 'starting' || job.status === 'queued') && (
                <div className="text-xs text-gray-400">
                  {(() => {
                    const minutes = Math.floor(job.etaSeconds / 60);
                    const seconds = job.etaSeconds % 60;
                    if (minutes > 0) {
                      return `About ${minutes} min${minutes > 1 ? 's' : ''}${seconds > 0 ? ` ${seconds} sec` : ''}`;
                    } else {
                      return `About ${seconds} sec${seconds > 1 ? 's' : ''}`;
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fixed VideoCard with proper layering, visibility logic, and lazy loading
function VideoCard({ video, videoSize = 4 }: { video: Video; videoSize?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasBeenPlayed, setHasBeenPlayed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [thumbnailReady, setThumbnailReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy loading: Only load video when visible in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(container);
          }
        });
      },
      { 
        rootMargin: '200px',
        threshold: 0 
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Get authoritative dimensions - use stored metadata if available, otherwise model presets
  const getDimensions = () => {
    if (video.width && video.height && video.width > 100 && video.height > 100) {
      return { w: video.width, h: video.height };
    }
    return getModelResolution(video.model);
  };

  const { w, h } = getDimensions();

  // Generate thumbnail URL - use video URL as fallback for now
  const getThumbnailUrl = () => {
    if (video.thumbnailUrl) return video.thumbnailUrl;
    return video.url;
  };

  // Play video with proper lifecycle management
  const play = useCallback(async () => {
    if (hasError || isPlaying || !thumbnailReady || !video.url) {
      return;
    }

    try {
      setIsReady(true);
      setIsPlaying(true);
      setHasError(false);
      
      setTimeout(async () => {
        const videoEl = videoRef.current;
        if (!videoEl) {
          setHasError(true);
          setIsPlaying(false);
          return;
        }

        try {
          await videoEl.play();
        } catch (error) {
          setHasError(true);
          setIsPlaying(false);
        }
      }, 100);
    } catch (error) {
      setHasError(true);
      setIsPlaying(false);
    }
  }, [video.id, hasError, isPlaying, thumbnailReady, video.url]);

  // Clean up video resources
  const cleanup = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.pause();
    setIsPlaying(false);
  }, []);

  // Retry playback with cleanup
  const retry = useCallback(async () => {
    if (retryCount >= 2) return;
    
    cleanup();
    setRetryCount(prev => prev + 1);
    
    setTimeout(() => {
      play();
    }, 500);
  }, [retryCount, cleanup, play]);

  // Intersection Observer for performance (cleanup when offscreen)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting && isPlaying) {
          cleanup();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Setup video src only when visible
  useEffect(() => {
    if (!isVisible) return;
    
    const videoEl = videoRef.current;
    if (videoEl && video.url) {
      videoEl.src = video.url;
      videoEl.load();
    }
  }, [video.url, video.id, isVisible]);

  return (
    <div 
      key={`media-${video.id}`}
      ref={containerRef}
      className="media"
    >
      {/* Placeholder skeleton shown until video is visible */}
      {!isVisible && (
        <div 
          className="absolute inset-0 bg-slate-800/50 flex items-center justify-center animate-pulse"
          style={{ aspectRatio: `${w} / ${h}` }}
        >
          <VideoIcon className="w-8 h-8 text-slate-500" />
        </div>
      )}

      {/* Video element - only render when visible, loads metadata for thumbnail */}
      {isVisible && (
        <video
          ref={videoRef}
          className={isPlaying ? "video-element" : "thumb"}
          controls={hasBeenPlayed}
          playsInline
          muted={!isPlaying}
          preload="metadata"
          style={{
            borderRadius: '5px',
            WebkitBorderRadius: '5px',
            MozBorderRadius: '5px',
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px',
            borderBottomLeftRadius: '5px',
            borderBottomRightRadius: '5px'
          }}
          onError={(e) => {
            setHasError(true);
          }}
          onLoadedMetadata={() => {
            setThumbnailReady(true);
            setIsReady(true);
            setHasError(false);
            const event = new CustomEvent('mediaLoaded', { detail: { videoId: video.id } });
            window.dispatchEvent(event);
          }}
          onCanPlay={() => {
            setHasError(false);
          }}
          onPlay={() => {
            setIsPlaying(true);
            setHasBeenPlayed(true);
          }}
          onPause={() => {
            setIsPlaying(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
          }}
        >
          <source src={video.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}

      {/* Interactive overlay - shows when not playing and video hasn't been played yet */}
      {!isPlaying && !hasBeenPlayed && (
        <div className="overlay" onClick={(e) => {
          console.log('Overlay clicked!', video.id);
          e.stopPropagation();
          play();
        }}>
          <div 
            className="play-button btn"
            onClick={(e) => {
              console.log('Play button div clicked!', video.id);
              e.stopPropagation();
              e.preventDefault();
              play();
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center">
              <Play className="w-5 h-5 text-white/95 ml-0.5" fill="currentColor" />
            </div>
          </div>
          
          {/* Video info */}
          <div className="video-info">
            <VideoIcon className="w-3 h-3" />
            {video.duration}s
          </div>
        </div>
      )}

      {/* Error state with retry */}
      {hasError && (
        <div className="overlay">
          <div className="error-message btn" onClick={retry}>
            <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
            <span className="text-sm text-white">Failed to load</span>
            <button className="text-xs text-blue-400 mt-1">Tap to retry</button>
          </div>
        </div>
      )}


    </div>
  );
}

export default function VideoGallery({ 
  videos, 
  isLoading, 
  onVideoDeleted,
  videoSize = 4,
  bulkVideoFavoriteStatus
}: VideoGalleryProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [showInfoForVideo, setShowInfoForVideo] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [sourceImageLightbox, setSourceImageLightbox] = useState<string | null>(null);
  const justOpenedRef = useRef(false);
  const { getDisplayName } = useVideoModelDisplayName();
  const setSelectedVideoPrompt = useVideoPromptStore(state => state.setSelectedVideoPrompt);
  const { setReferenceImage } = useVideoStore();
  
  const setSelectedVideoModel = useVideoPromptStore(state => state.setSelectedVideoModel);
  
  const handleRegenerateVideo = useCallback((video: Video) => {
    setSelectedVideoPrompt(video.prompt);
    
    // Extract base model ID from variant ID (e.g., "wan-2.2-t2v-fast" -> "wan-2.2")
    const variantLookup = findBaseModelByVariantId(video.model);
    const baseModelId = variantLookup?.baseModel.id || video.model;
    console.log('[VideoGallery] Regenerate video - variant:', video.model, 'baseModel:', baseModelId);
    
    setSelectedVideoModel(baseModelId);
    if (video.startFrameUrl) {
      setReferenceImage({
        url: video.startFrameUrl,
        prompt: video.prompt,
        defaultModel: baseModelId,
      });
    }
    setShowInfoForVideo(null);
    toast({
      title: t('toasts.videoSettingsLoaded', 'Video settings loaded'),
      description: t('toasts.videoSettingsLoadedDescription', 'Prompt and reference image loaded to the form'),
    });
  }, [setSelectedVideoPrompt, setSelectedVideoModel, setReferenceImage, toast, t]);
  
  const handleUsePrompt = useCallback((prompt: string) => {
    setSelectedVideoPrompt(prompt);
    setShowInfoForVideo(null);
    toast({
      title: t('toasts.promptApplied', 'Prompt applied'),
      description: t('toasts.promptAppliedDescription', 'Prompt has been copied to the generation form'),
    });
  }, [setSelectedVideoPrompt, toast, t]);
  
  // Clear tooltip if the selected video is removed from the list
  useEffect(() => {
    if (showInfoForVideo !== null && !videos.find(v => v.id === showInfoForVideo)) {
      setShowInfoForVideo(null);
    }
  }, [videos, showInfoForVideo]);
  
  // New unified progress tracking system
  const videoProgress = useGalleryStore(s => s.videoProgress);
  const removeVideoProgress = useGalleryStore(s => s.removeVideoProgress);
  const progressValues = useMemo(() => Object.values(videoProgress), [videoProgress]);
  
  // Legacy pending system (kept for compatibility during transition)
  const pending = useGalleryStore(s => s.pending);
  const pendingValues = useMemo(() => Object.values(pending), [pending]);
  const removePending = useGalleryStore(s => s.removePending);
  
  // ✅ GALLERY-LEVEL JOB POLLING: Polls for all active jobs even when form sidebar closes on mobile
  // This ensures job status updates continue and errors are properly shown to users
  useActiveJobsPolling();
  
  // ✅ CLEANUP: Remove stale entries from videoProgressStore
  // Only run when we have jobs (empty = skip cleanup to avoid wiping during fetch gaps)
  // The 5-minute timestamp guard in cleanupStaleVideoProgressEntries provides additional safety
  useEffect(() => {
    // Only cleanup when we have active jobs - this prevents wiping during loading/fetch gaps
    if (progressValues.length > 0) {
      const activeJobIds = new Set(progressValues.map(p => p.id));
      cleanupStaleVideoProgressEntries(activeJobIds);
    }
  }, [progressValues]);
  
  // ✅ IMMEDIATE CLEANUP ON MOUNT: Check all processing cards immediately when gallery loads
  // This handles the production case where stale cards persist from before a deployment
  useEffect(() => {
    const immediateCleanup = async () => {
      const currentProgress = useGalleryStore.getState().videoProgress;
      const progressEntries = Object.values(currentProgress);
      
      if (progressEntries.length === 0) return;
      
      console.log(`[IMMEDIATE CLEANUP] Checking ${progressEntries.length} progress cards on mount`);
      
      for (const progress of progressEntries) {
        // Skip failed cards - they persist until user dismisses
        if (progress.status === 'failed') continue;
        
        // For any processing/starting/queued job cards, verify with backend immediately
        if (progress.isJob && ['processing', 'starting', 'queued'].includes(progress.status)) {
          try {
            const response = await fetch(`/api/video/jobs/${progress.id}`);
            if (response.status === 404) {
              console.log(`[IMMEDIATE CLEANUP] Job ${progress.id} not found - removing orphaned card`);
              removeVideoProgress(progress.id);
            } else if (response.ok) {
              const jobData = await response.json();
              if (jobData.state === 'completed' || jobData.state === 'failed' || jobData.state === 'canceled') {
                console.log(`[IMMEDIATE CLEANUP] Job ${progress.id} already finished (${jobData.state}) - removing card`);
                removeVideoProgress(progress.id);
              }
            }
          } catch (error) {
            console.log(`[IMMEDIATE CLEANUP] Error checking job ${progress.id}:`, error);
          }
        }
      }
    };
    
    // Run immediately on mount
    immediateCleanup();
  }, []); // Only run once on mount
  
  // ✅ PERIODIC CLEANUP: Automatically remove stuck progress cards every 15 seconds
  // This is a safety net for cases where normal cleanup fails
  useEffect(() => {
    const cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const currentProgress = useGalleryStore.getState().videoProgress;
      const progressEntries = Object.values(currentProgress);
      
      if (progressEntries.length === 0) return;
      
      console.log(`[PERIODIC CLEANUP] Checking ${progressEntries.length} progress cards`);
      
      for (const progress of progressEntries) {
        // Skip failed cards - they persist until user dismisses
        if (progress.status === 'failed') continue;
        
        // Skip if no startedAt timestamp (required for age calculation)
        if (!progress.startedAt) {
          console.log(`[PERIODIC CLEANUP] Skipping ${progress.id} - no startedAt timestamp`);
          continue;
        }
        
        const age = now - progress.startedAt;
        
        // Remove succeeded cards after 10 seconds (video should already be in gallery)
        if (progress.status === 'succeeded' && age > 10000) {
          console.log(`[PERIODIC CLEANUP] Removing stale succeeded card: ${progress.id} (age: ${Math.round(age/1000)}s)`);
          removeVideoProgress(progress.id);
          continue;
        }
        
        // For processing cards, verify with backend before removing
        // ✅ REDUCED: Check after 2 minutes instead of 5 for faster cleanup
        if ((progress.status === 'processing' || progress.status === 'starting') && progress.isJob) {
          if (age > 120000) { // 2 minutes
            try {
              // Check if job still exists and is actually processing
              const response = await fetch(`/api/video/jobs/${progress.id}`);
              if (response.status === 404) {
                // Job doesn't exist on backend - safe to remove
                console.log(`[PERIODIC CLEANUP] Removing orphaned processing card: ${progress.id} (job not found)`);
                removeVideoProgress(progress.id);
              } else if (response.ok) {
                const jobData = await response.json();
                if (jobData.state === 'completed' || jobData.state === 'failed' || jobData.state === 'canceled') {
                  console.log(`[PERIODIC CLEANUP] Removing card for finished job: ${progress.id} (state: ${jobData.state})`);
                  removeVideoProgress(progress.id);
                }
              }
            } catch (error) {
              console.log(`[PERIODIC CLEANUP] Error checking job ${progress.id}:`, error);
            }
          }
        }
        
        // Remove queued cards older than 10 minutes (reduced from 20)
        if (progress.status === 'queued' && age > 600000) {
          console.log(`[PERIODIC CLEANUP] Removing stale queued card: ${progress.id} (age: ${Math.round(age/1000)}s)`);
          removeVideoProgress(progress.id);
        }
      }
    }, 15000); // Run every 15 seconds
    
    return () => clearInterval(cleanupInterval);
  }, [removeVideoProgress]);
  
  useEffect(() => {
    // Stage 2: Remove pending jobs when real video appears in server data
    pendingValues.forEach(pendingJob => {
      // Check if this pending job now exists in the server videos
      const realVideo = videos.find(v => v.replicateId === pendingJob.id);
      if (realVideo && (realVideo.status === 'completed' || realVideo.status === 'succeeded')) {
        console.log(`Removing pending job ${pendingJob.id} - real video found`);
        removePending(pendingJob.id);
      }
    });
  }, [videos, pendingValues, removePending]); // Only depend on videos, pendingValues, and removePending (stable from Zustand)
  
  // ✅ NEW: Enhanced cross-reference effect for removing completed progress cards
  useEffect(() => {
    if (progressValues.length === 0) return;
    
    console.log(`[VIDEO CROSS-REF] Checking ${progressValues.length} progress cards against ${videos.length} videos`);
    
    const now = Date.now();
    
    // Find progress cards that should be removed
    const toRemove = progressValues.filter(progress => {
      // Skip failed cards - they persist until user dismisses
      if (progress.status === 'failed') return false;
      
      let hasMatchingVideo = false;
      
      if (progress.isJob) {
        // Job-based matching: check by jobId
        hasMatchingVideo = videos.some(v => 
          (v as any).jobId === progress.id && 
          (v.status === 'completed' || v.status === 'succeeded')
        );
        
        // ✅ FALLBACK: Also try matching by prompt similarity for job-based cards
        if (!hasMatchingVideo && progress.prompt) {
          const promptMatch = videos.find(v => {
            if (!v.prompt || (v.status !== 'completed' && v.status !== 'succeeded')) return false;
            const similarity = v.prompt.trim().toLowerCase() === progress.prompt.trim().toLowerCase();
            const timeDiff = progress.startedAt ? Math.abs(new Date(v.createdAt).getTime() - progress.startedAt) : Infinity;
            return similarity && timeDiff < 180000; // Within 3 minutes
          });
          if (promptMatch) {
            console.log(`[VIDEO CROSS-REF] ✅ PROMPT MATCH found for job ${progress.id}: video ${promptMatch.id}`);
            hasMatchingVideo = true;
          }
        }
        
        // ✅ TIMEOUT SAFETY: Remove "succeeded" cards after 10 seconds even if no matching video found
        // This prevents cards from being stuck indefinitely
        if (!hasMatchingVideo && progress.status === 'succeeded') {
          const age = now - (progress.startedAt || now);
          // If it's been more than 3 minutes since generation started and status is succeeded, force remove
          if (age > 180000) {
            console.log(`[VIDEO CROSS-REF] ⏱️ TIMEOUT: Removing stale succeeded card ${progress.id} (age: ${Math.round(age/1000)}s)`);
            return true;
          }
        }
        
        // ✅ TIMEOUT SAFETY: Remove "processing" cards that are stuck for too long
        if (!hasMatchingVideo && (progress.status === 'processing' || progress.status === 'starting')) {
          const age = now - (progress.startedAt || now);
          // If processing for more than 10 minutes without completion, assume it's stuck
          if (age > 600000) {
            console.log(`[VIDEO CROSS-REF] ⏱️ TIMEOUT: Removing stale processing card ${progress.id} (age: ${Math.round(age/1000)}s)`);
            return true;
          }
        }
      } else {
        // Legacy matching: check by replicateId
        hasMatchingVideo = videos.some(v => 
          v.replicateId === progress.id && 
          (v.status === 'completed' || v.status === 'succeeded')
        );
      }
      
      if (hasMatchingVideo) {
        console.log(`[VIDEO CROSS-REF] ✅ REMOVING progress card ${progress.id} - matching video found`);
      }
      
      return hasMatchingVideo;
    });
    
    // Remove progress cards that have matching completed videos or are timed out
    if (toRemove.length > 0) {
      console.log(`[VIDEO CROSS-REF] Removing ${toRemove.length} progress cards`);
      toRemove.forEach(progress => {
        removeVideoProgress(progress.id);
      });
    }
  }, [progressValues, videos, removeVideoProgress]);
  
  // Combine server videos with progress cards and legacy pending items
  const allItems = useMemo(() => {
    const now = Date.now();
    
    // New progress cards - these show real progress from backend
    const progressItems = progressValues
      .filter(progress => {
        // Show progress cards for active generations, succeeded until video appears, AND failed (until dismissed)
        const isActiveGeneration = progress.status === 'queued' || 
          progress.status === 'starting' || 
          progress.status === 'processing' ||
          progress.status === 'succeeded'; // Keep succeeded until completed video available
        
        // Always show failed cards until user dismisses them
        const isFailed = progress.status === 'failed';
        
        // ✅ Enhanced cross-reference logic with multi-strategy matching
        if (progress.isJob) {
          // Strategy 1: Direct jobId match
          let hasCompletedJobVideo = videos.some(v => 
            (v as any).jobId === progress.id && 
            (v.status === 'completed' || v.status === 'succeeded')
          );
          
          // Strategy 2: Prompt + time proximity match (fallback when jobId missing)
          if (!hasCompletedJobVideo && progress.prompt) {
            hasCompletedJobVideo = videos.some(v => {
              if (!v.prompt || (v.status !== 'completed' && v.status !== 'succeeded')) return false;
              const similarity = v.prompt.trim().toLowerCase() === progress.prompt.trim().toLowerCase();
              const timeDiff = progress.startedAt ? Math.abs(new Date(v.createdAt).getTime() - progress.startedAt) : Infinity;
              return similarity && timeDiff < 180000; // Within 3 minutes
            });
          }
          
          // Strategy 3: Timeout-based hide for stuck cards
          if (!hasCompletedJobVideo && progress.status === 'succeeded') {
            const age = now - (progress.startedAt || now);
            if (age > 180000) { // 3 minutes
              return false; // Hide stale succeeded cards
            }
          }
          
          if (!hasCompletedJobVideo && (progress.status === 'processing' || progress.status === 'starting')) {
            const age = now - (progress.startedAt || now);
            if (age > 600000) { // 10 minutes
              return false; // Hide stale processing cards
            }
          }
          
          // Show if: active and no completed video, OR failed (persist until dismissed)
          return (isActiveGeneration && !hasCompletedJobVideo) || isFailed;
        }
        
        // For legacy progress cards, check by replicateId (old system)
        const hasCompletedVideo = videos.some(v => v.replicateId === progress.id && 
          (v.status === 'completed' || v.status === 'succeeded'));
        
        return (isActiveGeneration && !hasCompletedVideo) || isFailed;
      })
      .map(progress => {
        console.log(`[PROGRESS RENDER] Rendering progress card: ${progress.id} (${progress.stage})`);
        return { 
          kind: 'progress' as const, 
          id: `progress-${progress.id}`,
          progress
        };
      });
    
    // Legacy pending items (for backwards compatibility)
    const filteredPendingItems = pendingValues
      .filter(p => {
        // Only include pending items if there's NO video with the same replicateId
        const hasMatchingVideo = videos.some(v => v.replicateId === p.id);
        // Also don't show if we have a progress card for the same ID
        const hasProgressCard = progressValues.some(progress => progress.id === p.id);
        return !hasMatchingVideo && !hasProgressCard;
      })
      .map(p => ({ 
        kind: 'pending' as const, 
        id: `pending-${p.id}`, 
        jobId: p.id, 
        modelId: p.modelId,
        startedAt: p.startedAt
      }));
    
    const videoItems = videos.map(v => ({ 
      kind: 'video' as const, 
      id: `video-${v.id}`, 
      video: v 
    }));
    
    return [...progressItems, ...filteredPendingItems, ...videoItems];
  }, [progressValues, pendingValues, videos]);
  
  // Close tooltip when clicking outside or pressing Escape
  useEffect(() => {
    if (showInfoForVideo === null) return;

    // Set flag to ignore the first few events (the ones that opened the tooltip)
    justOpenedRef.current = true;
    setTimeout(() => {
      justOpenedRef.current = false;
    }, 50);

    const handleClickOutside = (e: MouseEvent) => {
      // Skip the first click that just opened the tooltip
      if (justOpenedRef.current) {
        return;
      }

      const target = e.target as HTMLElement;
      // Don't close if clicking inside a tooltip
      if (target.closest('.prompt-tooltip')) {
        return;
      }
      // Don't close if clicking on an info button (let onInfoToggle handle it)
      if (target.closest('[data-info-button="true"]')) {
        return;
      }
      // Close tooltip for any other click
      setShowInfoForVideo(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInfoForVideo(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInfoForVideo]);

  // Removed debug console.log statements that were causing re-render loops

  // Calculate grid columns based on video size (matching image gallery logic)
  const getGridColumns = (size: number) => {
    if (size <= 1) return "grid-cols-1";
    if (size <= 2) return "grid-cols-1 md:grid-cols-2";
    if (size <= 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    if (size <= 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    if (size <= 5) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    if (size <= 6) return "grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
    if (size <= 8) return "grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8";
    if (size <= 10) return "grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";
    if (size <= 12) return "grid-cols-4 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12";
    return "grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12";
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to delete video");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription'),
      });
      onVideoDeleted(); // Refresh the gallery
    },
    onError: (error: Error) => {
      toast({
        title: t('toasts.failedToDeleteImage'),
        description: error.message || t('toasts.failedToDeleteImageDescription'),
        variant: "destructive",
      });
    },
  });

  // Toggle visibility mutation
  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      const response = await fetch(`/api/videos/${id}/visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic }),
      });
      if (!response.ok) {
        throw new Error("Failed to update visibility");
      }
      return response.json();
    },
    onSuccess: (updatedVideo) => {
      toast({
        title: t('toasts.visibilityUpdated'),
        description: t('toasts.visibilityUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
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
        title: t('toasts.failedToUpdateVisibility'),
        description: t('toasts.failedToUpdateVisibilityDescription'),
        variant: "destructive",
      });
    },
  });

  const handleDownload = (video: Video) => {
    if (!video.url) return;
    
    const link = document.createElement('a');
    link.href = video.url;
    link.download = `ai-studio-video-${video.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenVideoModal = (video: Video) => {
    setSelectedVideo(video);
    setIsVideoModalOpen(true);
  };

  const handleCloseVideoModal = () => {
    setSelectedVideo(null);
    setIsVideoModalOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  // Masonry breakpoint configuration for responsive columns
  const breakpointColumnsObj: { default: number; [key: number]: number } = useMemo(() => {
    if (videoSize <= 1) return { default: 1, 640: 1, 768: 1, 1024: 1, 1280: 1 };
    if (videoSize <= 2) return { default: 2, 640: 1, 768: 1, 1024: 2, 1280: 2 };
    if (videoSize <= 3) return { default: 3, 640: 1, 768: 2, 1024: 2, 1280: 3 };
    if (videoSize <= 4) return { default: 4, 640: 1, 768: 2, 1024: 3, 1280: 4 };
    if (videoSize <= 5) return { default: 5, 640: 1, 768: 2, 1024: 3, 1280: 4 };
    if (videoSize <= 6) return { default: 6, 640: 2, 768: 3, 1024: 4, 1280: 5 };
    return { default: 6, 640: 2, 768: 3, 1024: 4, 1280: 5 };
  }, [videoSize]);

  return (
    <div className="w-full h-full space-y-6">
      {/* Video Gallery */}
      {allItems.length > 0 ? (
        <div className="space-y-4">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {allItems.map((item) => {
              if (item.kind === 'progress') {
                // New job-based progress card with smooth animation
                return (
                  <VideoProgressCard 
                    key={item.id} 
                    job={item.progress} 
                    onDismiss={() => removeVideoProgress(item.progress.id)}
                  />
                );
              } else if (item.kind === 'pending') {
                // Legacy pending video card
                return (
                  <div
                    key={item.id}
                    className="masonry-item group relative overflow-visible transition-all duration-300 animate-fade-in bg-[#0a1442b3] border border-white/15 hover:border-white/25 z-10 mb-4 rounded-[8px]"
                    style={{ borderRadius: '5px' }}
                  >
                    <div className="overflow-visible w-full" style={{ borderRadius: '5px', zIndex: 0 }}>
                      {(() => {
                        const modelRes = getModelResolution(item.modelId || 'luma-ray-flash-2-540p');
                        return (
                          <div 
                            className="media bg-transparent"
                            style={{ aspectRatio: `${modelRes.w} / ${modelRes.h}`, overflow: 'hidden' }}
                          >
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
                              <div className="flex flex-col items-center space-y-2">
                                <Clock className="w-8 h-8 text-blue-500" />
                                <span className="text-white text-sm">Generating video...</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              } else {
                // Completed video card
                return (
                  <div
                key={item.id}
                className={`masonry-item group relative overflow-visible transition-all duration-300 animate-fade-in bg-[#0a1442b3] border border-white/15 hover:border-white/25 mb-4 rounded-[8px] ${
                  showInfoForVideo === item.video.id ? "z-[80]" : "z-10"
                }`}
                style={{ borderRadius: '5px', overflow: 'visible' }}
              >
                {/* Content Display - matching public gallery */}
                <div className="overflow-visible w-full" style={{ borderRadius: '5px', zIndex: 0 }}>
                  {((item.video.status === "completed" || item.video.status === "succeeded") && item.video.url) ? (
                    <EnhancedVideoCard 
                      video={{
                        ...item.video,
                        url: item.video.url || null,
                        width: item.video.width || 720,
                        height: item.video.height || 1280
                      }} 
                      videoSize={{ width: item.video.width || 720, height: item.video.height || 1280 }} 
                      onOpenModal={(video) => handleOpenVideoModal(video as Video)}
                      onRegenerate={(video) => handleRegenerateVideo(video as Video)}
                    />
                  ) : item.video.status === "pending" || item.video.status === "processing" ? (
                    (() => {
                      // Use video dimensions if available, otherwise parse aspectRatio, fallback to model presets
                      let w, h;
                      if (item.video.width && item.video.height) {
                        w = item.video.width;
                        h = item.video.height;
                      } else if (item.video.aspectRatio) {
                        // Parse aspect ratio like "9:16" or "16:9"
                        const [aspectW, aspectH] = item.video.aspectRatio.split(':').map(Number);
                        if (aspectW && aspectH) {
                          w = aspectW * 100; // Scale up for reasonable dimensions
                          h = aspectH * 100;
                        } else {
                          const modelRes = getModelResolution(item.video.model || 'luma-ray-flash-2-540p');
                          w = modelRes.w;
                          h = modelRes.h;
                        }
                      } else {
                        const modelRes = getModelResolution(item.video.model || 'luma-ray-flash-2-540p');
                        w = modelRes.w;
                        h = modelRes.h;
                      }
                      
                      return (
                        <div 
                          className="media bg-transparent"
                          style={{ aspectRatio: `${w} / ${h}`, overflow: 'hidden' }}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
                            <div className="flex flex-col items-center space-y-2">
                              <Clock className="w-8 h-8 text-blue-500" />
                              <span className="text-white text-sm">Processing video...</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : item.video.status === "failed" ? (
                    (() => {
                      // Use video dimensions if available, otherwise parse aspectRatio, fallback to model presets
                      let w, h;
                      if (item.video.width && item.video.height) {
                        w = item.video.width;
                        h = item.video.height;
                      } else if (item.video.aspectRatio) {
                        const [aspectW, aspectH] = item.video.aspectRatio.split(':').map(Number);
                        if (aspectW && aspectH) {
                          w = aspectW * 100;
                          h = aspectH * 100;
                        } else {
                          const modelRes = getModelResolution(item.video.model);
                          w = modelRes.w;
                          h = modelRes.h;
                        }
                      } else {
                        const modelRes = getModelResolution(item.video.model);
                        w = modelRes.w;
                        h = modelRes.h;
                      }
                      
                      return (
                        <div 
                          className="media bg-transparent"
                          style={{ aspectRatio: `${w} / ${h}`, overflow: 'hidden' }}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 pointer-events-none">
                            <XCircle className="w-8 h-8 text-red-400" />
                            <span className="text-red-300 text-sm">Generation failed</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    (() => {
                      const { w, h } = getModelResolution(item.video.model);
                      return (
                        <div 
                          className="media bg-transparent"
                          style={{ aspectRatio: `${w} / ${h}`, overflow: 'hidden' }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <VideoIcon className="w-8 h-8 text-gray-500" />
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Only show hover overlay and buttons for completed videos */}
                {item.video.status === "completed" && (
                  <>
                    {/* Hover overlay with actions at top-right - matching image gallery */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    
                    {/* Unified hover buttons */}
                    <HoverButtons
                      onInfoToggle={(e) => {
                        if (e) e.stopPropagation();
                        setShowInfoForVideo(showInfoForVideo === item.video.id ? null : item.video.id);
                      }}
                      onDelete={() => {
                        if (confirm('Are you sure you want to delete this video?')) {
                          deleteMutation.mutate(item.video.id);
                        }
                      }}
                      onDownload={item.video.url ? () => handleDownload(item.video) : undefined}
                      isPublic={item.video.isPublic}
                      onVisibilityToggle={() => visibilityMutation.mutate({ id: item.video.id, isPublic: !item.video.isPublic })}
                      isFavorited={bulkVideoFavoriteStatus?.[item.video.id]}
                      onFavoriteToggle={() => {
                        const heartButton = document.querySelector(`[data-video-id="${item.video.id}"] .heart-favorite-btn`);
                        if (heartButton) {
                          (heartButton as HTMLElement).click();
                        }
                      }}
                    />

                    {/* Info tooltip - Card-relative positioning (top-right) like OptimizedPublicGallery */}
                    {showInfoForVideo === item.video.id && (
                      <div 
                        className="prompt-tooltip"
                        role="tooltip"
                        style={{
                          position: 'absolute',
                          top: '48px',
                          right: '16px',
                          minWidth: '200px',
                          maxWidth: '90vw',
                          zIndex: 120,
                          pointerEvents: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="flex-1 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                            {item.video.prompt}
                          </p>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUsePrompt(item.video.prompt);
                              }}
                              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                              aria-label={t('accessibility.usePrompt', 'Use prompt')}
                              data-testid="button-use-prompt"
                              title={t('accessibility.usePrompt', 'Use prompt')}
                            >
                              <Type className="w-3 h-3 text-white" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(item.video.prompt);
                                toast({
                                  title: t('toasts.copied'),
                                  description: t('toasts.promptCopied'),
                                });
                              }}
                              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                              aria-label={t('accessibility.copyPrompt')}
                              data-testid="button-copy-prompt"
                            >
                              <Copy className="w-3 h-3 text-white" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowInfoForVideo(null);
                              }}
                              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                              aria-label={t('accessibility.close')}
                              data-testid="button-close-info"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-white/10 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div>{getDisplayName(item.video.model)}</div>
                            <div>{item.video.duration}s • {item.video.aspectRatio}</div>
                          </div>
                          {item.video.startFrameUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSourceImageLightbox(item.video.startFrameUrl!);
                              }}
                              className="flex-shrink-0 group/img relative overflow-hidden rounded border border-white/20 hover:border-white/40 transition-all"
                              title={t('videoStudio.sourceImage', 'Source image')}
                            >
                              <img
                                src={item.video.startFrameUrl}
                                alt={t('videoStudio.sourceImage', 'Source image')}
                                className="w-10 h-10 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hidden VideoFavoriteIndicator for functionality */}
                    <div className="hidden" data-video-id={item.video.id}>
                      <VideoFavoriteIndicator 
                        videoId={item.video.id} 
                        initialFavorited={bulkVideoFavoriteStatus?.[item.video.id] || false}
                        showAlways={true}
                        className="heart-favorite-btn"
                      />
                    </div>
                  </>
                )}
              </div>
              );
              }
            })}
          </Masonry>
        </div>
      ) : !isLoading && videos.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">{t('pages.videoStudio.noVideosYet')}</div>
          <div className="text-gray-500 text-sm">
            {t('pages.videoStudio.generateFirstVideo')}
          </div>
        </div>
      )}
      {isLoading && (
        <div className="text-center py-8">
          <div className="text-gray-400">{t('pages.videoStudio.loadingVideoGallery')}</div>
        </div>
      )}

      {/* Video Modal */}
      <VideoModal
        video={selectedVideo ? {
          id: selectedVideo.id,
          url: selectedVideo.url || null,
          prompt: selectedVideo.prompt,
          model: selectedVideo.model,
          width: selectedVideo.width || 720,
          height: selectedVideo.height || 1280,
          duration: selectedVideo.duration,
          thumbnailUrl: selectedVideo.thumbnailUrl || null
        } : null}
        isOpen={isVideoModalOpen}
        onClose={handleCloseVideoModal}
      />

      {/* Source Image Lightbox */}
      {sourceImageLightbox && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setSourceImageLightbox(null)}
        >
          <button
            onClick={() => setSourceImageLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={t('accessibility.close')}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={sourceImageLightbox}
            alt={t('videoStudio.sourceImage', 'Source image')}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
