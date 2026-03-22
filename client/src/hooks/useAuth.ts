import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl?: string | null;
  role: "user" | "admin";
  isActive: boolean;
  publicByDefault: boolean;
  freeGenerationConsentAt?: string | null; // Timestamp when user consented to free plan public generations
  createdAt: string;
  updatedAt?: string | null;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
          signal: controller.signal,
        });
        
        // Handle 401 gracefully - user is simply not authenticated
        if (res.status === 401) {
          return null;
        }

        // Avoid blocking app shell when auth API is temporarily failing.
        if (res.status >= 500) {
          console.warn(`[Auth] /api/auth/user failed with ${res.status}. Treating as logged out.`);
          return null;
        }
        
        if (!res.ok) {
          const text = (await res.text()) || res.statusText;
          throw new Error(`${res.status}: ${text}`);
        }
        
        return await res.json();
      } catch (err) {
        console.warn("[Auth] Failed to resolve auth state. Treating as logged out.", err);
        return null;
      } finally {
        window.clearTimeout(timeout);
      }
    },
  });

  // Listen for auth reset events to refresh state
  useEffect(() => {
    const handleAuthReset = () => {
      console.log('Auth reset detected, refreshing user state');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      queryClient.removeQueries({ queryKey: ["/api/images/bulk-favorite-status"] });
      refetch();
    };

    window.addEventListener('auth-reset', handleAuthReset);
    return () => window.removeEventListener('auth-reset', handleAuthReset);
  }, [queryClient, refetch]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !!user.id,
    isAdmin: user?.role === "admin",
    isActive: user?.isActive !== false,
    error,
  };
}
