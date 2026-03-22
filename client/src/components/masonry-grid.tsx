import React, { useState, useEffect, useRef, useCallback } from 'react';

interface MasonryGridProps {
  children: React.ReactElement[];
  minColumnWidth?: number;
  gap?: number;
  className?: string;
}

export function MasonryGrid({ 
  children, 
  minColumnWidth = 280, 
  gap = 24, 
  className = "" 
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [actualColumnWidth, setActualColumnWidth] = useState(minColumnWidth);
  const [itemHeights, setItemHeights] = useState<number[]>([]);

  // Calculate optimal number of columns and actual column width for full width usage
  const calculateLayout = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const minColumns = 1;
    
    // Calculate max possible columns based on minimum column width
    const maxPossibleColumns = Math.floor((containerWidth + gap) / (minColumnWidth + gap));
    const optimalColumns = Math.max(minColumns, maxPossibleColumns);
    
    // Calculate actual column width to fill the container completely
    const totalGapWidth = (optimalColumns - 1) * gap;
    const actualWidth = (containerWidth - totalGapWidth) / optimalColumns;
    
    setColumns(optimalColumns);
    setActualColumnWidth(actualWidth);
  }, [minColumnWidth, gap]);

  // Handle resize
  useEffect(() => {
    calculateLayout();
    
    const resizeObserver = new ResizeObserver(calculateLayout);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateLayout]);

  // Calculate positions for masonry layout
  const getItemPositions = useCallback(() => {
    if (!children.length || columns === 0) return [];

    // Track column heights
    const columnHeights = new Array(columns).fill(0);
    const positions: Array<{ top: number; left: number; column: number }> = [];

    children.forEach((child, index) => {
      // Find the shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      const shortestColumnHeight = columnHeights[shortestColumnIndex];

      // Calculate position
      const left = shortestColumnIndex * (actualColumnWidth + gap);
      const top = shortestColumnHeight;

      positions.push({
        top,
        left,
        column: shortestColumnIndex
      });

      // Estimate item height (will be updated when measured)
      const estimatedHeight = itemHeights[index] || 300; // fallback height
      columnHeights[shortestColumnIndex] += estimatedHeight + gap;
    });

    return positions;
  }, [children.length, columns, actualColumnWidth, gap, itemHeights]);

  const positions = getItemPositions();

  // Calculate total container height
  const containerHeight = positions.length > 0 
    ? Math.max(...positions.map((pos, index) => pos.top + (itemHeights[index] || 300)))
    : 0;

  // Handle item height measurement
  const handleItemLoad = useCallback((index: number, height: number) => {
    setItemHeights(prev => {
      const newHeights = [...prev];
      newHeights[index] = height;
      return newHeights;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: containerHeight }}
    >
      {children.map((child, index) => {
        const position = positions[index];
        if (!position) return null;

        return (
          <div
            key={child.key || index}
            className="absolute transition-all duration-300 ease-out"
            style={{
              left: position.left,
              top: position.top,
              width: actualColumnWidth,
              transform: 'translateZ(0)' // Enable hardware acceleration
            }}
          >
            <MasonryItem
              index={index}
              onHeightChange={handleItemLoad}
            >
              {child}
            </MasonryItem>
          </div>
        );
      })}
    </div>
  );
}

// Helper component to measure item height
interface MasonryItemProps {
  children: React.ReactElement;
  index: number;
  onHeightChange: (index: number, height: number) => void;
}

function MasonryItem({ children, index, onHeightChange }: MasonryItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!itemRef.current) return;

    const measureHeight = () => {
      if (itemRef.current) {
        const height = itemRef.current.offsetHeight;
        onHeightChange(index, height);
      }
    };

    // Measure immediately
    measureHeight();

    // Also measure after images load
    const images = itemRef.current.querySelectorAll('img, video');
    images.forEach(element => {
      const img = element as HTMLImageElement | HTMLVideoElement;
      if ('complete' in img && img.complete) {
        measureHeight();
      } else {
        img.addEventListener('load', measureHeight);
        img.addEventListener('loadeddata', measureHeight); // for videos
      }
    });

    // Cleanup
    return () => {
      images.forEach(element => {
        const img = element as HTMLImageElement | HTMLVideoElement;
        img.removeEventListener('load', measureHeight);
        img.removeEventListener('loadeddata', measureHeight);
      });
    };
  }, [index, onHeightChange]);

  return (
    <div ref={itemRef} className="w-full">
      {children}
    </div>
  );
}

export default MasonryGrid;