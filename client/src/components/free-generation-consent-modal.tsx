import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Compass as Globe } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FreeGenerationConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function FreeGenerationConsentModal({ 
  open, 
  onAccept, 
  onDecline 
}: FreeGenerationConsentModalProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const acceptedRef = useRef(false);
  const isRTL = i18n.language === 'ar' || i18n.language?.startsWith('ar-');

  const consentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/free-generation-consent");
      return response;
    },
    onSuccess: () => {
      acceptedRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onAccept();
    },
    onError: (error) => {
      console.error("Failed to record consent:", error);
      setIsSubmitting(false);
    }
  });

  const handleAccept = async () => {
    setIsSubmitting(true);
    consentMutation.mutate();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !acceptedRef.current) {
      onDecline();
    }
    if (isOpen) {
      acceptedRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-md", isRTL && "text-right")} dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader className={isRTL ? "text-right" : ""}>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse justify-end")}>
            <Globe className="h-5 w-5 text-blue-500" />
            {t('freeConsent.title', 'Public Generations Notice')}
          </DialogTitle>
          <DialogDescription className="pt-4 space-y-4">
            <div className={cn("flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg", isRTL && "flex-row-reverse text-right")}>
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">
                {t('freeConsent.notice', 'By continuing, you understand your Free plan generations will be public. Other users can see and be inspired by your creations.')}
              </p>
            </div>
            <p className={cn("text-sm text-gray-400", isRTL && "text-right")}>
              {t('freeConsent.upgradeHint', 'Upgrade to a paid plan anytime to make your generations private by default.')}
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className={cn("flex-col sm:flex-row gap-2 mt-4", isRTL && "sm:flex-row-reverse")}>
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={isSubmitting}
            className="sm:flex-1"
          >
            {t('freeConsent.decline', 'Cancel')}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="sm:flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? t('common.loading', 'Loading...') : t('freeConsent.accept', 'I Understand, Continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
