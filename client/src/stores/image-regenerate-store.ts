import { create } from 'zustand';

export type RegenerateRequest = {
  prompt: string;
  model: string;
  style?: string;
  width?: number;
  height?: number;
  quality?: string;
  aspectRatio?: string;
  styleImageUrl?: string;
  imageStrength?: number;
  timestamp: number; // Unique timestamp to identify each regenerate request
} | null;

type ImageRegenerateStoreState = {
  regenerateRequest: RegenerateRequest;
  setRegenerateRequest: (request: RegenerateRequest) => void;
  clearRegenerateRequest: () => void;
};

export const useImageRegenerateStore = create<ImageRegenerateStoreState>((set) => ({
  regenerateRequest: null,
  setRegenerateRequest: (request) => set({ regenerateRequest: request }),
  clearRegenerateRequest: () => set({ regenerateRequest: null }),
}));
