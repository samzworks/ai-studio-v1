import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ResolutionSelectorProps {
  selectedResolution: string;
  supportedResolutions: string[];
  onResolutionChange: (resolution: string) => void;
  disabled?: boolean;
  variant?: "default" | "glass";
}

// Resolution option definitions
const RESOLUTION_DEFINITIONS: Record<string, { dimensions: string }> = {
  "480p": { 
    dimensions: "854×480" 
  },
  "720p": { 
    dimensions: "1280×720" 
  },
  "540p": { 
    dimensions: "540×960" 
  }
};

export default function ResolutionSelector({ 
  selectedResolution, 
  supportedResolutions, 
  onResolutionChange, 
  disabled = false,
  variant = "default"
}: ResolutionSelectorProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isGlass = variant === "glass";
  
  // Detect RTL based on current language
  const isRTL = i18n.language === 'ar';

  const handleResolutionSelect = (resolution: string) => {
    onResolutionChange(resolution);
    setOpen(false);
  };

  // Show disabled state if no resolutions available
  if (!supportedResolutions || supportedResolutions.length === 0) {
    return (
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t('common.resolution')}</label>
        <Button disabled className={cn("w-full justify-between", isGlass ? "h-12 rounded-[10px] border border-white/20 bg-white/[0.08] text-white/50" : "bg-gray-800 text-gray-500")}>
          {t('forms.noResolutionsAvailable')}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Get current resolution info
  const currentInfo = RESOLUTION_DEFINITIONS[selectedResolution] || {
    dimensions: selectedResolution
  };

  return (
    <div className="space-y-2">
      <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t('common.resolution')}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between h-12 px-4 group",
              isGlass
                ? "rounded-[10px] border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14] hover:border-white/30 focus:ring-[#5fb6ff] focus:border-[#5fb6ff]/70 focus:ring-offset-0"
                : "bg-[hsl(var(--dark-elevated))] border-gray-700 text-white hover:bg-[hsl(var(--dark-surface))] hover:border-gray-600 hover:text-white focus:ring-[hsl(var(--accent-primary))] focus:border-[hsl(var(--accent-primary))]",
              "transition-all duration-200"
            )}
          >
            <div className={cn(
              "flex items-center",
              isRTL ? "flex-row-reverse space-x-reverse space-x-3" : "space-x-3"
            )}>
              <Monitor className={cn("w-4 h-4 group-hover:text-white", isGlass ? "text-white/70" : "text-gray-400")} />
              <span className="font-medium group-hover:text-white">{selectedResolution}</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn(
            "w-56 p-2",
            isGlass
              ? "rounded-[10px] border-white/20 bg-[linear-gradient(170deg,rgba(82,130,185,0.32)_0%,rgba(35,57,90,0.88)_45%,rgba(17,29,50,0.94)_100%)] backdrop-blur-xl"
              : "bg-[hsl(var(--dark-elevated))] border-gray-700",
            "shadow-xl shadow-black/20"
          )}
          align="start"
        >
          <div className="space-y-1">
            {supportedResolutions.map((resolution) => {
              const info = RESOLUTION_DEFINITIONS[resolution] || {
                dimensions: resolution
              };
              
              return (
                <Button
                  key={resolution}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolutionSelect(resolution)}
                  className={cn(
                    "w-full px-3 py-2 h-auto font-normal",
                    isGlass ? "rounded-[10px] text-white/90 hover:bg-white/[0.14] hover:text-white" : "hover:bg-[hsl(var(--dark-surface))] hover:text-white",
                    selectedResolution === resolution && (isGlass ? "bg-white/[0.18] text-white" : "bg-[hsl(var(--accent-primary))] text-white"),
                    isRTL ? "justify-start" : "justify-between"
                  )}
                >
                  <div className={cn(
                    "flex w-full",
                    isRTL ? "flex-row-reverse justify-between" : "justify-between"
                  )}>
                    <span className="font-medium">{resolution}</span>
                    <span className={cn("text-xs", isGlass ? "text-white/60" : "text-gray-400")}>{info.dimensions}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
