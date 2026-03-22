import { useState, useEffect } from 'react';

export interface Dimensions {
  width: number;
  height: number;
}

export function useActualImageDimensions(url: string | null, fallbackDimensions?: Dimensions): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);

  useEffect(() => {
    if (!url) {
      setDimensions(fallbackDimensions || null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = () => {
      // Fallback to provided dimensions if image fails to load
      setDimensions(fallbackDimensions || null);
    };
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url, fallbackDimensions?.width, fallbackDimensions?.height]);

  return dimensions;
}

export function useActualVideoDimensions(url: string | null, fallbackDimensions?: Dimensions): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);

  useEffect(() => {
    if (!url) {
      setDimensions(fallbackDimensions || null);
      return;
    }

    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      setDimensions({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    video.onerror = () => {
      // Fallback to provided dimensions if video fails to load
      setDimensions(fallbackDimensions || null);
    };
    video.src = url;
    video.load();

    return () => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };
  }, [url, fallbackDimensions?.width, fallbackDimensions?.height]);

  return dimensions;
}