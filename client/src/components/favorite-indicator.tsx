import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { useAuth } from "@/hooks/useAuth";
import { Heart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FavoriteIndicatorProps {
  imageId: number;
  initialFavorited?: boolean;
  className?: string;
  showAlways?: boolean;
  size?: 'default' | 'compact';
  showInGallery?: boolean;
  onToggle?: () => void;
}

export function FavoriteIndicator({ imageId, initialFavorited, className = "", showAlways = false, size = 'default', showInGallery = false, onToggle }: FavoriteIndicatorProps) {
  const { t } = useTranslation();
  const { showErrorToast, showRoleBasedErrorToast } = useAuthAwareToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [localFavorited, setLocalFavorited] = useState(initialFavorited || false);

  const { data: favoriteStatus } = useQuery({
    queryKey: [`/api/images/${imageId}/favorite-status`],
    enabled: initialFavorited === undefined && showAlways === false, // Only fetch if not provided via bulk data and not in gallery
  });

  useEffect(() => {
    if (initialFavorited !== undefined) {
      setLocalFavorited(initialFavorited);
    } else if (favoriteStatus && typeof favoriteStatus === 'object' && 'isFavorited' in favoriteStatus) {
      setLocalFavorited((favoriteStatus as { isFavorited: boolean }).isFavorited);
    }
  }, [initialFavorited, favoriteStatus]);

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/images/${imageId}/favorite`);
      return await response.json();
    },
    onSuccess: (data: any) => {
      const newFavorited = data.isFavorited;
      setLocalFavorited(newFavorited);
      // Invalidate individual image favorite status
      queryClient.invalidateQueries({ queryKey: [`/api/images/${imageId}/favorite-status`] });
      // Invalidate bulk image favorite status queries
      queryClient.invalidateQueries({ queryKey: ["/api/images/bulk-favorite-status"] });
      // Invalidate favorites list
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      onToggle?.();
    },
    onError: (error: any) => {
      // Check if it's a 401 error (from the error message)
      const is401Error = error?.message?.includes("401") || error?.status === 401;
      
      if (is401Error) {
        showErrorToast({
          description: t('toasts.loginToSaveFavorites'),
          isLoginRequired: true
        });
      } else {
        showRoleBasedErrorToast({
          title: "Favorite failed",
          error: error,
          fallbackTitle: "Favorite failed"
        });
      }
    },
  });

  const isFavorited = localFavorited;

  // When showAlways is true, show persistent heart for favorited items with hover interaction
  if (showAlways) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 sm:h-8 sm:w-8 min-h-0 min-w-0 rounded-full p-0 flex items-center justify-center transition-all duration-200 bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm text-white ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          
          if (!isAuthenticated) {
            showErrorToast({
              description: t('toasts.loginToAddFavorites'),
              isLoginRequired: true
            });
            return;
          }
          
          favoriteMutation.mutate();
        }}
        disabled={favoriteMutation.isPending}
      >
        <Heart 
          className={`w-4 h-4 transition-all duration-200 ${isFavorited ? "fill-current" : ""}`} 
        />
      </Button>
    );
  }

  // Regular hover-only button (for lightbox and other contexts)
  return (
      <Button
      variant="ghost"
      size="sm"
      className={`h-7 w-7 sm:h-8 sm:w-8 min-h-0 min-w-0 p-0 flex items-center justify-center rounded-full transition-all duration-200 bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm text-white ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        
        if (!isAuthenticated) {
          showErrorToast({
            description: t('toasts.loginToAddFavorites'),
            isLoginRequired: true
          });
          return;
        }
        
        favoriteMutation.mutate();
      }}
      disabled={favoriteMutation.isPending}
    >
      <Heart 
        className={`w-4 h-4 transition-all duration-200 ${isFavorited ? "fill-current" : ""}`} 
      />
    </Button>
  );
}
