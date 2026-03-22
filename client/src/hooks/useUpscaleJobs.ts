import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UpscaleJobProgress } from "@/components/upscale-progress-card";

interface UpscaleJobResponse {
  id: string;
  state: string;
  progress: number;
  stage: string | null;
  scaleFactor: number;
  sourceImageUrl: string;
  resultUrl: string | null;
  error: string | null;
}

export function useUpscaleJobs() {
  const queryClient = useQueryClient();

  const { data: activeJobs = [], isLoading } = useQuery<UpscaleJobProgress[]>({
    queryKey: ["/api/upscale/active-jobs"],
    refetchInterval: (query) => {
      const jobs = query.state.data || [];
      const hasActiveJobs = jobs.some(
        (job) => job.state === "queued" || job.state === "starting" || job.state === "processing"
      );
      return hasActiveJobs ? 2000 : false;
    },
    staleTime: 1000,
    select: (data: any[]) => 
      data.map((job): UpscaleJobProgress => ({
        id: job.id,
        state: job.state,
        progress: job.progress || 0,
        stage: job.stage,
        scaleFactor: job.scaleFactor,
        sourceImageUrl: job.sourceImageUrl,
        resultUrl: job.resultUrl,
        error: job.error,
      })),
  });

  const dismissJob = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("POST", `/api/upscale/${jobId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upscale/active-jobs"] });
    },
  });

  const hasActiveJobs = activeJobs.some(
    (job) => job.state === "queued" || job.state === "starting" || job.state === "processing"
  );

  return {
    activeJobs,
    isLoading,
    hasActiveJobs,
    dismissJob: dismissJob.mutate,
  };
}
