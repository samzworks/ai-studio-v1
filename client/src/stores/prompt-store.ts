import { create } from 'zustand';

type ImageReference = {
  url: string;
  id: number;
};

type PromptStore = {
  selectedPrompt: string;
  setSelectedPrompt: (prompt: string) => void;
  clearSelectedPrompt: () => void;
  selectedImageReference: ImageReference | null;
  setSelectedImageReference: (image: ImageReference) => void;
  clearSelectedImageReference: () => void;
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  clearSelectedModel: () => void;
  openMobileForm: boolean;
  setOpenMobileForm: (open: boolean) => void;
};

export const usePromptStore = create<PromptStore>((set) => ({
  selectedPrompt: '',
  setSelectedPrompt: (prompt) => set({ selectedPrompt: prompt }),
  clearSelectedPrompt: () => set({ selectedPrompt: '' }),
  selectedImageReference: null,
  setSelectedImageReference: (image) => set({ selectedImageReference: image }),
  clearSelectedImageReference: () => set({ selectedImageReference: null }),
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  clearSelectedModel: () => set({ selectedModel: null }),
  openMobileForm: false,
  setOpenMobileForm: (open) => set({ openMobileForm: open }),
}));
