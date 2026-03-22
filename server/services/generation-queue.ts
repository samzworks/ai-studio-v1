import { storage } from "../storage";
import { getConfig } from "../site-config";
import { type ImageGenerationJob, type InsertImageGenerationJob } from "@shared/schema";

export interface QueueLimits {
  maxActiveJobsPerUser: number;  // Total active jobs (running + queued) allowed per user
  maxQueuedJobsPerUser: number;  // Maximum jobs waiting in queue per user
  maxRunningJobsPerUser: number; // Maximum jobs actively running (being processed) per user
  maxGlobalActiveJobs: number;
  jobsPerMinuteLimit: number;
}

export interface EnqueueResult {
  success: boolean;
  job?: ImageGenerationJob;
  error?: string;
  errorCode?: 'RATE_LIMITED' | 'QUEUE_FULL' | 'GLOBAL_LIMIT' | 'VALIDATION_ERROR';
  position?: number;
}

export interface JobCounts {
  running: number;
  queued: number;
  total: number;
}

class GenerationQueueService {
  private userJobTimestamps: Map<string, number[]> = new Map();
  private processingUsers: Set<string> = new Set();

  getQueueLimits(): QueueLimits {
    return {
      maxActiveJobsPerUser: parseInt(getConfig('max_active_jobs_per_user', 8)) || 8,
      maxQueuedJobsPerUser: parseInt(getConfig('max_queued_jobs_per_user', 4)) || 4,
      maxRunningJobsPerUser: parseInt(getConfig('max_running_jobs_per_user', 4)) || 4, // Max concurrent running jobs
      maxGlobalActiveJobs: parseInt(getConfig('max_global_active_jobs', 100)) || 100,
      jobsPerMinuteLimit: parseInt(getConfig('jobs_per_minute_limit', 10)) || 10,
    };
  }

  async getUserJobCounts(userId: string): Promise<JobCounts> {
    const [runningCount, queuedCount] = await Promise.all([
      storage.getUserRunningJobsCount(userId),
      storage.getUserQueuedJobsCount(userId),
    ]);
    return {
      running: runningCount,
      queued: queuedCount,
      total: runningCount + queuedCount,
    };
  }

  async getGlobalActiveJobsCount(): Promise<number> {
    return storage.getGlobalQueuedJobsCount();
  }

