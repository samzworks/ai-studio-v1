import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface PricingEstimate {
  baseCost: number;
  additionalCosts: { feature: string; cost: number }[];
  totalCost: number;
}

interface PricingParams {
  model?: string;
  enhancePrompt?: boolean;
  imageCount?: number;
  aspectRatio?: string;
  quality?: string;
  styleImageUrl?: string;
  duration?: number;
  resolution?: string;
  audioEnabled?: boolean;
  imageSize?: string;
  mode?: string;
  hasImageInput?: boolean;
}

// Create a stable cache key from params
function createCacheKey(params: PricingParams): string {
  return JSON.stringify({
    model: params.model || '',
    enhancePrompt: params.enhancePrompt || false,
    imageCount: params.imageCount || 1,
    aspectRatio: params.aspectRatio || '',
    quality: params.quality || '',
    styleImageUrl: params.styleImageUrl || '',
    duration: params.duration || undefined,
    resolution: params.resolution || undefined,
    audioEnabled: params.audioEnabled || false,
    imageSize: params.imageSize || '',
    mode: params.mode || '',
    hasImageInput: params.hasImageInput || false
  });
}

export function usePricingEstimate(params: PricingParams) {
  const [debouncedParams, setDebouncedParams] = useState<PricingParams>(params);
  
  // Debounce the parameters with longer delay to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedParams(params);
    }, 300); // Increased from 150ms to 300ms
    
    return () => clearTimeout(timer);
  }, [params.model, params.enhancePrompt, params.imageCount, params.aspectRatio, params.quality, params.styleImageUrl, params.duration, params.resolution, params.audioEnabled, params.imageSize, params.mode, params.hasImageInput]);

  // Create stable query key
  const queryKey = useMemo(() => {
    return ["/api/pricing/estimate", createCacheKey(debouncedParams)];
  }, [debouncedParams]);

  const { data: estimate, isLoading, error } = useQuery<PricingEstimate>({
    queryKey,
    queryFn: async () => {
      if (!debouncedParams.model) {
        return null;
      }
      
      const response = await apiRequest("POST", "/api/pricing/estimate", debouncedParams);
      return await response.json();
    },
    enabled: !!debouncedParams.model,
    staleTime: 1000 * 60 * 5, // Cache pricing estimates for 5 minutes
    refetchOnWindowFocus: false,
  });

  return { 
    estimate, 
    isLoading, 
    error: error?.message || null 
  };
}