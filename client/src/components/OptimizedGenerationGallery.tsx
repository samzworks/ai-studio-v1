import { useState, useMemo, useRef, useEffect } from 'react';
import GenerationGallery from './generation-gallery';
import VirtualizedGallery from './VirtualizedGallery';
import type { Image } from '@shared/schema';
import { GenerationJob } from './generation-gallery';
import { useIsMobile } from '@/hooks/use-mobile';

interface OptimizedGenerationGalleryProps {
  images: Image[];
  generationJobs: GenerationJob[];
  isLoading: boolean;
  onImageClick: (image: Image) => void;
  onImageDeleted: () => void;
  onJobCancel: (jobId: string) => void;
  imageSize?: number;
}

// Threshold for switching to virtualization
const VIRTUALIZATION_THRESHOLD = 100;

export default function OptimizedGenerationGallery({
  images,
  generationJobs,
  isLoading,
  onImageClick,
  onImageDeleted,
  onJobCancel,
  imageSize = 4
}: OptimizedGenerationGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 0, 
    height: 600 
  });
  const isMobile = useIsMobile();

  // Update container dimensions using ResizeObserver for reliable measurement
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Use requestAnimationFrame to ensure measurement happens after layout
        requestAnimationFrame(() => {
          setContainerDimensions({ 
            width: width || window.innerWidth, 
            height: height || 600 
          });
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isMobile]);

  // Decide whether to use virtualization based on image count
  const shouldVirtualize = useMemo(() => {
    return images.length > VIRTUALIZATION_THRESHOLD;
  }, [images.length]);

  if (shouldVirtualize) {
    return (
      <div ref={containerRef} className="flex-1 overflow-hidden min-w-0 min-h-0">
        {containerDimensions.width > 0 && (
          <VirtualizedGallery
            images={images}
            generationJobs={generationJobs}
            isLoading={isLoading}
            onImageClick={onImageClick}
            onImageDeleted={onImageDeleted}
            onJobCancel={onJobCancel}
            imageSize={imageSize}
            containerWidth={containerDimensions.width}
            containerHeight={Math.max(containerDimensions.height, 600)}
          />
        )}
      </div>
    );
  }

  // Use regular gallery for smaller image counts
  return (
    <GenerationGallery
      images={images}
      generationJobs={generationJobs}
      isLoading={isLoading}
      onImageClick={onImageClick}
      onImageDeleted={onImageDeleted}
      onJobCancel={onJobCancel}
      imageSize={imageSize}
    />
  );
}