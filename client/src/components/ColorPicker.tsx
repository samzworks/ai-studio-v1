import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isValidHexColor, previewThemeColors } from "@/lib/theme-service";
import { Palette, Eye, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  description?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

export default function ColorPicker({
  label,
  value,
  onChange,
  onSave,
  description,
  disabled = false,
  showPreview = true,
}: ColorPickerProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  useEffect(() => {
    setLocalValue(value);
    setIsValid(isValidHexColor(value) || value === "");
  }, [value]);

  const handleInputChange = (newValue: string) => {
    setLocalValue(newValue);
    const valid = isValidHexColor(newValue) || newValue === "";
    setIsValid(valid);
    
    if (valid) {
      onChange(newValue);
    }
  };

  const handlePreview = () => {
    if (isValidHexColor(localValue) && showPreview) {
      const colorKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
      previewThemeColors({ [colorKey]: localValue } as any, 3000);
      setIsPreviewActive(true);
      setTimeout(() => setIsPreviewActive(false), 3000);
    }
  };

  const handleReset = () => {
    const defaultColors: Record<string, string> = {
      'primary_color': '#083c4c',
      'secondary_color': '#988484',
      'accent_color': '#f59e0b',
      'background_color': '#0a0a0a',
      'surface_color': '#1a1a1a',
      'text_color': '#fafafa',
      'border_color': '#374151',
      'gradient_start': '#083c4c',
      'gradient_end': '#988484',
      'hero_gradient_start': '#0a0a0a',
      'hero_gradient_end': '#1a1a1a',
    };
    
    const colorKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    const defaultValue = defaultColors[colorKey] || '#083c4c';
    
    setLocalValue(defaultValue);
    onChange(defaultValue);
  };

  const needsSave = localValue !== value && isValid;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <Label className="font-medium">{label}</Label>
      </div>
      
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="flex gap-2 items-center">
        {/* Color preview square */}
        <div 
          className="w-10 h-10 rounded-md border-2 border-input flex-shrink-0 relative overflow-hidden"
          style={{ 
            backgroundColor: isValidHexColor(localValue) ? localValue : 'transparent',
            backgroundImage: !isValidHexColor(localValue) && localValue ? 
              'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 
              'none',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
          }}
          title={isValidHexColor(localValue) ? localValue : 'Invalid color'}
        />

        {/* Color input */}
        <div className="flex-1">
          <Input
            type="text"
            value={localValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={t('forms.placeholder.color')}
            className={`font-mono ${!isValid ? 'border-destructive' : ''}`}
            disabled={disabled}
            maxLength={7}
          />
          {!isValid && (
            <p className="text-xs text-destructive mt-1">
              {t('forms.validation.invalidColor')}
            </p>
          )}
        </div>

        {/* Native color picker */}
        <input
          type="color"
          value={isValidHexColor(localValue) ? localValue : '#083c4c'}
          onChange={(e) => handleInputChange(e.target.value)}
          disabled={disabled}
          className="w-10 h-10 rounded border border-input cursor-pointer disabled:cursor-not-allowed"
          title={t('tooltips.pickColor') || 'Pick color'}
        />
        
        {/* Action buttons */}
        <div className="flex gap-1">
          {showPreview && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={!isValidHexColor(localValue) || disabled || isPreviewActive}
              title={t('tooltips.previewColor') || 'Preview this color'}
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={disabled}
            title={t('tooltips.resetToDefault') || 'Reset to default'}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          {onSave && (
            <Button
              size="sm"
              onClick={onSave}
              disabled={!needsSave || disabled}
            >
              {t('common.save')}
            </Button>
          )}
        </div>
      </div>

      {isPreviewActive && (
        <p className="text-xs text-muted-foreground animate-pulse">
          {t('messages.previewingColor') || 'Previewing color changes for 3 seconds...'}
        </p>
      )}
    </div>
  );
}