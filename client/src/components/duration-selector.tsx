import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, Timer as Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DurationSelectorProps {
  selectedDuration: number;
  supportedDurations: number[];
  onDurationChange: (duration: number) => void;
  disabled?: boolean;
  variant?: "default" | "glass";
}

export default function DurationSelector({ 
  selectedDuration, 
  supportedDurations, 
  onDurationChange, 
  disabled = false,
  variant = "default"
}: DurationSelectorProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isGlass = variant === "glass";
  
  // Detect RTL based on current language
  const isRTL = i18n.language === 'ar';

  const handleDurationSelect = (duration: number) => {
    onDurationChange(duration);
    setOpen(false);
  };

  if (!supportedDurations || supportedDurations.length === 0) {
    return (
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t('common.duration')}</label>
        <Button disabled className={cn("w-full justify-between", isGlass ? "h-12 rounded-[10px] border border-white/20 bg-white/[0.08] text-white/50" : "bg-gray-800 text-gray-500")}>
          {t('forms.noDurationsAvailable')}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t('common.duration')}</label>
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
              <Clock className={cn("w-4 h-4 group-hover:text-white", isGlass ? "text-white/70" : "text-gray-400")} />
              <div className={cn(
                "flex flex-col",
                isRTL ? "items-end" : "items-start"
              )}>
                <span className="font-medium group-hover:text-white">{selectedDuration}s</span>
                <span className={cn("text-xs group-hover:text-gray-300", isGlass ? "text-white/60" : "text-gray-400")}>{t('common.duration')}</span>
              </div>
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn(
            "w-48 p-2 shadow-xl border",
            isGlass
              ? "rounded-[10px] border-white/20 bg-[linear-gradient(170deg,rgba(82,130,185,0.32)_0%,rgba(35,57,90,0.88)_45%,rgba(17,29,50,0.94)_100%)] backdrop-blur-xl"
              : "rounded-lg bg-[hsl(var(--dark-elevated))] border-gray-700"
          )}
          align="start"
        >
          <div className="space-y-1">
            {supportedDurations.map((duration) => (
              <Button
                key={duration}
                variant="ghost"
                onClick={() => handleDurationSelect(duration)}
                className={cn(
                  "w-full h-10 px-3 transition-all duration-200",
                  isGlass ? "rounded-[10px] text-white/90 hover:bg-white/[0.14] hover:text-white" : "hover:bg-[hsl(var(--dark-surface))] hover:text-white",
                  selectedDuration === duration
                    ? (isGlass ? "bg-white/[0.18] text-white border border-white/20" : "bg-[hsl(var(--accent-primary))]/10 text-[#21B0F8] border border-[hsl(var(--accent-primary))]/30")
                    : (isGlass ? "border border-transparent" : "text-gray-300 border border-transparent"),
                  isRTL ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex items-center",
                  isRTL ? "flex-row-reverse space-x-reverse space-x-2" : "space-x-2"
                )}>
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{duration}s</span>
                </div>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
