import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Edit3, Share2, Trash as Trash2, X, Wand2, Clipboard as Copy, Heart } from "lucide-react";
import ImageEditor from "./image-editor";
import Lightbox from "./lightbox";
import type { Image } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface ImageModalProps {
  image: Image;
  onClose: () => void;
  onImageDeleted: () => void;
}

export default function ImageModal({ image, onClose, onImageDeleted }: ImageModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImage, setCurrentImage] = useState(image);
  const [hasChanges, setHasChanges] = useState(false);

  // Query to check if image is favorited
  const { data: isFavorited = false } = useQuery({
    queryKey: ["/api/images", image.id, "favorite"],
    queryFn: async () => {
      const response = await fetch(`/api/images/${image.id}/favorite-status`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.isFavorited;
    },
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/images/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t('toasts.imageDeleted'),
        description: t('toasts.imageDeletedDescription'),
      });
      onImageDeleted();
    },
    onError: (error: Error) => {
      toast({
        title: t('toasts.deleteFailed'),
        description: error.message || t('toasts.deleteFailedDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/images/${id}/favorite`);
      return response.json();
    },
    onSuccess: (result) => {
      setHasChanges(true);
      // Invalidate queries to sync with other components
      queryClient.invalidateQueries({ queryKey: ["/api/images", image.id, "favorite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/images"] });
    },
    onError: (error: Error) => {
      // Silent failure - no toast messages
      console.error("Failed to update favorite status:", error);
    },
  });

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `ai-studio-${currentImage.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Generated Image',
          text: currentImage.prompt,
          url: currentImage.url,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(currentImage.url);
        toast({
          title: t('toasts.urlCopied'),
          description: t('toasts.urlCopiedDescription'),
        });
      } catch (error) {
        toast({
          title: t('toasts.shareFailed'),
          description: t('toasts.shareFailedDescription'),
          variant: "error-outline" as any,
        });
      }
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentImage.prompt);
      toast({
        title: t('toasts.promptCopied'),
        description: t('toasts.promptCopiedDescription'),
      });
    } catch (error) {
      toast({
        title: t('toasts.copyFailed'),
        description: t('toasts.copyFailedDescription'),
        variant: "error-outline" as any,
      });
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this image?')) {
      deleteMutation.mutate(image.id);
    }
  };

  const handleToggleFavorite = () => {
    favoriteMutation.mutate(currentImage.id);
  };

  if (showEditor) {
    return (
      <ImageEditor 
        image={image} 
        onClose={() => setShowEditor(false)}
        onSave={(blob, metadata) => {
          // Handle saving edited image
          setShowEditor(false);
          toast({
            title: t('toasts.imageEdited'),
            description: t('toasts.imageEditedDescription'),
          });
        }}
      />
    );
  }

  if (showFullScreen) {
    return (
      <Lightbox
        image={{
          id: currentImage.id,
          url: currentImage.url,
          prompt: currentImage.prompt
        }}
        isOpen={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        showActions={true}
        isFavorited={isFavorited}
        onFavoriteToggle={(imageId, isFavorited) => {
          setHasChanges(true);
          queryClient.invalidateQueries({ queryKey: ["/api/images", image.id, "favorite"] });
          queryClient.invalidateQueries({ queryKey: ["/api/images/favorites"] });
          queryClient.invalidateQueries({ queryKey: ["/api/images"] });
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900/95 backdrop-blur-md z-10">
          <h3 className="text-xl font-semibold text-white">Image Details</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              if (hasChanges) {
                onImageDeleted(); // Refresh gallery if there were changes
              }
              onClose();
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors duration-200 text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-6">
          {/* Full-size image */}
          <div className="mb-8">
            <img 
              src={currentImage.url} 
              alt={currentImage.prompt} 
              className="w-full h-auto max-h-[60vh] object-contain rounded-lg cursor-pointer border border-gray-600"
              onClick={() => setShowFullScreen(true)}
            />
          </div>
          
          {/* Image details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-8">
            <div>
              <span className="text-gray-400 block mb-2">Prompt:</span>
              <div className="flex items-start gap-2">
                <p className="text-white flex-1 p-3 bg-gray-800/50 rounded-lg border border-gray-700">{currentImage.prompt}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white"
                  title="Copy prompt"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <span className="text-gray-400 block mb-2">Dimensions:</span>
              <p className="text-white p-3 bg-gray-800/50 rounded-lg border border-gray-700">{currentImage.width}x{currentImage.height}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-2">Style:</span>
              <p className="text-white p-3 bg-gray-800/50 rounded-lg border border-gray-700 capitalize">{currentImage.style.replace('-', ' ')}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-2">Quality:</span>
              <p className="text-white p-3 bg-gray-800/50 rounded-lg border border-gray-700">{currentImage.quality}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-2">Created:</span>
              <p className="text-white p-3 bg-gray-800/50 rounded-lg border border-gray-700">{new Date(currentImage.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-2">Tags:</span>
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {currentImage.tags && currentImage.tags.length > 0 ? (
                    currentImage.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-xs border border-purple-600/30">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">No tags</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="border-t border-gray-700 pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Button 
                onClick={handleDownload}
                className="bg-purple-600 hover:bg-purple-700 text-white transition-colors duration-200 w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button 
                onClick={handleShare}
                variant="outline"
                className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700 transition-colors duration-200 w-full"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button 
                onClick={handleToggleFavorite}
                disabled={favoriteMutation.isPending}
                variant="outline"
                className={`${
                  isFavorited 
                    ? "bg-red-600/20 text-red-400 border-red-600/50 hover:bg-red-600/30" 
                    : "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                } transition-colors duration-200 w-full`}
              >
                <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? 'Unfavorite' : 'Favorite'}
              </Button>
              <Button 
                onClick={() => setShowEditor(true)}
                variant="outline"
                className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700 transition-colors duration-200 w-full"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                variant="outline" 
                className="bg-gray-800 text-white border-gray-600 hover:bg-red-600/20 hover:border-red-600/50 transition-colors duration-200 w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
