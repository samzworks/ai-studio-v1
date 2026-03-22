import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { Image } from "@shared/schema";
import { useGenerationJobs } from "@/contexts/GenerationJobsContext";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { createSafeTranslation } from "@/utils/safe-translation";

export interface GenerationJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  imageUrl?: string;
  image?: Image;
  error?: string;
  prompt: string;
  timestamp?: number; // Added for job tracking
}

interface Props {
  jobs: GenerationJob[];
  onCancel: (jobId: string) => void;
  onImageClick: (image: Image) => void;
}

// Individual job component with image load detection
function ProgressJobCard({ job, onCancel, onImageClick }: { job: GenerationJob; onCancel: (jobId: string) => void; onImageClick: (image: Image) => void; }) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { safeT, safeErrorT } = createSafeTranslation(t);
  const [imageLoaded, setImageLoaded] = useState(false);
  const queryClient = useQueryClient();

  // ✅ 1. Add image onLoad → force remove placeholder
  useEffect(() => {
    if (!job?.image?.url && !job?.imageUrl) return;

    const imageUrl = job.image?.url || job.imageUrl;
    if (!imageUrl) return;

    console.log(`[Image Detection] Setting up load detection for job ${job.id}: ${imageUrl}`);
    
    const img = new Image();
    img.src = imageUrl;
    
    img.onload = () => {
      console.log(`[Image Detection] Image loaded for job ${job.id}`);
      setImageLoaded(true);
      
      // Force query refresh to ensure backend is in sync
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    };
    
    img.onerror = () => {
      console.log(`[Image Detection] Image load failed for job ${job.id}`);
    };

    // Clean up
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [job?.image?.url, job?.imageUrl, job.id, queryClient]);

  // Adaptive fallback timeout based on device type
  useEffect(() => {
    if (!job?.image?.url && !job?.imageUrl) return;

    // Check if mobile device for appropriate timeout
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     window.innerWidth <= 768;
    
    // Use longer timeout on mobile due to potentially slower connections
    const timeoutDuration = isMobile ? 8000 : 5000; // 8s on mobile, 5s on desktop
    
    const timeout = setTimeout(() => {
      console.log(`[Fallback Timeout] Force hiding placeholder for job ${job.id} after ${timeoutDuration}ms (mobile: ${isMobile})`);
      setImageLoaded(true);
    }, timeoutDuration);

    return () => clearTimeout(timeout);
  }, [job?.image?.url, job?.imageUrl, job.id]);

  // ✅ Bonus Fix: DOM-based check (if needed)
  useEffect(() => {
    if (!job?.image?.url && !job?.imageUrl) return;

    const imageUrl = job.image?.url || job.imageUrl;
    if (!imageUrl) return;

    // Check if image already exists in DOM and is loaded
    const img = document.querySelector(`img[src="${imageUrl}"]`) as HTMLImageElement;
    if (img && img.complete && img.naturalHeight !== 0) {
      console.log(`[DOM Check] Image already loaded in DOM for job ${job.id}`);
      setImageLoaded(true);
    }
  }, [job?.image?.url, job?.imageUrl, job.id]);

  // ✅ IMAGE-FIRST LOGIC: If image exists, hide placeholder regardless of job status
  const shouldHidePlaceholder = useMemo(() => {
    console.log(`[Debug] Job ${job.id}: status=${job.status}, hasImage=${!!job.image}, hasImageUrl=${!!job.imageUrl}, imageLoaded=${imageLoaded}`);
    
    // PRIMARY RULE: If image exists, hide the placeholder immediately
    if (job.image || job.imageUrl) {
      console.log(`[Image-First] Hiding placeholder for job ${job.id} because image exists`);
      return true;
    }
    
    // SECONDARY: Hide if image is loaded through other means
    if (imageLoaded) {
      console.log(`[Image-First] Hiding placeholder for job ${job.id} because imageLoaded=true`);
      return true;
    }
    
    // TERTIARY: Hide completed jobs (even without image, likely an error state)
    if (job.status === 'completed') {
      console.log(`[Image-First] Hiding placeholder for job ${job.id} because status is completed`);
      return true;
    }
    
    return false;
  }, [job.id, job.status, job.image, job.imageUrl, imageLoaded]);

  if (shouldHidePlaceholder) {
    console.log(`[Placeholder Skip] Not rendering placeholder for job ${job.id} (status: ${job.status}, loaded: ${imageLoaded})`);
    return null;
  }

  return (
    <div
      key={job.id}
      className="relative gradient-border rounded-xl overflow-hidden bg-gray-800/50 animate-fade-in"
    >
      <div className="flex flex-col items-center justify-center aspect-square text-white p-4 animate-pulse">
        {/* Loading spinner */}
        <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mb-3" />
        
        {/* Status text */}
        <div className="text-sm font-medium mb-2">
          {job.status === 'running' ? safeT('progress.generating', {}, 'Generating...') : 
           job.status === 'queued' ? safeT('progress.queued', {}, 'Queued...') : 
           job.status === 'failed' ? safeT('progress.failed', {}, 'Generation failed') : job.status}
        </div>
        
        {/* Progress bar */}
        <div className="w-3/4 mb-2">
          <Progress 
            value={job.progress} 
            className="h-2"
          />
        </div>
        
        {/* Progress percentage */}
        <div className="text-xs text-gray-400">
          {Math.round(job.progress)}%
        </div>
        
        {/* Error message */}
        {job.error && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/20 border-t border-red-500/50 p-2">
            <div className="text-red-400 text-xs text-center line-clamp-2">
              {safeErrorT("progress.generationError", { message: job.error }, isAdmin, { code: 500 })}
            </div>
          </div>
        )}
        
        {/* Cancel button */}
        {(job.status === 'queued' || job.status === 'running') && (
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(job.id);
              }}
              className="bg-white/10 hover:bg-white/20 text-white hover:text-red-400 w-8 h-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {/* Prompt overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <p className="text-white text-xs font-light line-clamp-2">
            {job.prompt}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ImageGenerationProgress({ jobs, onCancel, onImageClick }: Props) {
  const queryClient = useQueryClient();
  const { cancelJob } = useGenerationJobs();
  
  // ✅ CROSS-REFERENCE WITH ACTUAL MEDIA: Remove jobs that have corresponding images/videos
  const { data: existingImages = [] } = useQuery<any[]>({ 
    queryKey: ["/api/images"],
    refetchInterval: jobs.length > 0 ? 1000 : false, // Fast polling for instant detection
  });
  
  const { data: existingVideos = [] } = useQuery<any[]>({ 
    queryKey: ["/api/videos"],
    refetchInterval: jobs.length > 0 ? 1000 : false, // Fast polling for instant detection
  });
  
  useEffect(() => {
    if (jobs.length === 0) return;
    
    // Find jobs that have corresponding completed media (images or videos)
    const jobsWithMedia = jobs.filter(job => {
      // Check for matching images
      const matchingImage = existingImages.find((img: any) => {
        if (!img.prompt || !job.prompt) return false;
        
        // Exact prompt match
        const promptsMatch = img.prompt.trim().toLowerCase() === job.prompt.trim().toLowerCase();
        
        // Time-based match (if timestamp exists, within reasonable range)
        let timeMatch = true;
        if (job.timestamp) {
          const timeDiff = Math.abs(new Date(img.createdAt).getTime() - job.timestamp);
          timeMatch = timeDiff < 30000; // Within 30 seconds for safe matching
        }
        
        return promptsMatch && timeMatch;
      });
      
      // Check for matching videos
      const matchingVideo = existingVideos.find((video: any) => {
        if (!video.prompt || !job.prompt) return false;
        
        // Exact prompt match
        const promptsMatch = video.prompt.trim().toLowerCase() === job.prompt.trim().toLowerCase();
        
        // Time-based match (if timestamp exists, within reasonable range)
        let timeMatch = true;
        if (job.timestamp) {
          const timeDiff = Math.abs(new Date(video.createdAt).getTime() - job.timestamp);
          timeMatch = timeDiff < 30000; // Within 30 seconds for safe matching
        }
        
        return promptsMatch && timeMatch;
      });
      
      return !!(matchingImage || matchingVideo);
    });
    
    if (jobsWithMedia.length > 0) {
      console.log(`[Media Cross-Reference] Found ${jobsWithMedia.length} jobs with matching media, REMOVING from context`);
      
      // Actually remove these jobs from the context
      jobsWithMedia.forEach(job => {
        console.log(`[Auto Remove] Removing job ${job.id} because matching media exists`);
        cancelJob(job.id);
      });
    }
  }, [jobs, existingImages, existingVideos, cancelJob]);
  
  // ✅ FORCE DEFER: Hide placeholder after short delay if image exists
  useEffect(() => {
    jobs.forEach(job => {
      if (job.image || job.imageUrl) {
        const forceHide = setTimeout(() => {
          console.log(`[Force Hide] Forcing placeholder hide for job ${job.id} with image`);
          // This will trigger shouldHidePlaceholder recalculation
        }, 1000); // Force hide after 1s if image is available
        return () => clearTimeout(forceHide);
      }
    });
  }, [jobs]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
      {jobs.map((job) => (
        <ProgressJobCard
          key={job.id}
          job={job}
          onCancel={onCancel}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}