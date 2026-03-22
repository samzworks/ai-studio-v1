import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SizeOption {
  size: "regular" | "large";
  label: string;
  multiplier: number;
  description: string;
}

// Simplified to just Regular and Large as requested
const SIZE_OPTIONS: SizeOption[] = [
  { size: "regular", label: "Regular", multiplier: 1.0, description: "Standard quality" },
  { size: "large", label: "Large", multiplier: 1.25, description: "Maximum quality" },
];

interface ImageSizeSelectorProps {
  selectedSize: "regular" | "large";
  aspectRatio: string;
  maxWidth: number;
  maxHeight: number;
  onSizeChange: (size: "regular" | "large", width: number, height: number) => void;
  disabled?: boolean;
}

// Function to calculate dimensions based on aspect ratio and size
function calculateDimensions(
  aspectRatio: string, 
  sizeMultiplier: number, 
  maxWidth: number, 
  maxHeight: number
): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  
  // Calculate base dimensions (medium size)
  let baseWidth: number, baseHeight: number;
  
  if (widthRatio === heightRatio) {
    // Square - use smaller of max dimensions
    const size = Math.min(maxWidth, maxHeight);
    baseWidth = baseHeight = size;
  } else if (widthRatio > heightRatio) {
    // Landscape - width-constrained
    baseWidth = maxWidth;
    baseHeight = Math.round((maxWidth * heightRatio) / widthRatio);
    
    // If height exceeds max, scale down
    if (baseHeight > maxHeight) {
      baseHeight = maxHeight;
      baseWidth = Math.round((maxHeight * widthRatio) / heightRatio);
    }
  } else {
    // Portrait - height-constrained
    baseHeight = maxHeight;
    baseWidth = Math.round((maxHeight * widthRatio) / heightRatio);
    
    // If width exceeds max, scale down
    if (baseWidth > maxWidth) {
      baseWidth = maxWidth;
      baseHeight = Math.round((maxWidth * heightRatio) / widthRatio);
    }
  }
  
  // Apply size multiplier
  const finalWidth = Math.round(baseWidth * sizeMultiplier);
  const finalHeight = Math.round(baseHeight * sizeMultiplier);
  
  // Ensure dimensions don't exceed maximums after multiplier
  return {
    width: Math.min(finalWidth, maxWidth),
    height: Math.min(finalHeight, maxHeight)
  };
}

export default function ImageSizeSelector({ 
  selectedSize, 
  aspectRatio, 
  maxWidth, 
  maxHeight, 
  onSizeChange, 
  disabled = false 
}: ImageSizeSelectorProps) {
  if (!aspectRatio) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Image Size</label>
        <div className="text-sm text-gray-500">Select an aspect ratio first</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-300">Image Size</label>
      <div className="grid grid-cols-2 gap-3">
        {SIZE_OPTIONS.map((option) => {
          const dimensions = calculateDimensions(aspectRatio, option.multiplier, maxWidth, maxHeight);
          
          return (
            <Button
              key={option.size}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onSizeChange(option.size, dimensions.width, dimensions.height)}
              className={cn(
                "h-auto p-4 flex flex-col items-center space-y-2 transition-all duration-200",
                "bg-[hsl(var(--dark-elevated))] border border-gray-700 text-white",
                "hover:bg-[hsl(var(--dark-surface))] hover:border-gray-600 hover:text-white",
                "touch-friendly mobile-hover text-sm rounded-lg",
                selectedSize === option.size
                  ? "border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/10 text-[#21B0F8]"
                  : ""
              )}
            >
              {/* Size label */}
              <span className="font-medium text-sm">{option.label}</span>
              {/* Actual dimensions */}
              <span className="text-gray-300 text-xs font-mono">
                {dimensions.width}×{dimensions.height}
              </span>
              {/* Description */}
              <span className="text-gray-400 text-xs leading-tight text-center">
                {option.description}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Export the calculation function for use in parent components
export { calculateDimensions };