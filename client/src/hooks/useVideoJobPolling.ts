import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGalleryStore } from '@/stores/gallery-store';

interface VideoJobStatus {
  jobId: string;
  state: 'queued' | 'starting' | 'processing' | 'completed' | 'failed' | 'canceled';
  progress: number;
  stage: string;
  assetUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export function useVideoJobPolling(jobId: string | null, enabled: boolean = false) {
  const completedJobsRef = useRef<Set<string>>(new Set());
  const [lastJobState, setLastJobState] = useState<VideoJobStatus['state'] | null>(null);
  const [fallbackProgress, setFallbackProgress] = useState<number>(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const fallbackAnimationRef = useRef<number | null>(null); // ✅ Use requestAnimationFrame for mobile compatibility
  const lastFrameTimeRef = useRef<number | null>(null); // Track last frame time for delta calculation
  const currentJobStatusRef = useRef<VideoJobStatus | null>(null); // ✅ Mutable ref for RAF callback to access fresh state
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ✅ MOBILE FIX: Track the true job start time to prevent reset
  const jobStartTimeRef = useRef<Record<string, number>>({});

  const shouldPoll = enabled && !!jobId && !completedJobsRef.current.has(jobId!);

  const { data: jobStatus } = useQuery<VideoJobStatus>({
    queryKey: [`/api/video/jobs/${jobId}`],
    enabled: shouldPoll,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      
      switch (data.state) {
        case 'queued':
          return 3000; // 3 seconds for queued jobs
        case 'starting':
        case 'processing':
          return 2000; // 2 seconds for active jobs
        case 'completed':
        case 'failed':
        case 'canceled':
          return false; // Stop polling
        default:
          return 3000;
      }
    },
    // ✅ Enable background polling for mobile - keeps progress updates coming even when screen dims
    refetchIntervalInBackground: true,
    retry: 3,
    // Aggressive stale time to ensure fresh data on mobile
    staleTime: 1000
  });

  // Reset fallback progress when job ID changes (new job)
  useEffect(() => {
    if (jobId !== currentJobId) {
      console.log(`[JOB CHANGE] Resetting state for new job: ${currentJobId} -> ${jobId}`);
      setFallbackProgress(0); // ✅ Reset fallback progress for new job
      setLastJobState(null);
      setCurrentJobId(jobId);
      
      // Clear any running animations from previous job
      if (fallbackAnimationRef.current) {
        cancelAnimationFrame(fallbackAnimationRef.current);
        fallbackAnimationRef.current = null;
      }
      lastFrameTimeRef.current = null;
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    }
  }, [jobId, currentJobId]);
  
  // Check if we should stop polling based on job state
  useEffect(() => {
    if (jobStatus?.state && ['completed', 'failed', 'canceled'].includes(jobStatus.state) && jobId) {
      completedJobsRef.current.add(jobId);
    }
  }, [jobStatus?.state, jobId]);

  // Handle state transitions and smooth progress animation
  useEffect(() => {
    if (!jobId || !jobStatus) return;

    const currentState = jobStatus.state;
    console.log(`[DEBUG] Job ${jobId} status update:`, {
      state: currentState,
      progress: jobStatus.progress,
      stage: jobStatus.stage,
      lastState: lastJobState,
      mappedStatus: mapJobStateToStatus(currentState)
    });

    // Handle state transitions
    if (lastJobState !== currentState) {
      console.log(`[STATE TRANSITION] Job ${jobId}: ${lastJobState} -> ${currentState}`);
      
      // Step 2: Reset progress to 0% when fal.ai job actually starts
      if (lastJobState === 'queued' && currentState === 'starting') {
        console.log(`[PROGRESS RESET] Job ${jobId} starting - resetting progress to 0%`);
        setFallbackProgress(0);
      }
      
      // Clear fallback animation when job actually starts processing
      if (currentState === 'processing' && fallbackAnimationRef.current) {
        cancelAnimationFrame(fallbackAnimationRef.current);
        fallbackAnimationRef.current = null;
        lastFrameTimeRef.current = null;
      }
      
      setLastJobState(currentState);
    }

    const updateGalleryStore = () => {
      const galleryStore = useGalleryStore.getState();
      
      // ✅ MOBILE FIX: Ensure we have a stable start time for this job
      // Use existing gallery store startedAt, or the ref, or create new one
      if (!jobStartTimeRef.current[jobId]) {
        jobStartTimeRef.current[jobId] = 
          galleryStore.videoProgress[jobId]?.startedAt || Date.now();
      }
      const stableStartedAt = jobStartTimeRef.current[jobId];
      
      // If job is completed, trigger video refresh BEFORE removing progress card
      if (currentState === 'completed') {
        console.log(`[DEBUG] Job ${jobId} completed, triggering video refresh`);
        
        // Clear any running fallback animation
        if (fallbackAnimationRef.current) {
          cancelAnimationFrame(fallbackAnimationRef.current);
          fallbackAnimationRef.current = null;
          lastFrameTimeRef.current = null;
        }
        
        // Step 3: Enhanced completion handling with smooth transition
        console.log(`[COMPLETION] Starting completion sequence for job ${jobId}`);
        
        // Jump to 100% progress and show completed status
        galleryStore.setVideoProgress(jobId, {
          id: jobId,
          status: 'succeeded',
          progress: 100,
          stage: 'Video ready!',
          startedAt: stableStartedAt,
          prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation completed',
          modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
          etaSeconds: 0,
          isJob: true
        });
        
        // Trigger video list refresh immediately to get the new video
        import('@/lib/queryClient').then(({ queryClient }) => {
          queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
          console.log(`[COMPLETION] Video list refreshed for job ${jobId}`);
        });
        
        // ✅ Immediate removal after video list refresh for smoother UX
        // Wait for video list to be refreshed, then remove the progress card
        setTimeout(() => {
          console.log(`[COMPLETION] Removing progress card for completed job ${jobId}`);
          galleryStore.removeVideoProgress(jobId);
          // Clear completed job tracking to allow future jobs
          completedJobsRef.current.delete(jobId);
          // Clean up start time ref
          delete jobStartTimeRef.current[jobId];
        }, 500); // 0.5 seconds - quick removal once video appears
        
        return;
      }
      
      // Calculate effective progress using real progress or smooth fallback
      const effectiveProgress = calculateEffectiveProgress(
        currentState,
        jobStatus.progress,
        fallbackProgress,
        stableStartedAt
      );
      
      // Get enhanced stage description
      const enhancedStage = getEnhancedStage(currentState, jobStatus.stage, effectiveProgress);
      
      // Update the progress card with enhanced status
      galleryStore.setVideoProgress(jobId, {
        id: jobId,
        status: mapJobStateToStatus(currentState),
        progress: effectiveProgress,
        stage: enhancedStage,
        startedAt: stableStartedAt,
        prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation in progress...',
        modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
        etaSeconds: calculateETA(currentState, effectiveProgress),
        isJob: true
      });

      // Step 3: Enhanced failure handling with better error messages and retry info
      if (currentState === 'failed') {
        console.log(`[FAILURE] Job ${jobId} failed:`, (jobStatus as VideoJobStatus).error);
        
        // Clear any running animations
        if (fallbackAnimationRef.current) {
          cancelAnimationFrame(fallbackAnimationRef.current);
          fallbackAnimationRef.current = null;
        }
        lastFrameTimeRef.current = null;
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
          completionTimeoutRef.current = null;
        }
        
        // Enhanced error message based on fal.ai response
        const errorMessage = getEnhancedErrorMessage((jobStatus as VideoJobStatus).error);
        
        galleryStore.setVideoProgress(jobId, {
          id: jobId,
          status: 'failed',
          progress: 0,
          stage: errorMessage,
          startedAt: stableStartedAt,
          prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation failed',
          modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
          etaSeconds: 0,
          error: (jobStatus as VideoJobStatus).error,
          isJob: true
        });
        
        // ✅ PERSIST: Do NOT auto-remove failed cards - user must dismiss them manually
        // This ensures users don't miss error messages, especially on mobile
        console.log(`[FAILURE] Failed card will persist until user dismisses: ${jobId}`);
      }
      
      // Handle cancellation
      if (currentState === 'canceled') {
        console.log(`[CANCELLATION] Job ${jobId} was canceled`);
        
        // Clear any running animations
        if (fallbackAnimationRef.current) {
          cancelAnimationFrame(fallbackAnimationRef.current);
          fallbackAnimationRef.current = null;
        }
        lastFrameTimeRef.current = null;
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
          completionTimeoutRef.current = null;
        }
        
        galleryStore.setVideoProgress(jobId, {
          id: jobId,
          status: 'failed', // Treat canceled as failed for UI purposes
          progress: 0,
          stage: 'Generation canceled. Credits refunded.',
          startedAt: stableStartedAt,
          prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation canceled',
          modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
          etaSeconds: 0,
          isJob: true
        });
        
        // ✅ PERSIST: Do NOT auto-remove canceled cards - user must dismiss them manually
        // This ensures users don't miss cancellation messages, especially on mobile
        console.log(`[CANCELLATION] Canceled card will persist until user dismisses: ${jobId}`);
      }
    };

    updateGalleryStore();
  }, [jobId, jobStatus, lastJobState, fallbackProgress]);
  
  // ✅ Update ref with latest jobStatus (runs on every poll)
  useEffect(() => {
    if (jobStatus) {
      currentJobStatusRef.current = jobStatus as VideoJobStatus;
    }
  }, [jobStatus]);
  
  // ✅ Mobile-friendly fallback animation using requestAnimationFrame
  // Runs on every poll to check if animation should start/stop
  useEffect(() => {
    if (!jobId || !jobStatus) return;
    
    const currentState = (jobStatus as VideoJobStatus)?.state;
    const currentProgress = (jobStatus as VideoJobStatus)?.progress || 0;
    
    // Start fallback animation for processing/starting jobs that aren't near completion
    const shouldStartAnimation = (
      (currentState === 'starting' || currentState === 'processing') && 
      currentProgress < 95 && 
      !fallbackAnimationRef.current
    );
    
    // Stop animation when job is nearly complete or completed
    const shouldStopAnimation = (
      currentProgress >= 95 || 
      !['starting', 'processing'].includes(currentState)
    ) && fallbackAnimationRef.current;
    
    if (shouldStartAnimation) {
      console.log(`[FALLBACK ANIMATION] Starting mobile-friendly progress for job ${jobId}`);
      
      // Initialize with current progress or minimum of 5%
      setFallbackProgress(prev => Math.max(prev, currentProgress || 5));
      
      // Smooth animation using requestAnimationFrame (mobile-compatible)
      const animate = (currentTime: number) => {
        // Initialize timestamp on first frame
        if (lastFrameTimeRef.current === null) {
          lastFrameTimeRef.current = currentTime;
        }
        
        const deltaSeconds = (currentTime - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = currentTime;
        
        setFallbackProgress(prev => {
          // Smooth progression: ~2% per second, capped at 95%
          const progressIncrease = deltaSeconds * 2; // 2% per second
          const newProgress = Math.min(prev + progressIncrease, 95);
          return newProgress;
        });
        
        // ✅ Read fresh state from ref to detect completion immediately
        const latestStatus = currentJobStatusRef.current;
        const shouldContinue = latestStatus && 
          (latestStatus.state === 'processing' || latestStatus.state === 'starting') && 
          latestStatus.progress < 95;
          
        if (shouldContinue) {
          fallbackAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // Clean up when done
          console.log('[FALLBACK ANIMATION] Stopping - job completed or progress reached 95%');
          fallbackAnimationRef.current = null;
          lastFrameTimeRef.current = null;
        }
      };
      
      fallbackAnimationRef.current = requestAnimationFrame(animate);
    } else if (shouldStopAnimation && fallbackAnimationRef.current) {
      console.log(`[FALLBACK ANIMATION] Stopping - state changed or progress >= 95%: ${currentProgress}%`);
      cancelAnimationFrame(fallbackAnimationRef.current);
      fallbackAnimationRef.current = null;
      lastFrameTimeRef.current = null;
    }
    
    // NO cleanup function - let the RAF loop manage itself
    // Cleanup is only in the unmount effect below
  }, [jobId, jobStatus]);
  
  // Cleanup on unmount or when jobId changes
  useEffect(() => {
    return () => {
      // Clean up all running animations and timeouts
      if (fallbackAnimationRef.current) {
        cancelAnimationFrame(fallbackAnimationRef.current);
        fallbackAnimationRef.current = null;
      }
      lastFrameTimeRef.current = null;
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
      console.log(`[CLEANUP] Cleaned up polling resources for job ${jobId}`);
    };
  }, [jobId]);
  
  // Enhanced return with retry capability support
  const retryJob = () => {
    if (jobId && jobStatus?.state === 'failed') {
      console.log(`[RETRY] Clearing failed job ${jobId} for potential retry`);
      completedJobsRef.current.delete(jobId);
      // Reset job state in gallery store to allow retry
      const galleryStore = useGalleryStore.getState();
      galleryStore.setVideoProgress(jobId, {
        ...galleryStore.videoProgress[jobId],
        status: 'queued',
        progress: 0,
        stage: 'Retrying...',
        error: undefined
      });
    }
  };

  return { 
    jobStatus, 
    isPolling: enabled && !!jobId && !completedJobsRef.current.has(jobId!),
    retryJob // Expose retry function for UI components
  };
}

