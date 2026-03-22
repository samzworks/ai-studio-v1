import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Check, ImagePlus as Image, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export interface ModelConfig {
  id: string;
  name: string;
  displayName?: string;
  provider: "openai" | "replicate" | "fal";
  category: "general" | "artistic" | "photorealistic" | "fast";
  description: string;
  maxWidth: number;
  maxHeight: number;
  supportedRatios: string[];
  supportsStyleUpload?: boolean;
}

interface ModelFamily {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: ModelConfig[];
}

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  onModelConfigChange?: (config: ModelConfig | null) => void;
  disabled?: boolean;
}

function getModelFamilyId(modelId: string): string | null {
  if (modelId.includes('gpt-image-1.5')) return 'gpt-image';
  if (modelId.includes('flux')) return 'flux';
  if (modelId.includes('imagen')) return 'imagen';
  // Saudi models need to be checked before nano-banana
  if (modelId.includes('saudi-model-pro')) return 'saudi-model-pro';
  if (modelId.includes('saudi-model')) return 'saudi-model';
  if (modelId.includes('nano-banana')) return 'nano-banana';
  if (modelId.includes('seedream')) return 'seedream';
  return null; // Standalone model
}

const DEFAULT_IMAGE_FAMILY_ICONS: Record<string, string> = {
  'gpt-image': '🎨',
  'flux': '⚡',
  'imagen': 'G',
  'nano-banana': '🍌',
  'seedream': '💫',
  'saudi-model': '🇸🇦',
  'saudi-model-pro': '🏆',
  'other': '🖼️',
};

const IMAGE_FAMILY_METADATA: Record<string, { name: string; description: string }> = {
  'gpt-image': { 
    name: 'GPT Image 1.5', 
    description: 'OpenAI advanced image generation & editing' 
  },
  'flux': { 
    name: 'FLUX', 
    description: 'High-quality image generation models' 
  },
  'imagen': { 
    name: 'Imagen 4', 
    description: "Google's state-of-the-art image generation" 
  },
  'nano-banana': { 
    name: 'Nano Banana', 
    description: 'Ultra-fast generation up to 4K resolution' 
  },
  'seedream': { 
    name: 'SeeDream 4.5', 
    description: 'ByteDance enhanced quality with text rendering' 
  },
  'saudi-model': { 
    name: 'Tkoeen Saudi Style', 
    description: 'Saudi-inspired artistic image generation' 
  },
  'saudi-model-pro': { 
    name: 'Tkoeen Saudi Style Pro', 
    description: 'Enhanced Saudi-inspired generation with premium quality' 
  },
  'other': { 
    name: 'Other', 
    description: 'Additional image models' 
  },
};

