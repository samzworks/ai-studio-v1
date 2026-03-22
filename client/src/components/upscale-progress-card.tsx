import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Wand2, Timer as Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface UpscaleJobProgress {
  id: string;
  state: "queued" | "starting" | "processing" | "completed" | "failed";
  progress: number;
  stage: string | null;
  scaleFactor: number;
  sourceImageUrl: string;
  resultUrl?: string | null;
  error?: string | null;
}

interface Props {
  job: UpscaleJobProgress;
  onDismiss?: () => void;
}

function useSmoothProgress(job: UpscaleJobProgress): number {
  const [smoothProgress, setSmoothProgress] = useState(job.progress);
  
  useEffect(() => {
    const targetProgress = job.progress;
    const interval = setInterval(() => {
      setSmoothProgress(current => {
        if (current < targetProgress) {
          return Math.min(current + 1, targetProgress);
        }
        return current;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [job.progress]);
  
  return smoothProgress;
}

export function UpscaleProgressCard({ job, onDismiss }: Props) {
  const { t } = useTranslation();
  const smoothProgress = useSmoothProgress(job);
  const progressPercent = Math.round(Math.max(0, Math.min(100, smoothProgress)));
  const isFailed = job.state === "failed";
  const isCompleted = job.state === "completed";

  const getStatusIcon = () => {
    switch (job.state) {
      case "queued":
        return <Clock className="w-8 h-8 text-blue-500" />;
      case "starting":
      case "processing":
        return <Wand2 className="w-8 h-8 text-purple-500 animate-pulse" />;
      case "completed":
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-8 h-8 text-amber-400" />;
      default:
        return <Clock className="w-8 h-8 text-blue-500" />;
    }
  };

  const getStatusText = () => {
    const stage = job.stage;
    if (stage) return stage;
    
    switch (job.state) {
      case "queued":
        return t("upscale.status.queued", { defaultValue: "In Queue" });
      case "starting":
        return t("upscale.status.starting", { defaultValue: "Starting..." });
      case "processing":
        return t("upscale.status.processing", { defaultValue: "Upscaling image..." });
      case "completed":
        return t("upscale.status.completed", { defaultValue: "Upscale complete!" });
      case "failed":
        return t("upscale.status.failed", { defaultValue: "Upscale failed" });
      default:
        return t("upscale.status.processing", { defaultValue: "Processing..." });
    }
  };

  if (isCompleted && !onDismiss) {
    return null;
  }

  return (
    <div
      className={`masonry-item group relative overflow-visible transition-all duration-300 animate-fade-in mb-4 z-10 ${
        isFailed 
          ? 'bg-slate-800/90 border border-amber-500/20' 
          : 'gradient-border bg-[#0a1442cc] hover:scale-[1.02]'
      }`}
      style={{ breakInside: 'avoid', borderRadius: '8px' }}
    >
      {(isFailed || isCompleted) && onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors pointer-events-auto"
          aria-label="Dismiss"
          data-testid="button-dismiss-upscale"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="overflow-visible w-full" style={{ borderRadius: '8px', zIndex: 0 }}>
        <div 
          className="relative media bg-transparent"
          style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}
        >
          {job.sourceImageUrl && (
            <img 
              src={job.sourceImageUrl} 
              alt="Source image"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none bg-black/40">
            <div className="flex flex-col items-center space-y-3 px-3">
              {getStatusIcon()}
              
              <div className="text-center space-y-1">
                <span className="text-white text-sm font-medium block">
                  {getStatusText()}
                </span>
                <span className="text-gray-400 text-xs">
                  {t("upscale.scaleFactorLabel", { factor: job.scaleFactor, defaultValue: `${job.scaleFactor}x Upscale` })}
                </span>
              </div>

              {isFailed && job.error && (
                <div className="text-center space-y-2 max-w-[220px]">
                  <span className="text-amber-400 text-xs block">
                    {job.error}
                  </span>
                  <span className="text-emerald-400 text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t("upscale.creditsRefunded", { defaultValue: "Credits returned to your account" })}
                  </span>
                </div>
              )}
              
              {(job.state === "processing" || job.state === "starting" || job.state === "queued") && (
                <div className="w-full max-w-32">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        job.state === 'queued' 
                          ? 'bg-purple-500/70' 
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.max(progressPercent, 3)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center mt-1">
                    {job.state === 'queued' 
                      ? `Waiting... ${progressPercent}%` 
                      : `${progressPercent}%`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpscaleProgressCard;
