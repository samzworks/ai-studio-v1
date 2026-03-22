import { create } from 'zustand';

type VideoReferenceImage = {
  url: string;
  prompt?: string;
  defaultModel?: string;
} | null;

type VideoStoreState = {
  referenceImage: VideoReferenceImage;
  setReferenceImage: (image: VideoReferenceImage) => void;
  clearReferenceImage: () => void;
};

export const useVideoStore = create<VideoStoreState>((set) => ({
  referenceImage: null,
  setReferenceImage: (image) => set({ referenceImage: image }),
  clearReferenceImage: () => set({ referenceImage: null }),
}));
