import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LoginRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginRequiredModal({ open, onOpenChange }: LoginRequiredModalProps) {
  const { t } = useTranslation();
  
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    // Since we're using Replit auth, login and signup are the same flow
    window.location.href = "/api/login";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-[9999]"
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t('modals.loginRequired.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
            {t('modals.loginRequired.description')}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={handleSignUp}
            className="flex-1"
          >
            {t('modals.loginRequired.signUpButton')}
          </Button>
          <Button 
            onClick={handleLogin}
            className="flex-1"
          >
            {t('modals.loginRequired.loginButton')}
          </Button>
        </DialogFooter>
        
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('common.close')}</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}