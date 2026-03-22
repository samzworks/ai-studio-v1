import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, CircleUserRound as User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Lightbox from "@/components/lightbox";
import { LoginRequiredModal } from "@/components/login-required-modal";
import type { Image } from "@shared/schema";
import { useImageModelDisplayName } from "@/hooks/useImageModelDisplayName";

export function PublicGalleryPreview() {
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Fetch public images (limited to latest 8)
  const { data: images = [], isLoading } = useQuery<(Image & { ownerName?: string })[]>({
    queryKey: ["/api/images/public"],
  });

  // Use the centralized hook for model display names
  const { getDisplayName: getModelDisplayName } = useImageModelDisplayName();

  const previewImages = images.slice(0, 8);

  const handleImageClick = (image: Image & { ownerName?: string }) => {
    setSelectedImage(image);
  };

  const handleGetStartedClick = () => {
    setShowLoginModal(true);
  };

  if (isLoading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Community Gallery
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Discover amazing creations from our community of AI artists
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-square bg-gray-800 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (previewImages.length === 0) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Community Gallery
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Discover amazing creations from our community of AI artists
            </p>
          </div>
          
          <div className="text-center py-12">
            <Eye className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-6">
              No public images available yet. Be the first to create and share!
            </p>
            <Button 
              onClick={handleGetStartedClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Community Gallery
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Discover amazing creations from our community of AI artists
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6">
            {previewImages.map((image) => (
              <Card 
                key={image.id} 
                className="group cursor-pointer bg-gray-800/50 border-gray-700 hover:border-primary/50 transition-all duration-300 overflow-hidden touch-friendly"
                onClick={() => handleImageClick(image)}
                data-testid={`card-image-${image.id}`}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={image.thumbnailUrl || image.url}
                      alt={image.prompt}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    
                    {/* Image info overlay - More visible on mobile */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 md:p-3">
                      <div className="flex items-center justify-between text-white text-xs md:text-sm mb-1">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span className="truncate">{image.ownerName || "Anonymous"}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-300 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                        <span>{image.width}×{image.height}</span>
                        <span className="hidden sm:inline">{getModelDisplayName(image.model)}</span>
                        <span className="hidden sm:inline">{image.isPublic ? 'Public' : 'Private'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {images.length > 8 && (
            <div className="text-center mt-12">
              <Button 
                variant="outline"
                onClick={handleGetStartedClick}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                View Full Gallery
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Image Modal */}
      {selectedImage && (
        <Lightbox
          image={{
            id: selectedImage.id,
            url: selectedImage.url,
            prompt: selectedImage.prompt,
            ownerId: selectedImage.ownerId,
            isPublic: selectedImage.isPublic,
            quality: selectedImage.quality || "standard",
            style: selectedImage.style || "photorealistic",
            width: selectedImage.width || 1024,
            height: selectedImage.height || 1024
          }}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          showActions={false}
          isFavorited={false}
          onFavoriteToggle={() => {}}
          onImageDeleted={() => {}}
          isOwner={false}
        />
      )}

      {/* Login Required Modal */}
      <LoginRequiredModal 
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />
    </>
  );
}