// Map backend job states to frontend status
function mapJobStateToStatus(state: VideoJobStatus['state']): 'queued' | 'starting' | 'processing' | 'failed' | 'succeeded' {
  switch (state) {
    case 'queued':
      return 'queued';
    case 'starting':
      return 'starting';
    case 'processing':
      return 'processing';
    case 'completed':
      return 'succeeded'; // Map completed to succeeded for gallery store
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'failed'; // Treat canceled as failed for UI purposes
    default:
      return 'queued';
  }
}

// Calculate effective progress using real progress or smooth fallback
function calculateEffectiveProgress(
  state: VideoJobStatus['state'],
  realProgress: number,
  fallbackProgress: number,
  startedAt: number
): number {
  // ✅ FIX: For queued state, calculate time-based progress (0-15% over 15 seconds)
  // This ensures mobile users see progress even when rAF is throttled
  if (state === 'queued') {
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    // Progress ~1% per second, capped at 15% to indicate waiting
    const timeBasedProgress = Math.min(Math.floor(elapsedSeconds), 15);
    return Math.max(timeBasedProgress, fallbackProgress, 1); // Minimum 1% to show activity
  }
  
  // ✅ FIX: Always use the MAXIMUM of real progress and fallback progress
  // This ensures smooth progression even when backend progress updates are slow
  if (state === 'processing' || state === 'starting') {
    // Use the higher value to ensure progress never goes backwards and always advances smoothly
    return Math.round(Math.max(realProgress, fallbackProgress, 5));
  }
  
  return Math.round(realProgress);
}