  private checkRateLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
    const limits = this.getQueueLimits();
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    let timestamps = this.userJobTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => t > oneMinuteAgo);
    this.userJobTimestamps.set(userId, timestamps);

    console.log(`[RateLimit] User ${userId}: ${timestamps.length}/${limits.jobsPerMinuteLimit} jobs in last minute`);

    if (timestamps.length >= limits.jobsPerMinuteLimit) {
      const oldestTimestamp = Math.min(...timestamps);
      const retryAfterSeconds = Math.ceil((oldestTimestamp + 60000 - now) / 1000);
      console.log(`[RateLimit] BLOCKED - User ${userId} exceeded rate limit (${timestamps.length} >= ${limits.jobsPerMinuteLimit}), retry in ${retryAfterSeconds}s`);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  }

  private recordJobCreation(userId: string): void {
    const timestamps = this.userJobTimestamps.get(userId) || [];
    timestamps.push(Date.now());
    this.userJobTimestamps.set(userId, timestamps);
  }

  async canEnqueueJob(userId: string): Promise<{ 
    canEnqueue: boolean; 
    reason?: string;
    errorCode?: 'RATE_LIMITED' | 'QUEUE_FULL' | 'GLOBAL_LIMIT';
    retryAfterSeconds?: number;
  }> {
    const limits = this.getQueueLimits();
    
    const rateCheck = this.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return {
        canEnqueue: false,
        reason: `You are creating images too fast. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        errorCode: 'RATE_LIMITED',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    const userCounts = await this.getUserJobCounts(userId);
    
    // Check total active jobs limit
    // Backend is the single source of truth - it accepts up to maxActiveJobsPerUser jobs
    // Frontend submits jobs directly and polls for status via useGenerationJobs hook
    if (userCounts.total >= limits.maxActiveJobsPerUser) {
      return {
        canEnqueue: false,
        reason: `You have too many active jobs (${userCounts.total}/${limits.maxActiveJobsPerUser}). Please wait for some to complete.`,
        errorCode: 'QUEUE_FULL',
      };
    }

    const globalActive = await this.getGlobalActiveJobsCount();
    if (globalActive >= limits.maxGlobalActiveJobs) {
      return {
        canEnqueue: false,
        reason: 'The system is currently very busy. Please try again in a few moments.',
        errorCode: 'GLOBAL_LIMIT',
      };
    }

    return { canEnqueue: true };
  }

  async enqueueJob(
    userId: string, 
    jobData: Omit<InsertImageGenerationJob, 'id' | 'ownerId' | 'status' | 'progress' | 'stage'>
  ): Promise<EnqueueResult> {
    const canEnqueueCheck = await this.canEnqueueJob(userId);
    if (!canEnqueueCheck.canEnqueue) {
      return {
        success: false,
        error: canEnqueueCheck.reason,
        errorCode: canEnqueueCheck.errorCode,
      };
    }

    const userCounts = await this.getUserJobCounts(userId);
    
    // All jobs start immediately as 'running' - the frontend handles actual parallel execution
    // The backend just tracks job metadata for the notification panel
    const jobId = `img_job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      const job = await storage.createImageGenerationJob({
        ...jobData,
        id: jobId,
        ownerId: userId,
        status: 'running',
        progress: 0,
        stage: 'Starting',
      });

      this.recordJobCreation(userId);
      await storage.startImageJob(jobId);
      
      console.log(`[GenerationQueue] Job ${jobId} accepted (${userCounts.total + 1} total active jobs for user)`);

      return {
        success: true,
        job,
        position: 0,
      };
    } catch (error) {
      console.error('[GenerationQueue] Failed to create job:', error);
      return {
        success: false,
        error: 'Failed to create generation job. Please try again.',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  async completeJob(jobId: string, resultImageId: number, resultUrl: string): Promise<ImageGenerationJob | undefined> {
    const job = await storage.getImageGenerationJob(jobId);
    if (!job) {
      console.error(`[GenerationQueue] Job ${jobId} not found for completion`);
      return undefined;
    }

    const completedJob = await storage.completeImageJob(jobId, resultImageId, resultUrl);
    
    this.processNextQueuedJob(job.ownerId).catch(err => {
      console.error('[GenerationQueue] Error processing next job:', err);
    });

    return completedJob;
  }

  async failJob(jobId: string, error: string): Promise<ImageGenerationJob | undefined> {
    const job = await storage.getImageGenerationJob(jobId);
    if (!job) {
      console.error(`[GenerationQueue] Job ${jobId} not found for failure`);
      return undefined;
    }

    const failedJob = await storage.failImageJob(jobId, error);
    
    this.processNextQueuedJob(job.ownerId).catch(err => {
      console.error('[GenerationQueue] Error processing next job after failure:', err);
    });

    return failedJob;
  }

  async cancelJob(jobId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const job = await storage.getImageGenerationJob(jobId);
    
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.ownerId !== userId) {
      return { success: false, error: 'You can only cancel your own jobs' };
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return { success: false, error: 'Job is already finished' };
    }

    await storage.cancelImageJob(jobId);

    if (job.status === 'queued') {
      this.processNextQueuedJob(userId).catch(err => {
        console.error('[GenerationQueue] Error processing next job after cancel:', err);
      });
    }

    return { success: true };
  }

  async updateJobProgress(jobId: string, progress: number, stage?: string): Promise<ImageGenerationJob | undefined> {
    return storage.updateImageJobStatus(jobId, 'running', progress, stage);
  }

  async getUserActiveJobs(userId: string): Promise<ImageGenerationJob[]> {
    return storage.getUserActiveImageJobs(userId);
  }

  async getJob(jobId: string): Promise<ImageGenerationJob | undefined> {
    return storage.getImageGenerationJob(jobId);
  }

  private async processNextQueuedJob(userId: string): Promise<void> {
    if (this.processingUsers.has(userId)) {
      return;
    }

    this.processingUsers.add(userId);

    try {
      // Check if there are any queued jobs to start
      const nextJob = await storage.getNextQueuedImageJob(userId);
      if (nextJob) {
        await storage.startImageJob(nextJob.id);
        console.log(`[GenerationQueue] Started queued job ${nextJob.id} for user ${userId}`);
      }
    } finally {
      this.processingUsers.delete(userId);
    }
  }

  async getQueueStatus(userId: string): Promise<{
    limits: QueueLimits;
    userCounts: JobCounts;
    globalActive: number;
    canEnqueue: boolean;
  }> {
    const limits = this.getQueueLimits();
    const userCounts = await this.getUserJobCounts(userId);
    const globalActive = await this.getGlobalActiveJobsCount();
    const canEnqueueCheck = await this.canEnqueueJob(userId);

    return {
      limits,
      userCounts,
      globalActive,
      canEnqueue: canEnqueueCheck.canEnqueue,
    };
  }

  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    return storage.cleanupOldImageJobs(olderThanDays);
  }
}

export const generationQueue = new GenerationQueueService();
