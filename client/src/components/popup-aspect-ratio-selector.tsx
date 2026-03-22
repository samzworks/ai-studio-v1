import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface AspectRatioOption {
  ratio: string;
  label: string;
  icon: string;
  description: string;
}

// Visual aspect ratio icon component
const AspectRatioIcon = ({ ratio }: { ratio: string }) => {
  const getIconDimensions = (ratio: string) => {
    switch (ratio) {
      case "1:1":
        return { width: 16, height: 16 };
      case "16:9":
        return { width: 20, height: 11 };
      case "9:16":
        return { width: 11, height: 20 };
      case "3:2":
        return { width: 18, height: 12 };
      case "2:3":
        return { width: 12, height: 18 };
      case "4:5":
        return { width: 13, height: 16 };
      default:
        return { width: 16, height: 16 };
    }
  };

  const { width, height } = getIconDimensions(ratio);
  
  return (
    <div className="flex items-center justify-center w-6 h-6">
      <div 
        className="border-2 border-current rounded-sm"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
};

// Limited to 6 most popular aspect ratios
const POPULAR_ASPECT_RATIOS: AspectRatioOption[] = [
  { ratio: "1:1", label: "Square", icon: "", description: "Social media" },
  { ratio: "16:9", label: "Landscape", icon: "", description: "Widescreen" },
  { ratio: "9:16", label: "Portrait", icon: "", description: "Mobile stories" },
  { ratio: "3:2", label: "Classic", icon: "", description: "Standard photo" },
  { ratio: "2:3", label: "Classic Portrait", icon: "", description: "Portrait photo" },
  { ratio: "4:5", label: "Social Portrait", icon: "", description: "Instagram" },
];

interface PopupAspectRatioSelectorProps {
  selectedRatio: string;
  supportedRatios: string[];
  onRatioChange: (ratio: string) => void;
  disabled?: boolean;
  variant?: "default" | "glass";
}

export default function PopupAspectRatioSelector({ 
  selectedRatio, 
  supportedRatios, 
  onRatioChange, 
  disabled = false,
  variant = "default"
}: PopupAspectRatioSelectorProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isGlass = variant === "glass";
  
  // Detect RTL based on current language
  const isRTL = i18n.language === 'ar';
  
  // Get translated label for aspect ratio
  const getTranslatedLabel = (label: string): string => {
    const labelMap: Record<string, string> = {
      "Square": t('aspectRatios.square'),
      "Landscape": t('aspectRatios.landscape'),
      "Portrait": t('aspectRatios.portrait'),
      "Ultra Wide": t('aspectRatios.ultraWide'),
      "Ultra Tall": t('aspectRatios.ultraTall'),
      "Classic": t('aspectRatios.classic'),
      "Classic Portrait": t('aspectRatios.classicPortrait'),
      "Social": t('aspectRatios.social'),
      "Social Wide": t('aspectRatios.socialWide'),
      "Standard Portrait": t('aspectRatios.standardPortrait'),
      "Standard": t('aspectRatios.standard'),
    };
    return labelMap[label] || label;
  };

  // Filter to only show supported ratios from our curated list
  const availableOptions = POPULAR_ASPECT_RATIOS.filter(option =>
    supportedRatios && Array.isArray(supportedRatios) && supportedRatios.includes(option.ratio)
  );

  const selectedOption = availableOptions.find(option => option.ratio === selectedRatio);

  const handleRatioSelect = (ratio: string) => {
    onRatioChange(ratio);
    setOpen(false);
  };

  if (availableOptions.length === 0) {
    return (
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t("forms.aspectRatio")}</label>
        <Button
          disabled
          className={cn(
            "w-full justify-between",
            isGlass ? "h-12 rounded-[10px] border border-white/20 bg-white/[0.08] text-white/50" : "bg-gray-800 text-gray-500"
          )}
        >
          {t("forms.noRatiosAvailable")}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className={cn("text-sm font-medium text-gray-300", isGlass && "text-white/85")}>{t("forms.aspectRatio")}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between px-4 group",
              isGlass
                ? "h-12 rounded-[10px] border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14] hover:border-white/30 focus:ring-[#5fb6ff] focus:border-[#5fb6ff]/70"
                : "h-12 bg-[hsl(var(--dark-elevated))] border-gray-700 text-white hover:bg-[hsl(var(--dark-surface))] hover:border-gray-600 hover:text-white focus:ring-[hsl(var(--accent-primary))] focus:border-[hsl(var(--accent-primary))]",
              "transition-all duration-200"
            )}
          >
            {selectedOption ? (
              <span className="font-medium group-hover:text-white">{selectedOption.ratio}</span>
            ) : (
              <span className="text-gray-400 group-hover:text-gray-300">{t("forms.selectAspectRatio")}</span>
            )}
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn(
            "w-72 p-2",
            isGlass
              ? "rounded-[10px] border-white/20 bg-[linear-gradient(170deg,rgba(82,130,185,0.32)_0%,rgba(35,57,90,0.88)_45%,rgba(17,29,50,0.94)_100%)] backdrop-blur-xl"
              : "rounded-lg bg-[hsl(var(--dark-elevated))] border-gray-700",
            "shadow-xl border"
          )}
          align="start"
        >
          <div className="grid grid-cols-3 gap-1">
            {availableOptions.map((option) => (
              <Button
                key={option.ratio}
                variant="ghost"
                onClick={() => handleRatioSelect(option.ratio)}
                className={cn(
                  "h-auto p-2 flex items-center justify-center transition-all duration-200",
                  "border border-transparent text-xs rounded-[10px]",
                  isGlass ? "hover:bg-white/[0.14] hover:border-white/30" : "hover:bg-[hsl(var(--dark-surface))] hover:border-gray-600",
                  selectedRatio === option.ratio
                    ? (isGlass ? "bg-white/[0.18] text-white border-white/25" : "border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/10 text-[#21B0F8]")
                    : (isGlass ? "text-white/85" : "text-gray-300")
                )}
              >
                {/* Just the ratio number */}
                <span 
                  className={cn(
                    "font-medium text-sm transition-all duration-200",
                    selectedRatio === option.ratio 
                      ? (isGlass ? "text-white" : "text-[#21B0F8]")
                      : (isGlass ? "text-white/90" : "text-white")
                  )}
                >
                  {option.ratio}
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
