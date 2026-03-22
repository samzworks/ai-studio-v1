import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Check, Monitor, Timer as Clock, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface VideoModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  maxDuration: number;
  supportedRatios: string[];
  supportedDurations: number[];
  supportedSizes: string[];
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsLoop?: boolean;
  supportsFrameRate?: boolean;
  fpsFixed?: number;
  framesByDuration?: Record<number, number>;
  supportsAudio?: boolean;
  supportsVideoReference?: boolean;
  modelGroup?: string;
  modelVariant?: "text-to-video" | "image-to-video" | "motion-control";
}

interface ModelFamily {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: VideoModel[];
}

interface VideoModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

function getModelFamilyId(modelId: string): string {
  if (modelId.includes('sora-2')) return 'sora-2';
  if (modelId.includes('wan-')) return 'wan';
  if (modelId.includes('veo3')) return 'veo';
  if (modelId.includes('luma')) return 'luma';
  if (modelId.includes('kling')) return 'kling';
  if (modelId.includes('hailuo')) return 'hailuo';
  if (modelId.includes('seedance')) return 'seedance';
  if (modelId.includes('higgsfield')) return 'higgsfield';
  return 'other';
}

const DEFAULT_VIDEO_FAMILY_ICONS: Record<string, string> = {
  'sora-2': '🎬',
  'wan': '🎥',
  'veo': 'G',
  'luma': '✨',
  'kling': '🎞️',
  'hailuo': '🚀',
  'seedance': '🎭',
  'higgsfield': '⚡',
  'other': '🎯',
};

