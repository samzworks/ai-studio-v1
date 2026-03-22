import { useState, useRef, useEffect, useCallback } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  rootMargin?: string;
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  onClick,
  rootMargin = '200px'
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSrcRef = useRef<string>(src);

  useEffect(() => {
    if (prevSrcRef.current !== src) {
      setIsLoaded(false);
      setHasError(false);
      setIsInView(false);
      prevSrcRef.current = src;
    }
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin,
        threshold: 0
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, src]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onClick={onClick}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-shimmer">
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/30 to-transparent"
            style={{
              animation: 'shimmer 1.5s infinite',
              backgroundSize: '200% 100%'
            }}
          />
        </div>
      )}
      
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          decoding="async"
        />
      )}

      {hasError && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <span className="text-gray-500 text-xs">Failed to load</span>
        </div>
      )}
    </div>
  );
}

export default OptimizedImage;
