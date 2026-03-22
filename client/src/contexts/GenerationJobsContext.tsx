import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { GenerationJob } from '@/components/generation-gallery';

interface GenerationJobsContextType {
  generationJobs: GenerationJob[];
  setGenerationJobs: (jobs: GenerationJob[]) => void;
  updateJobs: (workers: any[], queue: any[]) => void;
  cancelJob: (jobId: string) => void;
  forceRemoveCompletedJobs: () => void;
}

const GenerationJobsContext = createContext<GenerationJobsContextType | undefined>(undefined);

interface GenerationJobsProviderProps {
  children: ReactNode;
}

export function GenerationJobsProvider({ children }: GenerationJobsProviderProps) {
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);

  // Initialize with clean state on context load
  useEffect(() => {
    setGenerationJobs([]);
  }, []);

  const updateJobs = useCallback((workers: any[], queue: any[]) => {
    // Convert workers and queue to GenerationJob format
    const newJobs: GenerationJob[] = [];
    const currentTime = Date.now();
    
    // Add active workers (excluding completed ones for immediate cleanup)
    workers.forEach((worker, index) => {
      if (worker && worker.status && worker.status !== 'idle') {
        // Map worker status to generation job format
        let jobStatus: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
        switch (worker.status) {
          case 'running':
            jobStatus = 'running';
            break;
          case 'completed':
            // IMMEDIATE CLEANUP: Don't add completed jobs to display
            console.log(`[Immediate Cleanup] Skipping completed job: ${worker.id}`);
            return; // Skip completed jobs entirely
          case 'failed':
            jobStatus = 'failed';
            break;
          case 'stopped':
            jobStatus = 'cancelled';
            break;
          default:
            jobStatus = 'running';
        }

        newJobs.push({
          id: worker.id || `worker-${index}`,
          prompt: worker.prompt || 'Generating...',
          status: jobStatus,
          progress: worker.progress || 0,
          timestamp: currentTime,
          error: worker.error,
          imageId: worker.imageId,
          image: worker.image
        });
      }
    });
    
    // Add queued jobs
    queue.forEach((queuedJob, index) => {
      newJobs.push({
        id: queuedJob.id || `queue-${index}`,
        prompt: queuedJob.prompt || 'Queued...',
        status: 'queued',
        progress: 0,
        timestamp: currentTime,
      });
    });
    
    // Update generation jobs in context
    setGenerationJobs(newJobs);
  }, []);

  const cancelJob = useCallback((jobId: string) => {
    setGenerationJobs(prev => prev.filter(job => job.id !== jobId));
  }, []);

  const forceRemoveCompletedJobs = useCallback(() => {
    setGenerationJobs(prev => prev.filter(job => 
      job.status !== 'completed' && 
      job.status !== 'cancelled'
    ));
  }, []);

  // Aggressive cleanup: Remove completed/failed jobs immediately, stuck jobs every 5 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const currentTime = Date.now();
      setGenerationJobs(prev => {
        const beforeCount = prev.length;
        const filtered = prev.filter(job => {
          // Remove any completed or cancelled jobs immediately
          if (job.status === 'completed' || job.status === 'cancelled') {
            console.log(`[Aggressive Cleanup] Removing ${job.status} job: ${job.id}`);
            return false;
          }
          
          // Remove failed jobs after 10 seconds (so user can see the error)
          if (job.status === 'failed' && job.timestamp) {
            const elapsed = currentTime - job.timestamp;
            if (elapsed > 10000) { // 10 seconds
              console.log(`[Cleanup] Removing failed job (${elapsed}ms old): ${job.id}`);
              return false;
            }
          }
          
          // Remove jobs that have been running for more than 90 seconds (likely stuck)
          if (job.status === 'running' && job.timestamp) {
            const elapsed = currentTime - job.timestamp;
            if (elapsed > 90000) { // 90 seconds
              console.log(`[Cleanup] Removing stale running job (${elapsed}ms old): ${job.id}`);
              return false;
            }
          }
          
          // Keep active jobs
          return job.status === 'running' || job.status === 'queued' || job.status === 'failed';
        });
        
        if (beforeCount !== filtered.length) {
          console.log(`[Cleanup] Removed ${beforeCount - filtered.length} jobs`);
        }
        
        return filtered;
      });
    }, 5000); // Every 5 seconds - more frequent for mobile responsiveness

    return () => clearInterval(cleanupInterval);
  }, []);

  const value = {
    generationJobs,
    setGenerationJobs,
    updateJobs,
    cancelJob,
    forceRemoveCompletedJobs
  };

  return (
    <GenerationJobsContext.Provider value={value}>
      {children}
    </GenerationJobsContext.Provider>
  );
}

export function useGenerationJobs() {
  const context = useContext(GenerationJobsContext);
  if (context === undefined) {
    throw new Error('useGenerationJobs must be used within a GenerationJobsProvider');
  }
  return context;
}