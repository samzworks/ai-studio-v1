import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./useAuth";

/**
 * Optimized hook to fetch favorite status for multiple images in a single API call
 * This replaces individual favorite-status queries to improve performance
 */
export function useBulkFavoriteStatus(imageIds: number[]) {
  const { isAuthenticated, user } = useAuth();

  return useQuery({
    queryKey: ["/api/images/bulk-favorite-status", ...imageIds.sort()],
    queryFn: async () => {
      if (!isAuthenticated || imageIds.length === 0) {
        return {};
      }

      try {
        const response = await apiRequest("POST", "/api/images/bulk-favorite-status", {
          imageIds
        });
        return await response.json();
      } catch (error) {
        console.error('Error fetching bulk favorite status:', error);
        return {};
      }
    },
    enabled: isAuthenticated && imageIds.length > 0 && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * Helper hook to get favorite status for a single image from bulk data
 */
export function useSingleFavoriteStatus(imageId: number, bulkData?: Record<number, boolean>) {
  return bulkData?.[imageId] ?? false;
}