// Get enhanced stage description based on state and progress
function getEnhancedStage(
  state: VideoJobStatus['state'],
  originalStage: string,
  progress: number
): string {
  switch (state) {
    case 'queued':
      return 'Initializing job...';
    case 'starting':
      return 'Starting generation...';
    case 'processing':
      // Always show "Generating video..." as requested by user
      if (progress < 30) {
        return 'Generating video...';
      } else if (progress < 60) {
        return 'Generating video...';
      } else if (progress < 90) {
        return 'Generating video...';
      } else {
        return 'Finalizing video...';
      }
    case 'completed':
      return 'Completed';
    case 'failed':
      return originalStage || 'Generation failed';
    case 'canceled':
      return 'Canceled';
    default:
      return originalStage || 'Processing...';
  }
}

// Enhanced error message based on fal.ai response
// NOTE: Credits are automatically refunded by the backend (auto-refund-service) when jobs fail
function getEnhancedErrorMessage(error?: string): string {
  if (!error) return 'Generation failed. Credits refunded.';
  
  const lowerError = error.toLowerCase();
  
  // Content policy / copyright violations - user-friendly message
  if (lowerError.includes('content_policy_violation') || 
      lowerError.includes('content policy') ||
      lowerError.includes('content checker') ||
      lowerError.includes('flagged') ||
      lowerError.includes('copyright') ||
      lowerError.includes('nsfw') ||
      lowerError.includes('inappropriate')) {
    return 'Content cannot be processed (may contain copyrighted or restricted material). Credits refunded.';
  }
  
  // Unprocessable entity errors
  if (lowerError.includes('unprocessable') || lowerError.includes('422')) {
    return 'Unable to process this content. Please try a different prompt or image. Credits refunded.';
  }
  
  // Timeout errors
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'Generation took too long. Please try a simpler prompt. Credits refunded.';
  }
  
  // Service limits
  if (lowerError.includes('quota') || lowerError.includes('limit') || lowerError.includes('rate')) {
    return 'Service is busy. Please try again in a few minutes. Credits refunded.';
  }
  
  // Invalid request errors
  if (lowerError.includes('invalid') || lowerError.includes('bad request') || lowerError.includes('400')) {
    return 'Invalid request. Please check your settings. Credits refunded.';
  }
  
  // Network / connection errors
  if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('fetch')) {
    return 'Connection error. Please check your internet. Credits refunded.';
  }
  
  // Credit errors (shouldn't be refunded in this case)
  if (lowerError.includes('insufficient') || lowerError.includes('credits') || lowerError.includes('balance')) {
    return 'Insufficient credits. Please add credits to continue.';
  }
  
  // Server errors
  if (lowerError.includes('500') || lowerError.includes('internal') || lowerError.includes('server error')) {
    return 'Server error occurred. Please try again. Credits refunded.';
  }
  
  // Generic fallback with refund notice
  return 'Generation failed. Credits refunded.';
}

