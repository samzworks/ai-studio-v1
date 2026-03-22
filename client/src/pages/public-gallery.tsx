import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImagePlus as ImageIcon, Clapperboard as Video, ArrowDownToLine as Download, Clipboard as Copy } from "lucide-react";
import { Image } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useBulkFavoriteStatus } from "@/hooks/useBulkFavoriteStatus";
import { useBulkVideoFavoriteStatus } from "@/hooks/useBulkVideoFavoriteStatus";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import GalleryToolbar from "@/components/gallery-toolbar";
import Lightbox from "@/components/lightbox";
import { OptimizedPublicGallery } from "@/components/OptimizedPublicGallery";
import { MasonryGallerySkeleton } from "@/components/GallerySkeleton";
import { useGalleryPerformanceMetrics, trackApiTiming } from "@/hooks/usePerformanceMetrics";
import { useTranslation } from "react-i18next";

// Media asset type for gallery
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
  tags?: string[];
  quality?: string;
  style?: string;
  provider?: string;
  status?: string;
  isFeatured?: boolean;
  isStickyTop?: boolean;
}

type ContentItem = MediaAsset;

export default function PublicGallery() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState(""); // Separate input state
  const [sortBy, setSortBy] = useState("newest");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showInfoForItem, setShowInfoForItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Initialize performance tracking
  useGalleryPerformanceMetrics();
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const tooltip = document.getElementById(`tooltip-${showInfoForItem}`);
      const infoButton = document.querySelector(`[aria-describedby="tooltip-${showInfoForItem}"]`);
      
      if (showInfoForItem && tooltip && infoButton) {
        if (!tooltip.contains(e.target as Node) && !infoButton.contains(e.target as Node)) {
          setShowInfoForItem(null);
          setTooltipPosition(null);
        }
      }
    };
    
    if (showInfoForItem) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showInfoForItem]);


  // Fetch curated gallery items (admin-selected public items) with performance tracking
  const { data: curatedItems = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/gallery/curated"],
    queryFn: async () => {
      const startTime = performance.now();
      const response = await fetch("/api/gallery/curated");
      if (!response.ok) throw new Error("Failed to fetch gallery");
      const data = await response.json();
      const duration = performance.now() - startTime;
      trackApiTiming("/api/gallery/curated", duration, data.length);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Separate images and videos from curated items for compatibility
  const images = curatedItems.filter(item => item.type === 'image');
  const videos = curatedItems.filter(item => item.type === 'video');

  // Fetch user favorites (only if authenticated)
  const { data: favorites = [] } = useQuery({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to fetch favorites");
      return response.json();
    },
  });

  // Memoized image IDs for bulk favorite status checking
  const imageIds = useMemo(() => {
    return images.map((img) => img.id).sort((a: number, b: number) => a - b); // Stable sort for consistent queryKey
  }, [images]);
  
  // Memoized video IDs for bulk favorite status checking
  const videoIds = useMemo(() => {
    return videos.map((vid) => vid.id).sort((a: number, b: number) => a - b); // Stable sort for consistent queryKey
  }, [videos]);
  
  const { data: bulkFavoriteStatus = {} } = useBulkFavoriteStatus(imageIds);
  const { data: bulkVideoFavoriteStatus = {} } = useBulkVideoFavoriteStatus(videoIds);

  // Update isFavorited when selectedContent changes - use bulk data
  useEffect(() => {
    if (selectedContent && selectedContent.type === 'image' && bulkFavoriteStatus) {
      setIsFavorited(bulkFavoriteStatus[selectedContent.id] || false);
    } else if (selectedContent && selectedContent.type === 'video' && bulkVideoFavoriteStatus) {
      setIsFavorited(bulkVideoFavoriteStatus[selectedContent.id] || false);
    }
  }, [selectedContent, bulkFavoriteStatus, bulkVideoFavoriteStatus]);

  const executeSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput]);

  const handleToggleChange = (nextIds: string[]) => {
    setActiveFilters(nextIds.filter((id) => id !== "newest"));
  };

  const handleClearAll = () => {
    setSearchInput("");
    setSearchQuery("");
    setActiveFilters([]);
    setSortBy("newest");
  };

  // Curated items are pre-sorted by the server: sticky -> featured -> regular, all by sortOrder
  // Just use directly - the server handles the ordering
  const allContent = useMemo(() => curatedItems, [curatedItems]);

  // Filter logic that handles favorites first, then applies other filters
  const filteredContent = (() => {
    let sourceContent = allContent;

    // If favorites filter is active, show favorited images and videos
    if (activeFilters.includes("favorites")) {
      if (!isAuthenticated) {
        return [];
      }
      
      // Get favorited image IDs from the favorites response
      const favoriteImageIds = new Set(favorites.map((fav: any) => fav.id));
      
      sourceContent = allContent.filter((item) => {
        if (item.type === 'image') {
          return favoriteImageIds.has(item.id);
        } else if (item.type === 'video') {
          return bulkVideoFavoriteStatus[item.id] || false;
        }
        return false;
      });
    }

    const filtered = sourceContent
      .filter((item: ContentItem) => {
        // Search filter
        const matchesSearch = !searchQuery || 
          item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ('tags' in item && item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

        // Advanced filters (excluding favorites as it's handled above)
        const nonFavoriteFilters = activeFilters.filter(f => f !== "favorites");
        const matchesFilters = nonFavoriteFilters.length === 0 || nonFavoriteFilters.some(filter => {
          switch (filter) {
            case "images":
              return item.type === 'image';
            case "videos":
              return item.type === 'video';
            default:
              return true;
          }
        });

        return matchesSearch && matchesFilters;
      });
    
    // Only apply custom sort if user explicitly selected something other than default
    // Default ("newest") preserves server ordering (sticky -> featured -> regular by sortOrder)
    if (sortBy !== "newest") {
      return filtered.sort((a: ContentItem, b: ContentItem) => {
        switch (sortBy) {
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "prompt":
            return a.prompt.localeCompare(b.prompt);
          case "size":
            return (b.width * b.height) - (a.width * a.height);
          default:
            return 0;
        }
      });
    }
    
    return filtered;
  })();

  const handleContentClick = (content: ContentItem) => {
    setSelectedContent(content);
  };

  const handleDownload = (content: ContentItem) => {
    const link = document.createElement('a');
    link.href = content.url || '';
    link.download = `ai-studio-${content.id}.${content.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = (content: ContentItem) => {
    navigator.clipboard.writeText(content.prompt).then(() => {
      toast({
        title: t('toasts.copied'),
        description: t('gallery.promptCopied'),
      });
    }).catch(() => {
      toast({
        title: t('toasts.error'),
        description: t('gallery.failedToCopy'),
        variant: "destructive",
      });
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white">
      <div className="w-full px-4 py-8 max-w-none">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#21B0F8] to-[#21B0F8] bg-clip-text text-transparent mb-4">
            {t('pages.gallery.title')}
          </h1>
          <p className="text-gray-300 text-lg">
            {t('pages.publicGallery.description')}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <GalleryToolbar
            searchPlaceholder={t("pages.publicGallery.searchPlaceholder")}
            searchValue={searchQuery}
            searchDraftValue={searchInput}
            onSearchDraftChange={setSearchInput}
            onSearchCommit={executeSearch}
            toggles={[
              { id: "images", label: t("gallery.images"), icon: ImageIcon },
              { id: "videos", label: t("gallery.videos"), icon: Video },
              ...(isAuthenticated
                ? [{ id: "favorites", label: t("gallery.favorites"), icon: Heart }]
                : []),
            ]}
            activeToggleIds={activeFilters}
            onToggleChange={handleToggleChange}
            sortValue={sortBy}
            sortOptions={[
              { value: "newest", label: t("filters.sortOptions.newest") },
              { value: "oldest", label: t("filters.sortOptions.oldest") },
              { value: "prompt", label: t("filters.sortOptions.promptAZ") },
              { value: "size", label: t("filters.sortOptions.size") },
            ]}
            onSortChange={setSortBy}
            countLabel={
              filteredContent.length === 1
                ? t("pages.publicGallery.itemsFound_one", { count: filteredContent.length })
                : t("pages.publicGallery.itemsFound_other", { count: filteredContent.length })
            }
            onClearAll={handleClearAll}
            isMobile={isMobile}
          />
        </div>

        {/* Tooltip Portal - Render tooltip at document level */}
        {showInfoForItem && tooltipPosition && (
          <div 
            id={`tooltip-${showInfoForItem}`}
            className="prompt-tooltip"
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: tooltipPosition.top < 300 ? 'translateY(0)' : 'translateY(-100%)',
              zIndex: 99999,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const [type, idStr] = showInfoForItem.split('-');
              const id = parseInt(idStr);
              const content = filteredContent.find(c => c.type === type && c.id === id);
              if (!content) return null;
              return (
                <>
                  <p className="mb-2 max-h-48 overflow-y-auto">
                    {content.prompt}
                  </p>
                  <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">
                        {content.width}×{content.height}
                      </span>
                    </div>
                    {'tags' in content && content.tags && content.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {content.tags.slice(0, 3).map((tag: string, index: number) => (
                          <span key={index} className="text-xs border border-gray-500 text-gray-300 px-1 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Content Grid */}
        {isLoading ? (
          <MasonryGallerySkeleton count={16} />
        ) : filteredContent.length > 0 ? (
          <OptimizedPublicGallery
            assets={filteredContent}
            favoriteStatus={{
              ...bulkFavoriteStatus,
              ...bulkVideoFavoriteStatus
            }}
            onAssetClick={handleContentClick}
            onFavoriteToggle={(asset, isFavorited) => {
              // Update local state when favorite changes
              queryClient.invalidateQueries({ 
                queryKey: asset.type === 'video' 
                  ? ['/api/videos/bulk-favorite-status'] 
                  : ['/api/images/bulk-favorite-status']
              });
            }}
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">{t('gallery.noPublicContentFound')}</div>
            <div className="text-gray-500 text-sm">
              {searchQuery || activeFilters.length > 0 
                ? t('gallery.adjustFilters')
                : t('gallery.beFirstToShare')
              }
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Images */}
      {selectedContent && selectedContent.type === 'image' && (
        <Lightbox
          image={{
            id: selectedContent.id,
            url: selectedContent.url || '',
            prompt: selectedContent.prompt,
            ownerId: selectedContent.ownerId,
            ownerName: (selectedContent as any).ownerName,
            isPublic: selectedContent.isPublic,
            quality: (selectedContent as any).quality || '',
            style: (selectedContent as any).style || '',
            width: selectedContent.width,
            height: selectedContent.height,
            styleImageUrl: (selectedContent as any).styleImageUrl,
            imageStrength: (selectedContent as any).imageStrength,
            aspectRatio: (selectedContent as any).aspectRatio,
            provider: (selectedContent as any).provider
          }}
          isOpen={!!selectedContent}
          onClose={() => setSelectedContent(null)}
          showActions={true}
          isFavorited={isFavorited}
          onFavoriteToggle={(imageId, newIsFavorited) => {
            setIsFavorited(newIsFavorited);
          }}
          isOwner={user?.id === selectedContent.ownerId}
          images={filteredContent.filter(item => item.type === 'image').map((img) => ({
            id: img.id,
            url: img.url || '',
            prompt: img.prompt,
            ownerId: img.ownerId,
            ownerName: (img as any).ownerName,
            isPublic: img.isPublic,
            quality: (img as any).quality || '',
            style: (img as any).style || '',
            width: img.width,
            height: img.height,
            styleImageUrl: (img as any).styleImageUrl ?? undefined,
            imageStrength: (img as any).imageStrength ?? undefined,
            aspectRatio: (img as any).aspectRatio ?? undefined,
            provider: (img as any).provider ?? undefined
          }))}
          currentIndex={filteredContent.filter(item => item.type === 'image').findIndex((img) => img.id === selectedContent.id)}
          onNavigate={(newIndex) => {
            const imageItems = filteredContent.filter(item => item.type === 'image');
            const newImage = imageItems[newIndex];
            if (newImage) {
              setSelectedContent({ ...newImage, type: 'image' as const });
            }
          }}
        />
      )}

      {/* Video Modal for Videos */}
      {selectedContent && selectedContent.type === 'video' && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedContent(null)}
        >
          <div 
            className="relative bg-gray-900 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedContent(null)}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
            >
              <span className="text-2xl">×</span>
            </Button>
            
            {/* Video Player Container */}
            <div className="bg-black flex items-center justify-center max-w-[90vw] max-h-[85vh]">
              <video
                src={selectedContent.url || ''}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
                poster={selectedContent.thumbnailUrl || ''}
              />
            </div>
            
            {/* Info bar */}
            <div className="absolute bottom-16 left-0 right-0 pointer-events-none">
              <div className="mx-4 mb-2 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-white flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed mb-2">
                      {selectedContent.prompt}
                    </p>
                    <p className="text-xs text-gray-300">
                      {selectedContent.model}
                      {selectedContent.duration && ` • ${Math.floor(selectedContent.duration)}s`}
                      {` • ${selectedContent.width}×${selectedContent.height}`}
                    </p>
                  </div>
                  <div className="flex gap-2 pointer-events-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyPrompt(selectedContent)}
                      className="text-white hover:bg-white/20 flex-shrink-0"
                      title={t('common.copyPrompt')}
                      aria-label={t('accessibility.copyPrompt')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(selectedContent)}
                      className="text-white hover:bg-white/20 flex-shrink-0"
                      title={t('common.download')}
                      aria-label={t('accessibility.downloadVideo')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
