import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wand2, ArrowDownToLine as Download, RotateCw, Crop, Palette, Contrast, Sun } from "lucide-react";
import type { Image } from "@shared/schema";

interface ImageEditorProps {
  image: Image;
  onClose: () => void;
  onSave: (editedImage: Blob, metadata: any) => void;
}

interface EditSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  rotation: number;
  filter: string;
  crop: { x: number; y: number; width: number; height: number };
}

export default function ImageEditor({ image, onClose, onSave }: ImageEditorProps) {
  const [settings, setSettings] = useState<EditSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    rotation: 0,
    filter: "none",
    crop: { x: 0, y: 0, width: 100, height: 100 }
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const applyFilters = () => {
    return {
      filter: `
        brightness(${settings.brightness}%) 
        contrast(${settings.contrast}%) 
        saturate(${settings.saturation}%) 
        hue-rotate(${settings.hue}deg) 
        blur(${settings.blur}px)
        ${settings.filter !== "none" ? getFilterStyle(settings.filter) : ""}
      `,
      transform: `rotate(${settings.rotation}deg)`
    };
  };

  const getFilterStyle = (filter: string) => {
    switch (filter) {
      case "sepia": return "sepia(100%)";
      case "grayscale": return "grayscale(100%)";
      case "vintage": return "sepia(50%) contrast(120%) brightness(110%)";
      case "cool": return "hue-rotate(180deg) saturate(120%)";
      case "warm": return "hue-rotate(-20deg) saturate(120%) brightness(110%)";
      default: return "";
    }
  };

  const handleReset = () => {
    setSettings({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      rotation: 0,
      filter: "none",
      crop: { x: 0, y: 0, width: 100, height: 100 }
    });
  };

  const handleExport = async () => {
    setIsProcessing(true);
    // In a real implementation, this would apply the edits to the image
    // For now, we'll simulate the process
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-[hsl(var(--dark-surface))] border-r border-gray-700 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <Wand2 className="w-5 h-5 mr-2 text-[#21B0F8]" />
            Edit Image
          </h3>
          <Button variant="ghost" onClick={onClose} className="p-2">
            ×
          </Button>
        </div>

        <Tabs defaultValue="adjust" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[hsl(var(--dark-elevated))]">
            <TabsTrigger value="adjust">Adjust</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="transform">Transform</TabsTrigger>
          </TabsList>

          <TabsContent value="adjust" className="space-y-6 mt-6">
            <div>
              <Label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                <Sun className="w-4 h-4 mr-2" />
                Brightness: {settings.brightness}%
              </Label>
              <Slider
                value={[settings.brightness]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, brightness: value[0] }))}
                max={200}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                <Contrast className="w-4 h-4 mr-2" />
                Contrast: {settings.contrast}%
              </Label>
              <Slider
                value={[settings.contrast]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, contrast: value[0] }))}
                max={200}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                <Palette className="w-4 h-4 mr-2" />
                Saturation: {settings.saturation}%
              </Label>
              <Slider
                value={[settings.saturation]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, saturation: value[0] }))}
                max={200}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-300 mb-2 block">
                Hue: {settings.hue}°
              </Label>
              <Slider
                value={[settings.hue]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, hue: value[0] }))}
                max={360}
                min={-360}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-300 mb-2 block">
                Blur: {settings.blur}px
              </Label>
              <Slider
                value={[settings.blur]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, blur: value[0] }))}
                max={10}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4 mt-6">
            <div>
              <Label className="text-sm font-medium text-gray-300 mb-2 block">Filter Style</Label>
              <Select 
                value={settings.filter} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, filter: value }))}
              >
                <SelectTrigger className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="sepia">Sepia</SelectItem>
                  <SelectItem value="grayscale">Grayscale</SelectItem>
                  <SelectItem value="vintage">Vintage</SelectItem>
                  <SelectItem value="cool">Cool</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="transform" className="space-y-4 mt-6">
            <div>
              <Label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                <RotateCw className="w-4 h-4 mr-2" />
                Rotation: {settings.rotation}°
              </Label>
              <Slider
                value={[settings.rotation]}
                onValueChange={(value) => setSettings(prev => ({ ...prev, rotation: value[0] }))}
                max={360}
                min={-360}
                step={1}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSettings(prev => ({ ...prev, rotation: prev.rotation + 90 }))}
                className="bg-[hsl(var(--dark-elevated))] border-gray-700"
              >
                Rotate 90°
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSettings(prev => ({ ...prev, rotation: 0 }))}
                className="bg-[hsl(var(--dark-elevated))] border-gray-700"
              >
                Reset
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 space-y-3">
          <Button 
            onClick={handleReset}
            variant="outline"
            className="w-full bg-[hsl(var(--dark-elevated))] border-gray-700"
          >
            Reset All
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]"
          >
            <Download className="w-4 h-4 mr-2" />
            {isProcessing ? "Processing..." : "Export Image"}
          </Button>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl max-h-full">
          <img 
            src={image.url} 
            alt={image.prompt}
            style={applyFilters()}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300"
          />
        </div>
      </div>
    </div>
  );
}