const VIDEO_FAMILY_METADATA: Record<string, { name: string; description: string }> = {
  'sora-2': { 
    name: 'OpenAI Sora 2', 
    description: 'Multi-shot video with sound generation' 
  },
  'wan': { 
    name: 'Wan', 
    description: 'Camera-controlled video with sound, more freedom' 
  },
  'veo': { 
    name: 'Google Veo', 
    description: 'Precision video with sound control' 
  },
  'luma': { 
    name: 'Luma Dream Machine', 
    description: 'High-quality dream-like video generation' 
  },
  'kling': { 
    name: 'Kling 2.6', 
    description: 'Top-tier video with fluid motion, audio, and motion control' 
  },
  'hailuo': { 
    name: 'Minimax Hailuo', 
    description: 'High-dynamic, VFX-ready, fastest and most affordable' 
  },
  'seedance': { 
    name: 'Seedance', 
    description: 'Cinematic, multi-shot video creation' 
  },
  'higgsfield': { 
    name: 'Higgsfield', 
    description: 'Advanced camera controls and effect presets' 
  },
  'other': { 
    name: 'Other Models', 
    description: 'Additional video generation models' 
  }
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

function getVideoFamilyIcon(familyId: string, getConfig?: (key: string, defaultValue: any) => any): string {
  const defaultIcon = DEFAULT_VIDEO_FAMILY_ICONS[familyId] || '🎯';
  if (!getConfig) return defaultIcon;
  // Map family ID to config key: sora-2 -> video_family_icon_sora, wan -> video_family_icon_wan
  const configKeyMap: Record<string, string> = {
    'sora-2': 'video_family_icon_sora',
    'wan': 'video_family_icon_wan',
    'veo': 'video_family_icon_veo',
    'luma': 'video_family_icon_luma',
    'kling': 'video_family_icon_kling',
    'hailuo': 'video_family_icon_hailuo',
    'seedance': 'video_family_icon_seedance',
    'higgsfield': 'video_family_icon_higgsfield',
    'other': 'video_family_icon_other',
  };
  const configKey = configKeyMap[familyId] || `video_family_icon_${familyId}`;
  return getConfig(configKey, defaultIcon);
}

function getModelFamilyInfo(familyId: string, getConfig?: (key: string, defaultValue: any) => any): { name: string; icon: string; description: string } {
  const metadata = VIDEO_FAMILY_METADATA[familyId] || VIDEO_FAMILY_METADATA['other'];
  const icon = getVideoFamilyIcon(familyId, getConfig);
  return { ...metadata, icon };
}

function getModelDisplayName(model: VideoModel): string {
  const id = model.id;
  
  if (id === 'sora-2-text-to-video') return 'Sora 2';
  if (id === 'sora-2-image-to-video') return 'Sora 2 (I2V)';
  if (id === 'sora-2-pro-text-to-video') return 'Sora 2 Pro';
  if (id === 'sora-2-pro-image-to-video') return 'Sora 2 Pro (I2V)';
  
  if (id === 'wan-2.2-t2v-fast') return 'WAN 2.2 Fast';
  if (id === 'wan-2.2-i2v-fast') return 'WAN 2.2 Fast (I2V)';
  if (id === 'wan-2.5-preview-t2v') return 'WAN 2.5 Preview';
  if (id === 'wan-2.5-preview-i2v') return 'WAN 2.5 Preview (I2V)';
  if (id === 'wan-2.6-t2v') return 'WAN 2.6';
  if (id === 'wan-2.6-i2v') return 'WAN 2.6 (I2V)';
  
  if (id === 'fal-veo3-t2v') return 'VEO 3.1';
  if (id === 'fal-veo3-i2v') return 'VEO 3.1 (I2V)';
  if (id === 'fal-veo3-fast-t2v') return 'VEO 3.1 Fast';
  if (id === 'fal-veo3-fast-i2v') return 'VEO 3.1 Fast (I2V)';
  
  if (id === 'kling-2.6-pro-t2v') return 'Kling 2.6 Pro';
  if (id === 'kling-2.6-pro-i2v') return 'Kling 2.6 Pro (I2V)';
  if (id === 'kling-2.6-pro-motion') return 'Kling 2.6 Pro Motion';
  if (id === 'kling-2.6-standard-motion') return 'Kling 2.6 Standard Motion';
  
  if (id === 'fal-luma-dream-machine') return 'Luma Dream Machine';
  
  return model.name;
}

function getModelSubtitle(model: VideoModel): string {
  const id = model.id;
  
  if (id === 'sora-2-text-to-video') return "OpenAI's most advanced video model";
  if (id === 'sora-2-image-to-video') return "Animate images with text prompts";
  if (id === 'sora-2-pro-text-to-video') return "Enhanced quality video generation";
  if (id === 'sora-2-pro-image-to-video') return "Pro image-to-video with enhanced quality";
  
  if (id.includes('wan-2.2')) return "Fast video generation, 16 FPS";
  if (id.includes('wan-2.5')) return "Next-gen quality and motion coherence";
  if (id.includes('wan-2.6')) return "Multi-shot with audio and prompt expansion";
  
  if (id.includes('veo3-fast')) return "Faster and more cost-effective";
  if (id.includes('veo3')) return "Natural sound generation";
  
  if (id.includes('luma')) return "Dream-like video generation";
  
  if (id === 'kling-2.6-pro-t2v') return "Cinematic text-to-video with audio";
  if (id === 'kling-2.6-pro-i2v') return "Image-to-video with audio generation";
  if (id === 'kling-2.6-pro-motion') return "Premium motion transfer from video";
  if (id === 'kling-2.6-standard-motion') return "Cost-effective motion transfer";
  
  return model.description;
}

function formatDurations(durations: number[]): string {
  if (durations.length === 0) return '';
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  if (min === max) return `${min}s`;
  return `${min}s-${max}s`;
}

function formatSizes(sizes: string[]): string {
  if (sizes.length === 0) return '';
  return sizes.join('-');
}

function hasAudioSupport(model: VideoModel): boolean {
  const id = model.id;
  // Check explicit supportsAudio property first (for Kling models)
  if (model.supportsAudio !== undefined) return model.supportsAudio;
  // Fallback to ID-based detection
  return id.includes('sora') || id.includes('veo') || id.includes('wan');
}

function hasMotionControl(model: VideoModel): boolean {
  return model.supportsVideoReference === true;
}

export default function VideoModelSelector({ value, onValueChange, disabled = false }: VideoModelSelectorProps) {
  const { t } = useTranslation();
  const { getConfig } = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: videoModels = [], isLoading } = useQuery<VideoModel[]>({
    queryKey: ['/api/video-models'],
  });

  const selectedModel = videoModels.find(m => m.id === value);
  const selectedFamilyId = value ? getModelFamilyId(value) : null;
  const selectedFamilyInfo = selectedFamilyId ? getModelFamilyInfo(selectedFamilyId, getConfig) : null;

  const modelFamilies: ModelFamily[] = [];
  const familyOrder = ['sora-2', 'veo', 'wan', 'luma', 'kling', 'hailuo', 'seedance', 'higgsfield', 'other'];
  
  const familyMap: Record<string, VideoModel[]> = {};
  videoModels.forEach(model => {
    const familyId = getModelFamilyId(model.id);
    if (!familyMap[familyId]) {
      familyMap[familyId] = [];
    }
    familyMap[familyId].push(model);
  });

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
        <label className="text-sm font-medium text-gray-300">{t('forms.labels.model')}</label>
        <div className="h-10 bg-gray-800 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
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
        data-testid="video-model-selector-trigger"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModel ? (
            <>
              <ModelIcon icon={selectedFamilyInfo?.icon || '🎯'} size="md" />
              <span className="truncate text-sm">{getModelDisplayName(selectedModel)}</span>
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
          data-testid="video-model-dropdown"
        >
          <div className="max-h-[400px] overflow-y-auto">
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
                                  {model.supportsStartFrame && !hasMotionControl(model) && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">I2V</span>
                                  )}
                                  {hasMotionControl(model) && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">Motion</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                  {getModelSubtitle(model)}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Monitor className="w-3 h-3" />
                                    <span>{formatSizes(model.supportedSizes)}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDurations(model.supportedDurations)}</span>
                                  </div>
                                  {hasAudioSupport(model) && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Volume2 className="w-3 h-3" />
                                      <span>Audio</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
