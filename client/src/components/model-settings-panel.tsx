import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  supportedRatios: string[];
  maxWidth: number;
  maxHeight: number;
  supportsNegativePrompt?: boolean;
  supportsSeed?: boolean;
  supportsSteps?: boolean;
  supportsCfgScale?: boolean;
}

interface ModelSettingsPanelProps {
  selectedModel: ModelConfig | null;
  formData: any;
  onFormChange: (field: string, value: any) => void;
  availableModels: ModelConfig[];
  onModelSelect: (modelId: string) => void;
}

const ModelSettingsPanel = React.memo(({ 
  selectedModel, 
  formData, 
  onFormChange, 
  availableModels,
  onModelSelect 
}: ModelSettingsPanelProps) => {
  
  const handleModelChange = useCallback((modelId: string) => {
    onModelSelect(modelId);
  }, [onModelSelect]);

  const handleSliderChange = useCallback((field: string) => (value: number[]) => {
    onFormChange(field, value[0]);
  }, [onFormChange]);

  const handleInputChange = useCallback((field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onFormChange(field, e.target.value);
  }, [onFormChange]);

  const handleSwitchChange = useCallback((field: string) => (checked: boolean) => {
    onFormChange(field, checked);
  }, [onFormChange]);

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label htmlFor="model">AI Model</Label>
        <Select value={formData.model} onValueChange={handleModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aspect Ratio */}
      {selectedModel?.supportedRatios && (
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <Select value={formData.aspectRatio} onValueChange={(value) => onFormChange('aspectRatio', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectedModel.supportedRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced Settings */}
      {selectedModel?.supportsNegativePrompt && (
        <div className="space-y-2">
          <Label htmlFor="negativePrompt">Negative Prompt</Label>
          <Textarea
            id="negativePrompt"
            value={formData.negativePrompt || ''}
            onChange={handleInputChange('negativePrompt')}
            placeholder="What you don't want in the image..."
            rows={3}
          />
        </div>
      )}

      {selectedModel?.supportsSeed && (
        <div className="space-y-2">
          <Label htmlFor="seed">Seed (Optional)</Label>
          <Input
            id="seed"
            type="number"
            value={formData.seed || ''}
            onChange={handleInputChange('seed')}
            placeholder="Random seed for reproducibility"
          />
        </div>
      )}

      {selectedModel?.supportsSteps && (
        <div className="space-y-2">
          <Label>Inference Steps: {formData.steps || 20}</Label>
          <Slider
            value={[formData.steps || 20]}
            onValueChange={handleSliderChange('steps')}
            max={50}
            min={10}
            step={1}
          />
        </div>
      )}

      {selectedModel?.supportsCfgScale && (
        <div className="space-y-2">
          <Label>CFG Scale: {formData.cfgScale || 7}</Label>
          <Slider
            value={[formData.cfgScale || 7]}
            onValueChange={handleSliderChange('cfgScale')}
            max={20}
            min={1}
            step={0.5}
          />
        </div>
      )}
    </div>
  );
});

ModelSettingsPanel.displayName = 'ModelSettingsPanel';

export default ModelSettingsPanel;