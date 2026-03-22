import { create } from 'zustand';

// Enhanced pending job with real progress data from backend
type PendingVideoProgress = {
  id: string;          // replicateId/predictionId or jobId for job-based system
  modelId: string;     // video model used
  startedAt: number;   // timestamp when generation started
  prompt: string;      // user prompt for display
  status: 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed';
  progress: number;    // 0-100 percentage from backend
  stage: string;       // "Analyzing prompt", "Rendering frames", etc
  etaSeconds: number;  // estimated time remaining
  error?: string;      // error message if failed
  isJob?: boolean;     // flag to distinguish job-based cards from direct video cards
};

// Moderation placeholder shown while checking content policy
type ModerationPlaceholder = {
  id: string;          // unique ID for this placeholder
  prompt: string;      // prompt being checked (for display)
  startedAt: number;   // timestamp when moderation started
};

// Legacy type for compatibility during transition
type PendingJob = { id: string; modelId: string; startedAt: number };

type GalleryState = {
  pending: Record<string, PendingJob>;
  addPending: (j: PendingJob) => void;
  removePending: (id: string) => void;
  
  // New unified progress system
  videoProgress: Record<string, PendingVideoProgress>;
  setVideoProgress: (id: string, progress: PendingVideoProgress) => void;
  updateVideoProgress: (id: string, updates: Partial<PendingVideoProgress>) => void;
  removeVideoProgress: (id: string) => void;
  clearCompletedProgress: () => void;
  
  // Moderation placeholders
  moderationPlaceholders: Record<string, ModerationPlaceholder>;
  addModerationPlaceholder: (placeholder: ModerationPlaceholder) => void;
  removeModerationPlaceholder: (id: string) => void;
};

export const useGalleryStore = create<GalleryState>((set) => ({
  // Legacy pending system (kept for compatibility)
  pending: {},
  addPending: (j) => set((s) => ({ pending: { ...s.pending, [j.id]: j } })),
  removePending: (id) => set((s) => {
    const p = { ...s.pending }; 
    delete p[id]; 
    return { pending: p };
  }),
  
  // New unified video progress system
  videoProgress: {},
  
  setVideoProgress: (id, progress) => set((state) => ({
    videoProgress: { ...state.videoProgress, [id]: progress }
  })),
  
  updateVideoProgress: (id, updates) => set((state) => {
    const existing = state.videoProgress[id];
    if (!existing) return state;
    
    return {
      videoProgress: {
        ...state.videoProgress,
        [id]: { ...existing, ...updates }
      }
    };
  }),
  
  removeVideoProgress: (id) => set((state) => {
    const progress = { ...state.videoProgress };
    delete progress[id];
    return { videoProgress: progress };
  }),
  
  clearCompletedProgress: () => set((state) => {
    const progress = { ...state.videoProgress };
    Object.keys(progress).forEach(id => {
      const item = progress[id];
      if (item.status === 'succeeded' || item.status === 'failed') {
        delete progress[id];
      }
    });
    return { videoProgress: progress };
  }),
  
  // Moderation placeholders
  moderationPlaceholders: {},
  
  addModerationPlaceholder: (placeholder) => set((state) => ({
    moderationPlaceholders: { ...state.moderationPlaceholders, [placeholder.id]: placeholder }
  })),
  
  removeModerationPlaceholder: (id) => set((state) => {
    const placeholders = { ...state.moderationPlaceholders };
    delete placeholders[id];
    return { moderationPlaceholders: placeholders };
  })
}));

// Export types for use in components
export type { PendingVideoProgress, PendingJob, ModerationPlaceholder };