// Calculate estimated time remaining based on progress
function calculateETA(state: VideoJobStatus['state'], progress: number): number {
  if (state === 'completed' || state === 'failed' || state === 'canceled') {
    return 0;
  }
  
  if (state === 'queued') {
    return 45; // Estimate 45 seconds for queued jobs
  }
  
  if (state === 'starting') {
    return 90; // Estimate 1.5 minutes for starting jobs
  }
  
  if (progress === 0 || progress < 5) {
    return 75; // Estimate 1.25 minutes if no progress yet
  }
  
  if (progress >= 95) {
    return 15; // Almost done, just a few seconds left
  }
  
  // Estimate based on current progress (assumes 1.5-2 minutes total for fal.ai jobs)
  const totalEstimatedTime = 100; // 1.67 minutes
  const remainingProgress = 100 - progress;
  const eta = Math.round((remainingProgress / 100) * totalEstimatedTime);
  
  // Minimum ETA of 5 seconds to avoid showing 0 too early
  return Math.max(eta, 5);
}

/**
 * ✅ GALLERY-LEVEL JOB POLLING HOOK
 * This hook should be used in the video-gallery component to poll for ALL active video jobs.
 * It continues polling even when the video-generation-form is unmounted (e.g., on mobile when sidebar closes).
 */
