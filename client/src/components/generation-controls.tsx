import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Square, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GenerationControlsProps {
  concurrencyLimit: number;
  onConcurrencyChange: (value: number) => void;
  queueLength: number;
  activeJobs: number;
  onGenerateAll: () => void;
  onStopAll: () => void;
  onClearQueue: () => void;
  isGenerating: boolean;
}

const GenerationControls = React.memo(({
  concurrencyLimit,
  onConcurrencyChange,
  queueLength,
  activeJobs,
  onGenerateAll,
  onStopAll,
  onClearQueue,
  isGenerating
}: GenerationControlsProps) => {
  const { t } = useTranslation();

  const handleConcurrencyChange = useCallback((value: number[]) => {
    onConcurrencyChange(value[0]);
  }, [onConcurrencyChange]);

  return (
    <div className="bg-card/30 border border-border/50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('generation.parallelGeneration')}</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
            {activeJobs} {t('generation.active')}
          </Badge>
          {queueLength > 0 && (
            <Badge variant="secondary" className="bg-orange-500/20 text-orange-300">
              {queueLength} {t('generation.queued')}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          {t('generation.concurrentJobs')}: {concurrencyLimit}
        </label>
        <Slider
          value={[concurrencyLimit]}
          onValueChange={handleConcurrencyChange}
          max={6}
          min={1}
          step={1}
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="default"
          size="sm"
          onClick={onGenerateAll}
          disabled={isGenerating}
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-2" />
          {t('generation.generateAll')}
        </Button>

        {isGenerating && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onStopAll}
          >
            <Square className="w-4 h-4" />
          </Button>
        )}

        {queueLength > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearQueue}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

GenerationControls.displayName = 'GenerationControls';

export default GenerationControls;