import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { createSafeTranslation, extractErrorMessage } from "@/utils/safe-translation";
import { getFriendlyErrorMessage } from "@/lib/error-utils";

interface ErrorToastOptions {
  title?: string;
  description: string;
  isLoginRequired?: boolean;
}

interface RoleBasedErrorOptions {
  title?: string;
  error: Error | any;
  fallbackTitle?: string;
}

export function useAuthAwareToast() {
  const { toast } = useToast();
  const { isAuthenticated, isAdmin } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { t } = useTranslation();

  const showErrorToast = ({ title = "Error", description, isLoginRequired = false }: ErrorToastOptions) => {
    if (isLoginRequired && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    toast({
      title,
      description,
      variant: "error-outline" as any,
      toastType: "error",
    });
  };

  const showSuccessToast = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "default",
      toastType: "success",
    });
  };

  const { safeT } = createSafeTranslation(t);

  const showRoleBasedErrorToast = ({ title, error, fallbackTitle = "Error" }: RoleBasedErrorOptions) => {
    const toastTitle = title ? safeT(title, {}, fallbackTitle) : fallbackTitle;
    
    let description: string;
    if (isAdmin) {
      description = extractErrorMessage(error);
    } else {
      description = getFriendlyErrorMessage(error);
    }

    toast({
      title: toastTitle,
      description,
      variant: "error-outline" as any,
      toastType: "error",
    });
  };

  return {
    showErrorToast,
    showSuccessToast,
    showRoleBasedErrorToast,
    showLoginModal,
    setShowLoginModal,
  };
}