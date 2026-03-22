import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ImageGenerationJob } from "@shared/schema";
import { useCallback, useEffect, useState } from "react";

interface QueueLimits {
  maxActiveJobsPerUser: number;  // Total active jobs (running + queued) allowed per user
  maxGlobalActiveJobs: number;
  jobsPerMinuteLimit: number;
}

interface JobCounts {
  running: number;
  queued: number;
  total: number;
}

interface QueueStatus {
  limits: QueueLimits;
  userCounts: JobCounts;
  globalActive: number;
  canEnqueue: boolean;
}

interface EnqueueParams {
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  model?: string;
  provider?: string;
  style?: string;
  quality?: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  styleImageUrl?: string;
  styleImageUrls?: string[];
  imageStrength?: number;
  enhancePrompt?: boolean;
  tags?: string[];
  jobId?: string; // Client-side job ID for progress tracking and credit holds
}

interface EnqueueResult {
  success: boolean;
  job?: ImageGenerationJob;
  position?: number;
  message?: string;
  error?: string;
  errorCode?: string;
}

const POLL_INTERVAL_ACTIVE = 2000;
const POLL_INTERVAL_IDLE = 10000;

export function useGenerationJobs() {
  const queryClient = useQueryClient();
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  const { data: jobs = [], isLoading: isLoadingJobs, refetch: refetchJobs } = useQuery<ImageGenerationJob[]>({
    queryKey: ['/api/generation-jobs'],
    refetchInterval: (query) => {
      const data = query.state.data as ImageGenerationJob[] | undefined;
      if (data && data.some(job => job.status === 'running' || job.status === 'queued')) {
        return POLL_INTERVAL_ACTIVE;
      }
      return POLL_INTERVAL_IDLE;
    },
    staleTime: 1000,
  });

  const { data: queueStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery<QueueStatus>({
    queryKey: ['/api/generation-jobs/status'],
    staleTime: 2000,
    refetchInterval: (query) => {
      const jobsData = queryClient.getQueryData<ImageGenerationJob[]>(['/api/generation-jobs']);
      if (jobsData && jobsData.some(job => job.status === 'running' || job.status === 'queued')) {
        return POLL_INTERVAL_ACTIVE;
      }
      return 30000;
    },
  });

  const activeJobs = jobs.filter(job => job.status === 'running');
  const queuedJobs = jobs.filter(job => job.status === 'queued');
  const hasActiveJobs = activeJobs.length > 0 || queuedJobs.length > 0;

  const enqueueMutation = useMutation({
    mutationFn: async (params: EnqueueParams): Promise<EnqueueResult> => {
      const response = await apiRequest('POST', '/api/generation-jobs/enqueue', params);
      return response.json();
    },
    onSuccess: () => {
      setLastSubmitTime(Date.now());
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs/status'] });
    },
    onError: (error: any) => {
      console.error('[GenerationJobs] Enqueue failed:', error);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('POST', `/api/generation-jobs/${jobId}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs/status'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('DELETE', `/api/generation-jobs/${jobId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs/status'] });
    },
  });

  const enqueueJob = useCallback(async (params: EnqueueParams): Promise<EnqueueResult> => {
    try {
      const result = await enqueueMutation.mutateAsync(params);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to enqueue job',
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }, [enqueueMutation]);

  const cancelJob = useCallback(async (jobId: string) => {
    return cancelMutation.mutateAsync(jobId);
  }, [cancelMutation]);

  const dismissJob = useCallback(async (jobId: string) => {
    return dismissMutation.mutateAsync(jobId);
  }, [dismissMutation]);

  const getJob = useCallback((jobId: string): ImageGenerationJob | undefined => {
    return jobs.find(job => job.id === jobId);
  }, [jobs]);

  const throttleMs = queueStatus?.limits.jobsPerMinuteLimit 
    ? Math.max(1500, 60000 / queueStatus.limits.jobsPerMinuteLimit)
    : 1500;
  const timeSinceLastSubmit = Date.now() - lastSubmitTime;
  const isThrottled = timeSinceLastSubmit < throttleMs;
  const throttleRemaining = Math.max(0, throttleMs - timeSinceLastSubmit);

  useEffect(() => {
    const handleJobComplete = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/images'] });
      queryClient.invalidateQueries({ queryKey: ['/api/generation-jobs'] });
    };

    const checkForCompletions = () => {
      const prevJobs = queryClient.getQueryData<ImageGenerationJob[]>(['/api/generation-jobs']);
      if (prevJobs) {
        const prevRunningIds = new Set(
          prevJobs.filter(j => j.status === 'running').map(j => j.id)
        );
        const currentCompleted = jobs.filter(
          j => j.status === 'completed' && prevRunningIds.has(j.id)
        );
        if (currentCompleted.length > 0) {
          handleJobComplete();
        }
      }
    };

    checkForCompletions();
  }, [jobs, queryClient]);

  return {
    jobs,
    activeJobs,
    queuedJobs,
    hasActiveJobs,
    
    queueStatus,
    limits: queueStatus?.limits,
    userCounts: queueStatus?.userCounts,
    canEnqueue: queueStatus?.canEnqueue ?? true,
    
    isLoading: isLoadingJobs || isLoadingStatus,
    isEnqueuing: enqueueMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isDismissing: dismissMutation.isPending,
    isThrottled,
    throttleRemaining,
    
    enqueueJob,
    cancelJob,
    dismissJob,
    getJob,
    refetchJobs,
    refetchStatus,
    
    enqueueMutation,
    cancelMutation,
    dismissMutation,
  };
}

export function useJobPolling(jobId: string | null) {
  const { data: job, isLoading, error } = useQuery<ImageGenerationJob>({
    queryKey: ['/api/generation-jobs', jobId],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as ImageGenerationJob | undefined;
      if (data && (data.status === 'running' || data.status === 'queued')) {
        return POLL_INTERVAL_ACTIVE;
      }
      return false;
    },
    staleTime: 1000,
  });

  return {
    job,
    isLoading,
    error,
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    isCancelled: job?.status === 'cancelled',
    isRunning: job?.status === 'running',
    isQueued: job?.status === 'queued',
  };
}

export type { EnqueueParams, EnqueueResult, QueueStatus, QueueLimits, JobCounts };
