import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import VideoSidebar from "@/components/video-sidebar";
import VideoFilterBar from "@/components/video-filter-bar";
import VideoGallery from "@/components/video-gallery";
import { useBulkVideoFavoriteStatus } from "@/hooks/useBulkVideoFavoriteStatus";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVideoStore } from "@/stores/video-store";

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
}

export default function VideoStudio() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { referenceImage } = useVideoStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const [videoSize, setVideoSize] = useState(isMobile ? 1 : 4);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Track the last processed reference image URL to avoid reopening for the same image
  const lastProcessedImageRef = useRef<string | null>(null);

  // Keep videoSize at 1 on mobile
  useEffect(() => {
    if (isMobile) {
      setVideoSize(1);
    }
  }, [isMobile]);

  // Auto-open mobile sidebar when reference image is loaded
  useEffect(() => {
    if (isMobile && referenceImage && referenceImage.url !== lastProcessedImageRef.current) {
      setMobileSidebarOpen(true);
      lastProcessedImageRef.current = referenceImage.url;
    }
  }, [isMobile, referenceImage]);

  // Fetch user videos with status polling
  const { data: videos = [], isLoading, refetch } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
    staleTime: 10 * 1000, // 10 seconds (shorter for faster updates)
    refetchInterval: 2000, // Poll every 2 seconds to catch status updates quickly
    refetchIntervalInBackground: false, // Only poll when tab is active
  });

  const handleVideoGenerated = useCallback(() => {
    refetch();
  }, [refetch]);

  // Get bulk video favorite status for all user videos
  const videoIds = useMemo(() => videos.map(video => video.id), [videos]);
  const { data: bulkVideoFavoriteStatus = {} } = useBulkVideoFavoriteStatus(videoIds);




  // Memoized filtering
  const filteredVideos = useMemo(() => {
    return videos
      .filter((video) => {
        // Search filter
        const matchesSearch = !searchQuery || 
          video.prompt.toLowerCase().includes(searchQuery.toLowerCase());

        // Filter by favorites if favorites filter is active
        const matchesFilters = activeFilters.length === 0 || 
          !activeFilters.includes("favorites") || 
          bulkVideoFavoriteStatus?.[video.id] === true;

        return matchesSearch && matchesFilters;
      })
      .sort((a, b) => {
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
  }, [videos, searchQuery, activeFilters, sortBy, bulkVideoFavoriteStatus]);

  const handleFilterChange = useCallback((filterString: string) => {
    const newFilters =
      filterString === ""
        ? []
        : filterString
            .split(",")
            .filter((f) => f.length > 0 && f !== "newest");
    setActiveFilters(newFilters);
  }, []);

  const handleSearchChange = useCallback((searchString: string) => {
    setSearchQuery(searchString);
  }, []);

  const handleVideoClick = useCallback((video: Video) => {
    setSelectedVideo(video);
  }, []);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="flex h-full min-h-0">
      {/* Desktop Sidebar */}
      <div className="hidden md:block flex-shrink-0 md:sticky md:top-[60px] md:self-start md:h-[calc(100vh-60px)] overflow-y-auto">
        <VideoSidebar onVideoGenerated={handleVideoGenerated} />
      </div>
      
      <main className="flex-1 flex flex-col min-h-0">
        {/* Mobile-optimized header - Sticky */}
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-[52px] md:top-[60px] z-30">
          {/* Filter Bar Section - Sticky */}
          <div className="px-4 pt-3 md:pt-8 pb-4">
            <VideoFilterBar
              onFilterChange={handleFilterChange}
              onSearchChange={handleSearchChange}
              onSortChange={setSortBy}
              onVideoSizeChange={setVideoSize}
              videoCount={filteredVideos.length}
              videoSize={videoSize}
              mobileActionSlot={
                <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="parallel-generate-btn inline-flex h-10 items-center justify-center !rounded-[10px] border border-white/20 bg-[linear-gradient(90deg,#2d66f5_0%,#2599f6_100%)] px-3 text-[12px] font-medium leading-none text-white shadow-[0_9px_20px_rgba(44,149,255,0.35)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fd3ff] focus-visible:ring-offset-0"
                    >
                      <Video className="w-3.5 h-3.5 mr-1.5" />
                      <span>{t('generation.generateVideo')}</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-full max-w-[26.4rem] bg-[hsl(var(--dark-surface))] border-gray-800 p-0 overflow-y-auto scrollbar-hide">
                    <VideoSidebar
                      onVideoGenerated={() => {
                        handleVideoGenerated();
                        setMobileSidebarOpen(false);
                      }}
                      onMobileClose={() => setMobileSidebarOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
              }
            />
          </div>
        </div>

        {/* Scrollable gallery area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <VideoGallery 
            videos={filteredVideos} 
            isLoading={isLoading}
            onVideoDeleted={handleVideoGenerated}
            videoSize={videoSize}
            bulkVideoFavoriteStatus={bulkVideoFavoriteStatus}
          />
        </div>
      </main>

    </div>
  );
}
