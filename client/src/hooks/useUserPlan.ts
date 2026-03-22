import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface UserEntitlements {
  userId: string;
  subscription: {
    id: number;
    planId: number;
    status: string;
  } | null;
  plan: {
    id: number;
    name: string;
    isFree: boolean;
  } | null;
  featureFlags: {
    image_generation: boolean;
    video_generation: boolean;
    film_studio: boolean;
    can_make_private: boolean;
    [key: string]: boolean;
  };
  currentPeriodEnd: string | null;
  availableCredits: number;
}

export function useUserPlan() {
  const { user, isAuthenticated } = useAuth();
  
  const { data: entitlements, isLoading } = useQuery<UserEntitlements>({
    queryKey: ["/api/credits/entitlements"],
    enabled: isAuthenticated,
    staleTime: 30000,
    gcTime: 60000,
  });

  const isFreeUser = !entitlements?.featureFlags?.can_make_private;
  const isPaidUser = !!entitlements?.featureFlags?.can_make_private;
  const hasConsented = !!user?.freeGenerationConsentAt;
  const needsConsent = isFreeUser && !hasConsented;

  return {
    entitlements,
    isLoading,
    isFreeUser,
    isPaidUser,
    hasConsented,
    needsConsent,
    planName: entitlements?.plan?.name || 'Free',
  };
}
