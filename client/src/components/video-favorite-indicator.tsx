import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";

interface VideoFavoriteIndicatorProps {
  videoId: number;
  initialFavorited?: boolean;
  onToggle?: () => void;
  className?: string;
  showAlways?: boolean; // When true, always shows a heart (filled when favorited)
}

export function VideoFavoriteIndicator({ 
  videoId, 
  initialFavorited, 
  onToggle, 
  className = "", 
  showAlways = false 
}: VideoFavoriteIndicatorProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [localFavorited, setLocalFavorited] = useState(initialFavorited || false);

  const { data: favoriteStatus } = useQuery({
    queryKey: [`/api/videos/${videoId}/favorite-status`],
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
      const response = await apiRequest("PATCH", `/api/videos/${videoId}/favorite`);
      return await response.json();
    },
    onSuccess: (data: any) => {
      const newFavorited = data.isFavorited;
      setLocalFavorited(newFavorited);
      // Invalidate individual video favorite status
      queryClient.invalidateQueries({ queryKey: [`/api/videos/${videoId}/favorite-status`] });
      // Invalidate bulk video favorite status queries
      queryClient.invalidateQueries({ queryKey: ["/api/videos/bulk-favorite-status"] });
      // Invalidate favorites list
      queryClient.invalidateQueries({ queryKey: ["/api/videos/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      onToggle?.();
    },
    onError: (error: any) => {
      // Check if it's a 401 error (from the error message)
      const is401Error = error?.message?.includes("401") || error?.status === 401;
      
      if (is401Error) {
        toast({
          title: t("toasts.error"),
          description: t("toasts.unauthorized"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toasts.error"),
          description: t("toasts.failed"),
          variant: "destructive",
        });
      }
    },
  });

  const isFavorited = localFavorited;

  // When showAlways is true, show persistent heart that's always visible
  if (showAlways) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 sm:h-8 sm:w-8 min-h-0 min-w-0 rounded-full p-0 flex items-center justify-center transition-all duration-200 bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm text-white ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          
          if (!isAuthenticated) {
            toast({
              title: t("toasts.error"),
              description: t("toasts.unauthorized"),
              variant: "destructive",
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

  // Default behavior for thumbnails and cards
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 w-7 sm:h-8 sm:w-8 min-h-0 min-w-0 p-0 flex items-center justify-center force-circular transition-all duration-200 bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm text-white ${
        isFavorited ? "" : "opacity-0 group-hover:opacity-100"
      } ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        
        if (!isAuthenticated) {
          toast({
            title: t("toasts.error"),
            description: t("toasts.unauthorized"),
            variant: "destructive",
          });
          return;
        }
        
        favoriteMutation.mutate();
      }}
      disabled={favoriteMutation.isPending}
    >
      <Heart 
        className={`w-3 h-3 transition-all duration-200 ${isFavorited ? "fill-current" : ""}`} 
      />
    </Button>
  );
}
