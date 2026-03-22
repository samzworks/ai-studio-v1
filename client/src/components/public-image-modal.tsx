import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowDownToLine as Download, Flag, X, Calendar, CircleUserRound as User, Palette, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import ImageReportDialog from "./image-report-dialog";
import Lightbox from "./lightbox";
import { useTranslation } from "react-i18next";

interface Image {
  id: number;
  ownerId: string;
  prompt: string;
  url: string;
  isPublic: boolean;
  model: string;
  quality: string;
  style: string;
  width: number;
  height: number;
  createdAt: string;
  ownerName?: string;
  tags?: string[] | null;
  negativePrompt?: string | null;
  seed?: number | null;
  steps?: number | null;
  cfgScale?: number | null;
  aspectRatio?: string | null;
  provider: string;
}

interface PublicImageModalProps {
  image: Image | null;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteToggle?: (imageId: number, isFavorited: boolean) => void;
}

export default function PublicImageModal({ 
  image, 
  isOpen, 
  onClose,
  onFavoriteToggle 
}: PublicImageModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const favoriteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      return await apiRequest(`/api/images/${imageId}/favorite`, "PATCH");
    },
    onSuccess: (data: any) => {
      const isFavorited = data?.isFavorited || false;
      setIsFavorited(isFavorited);
      if (onFavoriteToggle) {
        onFavoriteToggle(image!.id, isFavorited);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: isFavorited ? "Added to favorites" : "Removed from favorites",
        description: isFavorited 
          ? "Image saved to your favorites collection" 
          : "Image removed from your favorites",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update favorite status",
        variant: "error-outline" as any,
      });
    },
  });

  const handleDownload = () => {
    if (!image) return;
    
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t('toasts.downloadStarted'),
      description: t('toasts.downloadDescription'),
    });
  };

  const handleFavoriteToggle = () => {
    if (!image || !isAuthenticated) {
      toast({
        title: t('toasts.loginRequired'),
        description: t('toasts.loginRequiredDescription'),
        variant: "error-outline" as any,
      });
      return;
    }
    favoriteMutation.mutate(image.id);
  };

  if (!image) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <div className="grid md:grid-cols-2 h-full">
            {/* Image Section */}
            <div className="relative bg-black flex items-center justify-center">
              <img
                src={image.url}
                alt={image.prompt}
                className="max-w-full max-h-full object-contain cursor-pointer"
                style={{ maxHeight: "80vh" }}
                onClick={() => setShowLightbox(true)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Details Section */}
            <div className="p-6 overflow-y-auto">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl">Image Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Creator Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-[#1F56F5] rounded-full flex items-center justify-center text-white font-semibold">
                    {image.ownerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium">Created by {image.ownerName || "Anonymous"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(image.createdAt)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Prompt */}
                <div>
                  <h3 className="font-semibold mb-2">Prompt</h3>
                  <p className="text-sm bg-muted p-3 rounded border leading-relaxed">
                    {image.prompt}
                  </p>
                </div>

                {/* Technical Details */}
                <div>
                  <h3 className="font-semibold mb-3">Generation Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">

                    
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-purple-500" />
                      <span className="text-muted-foreground">Style:</span>
                      <Badge variant="outline">{image.style}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span>{image.width} × {image.height}</span>
                    </div>
                    

                    
                    {image.quality && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Quality:</span>
                        <Badge variant="secondary">{image.quality}</Badge>
                      </div>
                    )}

                    {image.aspectRatio && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Aspect Ratio:</span>
                        <span>{image.aspectRatio}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Parameters */}
                {(image.negativePrompt || image.seed !== null || image.steps || image.cfgScale) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Advanced Parameters</h3>
                      <div className="space-y-3 text-sm">
                        {image.negativePrompt && (
                          <div>
                            <span className="text-muted-foreground block mb-1">Negative Prompt:</span>
                            <p className="bg-muted p-2 rounded text-xs">
                              {image.negativePrompt}
                            </p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3">
                          {image.seed !== null && (
                            <div>
                              <span className="text-muted-foreground">Seed:</span>
                              <span className="ml-1">{image.seed}</span>
                            </div>
                          )}
                          
                          {image.steps && (
                            <div>
                              <span className="text-muted-foreground">Steps:</span>
                              <span className="ml-1">{image.steps}</span>
                            </div>
                          )}
                          
                          {image.cfgScale && (
                            <div>
                              <span className="text-muted-foreground">CFG Scale:</span>
                              <span className="ml-1">{image.cfgScale}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Tags */}
                {image.tags && image.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {image.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    
                    {isAuthenticated && (
                      <Button
                        variant={isFavorited ? "default" : "outline"}
                        className="flex-1"
                        onClick={handleFavoriteToggle}
                        disabled={favoriteMutation.isPending}
                      >
                        <Heart 
                          className={`w-4 h-4 mr-2 ${isFavorited ? "fill-current" : ""}`} 
                        />
                        {isFavorited ? "Favorited" : "Favorite"}
                      </Button>
                    )}
                  </div>
                  
                  {isAuthenticated && user?.id !== image.ownerId && (
                    <Button
                      variant="outline"
                      className="text-orange-600 hover:text-orange-700"
                      onClick={() => setIsReportDialogOpen(true)}
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report Image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <ImageReportDialog
        image={image}
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
      />

      {/* Lightbox */}
      <Lightbox
        image={{
          id: image.id,
          url: image.url,
          prompt: image.prompt,
          ownerId: image.ownerId,
          ownerName: image.ownerName
        }}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        showActions={true}
        isFavorited={isFavorited}
        onFavoriteToggle={(imageId, newIsFavorited) => {
          setIsFavorited(newIsFavorited);
          if (onFavoriteToggle) {
            onFavoriteToggle(imageId, newIsFavorited);
          }
        }}
      />
    </>
  );
}