function ModelIcon({ icon, size = 'md' }: { icon: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  };
  
  const isImageUrl = icon && (icon.startsWith('http') || icon.startsWith('/'));
  
  if (isImageUrl) {
    return (
      <img 
        src={icon} 
        alt="" 
        className={`${sizeClasses[size]} object-cover rounded`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  
  return <span className={textSizes[size]}>{icon}</span>;
}

function getImageFamilyIcon(familyId: string, getConfig?: (key: string, defaultValue: any) => any): string {
  const defaultIcon = DEFAULT_IMAGE_FAMILY_ICONS[familyId] || '🖼️';
  if (!getConfig) return defaultIcon;
  // Map family ID to config key: gpt-image -> image_family_icon_gpt_image
  const configKeyMap: Record<string, string> = {
    'gpt-image': 'image_family_icon_gpt_image',
    'flux': 'image_family_icon_flux',
    'imagen': 'image_family_icon_imagen',
    'nano-banana': 'image_family_icon_nano_banana',
    'seedream': 'image_family_icon_seedream',
    'saudi-model': 'image_family_icon_alfia_saudi_style',
    'saudi-model-pro': 'image_family_icon_alfia_saudi_style_pro',
    'other': 'image_family_icon_other',
  };
  const configKey = configKeyMap[familyId] || `image_family_icon_${familyId.replace('-', '_')}`;
  return getConfig(configKey, defaultIcon);
}

function getModelFamilyInfo(familyId: string, getConfig?: (key: string, defaultValue: any) => any): { name: string; icon: string; description: string } {
  const metadata = IMAGE_FAMILY_METADATA[familyId] || { name: familyId, description: '' };
  const icon = getImageFamilyIcon(familyId, getConfig);
  return { ...metadata, icon };
}

function getModelDisplayName(model: ModelConfig): string {
  const id = model.id;
  
  // GPT Image 1.5 variants
  if (id === 'fal-gpt-image-1.5-txt2img-low') return 'Text-to-Image (Low)';
  if (id === 'fal-gpt-image-1.5-txt2img-high') return 'Text-to-Image (High)';
  if (id === 'fal-gpt-image-1.5-edit-low') return 'Edit (Low)';
  if (id === 'fal-gpt-image-1.5-edit-high') return 'Edit (High)';
  
  // FLUX variants
  if (id === 'fal-flux-schnell') return 'Schnell (Fast)';
  if (id === 'fal-flux-dev') return 'Dev';
  if (id === 'fal-flux-pro') return 'Pro';
  
  // Imagen 4 variants
  if (id === 'fal-imagen-4-fast') return 'Fast';
  if (id === 'fal-imagen-4') return 'Ultra';
  
  // Nano Banana variants
  if (id === 'fal-nano-banana-txt2img') return 'Pro';
  if (id === 'fal-nano-banana-edit') return 'Pro Edit';
  if (id === 'fal-nano-banana-img2img') return 'Image-to-Image';
  if (id === 'fal-nano-banana-pro-txt2img') return 'Pro 4K';
  if (id === 'fal-nano-banana-pro-edit') return 'Pro 4K Edit';
  
  // SeeDream variants
  if (id === 'fal-seedream-4.5-txt2img') return 'Text-to-Image';
  if (id === 'fal-seedream-4.5-img2img') return 'Image-to-Image';
  
  return model.displayName || model.name;
}

function getModelSubtitle(model: ModelConfig): string {
  const id = model.id;
  
  // GPT Image 1.5
  if (id.includes('gpt-image-1.5-txt2img-low')) return 'Fast generation, good quality';
  if (id.includes('gpt-image-1.5-txt2img-high')) return 'Detailed, high-quality images';
  if (id.includes('gpt-image-1.5-edit-low')) return 'Quick image edits';
  if (id.includes('gpt-image-1.5-edit-high')) return 'Precise, detailed edits';
  
  // FLUX
  if (id.includes('flux-schnell')) return 'Ultra-fast generation';
  if (id.includes('flux-dev')) return 'Detailed image generation';
  if (id.includes('flux-pro')) return 'Professional-grade quality';
  
  // Imagen 4
  if (id.includes('imagen-4-fast')) return 'Quick, high-quality generation';
  if (id === 'fal-imagen-4') return 'Premium image generation';
  
  // Nano Banana
  if (id.includes('nano-banana-pro-txt2img')) return 'Up to 4K resolution';
  if (id.includes('nano-banana-pro-edit')) return '4K resolution editing';
  if (id.includes('nano-banana-txt2img')) return 'Fast text-to-image';
  if (id.includes('nano-banana-edit')) return 'Fast image editing';
  if (id.includes('nano-banana-img2img')) return 'Image transformation';
  
  // SeeDream
  if (id.includes('seedream')) return 'Enhanced text rendering';
  
  return model.description;
}

function hasStyleSupport(model: ModelConfig): boolean {
  return model.supportsStyleUpload === true;
}

export default function ModelSelector({ value, onValueChange, onModelConfigChange, disabled = false }: ModelSelectorProps) {
  const { t } = useTranslation();
  const { getConfig } = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: models = [], isLoading } = useQuery<ModelConfig[]>({
    queryKey: ['/api/models'],
  });

  const selectedModel = models.find(m => m.id === value) || null;
  const selectedFamilyId = value ? getModelFamilyId(value) : null;
  const selectedFamilyInfo = selectedFamilyId ? getModelFamilyInfo(selectedFamilyId, getConfig) : null;

  useEffect(() => {
    onModelConfigChange?.(selectedModel);
  }, [selectedModel, onModelConfigChange]);

  // Separate models into families and standalone
  const familyOrder = ['gpt-image', 'flux', 'imagen', 'saudi-model', 'saudi-model-pro', 'nano-banana', 'seedream'];
  const familyMap: Record<string, ModelConfig[]> = {};
  const standaloneModels: ModelConfig[] = [];

  models.forEach(model => {
    const familyId = getModelFamilyId(model.id);
    if (familyId) {
      if (!familyMap[familyId]) {
        familyMap[familyId] = [];
      }
      familyMap[familyId].push(model);
    } else {
      standaloneModels.push(model);
    }
  });

  const modelFamilies: ModelFamily[] = [];
  familyOrder.forEach(familyId => {
    if (familyMap[familyId] && familyMap[familyId].length > 0) {
      const info = getModelFamilyInfo(familyId, getConfig);
      modelFamilies.push({
        id: familyId,
        name: info.name,
        icon: info.icon,
        description: info.description,
        models: familyMap[familyId]
      });
    }
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedFamilyId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFamilyClick = (familyId: string) => {
    setExpandedFamilyId(expandedFamilyId === familyId ? null : familyId);
  };

  const handleModelSelect = (modelId: string) => {
    onValueChange(modelId);
    setIsOpen(false);
    setExpandedFamilyId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">{t('forms.labels.aiModel')}</label>
        <div className="h-10 bg-gray-800 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{t('forms.labels.aiModel')}</label>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-md border transition-colors",
            "bg-[hsl(var(--dark-elevated))] border-gray-700 text-white",
            "hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-primary))] focus:ring-offset-1 focus:ring-offset-[hsl(var(--dark-bg))]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-testid="model-selector-trigger"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedModel ? (
              <>
                <ModelIcon icon={selectedFamilyInfo?.icon || getImageFamilyIcon('other', getConfig)} size="md" />
                <span className="truncate text-sm">
                  {selectedFamilyInfo ? `${selectedFamilyInfo.name} - ${getModelDisplayName(selectedModel)}` : (selectedModel.displayName || selectedModel.name)}
                </span>
              </>
            ) : (
              <span className="text-gray-400 text-sm">{t("forms.placeholder.selectModel")}</span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div 
            className="absolute z-50 left-0 mt-1 w-full bg-[hsl(var(--dark-elevated))] border border-gray-700 rounded-lg shadow-xl overflow-hidden"
            data-testid="model-dropdown"
          >
            <div className="max-h-[400px] overflow-y-auto">
              {/* Model Families with expandable submenus */}
              {modelFamilies.map((family) => {
                const isExpanded = expandedFamilyId === family.id;
                const familyHasSelectedModel = family.models.some(m => m.id === value);
                
                return (
                  <div key={family.id}>
                    <div
                      onClick={() => handleFamilyClick(family.id)}
                      className={cn(
                        "flex items-center justify-between px-3 py-3 cursor-pointer transition-colors",
                        "hover:bg-gray-800/50",
                        familyHasSelectedModel && "bg-gray-800/30"
                      )}
                      data-testid={`model-family-${family.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><ModelIcon icon={family.icon} size="lg" /></div>
                        <div className="min-w-0">
                          <div className="font-medium text-white text-sm">{family.name}</div>
                          <div className="text-xs text-gray-400 truncate">{family.description}</div>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 text-gray-400 transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                    </div>

                    {isExpanded && (
                      <div className="bg-gray-900/50 border-t border-gray-700/50">
                        {family.models.map((model) => {
                          const isSelected = value === model.id;
                          return (
                            <div
                              key={model.id}
                              onClick={() => handleModelSelect(model.id)}
                              className={cn(
                                "px-4 py-3 pl-14 cursor-pointer transition-colors",
                                "hover:bg-gray-800/50",
                                isSelected && "bg-[hsl(var(--accent-primary))]/10"
                              )}
                              data-testid={`model-option-${model.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white text-sm">
                                      {getModelDisplayName(model)}
                                    </span>
                                    {hasStyleSupport(model) && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">Style</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                    {getModelSubtitle(model)}
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Image className="w-3 h-3" />
                                      <span>{model.maxWidth}x{model.maxHeight}</span>
                                    </div>
                                    {model.category === 'fast' && (
                                      <div className="flex items-center gap-1 text-xs text-orange-400">
                                        <Zap className="w-3 h-3" />
                                        <span>Fast</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-[#21B0F8] flex-shrink-0 mt-1" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone models (not in a family) */}
              {standaloneModels.length > 0 && modelFamilies.length > 0 && (
                <div className="border-t border-gray-700/50" />
              )}
              {standaloneModels.map((model) => {
                const isSelected = value === model.id;
                const otherIcon = getImageFamilyIcon('other', getConfig);
                return (
                  <div
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-3 cursor-pointer transition-colors",
                      "hover:bg-gray-800/50",
                      isSelected && "bg-[hsl(var(--accent-primary))]/10"
                    )}
                    data-testid={`model-option-${model.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center"><ModelIcon icon={otherIcon} size="lg" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{model.displayName || model.name}</span>
                          {hasStyleSupport(model) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">Style</span>
                          )}
                          {model.category === 'fast' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">Fast</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{model.description}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#21B0F8] flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
