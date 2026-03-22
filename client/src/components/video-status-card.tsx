import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { Progress } from "@/components/ui/progress"; // Component not available, will use custom progress
import { Video, Play, ArrowDownToLine as Download, Timer as Clock, CheckCircle, XCircle, Loader2, Eye, EyeOff, Trash as Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { videoPolling } from "@/utils/video-polling";
import { useVideoModelDisplayName } from "@/hooks/useVideoModelDisplayName";

interface VideoStatusCardProps {
  video: {
    id: number;
    prompt: string;
    url: string;
    status: string;
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
    model: string;
    isPublic: boolean;
    createdAt: string;
    replicateId?: string;
    thumbnailUrl?: string;
  };
  onVideoUpdated?: (video: any) => void;
  onVideoDeleted?: (videoId: number) => void;
}

export default function VideoStatusCard({ video, onVideoUpdated, onVideoDeleted }: VideoStatusCardProps) {
  const { showRoleBasedErrorToast, showSuccessToast } = useAuthAwareToast();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showVideo, setShowVideo] = useState(false);
  const { getDisplayName } = useVideoModelDisplayName();

  // Register video for polling if it's pending
  useEffect(() => {
    if (video.replicateId && (video.status === "pending" || video.status === "processing")) {
      videoPolling.addPendingVideo(video.replicateId);
    }
  }, [video.replicateId, video.status]);

  // Check if this video has been marked as completed by the polling manager
  const isPollingCompleted = video.replicateId && videoPolling.isVideoCompleted(video.replicateId);

  // Poll video status if still generating (only for pending/processing videos)
  const pollingEnabled = (video.status === "pending" || video.status === "processing") && !!video.replicateId && !isPollingCompleted;
  
  const { data: statusData, error: statusError } = useQuery({
    queryKey: [`/api/video-status/${video.replicateId}`],
    enabled: pollingEnabled,
    refetchInterval: pollingEnabled ? 3000 : false, // Poll every 3 seconds when enabled
    retry: 2,
    retryDelay: 2000,
    staleTime: 0, // Always fetch fresh data
    gcTime: 10000, // Keep in cache for 10 seconds
    refetchIntervalInBackground: false, // Only poll when tab is active
  }) as { data: { status: string; output?: string; progress?: number; error?: string } | undefined; error: any };

  // Update video visibility
  const visibilityMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      const response = await fetch(`/api/videos/${video.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    onSuccess: (updatedVideo: any) => {
      showSuccessToast(
        "Visibility updated",
        `Video is now ${updatedVideo.isPublic ? 'public' : 'private'}`
      );
      onVideoUpdated?.(updatedVideo);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
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
        title: "Error",
        error: error,
        fallbackTitle: "Error"
      });
    }
  });

  // Delete video
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    onSuccess: () => {
      showSuccessToast(
        "Video deleted",
        "Video has been successfully deleted"
      );
      onVideoDeleted?.(video.id);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      showRoleBasedErrorToast({
        title: "Error",
        error: error,
        fallbackTitle: "Error"
      });
    }
  });

  // Update video status in database when completed
  useEffect(() => {
    if (!statusData) return;

    const statusChanged = video.status !== statusData.status;
    const videoCompleted = statusData.status === "succeeded" && statusData.output && video.status !== "completed";
    const videoFailed = statusData.status === "failed" && video.status !== "failed";
    const videoProcessing = statusData.status === "processing" && video.status === "pending";

    if (videoCompleted) {
      console.log('Video generation completed:', { 
        videoId: video.id, 
        replicateId: video.replicateId,
        url: statusData.output 
      });
      
      // Update video in database with final URL
      fetch(`/api/videos/${video.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          status: "completed", 
          url: statusData.output,
          thumbnailUrl: statusData.output
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((updatedVideo) => {
        console.log('Video updated successfully:', updatedVideo);
        
        // Mark as completed in polling manager
        if (video.replicateId) {
          videoPolling.markVideoCompleted(video.replicateId);
        }
        
        // Aggressive cache invalidation and refetch to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        queryClient.invalidateQueries({ queryKey: [`/api/video-status/${video.replicateId}`] });
        
        // Force immediate refetch of videos list
        queryClient.refetchQueries({ 
          queryKey: ["/api/videos"],
          type: 'active'
        });
        
        onVideoUpdated?.(updatedVideo);
      })
      .catch(error => {
        console.error('Failed to update video status:', error);
      });
    } else if (videoFailed) {
      console.log('Video generation failed:', { 
        videoId: video.id, 
        replicateId: video.replicateId,
        error: statusData.error 
      });
      
      fetch(`/api/videos/${video.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          status: "failed",
          error: statusData.error || "Video generation failed"
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((updatedVideo) => {
        console.log('Video failure status updated:', updatedVideo);
        
        // Mark as completed (failed) in polling manager
        if (video.replicateId) {
          videoPolling.markVideoCompleted(video.replicateId);
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        queryClient.invalidateQueries({ queryKey: [`/api/video-status/${video.replicateId}`] });
        
        // Force immediate refetch of videos list
        queryClient.refetchQueries({ 
          queryKey: ["/api/videos"],
          type: 'active'
        });
        
        onVideoUpdated?.(updatedVideo);
      })
      .catch(error => {
        console.error('Failed to update video failure status:', error);
      });
    } else if (videoProcessing) {
      console.log('Video moved to processing:', { 
        videoId: video.id, 
        replicateId: video.replicateId 
      });
      
      fetch(`/api/videos/${video.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "processing" })
      })
      .then(response => response.ok ? response.json() : null)
      .then((updatedVideo) => {
        if (updatedVideo) {
          queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
          onVideoUpdated?.(updatedVideo);
        }
      })
      .catch(error => {
        console.error('Failed to update processing status:', error);
      });
    }
  }, [statusData, video.id, video.status, video.replicateId, queryClient, onVideoUpdated]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const currentStatus = statusData?.status || video.status;
  const currentUrl = statusData?.output || video.url;
  const progress = statusData?.progress;

  // Check if progress UI should be shown for this video - use currentStatus which includes statusData
  const showProgress = video.replicateId && 
                      (currentStatus === "pending" || currentStatus === "processing" || currentStatus === "starting" || currentStatus === "queued") &&
                      video.model;

  // Debug logging
  useEffect(() => {
    console.log('Video status card update:', {
      videoId: video.id,
      currentStatus,
      currentUrl,
      videoStatus: video.status,
      videoUrl: video.url,
      statusDataOutput: statusData?.output,
      showProgress,
      replicateId: video.replicateId,
      model: video.model
    });
  }, [video.id, currentStatus, currentUrl, video.status, video.url, statusData?.output, showProgress, video.replicateId, video.model]);

  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge className={`${getStatusColor(currentStatus)} text-xs`}>
            <div className="flex items-center gap-1">
              {getStatusIcon(currentStatus)}
              <span className="capitalize">{currentStatus}</span>
            </div>
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{video.duration}s</span>
            <Badge variant="outline" className="text-xs text-gray-300">
              {video.aspectRatio}
            </Badge>
          </div>
        </div>

        {/* Show video progress if generation is in progress */}
        {showProgress && video.replicateId && (
          <div className="mt-3 flex items-center space-x-2 text-blue-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Processing video...</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-gray-700 rounded-lg overflow-hidden">
          {(currentStatus === "completed" || currentStatus === "succeeded") && (currentUrl || statusData?.output) ? (
            showVideo ? (
              <video 
                src={currentUrl}
                controls
                autoPlay
                className="w-full h-full object-cover"
                poster={video.thumbnailUrl || currentUrl}
                onLoadedData={(e) => {
                  // Video loaded successfully
                  const videoEl = e.target as HTMLVideoElement;
                  videoEl.play().catch(() => {
                    // Auto-play might be blocked by browser policy
                    console.log('Auto-play blocked by browser');
                  });
                }}
              />
            ) : (
              <div 
                className="relative w-full h-full bg-gray-600 flex items-center justify-center cursor-pointer group"
                onClick={() => {
                  console.log('Play button clicked, showing video player');
                  setShowVideo(true);
                }}
              >
                {/* Always show video thumbnail using video poster */}
                <video
                  src={statusData?.output || currentUrl}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  poster=""
                  onLoadedMetadata={(e) => {
                    console.log('Video metadata loaded, setting thumbnail for:', statusData?.output || currentUrl);
                    // Generate thumbnail from first frame
                    const video = e.target as HTMLVideoElement;
                    video.currentTime = 0.1; // Seek to 0.1 seconds for first frame
                  }}
                  onError={(e) => {
                    console.error('Video thumbnail load error:', e);
                  }}
                />
                {/* Add key prop to force re-render when URL changes */}
                <div key={statusData?.output || currentUrl} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 min-w-0 min-h-0 rounded-full bg-white/18 border border-white/45 backdrop-blur-[2px] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 text-white/95 ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
            )
          ) : currentStatus === "pending" || currentStatus === "processing" ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="text-gray-300 text-sm">
                {currentStatus === "pending" ? "Queued for generation..." : "Generating video..."}
              </span>
              {progress !== undefined && (
                <div className="w-3/4">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(progress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">{Math.round(progress)}%</p>
                </div>
              )}
            </div>
          ) : currentStatus === "failed" ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
              <XCircle className="w-8 h-8 text-red-400" />
              <span className="text-red-300 text-sm">Generation failed</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="w-8 h-8 text-gray-500" />
            </div>
          )}
        </div>

        {/* Prompt */}
        <div>
          <p className="text-white text-sm line-clamp-3 leading-relaxed">
            {video.prompt}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => visibilityMutation.mutate(!video.isPublic)}
              disabled={visibilityMutation.isPending}
              className="text-gray-400 hover:text-white p-2 h-8 w-8"
            >
              {video.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-gray-400 hover:text-red-400 p-2 h-8 w-8"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentStatus === "completed" && currentUrl && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="text-gray-300 border-gray-600 hover:border-purple-500"
              >
                <a href={currentUrl} download>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-600">
          <div className="flex justify-between items-center">
            <span>Model: {getDisplayName(video.model)}</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
