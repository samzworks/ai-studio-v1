import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Zap, Palette, Brain } from "lucide-react";

interface AdvancedSettingsProps {
  onSettingsChange: (settings: any) => void;
}

interface GenerationSettings {
  creativity: number;
  guidance: number;
  iterations: number;
  seed: string;
  negativePrompt: string;
  autoEnhance: boolean;
  colorPalette: string;
  composition: string;
  lightingStyle: string;
}

export default function AdvancedSettings({ onSettingsChange }: AdvancedSettingsProps) {
  const [settings, setSettings] = useState<GenerationSettings>({
    creativity: 7,
    guidance: 7.5,
    iterations: 50,
    seed: "",
    negativePrompt: "",
    autoEnhance: true,
    colorPalette: "natural",
    composition: "balanced",
    lightingStyle: "natural"
  });

  const [isOpen, setIsOpen] = useState(false);

  const handleSettingChange = (key: keyof GenerationSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      creativity: 7,
      guidance: 7.5,
      iterations: 50,
      seed: "",
      negativePrompt: "",
      autoEnhance: true,
      colorPalette: "natural",
      composition: "balanced",
      lightingStyle: "natural"
    };
    setSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000).toString();
    handleSettingChange('seed', seed);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-[hsl(var(--dark-elevated))] border-gray-700 text-gray-300 hover:text-white"
        >
          <Settings className="w-4 h-4 mr-2" />
          Advanced
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-[hsl(var(--dark-surface))] border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-white">
            <Brain className="w-5 h-5 mr-2 text-[#21B0F8]" />
            Advanced Generation Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Creativity Control */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-[hsl(var(--accent-amber))]" />
              Creativity Level: {settings.creativity}/10
            </Label>
            <Slider
              value={[settings.creativity]}
              onValueChange={(value) => handleSettingChange('creativity', value[0])}
              max={10}
              min={1}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Higher values produce more creative and unexpected results
            </p>
          </div>

          {/* Guidance Scale */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">
              Prompt Adherence: {settings.guidance}/15
            </Label>
            <Slider
              value={[settings.guidance]}
              onValueChange={(value) => handleSettingChange('guidance', value[0])}
              max={15}
              min={1}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              How closely the AI follows your prompt
            </p>
          </div>

          {/* Iterations */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">
              Quality Steps: {settings.iterations}
            </Label>
            <Slider
              value={[settings.iterations]}
              onValueChange={(value) => handleSettingChange('iterations', value[0])}
              max={100}
              min={20}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              More steps = higher quality but slower generation
            </p>
          </div>

          {/* Seed Control */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">Random Seed</Label>
            <div className="flex space-x-2">
              <Input
                value={settings.seed}
                onChange={(e) => handleSettingChange('seed', e.target.value)}
                placeholder="Leave empty for random"
                className="bg-[hsl(var(--dark-elevated))] border-gray-700 text-white"
              />
              <Button
                onClick={generateRandomSeed}
                variant="outline"
                className="bg-[hsl(var(--dark-elevated))] border-gray-700"
              >
                Random
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Use the same seed to reproduce identical results
            </p>
          </div>

          {/* Negative Prompt */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">Negative Prompt</Label>
            <Textarea
              value={settings.negativePrompt}
              onChange={(e) => handleSettingChange('negativePrompt', e.target.value)}
              placeholder="Describe what you don't want in the image..."
              className="bg-[hsl(var(--dark-elevated))] border-gray-700 text-white placeholder-gray-500 h-20"
            />
            <p className="text-xs text-gray-500">
              Elements to avoid in the generated image
            </p>
          </div>

          {/* Style Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300 flex items-center">
                <Palette className="w-4 h-4 mr-2 text-[hsl(var(--accent-secondary))]" />
                Color Palette
              </Label>
              <Select value={settings.colorPalette} onValueChange={(value) => handleSettingChange('colorPalette', value)}>
                <SelectTrigger className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="vibrant">Vibrant</SelectItem>
                  <SelectItem value="muted">Muted</SelectItem>
                  <SelectItem value="monochrome">Monochrome</SelectItem>
                  <SelectItem value="pastel">Pastel</SelectItem>
                  <SelectItem value="neon">Neon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">Composition</Label>
              <Select value={settings.composition} onValueChange={(value) => handleSettingChange('composition', value)}>
                <SelectTrigger className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="rule-of-thirds">Rule of Thirds</SelectItem>
                  <SelectItem value="center-focused">Center Focused</SelectItem>
                  <SelectItem value="dynamic">Dynamic</SelectItem>
                  <SelectItem value="minimalist">Minimalist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-300">Lighting Style</Label>
            <Select value={settings.lightingStyle} onValueChange={(value) => handleSettingChange('lightingStyle', value)}>
              <SelectTrigger className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(var(--dark-elevated))] border-gray-700">
                <SelectItem value="natural">Natural</SelectItem>
                <SelectItem value="dramatic">Dramatic</SelectItem>
                <SelectItem value="soft">Soft</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="golden-hour">Golden Hour</SelectItem>
                <SelectItem value="blue-hour">Blue Hour</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto Enhancement */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-300">Auto Enhancement</Label>
              <p className="text-xs text-gray-500">
                Automatically improve prompts for better results
              </p>
            </div>
            <Switch
              checked={settings.autoEnhance}
              onCheckedChange={(checked) => handleSettingChange('autoEnhance', checked)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-700">
            <Button
              onClick={resetToDefaults}
              variant="outline"
              className="bg-[hsl(var(--dark-elevated))] border-gray-700"
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              className="bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]"
            >
              Apply Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}