import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Clapperboard as VideoIcon, WandSparkles as Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Video {
  id: number;
  url: string | null;
  prompt: string;
  model: string;
  width: number;
  height: number;
  duration?: number;
  thumbnailUrl?: string | null;
  aspectRatio?: string;
  startFrameUrl?: string;
}

interface EnhancedVideoCardProps {
  video: Video;
  videoSize: { width: number; height: number };
  onOpenModal: (video: Video) => void;
  onRegenerate?: (video: Video) => void;
}

export default function EnhancedVideoCard({ video, videoSize, onOpenModal, onRegenerate }: EnhancedVideoCardProps) {
  const { t } = useTranslation();
  const minimalBadgeClass = "bg-black/40 text-white/85 border border-white/20 px-2 py-0.5 rounded-md text-[11px] font-normal shadow-none";
  const actionIconButtonClass = "bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm";
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
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
            // Once visible, stop observing to prevent re-triggering
            observer.unobserve(container);
          }
        });
      },
      { 
        rootMargin: '200px', // Start loading slightly before visible
        threshold: 0 
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Pause video when scrolled out of view
  useEffect(() => {
    if (!isPlaying) return;
    
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && isPlaying && videoRef.current) {
            videoRef.current.pause();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isPlaying]);

  const updateTooltip = useCallback(() => {
    if (isPlaying) {
      setTooltipText("Click again to enlarge");
    } else {
      setTooltipText("Click to play");
    }
  }, [isPlaying]);

  useEffect(() => {
    updateTooltip();
  }, [updateTooltip]);

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!videoRef.current) return;

    if (isPlaying) {
      onOpenModal(video);
    } else {
      videoRef.current.play().catch(() => {
        console.log('Autoplay prevented');
      });
    }
  }, [isPlaying, video, onOpenModal]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const getAspectRatio = () => {
    return `${video.width} / ${video.height}`;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden cursor-pointer"
      style={{ 
        aspectRatio: getAspectRatio(),
        borderRadius: '5px'
      }}
      onClick={handleVideoClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Placeholder skeleton shown until video is visible */}
      {!isVisible && (
        <div className="absolute inset-0 bg-slate-800/50 flex items-center justify-center animate-pulse">
          <VideoIcon className="w-8 h-8 text-slate-500" />
        </div>
      )}

      {/* Video Element - only render when visible, loads metadata for thumbnail */}
      {isVisible && (
        <video
          ref={videoRef}
          src={video.url || undefined}
          className="w-full h-full object-cover"
          poster={video.thumbnailUrl || undefined}
          preload="metadata"
          loop
          muted
          playsInline
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handlePause}
          onLoadedMetadata={(e) => {
            const videoElement = e.target as HTMLVideoElement;
            videoElement.currentTime = 0.1;
            setVideoLoaded(true);
          }}
        />
      )}

      {/* Play/Pause Overlay - Only show when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
          <div className="w-11 h-11 sm:w-12 sm:h-12 min-w-0 min-h-0 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center hover:scale-105 transition-transform">
            <Play className="w-5 h-5 text-white/95 ml-0.5" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Duration Badge */}
      {video.duration && (
        <div className={`absolute top-2 left-2 ${minimalBadgeClass} pointer-events-none`}>
          {Math.floor(video.duration)}s
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-2 py-1 rounded text-xs pointer-events-none whitespace-nowrap z-10">
          {tooltipText}
        </div>
      )}

      {/* Subtle playing indicator overlay */}
      {isPlaying && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse pointer-events-none"></div>
      )}

      {/* Regenerate button - bottom right corner */}
      {onRegenerate && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegenerate(video);
          }}
          className={`absolute bottom-2 right-2 w-7 h-7 sm:w-8 sm:h-8 md:w-7 md:h-7 min-w-0 min-h-0 rounded-full flex items-center justify-center transition-colors z-10 ${actionIconButtonClass}`}
          title={t('videoStudio.regenerateVideo', 'Regenerate video')}
        >
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}
