import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UserCredits {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

interface CreditContextType {
  credits: UserCredits | undefined;
  isLoading: boolean;
  refetchCredits: () => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function CreditProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data: credits, isLoading, refetch } = useQuery<UserCredits>({
    queryKey: ["/api/credits"],
    staleTime: 0, // Always refetch when invalidated for instant credit updates
    refetchInterval: 1000 * 60 * 3, // 3 minutes - reduced from 30 seconds
    refetchOnWindowFocus: true, // Refresh when user comes back to tab
    queryFn: async () => {
      const res = await fetch("/api/credits", {
        credentials: "include",
      });
      
      // Handle 401 gracefully - user is not authenticated, return null
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
  });

  const refetchCredits = () => {
    // Force immediate invalidation and refetch
    queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    queryClient.refetchQueries({ queryKey: ["/api/credits"] });
  };

  return (
    <CreditContext.Provider value={{ credits, isLoading, refetchCredits }}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error("useCredits must be used within a CreditProvider");
  }
  return context;
}