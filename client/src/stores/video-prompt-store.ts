import { create } from 'zustand';

type VideoPromptStore = {
  selectedVideoPrompt: string;
  selectedVideoModel: string;
  setSelectedVideoPrompt: (prompt: string) => void;
  setSelectedVideoModel: (model: string) => void;
  clearSelectedVideoPrompt: () => void;
  clearSelectedVideoModel: () => void;
};

export const useVideoPromptStore = create<VideoPromptStore>((set) => ({
  selectedVideoPrompt: '',
  selectedVideoModel: '',
  setSelectedVideoPrompt: (prompt) => set({ selectedVideoPrompt: prompt }),
  setSelectedVideoModel: (model) => set({ selectedVideoModel: model }),
  clearSelectedVideoPrompt: () => set({ selectedVideoPrompt: '' }),
  clearSelectedVideoModel: () => set({ selectedVideoModel: '' }),
}));
