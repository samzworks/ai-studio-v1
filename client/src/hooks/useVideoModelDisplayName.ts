import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface VideoModel {
  id: string;
  name: string;
  displayName: string | null;
  enabled: boolean;
}

// Hardcoded fallback display names for all video models
// These are used when the API fails (e.g., for anonymous users or network errors)
const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  // WAN models
  'wan-2.2-t2v': 'WAN 2.2 Text-to-Video',
  'wan-2.2-i2v': 'WAN 2.2 Image-to-Video',
  'wan-2.2-t2v-fast': 'WAN 2.2 Text-to-Video Fast',
  'wan-2.2-i2v-fast': 'WAN 2.2 Image-to-Video Fast',
  'wan-2.5-preview-t2v': 'WAN 2.5 Preview Text-to-Video',
  'wan-2.5-preview-i2v': 'WAN 2.5 Preview Image-to-Video',
  // VEO 3.1 models
  'fal-veo3-t2v': 'VEO 3.1 (Text to Video)',
  'fal-veo3-i2v': 'VEO 3.1 (Image to Video)',
  'fal-veo3-fast-t2v': 'VEO 3.1 Fast (Text to Video)',
  'fal-veo3-fast-i2v': 'VEO 3.1 Fast (Image to Video)',
  // Luma models
  'luma-ray-flash-2-540p': 'Luma Ray Flash 2',
  'luma-dream-machine': 'Luma Dream Machine',
  // Sora 2 models
  'sora-2-t2v': 'Sora 2 Text-to-Video',
  'sora-2-i2v': 'Sora 2 Image-to-Video',
  'sora-2-t2v-pro': 'Sora 2 Pro Text-to-Video',
  'sora-2-i2v-pro': 'Sora 2 Pro Image-to-Video',
};

export function useVideoModelDisplayName() {
  // Fetch video models from API
  // Note: This may fail for unauthenticated users (401) or missing endpoint (404)
  // We gracefully fall back to hardcoded names in those cases
  const { data: videoModels = [], isLoading, error } = useQuery<VideoModel[]>({
    queryKey: ['/api/video-models'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry on auth failures
    queryFn: async () => {
      try {
        const res = await fetch('/api/video-models', {
          credentials: 'include',
        });
        
        // Return empty array on any non-2xx response (401, 404, 500, etc.)
        // This ensures we always fall back to hardcoded names without toasts
        if (!res.ok) {
          console.debug(`Failed to fetch video models (${res.status}), using fallbacks`);
          return [];
        }
        
        return await res.json();
      } catch (err) {
        // Silently return empty array on network/parsing errors
        console.debug('Failed to fetch video models (network error), using fallbacks:', err);
        return [];
      }
    },
  });

  // Create lookup map with fallbacks
  const displayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // First, add hardcoded fallbacks
    Object.entries(FALLBACK_DISPLAY_NAMES).forEach(([id, name]) => {
      map.set(id, name);
    });
    
    // Then override with API data if available (admin-configured names take precedence)
    // If API fails (e.g., 401 for anonymous users), we just use the fallbacks
    if (videoModels && !error) {
      videoModels.forEach(model => {
        const displayName = model.displayName || model.name;
        map.set(model.id, displayName);
      });
    }
    
    return map;
  }, [videoModels, error]);

  // Helper function to get display name for a model ID
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
