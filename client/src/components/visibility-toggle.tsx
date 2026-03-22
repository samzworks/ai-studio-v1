import { useState, useEffect } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface VisibilityToggleProps {
  imageId?: number;
  videoId?: number;
  isPublic: boolean;
}

export function VisibilityToggle({ imageId, videoId, isPublic }: VisibilityToggleProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (showSuccess) {
      const timeout = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [showSuccess]);

  const toggleVisibilityMutation = useMutation({
    mutationFn: async () => {
      if (imageId) {
        return await apiRequest("PATCH", `/api/images/${imageId}/visibility`, {
          isPublic: !isPublic,
        });
      } else if (videoId) {
        return await apiRequest("PATCH", `/api/videos/${videoId}/visibility`, {
          isPublic: !isPublic,
        });
      }
      throw new Error("No ID provided");
    },
    onSuccess: () => {
      setShowSuccess(true);
      if (imageId) {
        queryClient.invalidateQueries({ queryKey: ["/api/images"] });
        queryClient.invalidateQueries({ queryKey: ["/api/images/public"] });
      } else if (videoId) {
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/videos/public"] });
      }
      // Also invalidate history queries for my gallery page
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/history";
        }
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: t('toasts.unauthorized'),
          description: t('toasts.unauthorizedDescription'),
          variant: "error-outline" as any,
          toastType: "error",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = error.message || "";
      
      // Check for feature not available error (403 status or error codes in message)
      const isFeatureNotAvailable = errorMessage.includes("403") ||
                                     errorMessage.includes("FEATURE_NOT_AVAILABLE") || 
                                     errorMessage.includes("does not allow") ||
                                     errorMessage.includes("can_make_private") ||
                                     errorMessage.includes("upgrade");
      
      if (isFeatureNotAvailable) {
        // User is trying to make content private but doesn't have permission
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
        variant: "error-outline" as any,
        toastType: "error",
      });
    },
  });

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAuthenticated) {
      toggleVisibilityMutation.mutate();
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      onClick={handleToggleVisibility}
      className={`w-7 h-7 md:w-6 md:h-6 min-w-0 min-h-0 rounded-full flex items-center justify-center opacity-100 transition-all ${
        showSuccess 
          ? "bg-green-500/80 hover:bg-green-500/90" 
          : "bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm"
      }`}
      disabled={toggleVisibilityMutation.isPending}
      title={isPublic ? "Make private" : "Make public"}
      aria-label={isPublic ? "Make private" : "Make public"}
      data-testid={`visibility-toggle-${imageId || videoId}`}
    >
      {showSuccess ? (
        <Check className="w-4 h-4 text-white" />
      ) : isPublic ? (
        <EyeOff className="w-4 h-4 text-white" />
      ) : (
        <Eye className="w-4 h-4 text-white" />
      )}
    </button>
  );
}


