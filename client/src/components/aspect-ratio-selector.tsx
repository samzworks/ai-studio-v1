import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AspectRatioOption {
  ratio: string;
  label: string;
  icon: string;
  description: string;
}

// Define aspect ratio options with visual icons and labels
const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { ratio: "1:1", label: "Square", icon: "⬜", description: "Equal width and height" },
  { ratio: "16:9", label: "Landscape", icon: "▭", description: "Widescreen format" },
  { ratio: "9:16", label: "Portrait", icon: "▯", description: "Tall format" },
  { ratio: "21:9", label: "Ultra Wide", icon: "▬", description: "Cinema format" },
  { ratio: "9:21", label: "Ultra Tall", icon: "▮", description: "Vertical cinema" },
  { ratio: "3:2", label: "Classic", icon: "▭", description: "Standard photo" },
  { ratio: "2:3", label: "Classic Portrait", icon: "▯", description: "Tall photo" },
  { ratio: "4:5", label: "Social", icon: "▯", description: "Instagram portrait" },
  { ratio: "5:4", label: "Social Wide", icon: "▭", description: "Instagram landscape" },
  { ratio: "3:4", label: "Standard Portrait", icon: "▯", description: "Traditional tall" },
  { ratio: "4:3", label: "Standard", icon: "▭", description: "Traditional wide" },
];

interface AspectRatioSelectorProps {
  selectedRatio: string;
  supportedRatios: string[];
  onRatioChange: (ratio: string) => void;
  disabled?: boolean;
}

export default function AspectRatioSelector({ 
  selectedRatio, 
  supportedRatios, 
  onRatioChange, 
  disabled = false 
}: AspectRatioSelectorProps) {
  const { t } = useTranslation();
  
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
  
  // Get translated description for aspect ratio
  const getTranslatedDescription = (description: string): string => {
    const descMap: Record<string, string> = {
      "Equal width and height": t('aspectRatios.equalWidthHeight'),
      "Widescreen format": t('aspectRatios.widescreenFormat'),
      "Tall format": t('aspectRatios.tallFormat'),
      "Cinema format": t('aspectRatios.cinemaFormat'),
      "Vertical cinema": t('aspectRatios.verticalCinema'),
      "Standard photo": t('aspectRatios.standardPhoto'),
      "Tall photo": t('aspectRatios.tallPhoto'),
      "Instagram portrait": t('aspectRatios.instagramPortrait'),
      "Instagram landscape": t('aspectRatios.instagramLandscape'),
      "Traditional tall": t('aspectRatios.traditionalTall'),
      "Traditional wide": t('aspectRatios.traditionalWide'),
    };
    return descMap[description] || description;
  };
  // Filter options to only show supported ratios
  const availableOptions = ASPECT_RATIO_OPTIONS.filter(option =>
    supportedRatios && Array.isArray(supportedRatios) && supportedRatios.includes(option.ratio)
  );

  if (availableOptions.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">{t('common.aspectRatio')}</label>
        <div className="text-sm text-gray-500">{t('aspectRatios.noAspectRatios')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-300">{t('common.aspectRatio')}</label>
      <div className="grid grid-cols-2 gap-2">
        {availableOptions.map((option) => (
          <Button
            key={option.ratio}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onRatioChange(option.ratio)}
            className={cn(
              "h-auto p-3 flex flex-col items-center space-y-1 transition-all duration-200",
              "bg-[hsl(var(--dark-elevated))] border border-gray-700 text-white hover:bg-[hsl(var(--dark-surface))]",
              "touch-friendly mobile-hover text-xs",
              selectedRatio === option.ratio
                ? "border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/10 text-[#21B0F8]"
                : "hover:border-gray-600"
            )}
          >
            {/* Visual icon */}
            <span className="text-lg" role="img" aria-label={option.label}>
              {option.icon}
            </span>
            {/* Ratio label */}
            <span className="font-medium">{option.ratio}</span>
            {/* Descriptive label */}
            <span className="text-gray-400 text-xs leading-tight text-center">
              {getTranslatedLabel(option.label)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}