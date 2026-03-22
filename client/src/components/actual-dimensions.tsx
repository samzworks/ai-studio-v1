import { useActualImageDimensions, useActualVideoDimensions, type Dimensions } from '@/hooks/useActualDimensions';

interface ActualDimensionsProps {
  type: 'image' | 'video';
  url: string | null;
  fallbackDimensions: Dimensions;
  className?: string;
}

export function ActualDimensions({ type, url, fallbackDimensions, className }: ActualDimensionsProps) {
  const imageDimensions = useActualImageDimensions(
    type === 'image' ? url : null, 
    fallbackDimensions
  );
  
  const videoDimensions = useActualVideoDimensions(
    type === 'video' ? url : null, 
    fallbackDimensions
  );

  const actualDimensions = type === 'image' ? imageDimensions : videoDimensions;
  
  // Use actual dimensions if available, otherwise fallback to provided dimensions
  const displayDimensions = actualDimensions || fallbackDimensions;

  return (
    <span className={className}>
      {displayDimensions.width}×{displayDimensions.height}
    </span>
  );
}