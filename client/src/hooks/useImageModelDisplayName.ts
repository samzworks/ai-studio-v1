import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface ImageModel {
  id: string;
  name: string;
  displayName: string | null;
  enabled: boolean;
}

const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  'dall-e-3': 'DALL-E 3',
  'flux-pro': 'Flux Pro',
  'flux-dev': 'Flux Dev',
  'flux-schnell': 'Flux Schnell',
  'fal-z-image-turbo': 'Fast (Low quality for testing only)',
  'z-image-turbo': 'Fast (Low quality for testing only)',
  'fal-flux-schnell': 'FLUX Schnell (fal.ai)',
  'fal-flux-dev': 'FLUX Dev (fal.ai)',
  'fal-flux-pro': 'FLUX Pro (fal.ai)',
  'fal-imagen-4-fast': 'Imagen 4 Fast (fal.ai)',
  'fal-imagen-4': 'Imagen 4 (fal.ai)',
  'fal-nano-banana-txt2img': 'Nano Banana Text-to-Image (fal.ai)',
  'fal-nano-banana-edit': 'Nano Banana Edit (fal.ai)',
  'fal-nano-banana-img2img': 'Nano Banana Image-to-Image (fal.ai)',
  'fal-nano-banana-pro-txt2img': 'Nano Banana Pro Text-to-Image (fal.ai)',
  'fal-nano-banana-pro-edit': 'Nano Banana Pro Edit (fal.ai)',
  'fal-saudi-model': 'Saudi Model',
  'fal-saudi-model-pro': 'Saudi Model Pro (4K)',
  'fal-seedream-4.5-txt2img': 'SeeDream 4.5 Text-to-Image (fal.ai)',
  'fal-seedream-4.5-img2img': 'SeeDream 4.5 Image-to-Image (fal.ai)',
  'fal-sdxl': 'Stable Diffusion XL (fal.ai)',
  'fal-gpt-image-1.5-txt2img-low': 'GPT Image 1.5 Text-to-Image (Low)',
  'fal-gpt-image-1.5-txt2img-high': 'GPT Image 1.5 Text-to-Image (High)',
  'fal-gpt-image-1.5-edit-low': 'GPT Image 1.5 Edit (Low)',
  'fal-gpt-image-1.5-edit-high': 'GPT Image 1.5 Edit (High)',
};

export function useImageModelDisplayName() {
  const { data: imageModels = [], isLoading, error } = useQuery<ImageModel[]>({
    queryKey: ['/api/models'],
    staleTime: 1000 * 60 * 5,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch('/api/models', {
          credentials: 'include',
        });
        
        if (!res.ok) {
          console.debug(`Failed to fetch image models (${res.status}), using fallbacks`);
          return [];
        }
        
        return await res.json();
      } catch (err) {
        console.debug('Failed to fetch image models (network error), using fallbacks:', err);
        return [];
      }
    },
  });

  const displayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    
    Object.entries(FALLBACK_DISPLAY_NAMES).forEach(([id, name]) => {
      map.set(id, name);
    });
    
    if (imageModels && !error) {
      imageModels.forEach(model => {
        const displayName = model.displayName || model.name;
        map.set(model.id, displayName);
      });
    }
    
    return map;
  }, [imageModels, error]);

  const getDisplayName = (modelId: string): string => {
    return displayNameMap.get(modelId) || modelId;
  };

  return {
    getDisplayName,
    isLoading,
    error,
    displayNameMap,
  };
}
