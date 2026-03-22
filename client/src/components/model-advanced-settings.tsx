import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

interface ModelAdvancedSettingsProps {
  modelId: string;
  provider: "openai" | "replicate";
  onSettingsChange: (settings: any) => void;
  initialSettings?: any;
}

export default function ModelAdvancedSettings({ 
  modelId, 
  provider, 
  onSettingsChange, 
  initialSettings = {} 
}: ModelAdvancedSettingsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    negativePrompt: "",
    seed: "",
    steps: 50,
    cfgScale: 7.5,
    aspectRatio: "1:1",
    ...initialSettings
  });

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const isFluxModel = modelId.startsWith('flux');
  const isSDModel = modelId.startsWith('sd') || modelId === 'sdxl';
  const isOpenAIModel = provider === 'openai';

  const aspectRatios = [
    { value: "1:1", label: "Square (1:1)" },
    { value: "16:9", label: "Landscape (16:9)" },
    { value: "9:16", label: "Portrait (9:16)" },
    { value: "4:3", label: "Standard (4:3)" },
    { value: "3:4", label: "Portrait (3:4)" },
    { value: "21:9", label: "Ultrawide (21:9)" },
    { value: "2:3", label: "Photo (2:3)" },
    { value: "3:2", label: "Photo (3:2)" },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium text-gray-300 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
        <span>{t('forms.advancedSettings') || 'Advanced Settings'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 mt-4">
        <TooltipProvider>
          {/* Negative Prompt - Available for Replicate models */}
          {provider === "replicate" && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="negativePrompt" className="text-sm font-medium text-gray-300">
                  {t('forms.labels.negativePrompt')}
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('tooltips.negativePrompt')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="negativePrompt"
                placeholder={t('forms.placeholder.negativePrompt')}
                value={settings.negativePrompt}
                onChange={(e) => updateSetting('negativePrompt', e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Seed */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="seed" className="text-sm font-medium text-gray-300">
                {t('forms.labels.seed')}
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('tooltips.seed')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="seed"
              type="number"
              placeholder={t('forms.placeholder.seed')}
              value={settings.seed}
              onChange={(e) => updateSetting('seed', e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>

          {/* Steps - Not for OpenAI models */}
          {!isOpenAIModel && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm font-medium text-gray-300">
                    {t('forms.labels.steps')}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('tooltips.steps')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-gray-400">{settings.steps}</span>
              </div>
              <Slider
                value={[settings.steps]}
                onValueChange={([value]) => updateSetting('steps', value)}
                min={isFluxModel && modelId === 'flux-schnell' ? 1 : 10}
                max={isFluxModel ? 50 : 100}
                step={1}
                className="w-full"
              />
            </div>
          )}

          {/* CFG Scale - Not for OpenAI models */}
          {!isOpenAIModel && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm font-medium text-gray-300">
                    Guidance Scale
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How closely to follow the prompt. Higher = more adherence</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-gray-400">{settings.cfgScale}</span>
              </div>
              <Slider
                value={[settings.cfgScale]}
                onValueChange={([value]) => updateSetting('cfgScale', value)}
                min={1}
                max={20}
                step={0.5}
                className="w-full"
              />
            </div>
          )}

          {/* Aspect Ratio - For Replicate models */}
          {provider === "replicate" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Aspect Ratio
              </Label>
              <Select 
                value={settings.aspectRatio} 
                onValueChange={(value) => updateSetting('aspectRatio', value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {aspectRatios.map((ratio) => (
                    <SelectItem 
                      key={ratio.value} 
                      value={ratio.value}
                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                    >
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Model-specific settings */}
          {isFluxModel && (
            <div className="p-3 bg-[#1F56F5]/10 border border-[#1F56F5]/20 rounded-lg">
              <h4 className="text-sm font-medium text-[#21B0F8] mb-2">Flux Model Tips</h4>
              <ul className="text-xs text-[#21B0F8] space-y-1">
                <li>• Flux Schnell: Optimized for 1-4 steps (fastest)</li>
                <li>• Flux Dev: Best quality with 20-50 steps</li>
                <li>• Flux Pro: Maximum quality, slower generation</li>
              </ul>
            </div>
          )}

          {isSDModel && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-purple-300 mb-2">Stable Diffusion Tips</h4>
              <ul className="text-xs text-purple-200 space-y-1">
                <li>• Use 20-50 steps for best quality</li>
                <li>• CFG Scale 7-12 works well for most prompts</li>
                <li>• Negative prompts help avoid unwanted elements</li>
              </ul>
            </div>
          )}
        </TooltipProvider>
      </CollapsibleContent>
    </Collapsible>
  );
}
