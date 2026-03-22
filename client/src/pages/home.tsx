import { useState, useMemo, useEffect, useCallback, useDeferredValue, useTransition } from "react";
import { useSearch } from "wouter";
import Sidebar from "@/components/sidebar";
import OptimizedGenerationGallery from "@/components/OptimizedGenerationGallery";
import Lightbox from "@/components/lightbox";
import FilterBar from "@/components/filter-bar";
import UserHeader from "@/components/user-header";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import { useGenerationJobs } from "@/hooks/useGenerationJobs";
import type { Image } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { GenerationJob } from "@/components/generation-gallery";
import { usePromptStore } from "@/stores/prompt-store";

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const searchString = useSearch();

  // Parse URL query params to get initial model
  const initialModel = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('model') || undefined;
  }, [searchString]);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");
  const [isPending, startTransition] = useTransition();

  const [imageSize, setImageSize] = useState(isMobile ? 1 : 4);
  const [isFavorited, setIsFavorited] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // SINGLE SOURCE OF TRUTH: Use server jobs for all job state
  // Grid, dropdown, and counters all use this same data
  const {
    jobs: serverJobs,
    activeJobs,
    queuedJobs,
    hasActiveJobs,
    cancelJob
  } = useGenerationJobs();

  // Convert server jobs to GenerationJob format for the gallery
  // Include running, queued, and failed jobs (so users can dismiss failed ones)
  const generationJobs: GenerationJob[] = useMemo(() => {
    return serverJobs
      .filter(job => job.status === 'running' || job.status === 'queued' || job.status === 'failed')
      .map(job => ({
        id: job.id,
        prompt: job.prompt || '',
        status: job.status as 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
        progress: job.progress || 0,
        error: job.error || undefined,
        timestamp: job.createdAt ? new Date(job.createdAt).getTime() : Date.now(),
      }));
  }, [serverJobs]);

  // No need for debouncing since search is triggered manually
  const debouncedSearchQuery = searchQuery;

  // Optimized images query with staleTime
  // Refetch every 2 seconds while generation jobs are running
  const { data: images = [], isLoading, refetch } = useQuery<Image[]>({
    queryKey: ["/api/images"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: hasActiveJobs ? 2000 : false, // Poll every 2s when jobs are active
  });

  // Always fetch favorite status for all images to enable instant filtering
  const imageIds = useMemo(() => {
    return images.map(img => img.id).sort((a, b) => a - b);
  }, [images]);

  const { data: favoriteStatus = {} } = useQuery({
    queryKey: ["/api/images/bulk-favorite-status", ...imageIds],
    queryFn: async () => {
      if (!user?.id || imageIds.length === 0) {
        return {};
      }
      try {
        const response = await apiRequest("POST", "/api/images/bulk-favorite-status", {
          imageIds
        });
        return await response.json();
      } catch (error) {
        console.error('Error fetching favorite status:', error);
        return {};
      }
    },
    enabled: !!user?.id && imageIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update isFavorited when selectedImage changes
  useEffect(() => {
    if (selectedImage && favoriteStatus) {
      setIsFavorited(favoriteStatus[selectedImage.id] || false);
    }
  }, [selectedImage, favoriteStatus]);

  // Update imageSize based on mobile state
  useEffect(() => {
    setImageSize(isMobile ? 1 : 4);
  }, [isMobile]);

  // Auto-open mobile form when navigating from gallery with "Use Image"
  const openMobileForm = usePromptStore(state => state.openMobileForm);
  const setOpenMobileForm = usePromptStore(state => state.setOpenMobileForm);

  useEffect(() => {
    if (isMobile && openMobileForm) {
      setMobileSidebarOpen(true);
      setOpenMobileForm(false);
    }
  }, [isMobile, openMobileForm, setOpenMobileForm]);


  // Optimized filtering with debounced search and memoized expensive operations
  const filteredImages = useMemo(() => {
    // Use debounced search query for better performance
    const searchLower = debouncedSearchQuery.toLowerCase();

    const filtered = images
      .filter(image => {
        // Search filter with search query
        const matchesSearch = !debouncedSearchQuery ||
          image.prompt.toLowerCase().includes(searchLower) ||
          (image.tags && image.tags.some(tag => tag.toLowerCase().includes(searchLower)));

        // Apply filters
        const matchesFilters = activeFilters.length === 0 || activeFilters.some(filter => {
          switch (filter) {
            case "scaled":
              return image.style === "upscaled" || (image.tags && image.tags.includes("upscaled"));
            case "favorites":
              // Only show images that are both created by the current user AND favorited by them
              return user?.id === image.ownerId && favoriteStatus[image.id] === true;
            default:
              return true;
          }
        });

        return matchesSearch && matchesFilters;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "favorites":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "prompt":
            return a.prompt.localeCompare(b.prompt);
          case "size":
            return (b.width * b.height) - (a.width * a.height);
          case "newest":
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

    return filtered;
  }, [images, debouncedSearchQuery, activeFilters, sortBy, favoriteStatus, user?.id]);

  const handleFilterChange = useCallback((filterString: string) => {
    // Handle filters (from filter buttons) - empty string means clear all filters
    const newFilters =
      filterString === ""
        ? []
        : filterString
            .split(",")
            .filter((f) => f.length > 0 && f !== "newest");
    setActiveFilters(newFilters);
  }, []);

  const handleSearchChange = useCallback((searchString: string) => {
    // Handle search query directly - triggered manually via Enter or click
    setSearchQuery(searchString);
  }, []);

  // Handle job count updates from parallel-generation-form
  // The activeJobCount is now just a simple number from the server queue
  const handleJobsUpdate = useCallback((activeJobCount: number) => {
    // Just refresh the jobs from server when job count changes
    queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
  }, []);

  const handleJobCancel = useCallback(async (jobId: string) => {
    try {
      await cancelJob(jobId);
    } catch (error) {
      console.error('[Home] Failed to cancel job:', error);
    }
  }, [cancelJob]);

  const handleImageClick = useCallback((image: Image) => {
    console.log('Image clicked:', image.id); // Debug log
    setSelectedImage(image);
  }, []);

  const handleRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/images"] });
  }, []);

  return (
    <>
      <div className="flex h-full min-h-0">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="flex-shrink-0 md:sticky md:top-[60px] md:self-start md:h-[calc(100vh-60px)] overflow-y-auto">
            <Sidebar
              onImageGenerated={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/images"] });
              }}
              onJobsUpdate={handleJobsUpdate}
              initialModel={initialModel}
            />
          </div>
        )}

        <main className="flex-1">
          {/* Filter Bar with Mobile Generation Button */}
          <div className="flex-shrink-0 bg-background border-b border-border p-4 md:p-4 sticky top-[52px] md:top-[60px] z-30">
            <FilterBar
              onFilterChange={handleFilterChange}
              onSearchChange={handleSearchChange}
              onSortChange={setSortBy}
              onImageSizeChange={setImageSize}
              imageCount={filteredImages.length}
              imageSize={imageSize}
              mobileActionSlot={
                <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="parallel-generate-btn inline-flex h-10 items-center justify-center !rounded-[10px] border border-white/20 bg-[linear-gradient(90deg,#2d66f5_0%,#2599f6_100%)] px-3 text-[12px] font-medium leading-none text-white shadow-[0_9px_20px_rgba(44,149,255,0.35)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fd3ff] focus-visible:ring-offset-0"
                      data-testid="button-mobile-generate"
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5" />
                      {t('generation.generateImage')}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[22rem] bg-sidebar-background border-sidebar-border p-0 overflow-y-auto scrollbar-hide max-w-[88vw]">
                    <Sidebar
                      onImageGenerated={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/images"] });
                        setMobileSidebarOpen(false);
                      }}
                      onJobsUpdate={handleJobsUpdate}
                      onMobileClose={() => setMobileSidebarOpen(false)}
                      initialModel={initialModel}
                    />
                  </SheetContent>
                </Sheet>
              }
            />
          </div>

          <div className="p-2 md:p-6">
            <OptimizedGenerationGallery
              images={filteredImages}
              generationJobs={generationJobs}
              isLoading={isLoading}
              onImageClick={handleImageClick}
              onImageDeleted={handleRefetch}
              onJobCancel={handleJobCancel}
              imageSize={imageSize}
            />
          </div>
        </main>
      </div>

      {selectedImage && (
        <Lightbox
          image={{
            id: selectedImage.id,
            url: selectedImage.url,
            prompt: selectedImage.prompt,
            model: selectedImage.model,
            ownerId: selectedImage.ownerId,
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
            // Invalidate favorites cache to ensure filter updates instantly
            queryClient.invalidateQueries({
              queryKey: ["/api/images/bulk-favorite-status"]
            });
          }}
          onImageDeleted={() => {
            setSelectedImage(null);
            queryClient.invalidateQueries({ queryKey: ["/api/images"] });
          }}
          isOwner={user?.id === selectedImage.ownerId}
          images={filteredImages.map(img => ({
            id: img.id,
            url: img.url,
            prompt: img.prompt,
            model: img.model,
            ownerId: img.ownerId,
            isPublic: img.isPublic,
            quality: img.quality,
            style: img.style,
            width: img.width,
            height: img.height,
            styleImageUrl: img.styleImageUrl ?? undefined,
            imageStrength: img.imageStrength ?? undefined,
            aspectRatio: img.aspectRatio ?? undefined,
            provider: img.provider ?? undefined
          }))}
          currentIndex={filteredImages.findIndex(img => img.id === selectedImage.id)}
          onNavigate={(newIndex) => {
            const newImage = filteredImages[newIndex];
            if (newImage) {
              setSelectedImage(newImage);
            }
          }}
        />
      )}
    </>
  );
}
