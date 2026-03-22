import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, House as Home, ArrowLeft, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  const handleGoHome = () => {
    window.location.href = "/";
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const handleGoToGallery = () => {
    window.location.href = "/gallery";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]" />
      </div>
      <Card className="w-full max-w-lg bg-card/40 backdrop-blur-md border-white/10 shadow-2xl relative z-10">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon and 404 */}
            <div className="space-y-4">
              <div className="p-4 rounded-full bg-primary/10 mx-auto w-fit">
                <FileQuestion className="h-12 w-12 text-primary" />
              </div>
              <div className="text-8xl font-bold text-muted-foreground/10 select-none">404</div>
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                {t('pages.notFound.title') || "Page Not Found"}
              </h1>
              <p className="text-muted-foreground text-lg max-w-md">
                {t('pages.notFound.description') || "The page you're looking for doesn't exist. It might have been moved or deleted."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
              <Button
                onClick={handleGoHome}
                className="flex-1"
                data-testid="button-go-home"
              >
                <Home className="mr-2 h-4 w-4" />
                {t('common.goHome') || "Go Home"}
              </Button>
              <Button
                onClick={handleGoBack}
                variant="outline"
                className="flex-1 border-white/10 hover:bg-white/5"
                data-testid="button-go-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.goBack') || "Go Back"}
              </Button>
            </div>

            {/* Additional Help */}
            <div className="pt-4 border-t border-white/10 w-full">
              <Button
                onClick={handleGoToGallery}
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground hover:bg-white/5"
                data-testid="button-explore-gallery"
              >
                <Compass className="mr-2 h-4 w-4" />
                {t('common.exploreGallery') || "Explore Public Gallery"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
