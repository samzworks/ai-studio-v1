import { Heart, ArrowDownToLine as Download, Trash as Trash2, Eye, EyeOff, Type } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

interface HoverButtonsProps {
  // Position props
  className?: string;
  
  // Info button
  showInfo?: boolean;
  onInfoToggle?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  
  // Download button  
  onDownload?: () => void;
  
  // Favorite button
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
  
  // Delete button (for studio galleries)
  onDelete?: () => void;
  
  // Visibility toggle (for studio galleries) 
  isPublic?: boolean;
  onVisibilityToggle?: () => void;
  
  // Additional props
  infoButtonRef?: React.RefObject<HTMLButtonElement>;
}

export function HoverButtons({
  className = "absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-nowrap items-center justify-end gap-1 z-30 max-w-[calc(100%-0.5rem)]",
  showInfo,
  onInfoToggle,
  onDownload,
  isFavorited,
  onFavoriteToggle,
  onDelete,
  isPublic,
  onVisibilityToggle,
  infoButtonRef
}: HoverButtonsProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const actionChipClasses = "bg-black/35 hover:bg-black/50 border border-white/30 backdrop-blur-sm";
  // Base button classes - visible on mobile, visible on hover on desktop
  const baseButtonClasses = `w-7 h-7 sm:w-8 sm:h-8 md:w-7 md:h-7 min-w-0 min-h-0 rounded-full ${actionChipClasses} flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 flex-shrink-0`;
  const iconClasses = "w-3 h-3 sm:w-3.5 sm:h-3.5 text-white";
  // Favorite button classes - always visible on all devices
  const favoriteButtonClasses = "w-7 h-7 sm:w-8 sm:h-8 md:w-7 md:h-7 min-w-0 min-h-0 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0 opacity-100";

  return (
    <>
      {/* Action Buttons - Top Right */}
      <div className={className} dir="ltr">
      {/* Delete Button (Studio galleries only) */}
      {onDelete && (
        <button
          className={baseButtonClasses}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          aria-label={t('accessibility.delete')}
          data-testid="button-delete"
        >
          <Trash2 className={iconClasses} />
        </button>
      )}

      {/* Info Button */}
      {onInfoToggle && (
        <button
          ref={infoButtonRef}
          className={baseButtonClasses}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInfoToggle(e);
          }}
          aria-label={t('accessibility.showInfo')}
          data-testid="button-show-info"
          data-info-button="true"
        >
          <Type className={iconClasses} />
        </button>
      )}

      {/* Download Button */}
      {onDownload && (
        <button
          className={baseButtonClasses}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDownload();
          }}
          aria-label={t('accessibility.download')}
        >
          <Download className={iconClasses} />
        </button>
      )}

      {/* Visibility Toggle (Studio galleries only) */}
      {onVisibilityToggle !== undefined && (
        <button
          className={baseButtonClasses}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVisibilityToggle();
          }}
          aria-label={isPublic ? t('accessibility.makePrivate') : t('accessibility.makePublic')}
        >
          {isPublic ? (
            <Eye className={iconClasses} />
          ) : (
            <EyeOff className={iconClasses} />
          )}
        </button>
      )}

      {/* Favorite Button - Always visible on all devices */}
      {isAuthenticated && onFavoriteToggle && (
        <button
          className={`${favoriteButtonClasses} ${actionChipClasses}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle();
          }}
          aria-label={isFavorited ? t('accessibility.removeFromFavorites') : t('accessibility.addToFavorites')}
        >
          <Heart 
            className={`w-3 h-3 sm:w-4 sm:h-4 ${isFavorited ? 'text-red-400 fill-current' : 'text-white'}`} 
          />
        </button>
      )}
    </div>
    </>
  );
}
