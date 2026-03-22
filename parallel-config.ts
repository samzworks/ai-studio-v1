/**
 * Parallel Generation Configuration
 * 
 * These settings control the parallel image generation system.
 * Admins can modify these values without touching business logic.
 */

// Configuration constants - modify these to change system behavior
export const MAX_CONCURRENT_JOBS = 4;
export const MAX_QUEUE_LENGTH = 4;
export const COMPLETED_JOB_DISPLAY_TIME = 3000;
export const FAILED_JOB_DISPLAY_TIME = 5000;
export const PROGRESS_UPDATE_INTERVAL = 1000;