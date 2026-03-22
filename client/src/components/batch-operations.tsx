import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash as Trash2, Heart, Archive, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Image } from "@shared/schema";

interface BatchOperationsProps {
  images: Image[];
  selectedImages: number[];
  onSelectionChange: (ids: number[]) => void;
  onOperationComplete: () => void;
}

export default function BatchOperations({ 
  images, 
  selectedImages, 
  onSelectionChange, 
  onOperationComplete 
}: BatchOperationsProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [operation, setOperation] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const promises = ids.map(id => apiRequest("DELETE", `/api/images/${id}`));
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: t("toasts.deleted"),
        description: t("toasts.imageDeletedDescription"),
      });
      onSelectionChange([]);
      onOperationComplete();
    },
    onError: () => {
      toast({
        title: t("toasts.deleteFailed"),
        description: t("toasts.deleteFailedDescription"),
        variant: "error-outline" as any,
      });
    },
  });

  const batchFavoriteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const promises = ids.map(id => apiRequest("PATCH", `/api/images/${id}/favorite`));
      await Promise.all(promises);
    },
    onSuccess: () => {
      onSelectionChange([]);
      onOperationComplete();
    },
    onError: (error) => {
      // Silent failure - no toast messages
      console.error("Failed to update favorites:", error);
    },
  });

  const handleSelectAll = () => {
    if (selectedImages.length === images.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(images.map(img => img.id));
    }
  };

  const handleBatchDownload = async () => {
    setIsProcessing(true);
    const selectedImageData = images.filter(img => selectedImages.includes(img.id));
    
    for (const image of selectedImageData) {
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `ai-studio-${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsProcessing(false);
    toast({
      title: t("toasts.downloadStarted"),
      description: t("toasts.downloadDescription"),
    });
  };

  const handleBatchOperation = () => {
    switch (operation) {
      case "delete":
        if (confirm(`Are you sure you want to delete ${selectedImages.length} images?`)) {
          batchDeleteMutation.mutate(selectedImages);
        }
        break;
      case "favorite":
        batchFavoriteMutation.mutate(selectedImages);
        break;
      case "download":
        handleBatchDownload();
        break;
    }
  };

  if (selectedImages.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="glass-morphism rounded-xl px-6 py-4 flex items-center space-x-4 shadow-2xl">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={selectedImages.length === images.length}
            onCheckedChange={handleSelectAll}
            className="border-gray-500"
          />
          <span className="text-white font-medium">
            {selectedImages.length} selected
          </span>
        </div>

        <div className="h-6 w-px bg-gray-600"></div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBatchDownload}
            disabled={isProcessing}
            className="text-white hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-2" />
            {isProcessing ? "Downloading..." : "Download"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => batchFavoriteMutation.mutate(selectedImages)}
            disabled={batchFavoriteMutation.isPending}
            className="text-white hover:bg-white/10"
          >
            <Heart className="w-4 h-4 mr-2" />
            Favorite
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(var(--dark-surface))] border-gray-700">
              <DialogHeader>
                <DialogTitle>Delete Images</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-gray-300">
                  Are you sure you want to delete {selectedImages.length} images? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" className="border-gray-700">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => batchDeleteMutation.mutate(selectedImages)}
                    disabled={batchDeleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {batchDeleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectionChange([])}
          className="text-gray-400 hover:text-white"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}