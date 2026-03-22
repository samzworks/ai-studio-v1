import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface CostEstimateParams {
  operationId: string;
  params?: Record<string, any>;
  enabled?: boolean;
}

interface CostEstimateResult {
  credits: number | null;
  isLoading: boolean;
  effectiveUsd: number | null;
  baseCostUsd: number | null;
  marginPercent: number | null;
}

interface PricingApiResponse {
  credits: number;
  effectiveUsd: number;
  baseCostUsd: number;
  marginPercent: number;
  operationId: string;
  snapshot: any;
}

/**
 * Hook to estimate the cost of an AI operation in real-time
 * 
 * Usage:
 * const { credits, isLoading } = useCostEstimate({
 *   operationId: "flux_schnell",
 *   params: { quantity: 1 },
 *   enabled: true
 * });
 */
export function useCostEstimate({ operationId, params, enabled = true }: CostEstimateParams): CostEstimateResult {
  const [estimate, setEstimate] = useState<CostEstimateResult>({
    credits: null,
    isLoading: false,
    effectiveUsd: null,
    baseCostUsd: null,
    marginPercent: null,
  });

  const { data, isLoading } = useQuery<PricingApiResponse>({
    queryKey: [`/api/pricing/estimate/${operationId}`, params],
    enabled: enabled && !!operationId,
  });

  useEffect(() => {
    if (data) {
      setEstimate({
        credits: data.credits,
        isLoading: false,
        effectiveUsd: data.effectiveUsd,
        baseCostUsd: data.baseCostUsd,
        marginPercent: data.marginPercent,
      });
    } else if (isLoading) {
      setEstimate(prev => ({ ...prev, isLoading: true }));
    }
  }, [data, isLoading]);

  return estimate;
}

/**
 * Simple hook to get just the credit cost
 */
export function useCreditCost(operationId: string, params?: Record<string, any>, enabled = true): number | null {
  const { credits } = useCostEstimate({ operationId, params, enabled });
  return credits;
}
