import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, UserPlus, LogIn, ArrowLeft, WandSparkles as Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function Unauthorized() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();

  const redirectPath = encodeURIComponent(location || "/");

  const handleCreateAccount = () => {
    window.location.href = `/api/login`;
  };

  const handleSignIn = () => {
    window.location.href = `/api/login`;
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]" />
        </div>
        <Card className="w-full max-w-lg bg-card/40 backdrop-blur-md border-white/10 shadow-2xl relative z-10">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-4 rounded-full bg-secondary/50">
                <Lock className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                  {t('pages.unauthorized.accessDenied') || "Access Denied"}
                </h1>
                <p className="text-muted-foreground text-lg max-w-md">
                  {t('pages.unauthorized.noPermissionMessage') || "You don't have permission to access this page. This area is restricted to authorized users only."}
                </p>
              </div>

              <Button
                onClick={handleGoBack}
                className="w-full"
                data-testid="button-go-back"
                aria-label={t('common.goBack') || "Go Back"}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('common.goBack') || "Go Back"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]" />
      </div>
      <Card className="w-full max-w-lg bg-card/40 backdrop-blur-md border-white/10 shadow-2xl relative z-10">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-full bg-primary/20">
              <Lock className="h-12 w-12 text-primary" aria-hidden="true" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">
                {t('pages.unauthorized.title') || "Sign in to continue"}
              </h1>
              <p className="text-muted-foreground text-lg max-w-md">
                {t('pages.unauthorized.subtitle') || "Sign in or create an account to access this page. You'll return right where you left off."}
              </p>
              <p className="text-muted-foreground/80 text-sm flex items-center justify-center gap-1">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t('pages.unauthorized.benefit') || "Save your projects, generations, and settings."}
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full pt-2">
              <Button
                onClick={handleCreateAccount}
                className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20"
                size="lg"
                data-testid="button-create-account"
                aria-label={t('pages.unauthorized.createAccount') || "Create account (Free)"}
              >
                <UserPlus className="mr-2 h-5 w-5" aria-hidden="true" />
                {t('pages.unauthorized.createAccount') || "Create account (Free)"}
              </Button>

              <Button
                onClick={handleSignIn}
                variant="outline"
                className="w-full h-12 text-lg border-white/10 hover:bg-white/5"
                size="lg"
                data-testid="button-sign-in"
                aria-label={t('common.signIn') || "Sign In"}
              >
                <LogIn className="mr-2 h-5 w-5" aria-hidden="true" />
                {t('common.signIn') || "Sign In"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground pt-2">
              <a
                href="/forgot-password"
                className="hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded"
                data-testid="link-forgot-password"
              >
                {t('pages.unauthorized.forgotPassword') || "Forgot password?"}
              </a>
              <span className="text-muted-foreground/50" aria-hidden="true">|</span>
              <button
                onClick={handleGoBack}
                className="hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded"
                data-testid="link-go-back"
              >
                {t('common.goBack') || "Go back"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
