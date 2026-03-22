import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BaseModel, VideoMode, MediaType, ResolvedVariant } from "@shared/model-routing";
import { apiRequest } from "@/lib/queryClient";

interface UseModelRoutingOptions {
  mediaType: MediaType;
  defaultBaseModelId?: string;
  defaultMode?: VideoMode;
}

interface UseModelRoutingResult {
  baseModels: BaseModel[];
  isLoading: boolean;
  selectedBaseModelId: string;
  selectedMode: VideoMode;
  hasImageInput: boolean;
  resolvedVariant: ResolvedVariant | null;
  fallbackMessage: string | null;
  hasError: boolean;
  setSelectedBaseModelId: (id: string) => void;
  setSelectedMode: (mode: VideoMode) => void;
  setHasImageInput: (hasImage: boolean) => void;
  getResolvedVariantId: () => string | null;
  selectedBaseModel: BaseModel | null;
  canSubmit: boolean;
}

export function useModelRouting({
  mediaType,
  defaultBaseModelId,
  defaultMode = "pro"
}: UseModelRoutingOptions): UseModelRoutingResult {
  const [selectedBaseModelId, setSelectedBaseModelId] = useState<string>(defaultBaseModelId || "");
  const [selectedMode, setSelectedMode] = useState<VideoMode>(defaultMode);
  const [hasImageInput, setHasImageInput] = useState<boolean>(false);

  const { data: baseModels = [], isLoading } = useQuery<BaseModel[]>({
    queryKey: [`/api/base-models/${mediaType}`],
    staleTime: 5 * 60 * 1000,
  });

  const selectedBaseModel = useMemo(() => {
    return baseModels.find(m => m.id === selectedBaseModelId) || null;
  }, [baseModels, selectedBaseModelId]);

  const { data: resolvedVariantData } = useQuery<ResolvedVariant>({
    queryKey: ["/api/resolve-variant", selectedBaseModelId, mediaType, hasImageInput, selectedMode],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/resolve-variant", {
        baseModelId: selectedBaseModelId,
        mediaType,
        hasInputImage: hasImageInput,
        mode: selectedMode
      });
      return response.json();
    },
    enabled: !!selectedBaseModelId,
    staleTime: 30 * 1000,
  });

  const resolvedVariant = resolvedVariantData || null;
  const fallbackMessage = resolvedVariant?.fallbackMessage || null;
  const hasError = resolvedVariant?.error === true;
  const canSubmit = !!selectedBaseModelId && !hasError && !!resolvedVariant?.variant;

  const getResolvedVariantId = useCallback(() => {
    return resolvedVariant?.variant?.id || null;
  }, [resolvedVariant]);

  const handleSetSelectedBaseModelId = useCallback((id: string) => {
    setSelectedBaseModelId(id);
    const model = baseModels.find(m => m.id === id);
    if (model?.defaultMode) {
      setSelectedMode(model.defaultMode);
    }
  }, [baseModels]);

  return {
    baseModels,
    isLoading,
    selectedBaseModelId,
    selectedMode,
    hasImageInput,
    resolvedVariant,
    fallbackMessage,
    hasError,
    setSelectedBaseModelId: handleSetSelectedBaseModelId,
    setSelectedMode,
    setHasImageInput,
    getResolvedVariantId,
    selectedBaseModel,
    canSubmit,
  };
}

export function useResolveVariant(
  baseModelId: string,
  mediaType: MediaType,
  hasInputImage: boolean,
  mode?: VideoMode
) {
  return useQuery<ResolvedVariant>({
    queryKey: ["/api/resolve-variant", baseModelId, mediaType, hasInputImage, mode],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/resolve-variant", {
        baseModelId,
        mediaType,
        hasInputImage,
        mode
      });
      return response.json();
    },
    enabled: !!baseModelId,
    staleTime: 30 * 1000,
  });
}
