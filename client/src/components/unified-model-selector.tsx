import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, ImagePlus as Image, Zap, Clapperboard as Video, Volume2, WandSparkles as Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import type { BaseModel, VideoMode, MediaType } from "@shared/model-routing";

interface UnifiedModelSelectorProps {
  value: string;
  onValueChange: (baseModelId: string) => void;
  onModeChange?: (mode: VideoMode) => void;
  mode?: VideoMode;
  mediaType: MediaType;
  disabled?: boolean;
  hasImageInput?: boolean;
  errorMessage?: string | null;
  warningMessage?: string | null;
  variant?: "default" | "glass";
}

const DEFAULT_ICONS: Record<string, string> = {
  'nano-banana': '🍌',
  'nano-banana-pro': '🍌✨',
  'flux-schnell': '⚡',
  'flux-dev': '⚡',
  'flux-pro': '⚡',
  'z-image-turbo': '🚀',
  'imagen-4': 'G',
  'gpt-image-1.5': '🎨',
  'seedream-4.5': '💫',
  'saudi-model': '🇸🇦',
  'saudi-model-pro': '🏆',
  'sora-2': '🎬',
  'veo-3.1': 'G',
  'kling-2.6': '🎞️',
  'kling-2.6-motion': '🕺',
  'wan-2.6': '🎥',
  'wan-2.5': '🎥',
  'wan-2.2-fast': '🎥',
  'luma-dream-machine': '✨',
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

function getModelIcon(modelId: string): string {
  return DEFAULT_ICONS[modelId] || '🖼️';
}

function ModelTags({ model, compact = false }: { model: BaseModel; compact?: boolean }) {
  const tags: { label: string; color: string; icon?: typeof Zap }[] = [];

  if (model.category === 'fast') {
    tags.push({ label: 'Fast', color: 'bg-orange-500/20 text-orange-300', icon: Zap });
  }

  if (model.supportsImageInput) {
    tags.push({ label: 'Img', color: 'bg-purple-500/20 text-purple-300', icon: Image });
  }

  if (model.supportsAudio) {
    tags.push({ label: 'Audio', color: 'bg-blue-500/20 text-blue-300', icon: Volume2 });
  }

  if (model.supportsModes && model.availableModes && model.availableModes.length > 1) {
    tags.push({ label: 'Fast/Pro', color: 'bg-green-500/20 text-green-300', icon: Sparkles });
  }

  if (model.tags?.includes('4K')) {
    tags.push({ label: '4K', color: 'bg-[#1F56F5]/20 text-[#21B0F8]' });
  }

  if (model.tags?.includes('Multi-shot')) {
    tags.push({ label: 'Multi-shot', color: 'bg-indigo-500/20 text-indigo-300', icon: Layers });
  }

  if (compact && tags.length > 2) {
    const displayTags = tags.slice(0, 2);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {displayTags.map((tag, i) => (
          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${tag.color}`}>
            {tag.icon && <tag.icon className="w-2.5 h-2.5" />}
            {tag.label}
          </span>
        ))}
        {tags.length > 2 && (
          <span className="text-[10px] px-1 text-gray-400">+{tags.length - 2}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag, i) => (
        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${tag.color}`}>
          {tag.icon && <tag.icon className="w-2.5 h-2.5" />}
          {tag.label}
        </span>
      ))}
    </div>
  );
}

function ModeSelector({
  modes,
  selectedMode,
  onModeChange,
  disabled = false
}: {
  modes: VideoMode[];
  selectedMode: VideoMode;
  onModeChange: (mode: VideoMode) => void;
  disabled?: boolean;
}) {
  if (modes.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onModeChange(mode);
          }}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-colors",
            selectedMode === mode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-testid={`mode-${mode}`}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

