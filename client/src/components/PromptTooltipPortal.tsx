import { useEffect } from "react";

interface TooltipContent {
  prompt: string;
  width?: number;
  height?: number;
  type?: 'image' | 'video';
  tags?: string[];
  quality?: string;
  style?: string;
  model?: string;
}

interface PromptTooltipPortalProps {
  show: boolean;
  content: TooltipContent | null;
  position: { top: number; left: number } | null;
  onClose: () => void;
  itemId: string;
}

export function PromptTooltipPortal({ show, content, position, onClose, itemId }: PromptTooltipPortalProps) {
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const tooltip = document.getElementById(`tooltip-${itemId}`);
      const infoButton = document.querySelector(`[aria-describedby="tooltip-${itemId}"]`);
      
      if (show && tooltip && infoButton) {
        if (!tooltip.contains(e.target as Node) && !infoButton.contains(e.target as Node)) {
          onClose();
        }
      }
    };
    
    if (show) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [show, itemId, onClose]);

  if (!show || !content || !position) return null;

  return (
    <div 
      id={`tooltip-${itemId}`}
      className="prompt-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: position.top < 300 ? 'translateY(0)' : 'translateY(-100%)',
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2">
        {content.prompt}
      </p>
      <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1">
          {content.width && content.height && (
            <span className="text-xs">
              {content.width}×{content.height}
            </span>
          )}
          {content.type === 'image' && (
            <span className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded text-xs">
              Image
            </span>
          )}
          {content.type === 'video' && (
            <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded text-xs">
              Video
            </span>
          )}
        </div>
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {content.tags.slice(0, 3).map((tag: string, index: number) => (
              <span key={index} className="text-xs border border-gray-500 text-gray-300 px-1 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to calculate tooltip position
export function useTooltipPosition() {
  const calculatePosition = (buttonElement: HTMLElement, cardWidth: number) => {
    const buttonRect = buttonElement.getBoundingClientRect();
    const cardRect = buttonElement.closest('[data-card-container]')?.getBoundingClientRect();
    
    if (!cardRect) {
      // Fallback if card container not found
      return {
        top: buttonRect.bottom + 8,
        left: buttonRect.left
      };
    }
    
    // Position tooltip at 90% of card width, below the card
    const tooltipWidth = cardRect.width * 0.9;
    const tooltipLeft = cardRect.left + (cardRect.width * 0.05); // 5% margin on each side
    
    return {
      top: cardRect.bottom + 8,
      left: tooltipLeft,
      width: tooltipWidth
    };
  };

  return { calculatePosition };
}
