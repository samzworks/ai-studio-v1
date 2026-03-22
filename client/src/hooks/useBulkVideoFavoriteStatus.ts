import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

export function useBulkVideoFavoriteStatus(videoIds: (number | string)[]) {
  const { isAuthenticated } = useAuth();

  // Filter out temporary video IDs (non-integer IDs) as they don't exist in database
  const validVideoIds = videoIds.filter(id => {
    const numId = Number(id);
    return Number.isInteger(numId) && numId > 0;
  }).map(id => Number(id));

  return useQuery({
    queryKey: ["/api/videos/bulk-favorite-status", validVideoIds],
    queryFn: async () => {
      if (validVideoIds.length === 0) {
        return {};
      }
      
      const response = await apiRequest("POST", "/api/videos/bulk-favorite-status", {
        videoIds: validVideoIds,
      });
      return await response.json();
    },
    enabled: isAuthenticated && videoIds.length > 0,
    staleTime: 30000, // Keep data fresh for 30 seconds
  });
}