export default function UnifiedModelSelector({
  value,
  onValueChange,
  onModeChange,
  mode = "pro",
  mediaType,
  disabled = false,
  hasImageInput = false,
  errorMessage = null,
  warningMessage = null,
  variant = "default",
}: UnifiedModelSelectorProps) {
  const { t } = useTranslation();
  const { getConfig } = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isGlass = variant === "glass";

  // Fetch models from API to respect admin visibility settings
  const { data: imageModels = [] } = useQuery<BaseModel[]>({
    queryKey: ['/api/base-models/image'],
    enabled: mediaType === "image",
    staleTime: 30000,
  });

  const { data: videoModels = [] } = useQuery<BaseModel[]>({
    queryKey: ['/api/base-models/video'],
    enabled: mediaType === "video",
    staleTime: 30000,
  });

  const baseModels = useMemo(() => {
    return mediaType === "image" ? imageModels : videoModels;
  }, [mediaType, imageModels, videoModels]);

  const selectedModel = useMemo(() => {
    return baseModels.find(m => m.id === value) || null;
  }, [baseModels, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelSelect = (modelId: string) => {
    const model = baseModels.find(m => m.id === modelId);
    onValueChange(modelId);

    if (model?.supportsModes && model.defaultMode && onModeChange) {
      onModeChange(model.defaultMode);
    }

    setIsOpen(false);
  };

  const getCompatibilityNote = (model: BaseModel): string | null => {
    if (hasImageInput && !model.supportsImageInput) {
      return "Text-only mode will be used";
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>
          {mediaType === "image" ? t('forms.labels.aiModel') : t('forms.labels.videoModel')}
        </label>

        {selectedModel?.supportsModes && selectedModel.availableModes && onModeChange && (
          <ModeSelector
            modes={selectedModel.availableModes}
            selectedMode={mode}
            onModeChange={onModeChange}
            disabled={disabled}
          />
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between transition-colors",
            isGlass
              ? "px-4 py-3 rounded-[10px] border border-white/20 bg-white/[0.07] text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.13] hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-[#5fb6ff] focus:ring-offset-0"
              : "px-3 py-2.5 rounded-md border bg-secondary/50 border-input text-foreground hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-testid="unified-model-selector-trigger"
        >
          <div className="flex items-center gap-3 min-w-0">
            {selectedModel ? (
              <>
                <ModelIcon icon={getModelIcon(selectedModel.id)} size="md" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate text-sm font-medium">
                    {selectedModel.displayName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ModelTags model={selectedModel} compact />
                  </div>
                </div>
              </>
            ) : (
              <span className="text-gray-400 text-sm">{t("forms.placeholder.selectModel")}</span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div
            className={cn(
              "absolute z-50 left-0 mt-1 w-full shadow-xl overflow-hidden",
              isGlass
                ? "rounded-[10px] border border-[#3b597d] bg-[linear-gradient(170deg,#355f8f_0%,#243a5b_45%,#142238_100%)]"
                : "rounded-lg bg-popover border border-border"
            )}
            data-testid="unified-model-dropdown"
          >
            <div className="max-h-[400px] overflow-y-auto">
              {baseModels.map((model) => {
                const isSelected = value === model.id;
                const compatNote = getCompatibilityNote(model);

                return (
                  <div
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-3 cursor-pointer transition-colors",
                      isGlass
                        ? "hover:bg-white/10 hover:text-white"
                        : "hover:bg-accent hover:text-accent-foreground",
                      isSelected && (isGlass ? "bg-[#5fb6ff]/20" : "bg-primary/10")
                    )}
                    data-testid={`base-model-option-${model.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 flex justify-center flex-shrink-0">
                        <ModelIcon icon={getModelIcon(model.id)} size="lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm">{model.displayName}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {model.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <ModelTags model={model} />
                        </div>
                        {compatNote && (
                          <div className="text-[10px] text-amber-400 mt-1">
                            {compatNote}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {model.mediaType === "image" && model.maxWidth && model.maxHeight && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Image className="w-3 h-3" />
                              <span>{model.maxWidth}x{model.maxHeight}</span>
                            </div>
                          )}
                          {model.mediaType === "video" && (
                            <>
                              {model.maxDuration && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Video className="w-3 h-3" />
                                  <span>{model.maxDuration}s max</span>
                                </div>
                              )}
                              {model.supportedSizes && model.supportedSizes.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  {model.supportedSizes.join('/')}
                                </div>
                              )}
                            </>
                          )}
                        </div>
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

      {errorMessage && (
        <div
          className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm"
          data-testid="model-error-message"
        >
          <span className="text-red-500">⚠</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {!errorMessage && warningMessage && (
        <div
          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400 text-xs"
          data-testid="model-warning-message"
        >
          <span>ℹ️</span>
          <span>{warningMessage}</span>
        </div>
      )}
    </div>
  );
}

export { ModeSelector };
export type { UnifiedModelSelectorProps };

