import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { HoverButtons } from "./HoverButtons";
import type { Image } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { X, Clipboard as Copy } from "lucide-react";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";
import { Badge } from "@/components/ui/badge";

interface ImageGalleryProps {
  images: Image[];
  isLoading: boolean;
  onImageClick: (image: Image) => void;
  onImageDeleted: () => void;
}

export default function ImageGallery({ images, isLoading, onImageClick, onImageDeleted }: ImageGalleryProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showRoleBasedErrorToast, showSuccessToast } = useAuthAwareToast();
  const [favoriteStatuses, setFavoriteStatuses] = useState<Record<number, boolean>>({});
  const [showInfoForImage, setShowInfoForImage] = useState<number | null>(null);
  const justOpenedRef = useRef(false);
  const minimalBadgeClass = "!rounded-md !border-white/20 !bg-black/40 !text-white/85 !px-2 !py-0.5 !text-[11px] !font-normal shadow-none";

  // Use the centralized hook for model display names
  const { getDisplayName: getModelDisplayName } = useImageModelDisplayName();

  // Clear tooltip if the selected image is removed from the list
  useEffect(() => {
    if (showInfoForImage !== null && !images.find(img => img.id === showInfoForImage)) {
      setShowInfoForImage(null);
    }
  }, [images, showInfoForImage]);

  // Fetch bulk favorite status when images change
  useEffect(() => {
    if (images.length > 0) {
      const imageIds = images.map(img => img.id);
      
      apiRequest("POST", "/api/images/bulk-favorite-status", {
        body: JSON.stringify({ imageIds }),
        headers: { "Content-Type": "application/json" }
      })
      .then(response => response.json())
      .then(data => {
        setFavoriteStatuses(data);
      })
      .catch(error => {
        console.error("Failed to fetch favorite statuses:", error);
      });
    }
  }, [images]);

  // Close tooltip when clicking outside or pressing Escape
  useEffect(() => {
    if (showInfoForImage === null) return;

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
      setShowInfoForImage(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInfoForImage(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInfoForImage]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Deleting image with ID:", id);
      const response = await apiRequest("DELETE", `/api/images/${id}`);
      console.log("Delete response:", response);
      return response;
    },
    onSuccess: () => {
      console.log("Delete successful");
      showSuccessToast(
        t('toasts.imageDeleted'),
        t('toasts.imageDeletedDescription')
      );
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      onImageDeleted();
    },
    onError: (error: Error) => {
      console.error("Delete error:", error);
      showRoleBasedErrorToast({
        title: t('toasts.deleteFailed'),
        error: error,
        fallbackTitle: t('toasts.deleteFailed')
      });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Toggling favorite for image ID:", id);
      const response = await apiRequest("PATCH", `/api/images/${id}/favorite`);
      const data = await response.json();
      console.log("Favorite response:", data);
      return data;
    },
    onSuccess: (data, id) => {
      console.log("Favorite toggle successful:", data);
      // Update local state immediately for better UX
      setFavoriteStatuses(prev => ({
        ...prev,
        [id]: data.isFavorited
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      // Also refresh the gallery to ensure consistency
      onImageDeleted();
    },
    onError: (error: Error) => {
      console.error("Failed to update favorite status:", error);
      showRoleBasedErrorToast({
        title: t('toasts.favoriteFailed'),
        error: error,
        fallbackTitle: t('toasts.favoriteFailed')
      });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      console.log("Updating visibility for image ID:", id, "to", isPublic);
      const response = await apiRequest("PATCH", `/api/images/${id}/visibility`, {
        body: JSON.stringify({ isPublic }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      console.log("Visibility response:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Visibility update successful:", data);
      showSuccessToast(
        t('toasts.visibilityUpdated'),
        t('toasts.visibilityUpdatedDescription')
      );
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      onImageDeleted(); // Refresh the gallery
    },
    onError: (error: Error) => {
      console.error("Visibility update error:", error);
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
      
      showRoleBasedErrorToast({
        title: t('toasts.updateFailed'),
        error: error,
        fallbackTitle: t('toasts.updateFailed')
      });
    },
  });

  const handleDownload = (image: Image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const preloadImage = (url: string) => {
    const img = new Image();
    img.src = url;
    if ('decode' in img) {
      img.decode().catch(() => {
        // Ignore decode errors, image will still load normally
      });
    }
  };



  if (isLoading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="text-center py-12">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--accent-primary))]"></div>
            <span className="text-lg text-gray-300">Loading images...</span>
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="text-center py-24">
          <div className="w-24 h-24 mx-auto mb-6 bg-[hsl(var(--dark-elevated))] rounded-2xl flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">No images yet</h3>
          <p className="text-gray-500 mb-6">Start creating amazing AI-generated artwork</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {images.map((image) => (
          <div 
            key={image.id} 
            className="group relative gradient-border rounded-xl hover:scale-[1.02] transition-all duration-300 animate-fade-in cursor-pointer z-10"
            style={{ overflow: 'visible' }}
            onClick={() => onImageClick(image)}
            onMouseEnter={() => preloadImage(image.url)}
          >
            {/* Card content wrapper with z-index 0 to create stacking context */}
            <div style={{ zIndex: 0 }}>
              {/* Inner wrapper for image with overflow-hidden to maintain rounded corners */}
              <div className="overflow-hidden rounded-xl">
                {image.url && image.url !== '{}' && image.url !== '' && (image.url.startsWith('http') || image.url.startsWith('/images/')) ? (
                  <img 
                    src={image.thumbnailUrl || image.url} 
                    alt={image.prompt} 
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      // Apply actual image dimensions for correct aspect ratio
                      if (img.naturalWidth && img.naturalHeight) {
                        img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
                      }
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'w-full aspect-square bg-gray-800 flex items-center justify-center text-gray-400 text-sm';
                        errorDiv.innerHTML = 'Image unavailable';
                        parent.appendChild(errorDiv);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
                    Image unavailable
                  </div>
                )}
              </div>
              
              {/* Hover overlay - outside inner wrapper to cover entire card */}
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              
              {/* Upscaled badge - positioned at bottom left since icons are at top */}
              {(image.style === "upscaled" || image.tags?.includes("upscaled")) && (
                <div className="absolute bottom-2 left-2 z-20">
                  <Badge variant="outline" className={minimalBadgeClass}>
                    {t('landing.badges.upscaled')}
                  </Badge>
                </div>
              )}
              
              {/* Unified hover buttons */}
              <HoverButtons
                onInfoToggle={(e) => {
                  if (e) e.stopPropagation();
                  setShowInfoForImage(showInfoForImage === image.id ? null : image.id);
                }}
                onDownload={() => handleDownload(image)}
                onDelete={() => {
                  if (confirm('Are you sure you want to delete this image?')) {
                    deleteMutation.mutate(image.id);
                  }
                }}
                isPublic={image.isPublic}
                onVisibilityToggle={() => visibilityMutation.mutate({ id: image.id, isPublic: !image.isPublic })}
                isFavorited={favoriteStatuses[image.id]}
                onFavoriteToggle={() => favoriteMutation.mutate(image.id)}
              />
            </div>

            {/* Info tooltip - Card-relative positioning (top-right) like OptimizedPublicGallery */}
            {showInfoForImage === image.id && (
              <div 
                className="prompt-tooltip"
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '16px',
                  minWidth: '200px',
                  maxWidth: '90vw',
                  zIndex: 50,
                  pointerEvents: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="flex-1">
                    {image.prompt}
                  </p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(image.prompt);
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
                        setShowInfoForImage(null);
                      }}
                      className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      aria-label={t('accessibility.close')}
                      data-testid="button-close-info"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-white/10">
                  <div>{getModelDisplayName(image.model)}</div>
                  <div>{image.width}x{image.height}</div>
                </div>
              </div>
            )}

            {/* Bottom info overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-sm text-white font-medium mb-2 line-clamp-2">{image.prompt}</p>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>{image.width}x{image.height}</span>
                <span>{getModelDisplayName(image.model)}</span>
                <span>{image.isPublic ? t('common.public') : t('common.private')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

