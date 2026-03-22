import { useEffect, useRef } from 'react';
import { onCLS, onINP, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

interface ApiTiming {
  endpoint: string;
  duration: number;
  itemCount?: number;
  payloadSize?: number;
}

interface PerformanceMetrics {
  cls?: number;
  inp?: number;
  lcp?: number;
  fcp?: number;
  ttfb?: number;
  apiTiming: ApiTiming[];
}

const metrics: PerformanceMetrics = { apiTiming: [] };
const apiTimings: ApiTiming[] = [];

function reportMetric(metric: Metric) {
  const { name, value, rating } = metric;
  
  if (import.meta.env.DEV) {
    const color = rating === 'good' ? 'green' : rating === 'needs-improvement' ? 'orange' : 'red';
    console.log(`%c[Web Vitals] ${name}: ${value.toFixed(2)}ms (${rating})`, `color: ${color}`);
  }

  switch (name) {
    case 'CLS':
      metrics.cls = value;
      break;
    case 'INP':
      metrics.inp = value;
      break;
    case 'LCP':
      metrics.lcp = value;
      break;
    case 'FCP':
      metrics.fcp = value;
      break;
    case 'TTFB':
      metrics.ttfb = value;
      break;
  }
}

export function initWebVitals() {
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
}

export function trackApiTiming(
  endpoint: string,
  duration: number,
  itemCount?: number,
  payloadSize?: number
) {
  const timing = { endpoint, duration, itemCount, payloadSize };
  apiTimings.push(timing);
  
  if (import.meta.env.DEV) {
    console.log(
      `%c[API Timing] ${endpoint}: ${duration.toFixed(0)}ms` +
      (itemCount !== undefined ? ` (${itemCount} items)` : '') +
      (payloadSize !== undefined ? ` (${(payloadSize / 1024).toFixed(1)}KB)` : ''),
      'color: #6366f1'
    );
  }
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...metrics, apiTiming: [...apiTimings] };
}

export function useApiTimingQuery<T>(
  queryFn: () => Promise<Response>,
  endpoint: string
): () => Promise<T> {
  return async () => {
    const startTime = performance.now();
    const response = await queryFn();
    const duration = performance.now() - startTime;
    
    const contentLength = response.headers.get('content-length');
    const payloadSize = contentLength ? parseInt(contentLength, 10) : undefined;
    
    const data = await response.json() as T;
    const itemCount = Array.isArray(data) ? data.length : 
                     (data && typeof data === 'object' && 'items' in data && Array.isArray((data as any).items)) 
                     ? (data as any).items.length : undefined;
    
    trackApiTiming(endpoint, duration, itemCount, payloadSize);
    
    return data;
  };
}

export function useGalleryPerformanceMetrics() {
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initWebVitals();
      
      if (import.meta.env.DEV) {
        console.log('%c[Performance] Web Vitals tracking initialized', 'color: #10b981');
      }
    }
  }, []);
  
  return {
    trackApiTiming,
    getMetrics: getPerformanceMetrics,
  };
}
