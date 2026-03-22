import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, RotateCcw, WandSparkles as Sparkles, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface UpscaleModel {
  id: string;
  name: string;
  description: string;
  supportedScaleFactors: number[];
  creditsPerMegapixel: number;
}

interface UpscaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageId?: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  isPublic?: boolean;
}

function getAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function UpscaleModal({
  open,
  onOpenChange,
  imageId,
  imageUrl,
  imageWidth,
  imageHeight,
  isPublic = false,
}: UpscaleModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [selectedModel, setSelectedModel] = useState("seedvr-upscale");
  const [scaleFactor, setScaleFactor] = useState<number>(2);
  const [creditCost, setCreditCost] = useState<number>(0);

  const { data: modelsData } = useQuery<{ models: UpscaleModel[] }>({
    queryKey: ["/api/upscale/models"],
    enabled: open,
  });

  const models = modelsData?.models || [];
  const currentModel = models.find(m => m.id === selectedModel);
  const supportedScaleFactors = currentModel?.supportedScaleFactors || [2, 4, 8, 10];

  const calculateCostMutation = useMutation({
    mutationFn: async (params: { sourceWidth: number; sourceHeight: number; scaleFactor: number; modelId: string }) => {
      const res = await apiRequest("POST", "/api/upscale/calculate-cost", params);
      return res.json();
    },
    onSuccess: (data) => {
      setCreditCost(data.creditCost);
    },
  });

  useEffect(() => {
    if (open && imageWidth && imageHeight) {
      calculateCostMutation.mutate({
        sourceWidth: imageWidth,
        sourceHeight: imageHeight,
        scaleFactor,
        modelId: selectedModel,
      });
    }
  }, [open, imageWidth, imageHeight, scaleFactor, selectedModel]);

  const startUpscaleMutation = useMutation({
    mutationFn: async () => {
      const absoluteUrl = getAbsoluteUrl(imageUrl);
      const res = await apiRequest("POST", "/api/upscale/start", {
        sourceImageId: imageId,
        sourceImageUrl: absoluteUrl,
        sourceWidth: imageWidth,
        sourceHeight: imageHeight,
        scaleFactor,
        modelId: selectedModel,
        isPublic,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || "Failed to start upscale");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("upscale.started"),
        description: t("upscale.startedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/upscale/active-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      onOpenChange(false);
      navigate("/history");
    },
    onError: (error: Error) => {
      toast({
        title: t("upscale.failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReset = () => {
    setSelectedModel("seedvr-upscale");
    setScaleFactor(2);
  };

  const handleUpscale = () => {
    startUpscaleMutation.mutate();
  };

  const outputWidth = imageWidth * scaleFactor;
  const outputHeight = imageHeight * scaleFactor;
  const outputMegapixels = (outputWidth * outputHeight) / 1_000_000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-purple-900/50 text-white max-w-md z-[10000]"
        overlayClassName="z-[10000]"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#21B0F8]" />
            <DialogTitle className="text-white">{t("upscale.title")}</DialogTitle>
          </div>
        </DialogHeader>
        
        <DialogDescription className="sr-only">
          {t("upscale.description")}
        </DialogDescription>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t("upscale.model")}</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="bg-[#1a1a2e]/80 border-purple-800/50 text-white h-14">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-purple-800/50">
                {models.length > 0 ? (
                  models.map((model) => (
                    <SelectItem 
                      key={model.id} 
                      value={model.id}
                      className="text-white hover:bg-purple-900/50 focus:bg-purple-900/50"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-gray-400">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="seedvr-upscale" className="text-white hover:bg-purple-900/50">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">SeedVR2 Upscale</span>
                      <span className="text-xs text-gray-400">{t("upscale.description")}</span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t("upscale.scaleFactor")}</Label>
            <div className="flex gap-2">
              {supportedScaleFactors.map((factor) => (
                <Button
                  key={factor}
                  variant={scaleFactor === factor ? "default" : "outline"}
                  onClick={() => setScaleFactor(factor)}
                  className={`flex-1 h-12 font-medium ${
                    scaleFactor === factor
                      ? "bg-gradient-to-r from-[#1F56F5] to-purple-600 text-white hover:from-[#1F56F5] hover:to-purple-700 border-0"
                      : "bg-[#1a1a2e]/80 border-purple-800/50 text-white hover:bg-purple-900/50 hover:border-purple-700"
                  }`}
                >
                  x{factor}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1a2e]/60 rounded-lg p-4 space-y-2 border border-purple-900/30">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t("upscale.inputSize")}</span>
              <span className="text-white">{imageWidth} x {imageHeight}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t("upscale.outputSize")}</span>
              <span className="text-white">{outputWidth} x {outputHeight}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t("upscale.outputMegapixels")}</span>
              <span className="text-white">{outputMegapixels.toFixed(2)} MP</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-shrink-0 h-14 px-4 bg-transparent border-purple-800/50 text-gray-300 hover:bg-purple-900/30 hover:text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {t("upscale.reset")}
            </Button>
            <Button
              onClick={handleUpscale}
              disabled={startUpscaleMutation.isPending || calculateCostMutation.isPending}
              className="flex-1 h-14 bg-gradient-to-r from-[#1F56F5] to-purple-600 text-white hover:from-[#1F56F5] hover:to-purple-700 font-medium text-lg"
            >
              {startUpscaleMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t("upscale.processing")}
                </>
              ) : (
                <>
                  {t("upscale.upscaleButton")}
                  {calculateCostMutation.isPending ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <span className="ml-2 flex items-center gap-1">{creditCost} <Coins className="w-4 h-4" /></span>
                  )}
                  <Wand2 className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

