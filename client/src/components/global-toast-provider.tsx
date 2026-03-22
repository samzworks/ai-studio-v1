import { createContext, useContext, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { LoginRequiredModal } from "@/components/login-required-modal";
import { useAuthAwareToast } from "@/hooks/use-auth-aware-toast";
import { ToastPositionProvider } from "@/contexts/toast-position-context";

interface GlobalToastContextType {
  showErrorToast: (options: { title?: string; description: string; isLoginRequired?: boolean }) => void;
  showSuccessToast: (title: string, description?: string) => void;
}

const GlobalToastContext = createContext<GlobalToastContextType | undefined>(undefined);

interface GlobalToastProviderProps {
  children: ReactNode;
}

export function GlobalToastProvider({ children }: GlobalToastProviderProps) {
  const { showErrorToast, showSuccessToast, showLoginModal, setShowLoginModal } = useAuthAwareToast();

  return (
    <ToastPositionProvider>
      <GlobalToastContext.Provider value={{ showErrorToast, showSuccessToast }}>
        {children}
        <Toaster />
        <LoginRequiredModal 
          open={showLoginModal} 
          onOpenChange={setShowLoginModal}
        />
      </GlobalToastContext.Provider>
    </ToastPositionProvider>
  );
}

export function useGlobalToast() {
  const context = useContext(GlobalToastContext);
  if (context === undefined) {
    throw new Error('useGlobalToast must be used within a GlobalToastProvider');
  }
  return context;
}