export function useActiveJobsPolling() {
  const videoProgress = useGalleryStore((state) => state.videoProgress);
  const completedJobsRef = useRef<Set<string>>(new Set());
  const jobStartTimeRef = useRef<Record<string, number>>({});
  const cleanupTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  // Get all active job IDs from the gallery store
  const activeJobIds = useMemo(() => {
    return Object.entries(videoProgress)
      .filter(([_, progress]) => {
        // Include jobs that are not in terminal states
        const isActive = progress.isJob && 
          ['queued', 'starting', 'processing'].includes(progress.status);
        return isActive && !completedJobsRef.current.has(progress.id);
      })
      .map(([id]) => id);
  }, [videoProgress]);

  // Poll each active job's status
  useEffect(() => {
    if (activeJobIds.length === 0) return;
    
    console.log(`[GALLERY POLLING] Monitoring ${activeJobIds.length} active jobs:`, activeJobIds);
    
    const pollInterval = setInterval(async () => {
      const galleryStore = useGalleryStore.getState();
      
      for (const jobId of activeJobIds) {
        // Skip if already completed
        if (completedJobsRef.current.has(jobId)) continue;
        
        try {
          const response = await fetch(`/api/video/jobs/${jobId}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              // Job not found - might have been cleaned up, remove progress card
              console.log(`[GALLERY POLLING] Job ${jobId} not found (404), cleaning up`);
              handleJobFailure(jobId, 'Job not found', galleryStore);
              continue;
            }
            console.error(`[GALLERY POLLING] Error fetching job ${jobId}: ${response.status}`);
            continue;
          }
          
          const jobStatus: VideoJobStatus = await response.json();
          
          // Ensure stable start time
          if (!jobStartTimeRef.current[jobId]) {
            jobStartTimeRef.current[jobId] = 
              galleryStore.videoProgress[jobId]?.startedAt || Date.now();
          }
          const stableStartedAt = jobStartTimeRef.current[jobId];
          
          console.log(`[GALLERY POLLING] Job ${jobId} status:`, jobStatus.state, jobStatus.progress);
          
          // Handle completed jobs
          if (jobStatus.state === 'completed') {
            completedJobsRef.current.add(jobId);
            
            galleryStore.setVideoProgress(jobId, {
              id: jobId,
              status: 'succeeded',
              progress: 100,
              stage: 'Video ready!',
              startedAt: stableStartedAt,
              prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation completed',
              modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
              etaSeconds: 0,
              isJob: true
            });
            
            // Refresh video list and clean up
            import('@/lib/queryClient').then(({ queryClient }) => {
              queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
            });
            
            setTimeout(() => {
              galleryStore.removeVideoProgress(jobId);
              completedJobsRef.current.delete(jobId);
              delete jobStartTimeRef.current[jobId];
            }, 500);
            
            continue;
          }
          
          // Handle failed jobs
          if (jobStatus.state === 'failed') {
            handleJobFailure(jobId, jobStatus.error || 'Generation failed', galleryStore);
            continue;
          }
          
          // Handle canceled jobs
          if (jobStatus.state === 'canceled') {
            completedJobsRef.current.add(jobId);
            
            galleryStore.setVideoProgress(jobId, {
              id: jobId,
              status: 'failed',
              progress: 0,
              stage: 'Generation canceled. Credits refunded.',
              startedAt: stableStartedAt,
              prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation canceled',
              modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
              etaSeconds: 0,
              isJob: true
            });
            
            // ✅ PERSIST: Do NOT auto-remove canceled cards - user must dismiss them manually
            console.log(`[GALLERY POLLING] Canceled card will persist until user dismisses: ${jobId}`);
            
            continue;
          }
          
          // Update progress for active jobs
          const effectiveProgress = calculateEffectiveProgress(
            jobStatus.state,
            jobStatus.progress,
            0, // No fallback animation in gallery polling
            stableStartedAt
          );
          
          const enhancedStage = getEnhancedStage(jobStatus.state, jobStatus.stage, effectiveProgress);
          
          galleryStore.setVideoProgress(jobId, {
            id: jobId,
            status: mapJobStateToStatus(jobStatus.state),
            progress: effectiveProgress,
            stage: enhancedStage,
            startedAt: stableStartedAt,
            prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation in progress...',
            modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
            etaSeconds: calculateETA(jobStatus.state, effectiveProgress),
            isJob: true
          });
          
        } catch (error) {
          console.error(`[GALLERY POLLING] Error polling job ${jobId}:`, error);
        }
      }
    }, 3000); // Poll every 3 seconds
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [activeJobIds]);
  
  // Helper function to handle job failures with enhanced error messages
  function handleJobFailure(jobId: string, error: string, galleryStore: ReturnType<typeof useGalleryStore.getState>) {
    completedJobsRef.current.add(jobId);
    
    const stableStartedAt = jobStartTimeRef.current[jobId] || 
      galleryStore.videoProgress[jobId]?.startedAt || Date.now();
    
    // Get user-friendly error message
    const errorMessage = getEnhancedErrorMessage(error);
    
    console.log(`[GALLERY POLLING] Job ${jobId} failed:`, error);
    
    galleryStore.setVideoProgress(jobId, {
      id: jobId,
      status: 'failed',
      progress: 0,
      stage: errorMessage,
      startedAt: stableStartedAt,
      prompt: galleryStore.videoProgress[jobId]?.prompt || 'Video generation failed',
      modelId: galleryStore.videoProgress[jobId]?.modelId || 'unknown',
      etaSeconds: 0,
      error: error,
      isJob: true
    });
    
    // ✅ PERSIST: Do NOT auto-remove failed cards - user must dismiss them manually
    // This ensures users don't miss error messages, especially on mobile
    console.log(`[GALLERY POLLING] Failed card will persist until user dismisses: ${jobId}`);
  }
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(cleanupTimeoutsRef.current).forEach(clearTimeout);
      cleanupTimeoutsRef.current = {};
    };
  }, []);
  
  return { activeJobIds };
}