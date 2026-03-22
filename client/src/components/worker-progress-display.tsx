import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Timer as Clock, CheckCircle, AlertCircle, WandSparkles as Sparkles } from "lucide-react";

interface Worker {
  id: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  progress: number;
  prompt?: string;
  error?: string;
  startTime?: number;
}

interface EnhancementSession {
  stage: 'idle' | 'enhancing' | 'ready' | 'failed';
  enhancedPrompt?: string;
  progressText?: string;
  error?: string;
  startedAt?: number;
}

interface WorkerProgressDisplayProps {
  workers: Worker[];
  onCancelJob: (workerId: string) => void;
  enhancementSession?: EnhancementSession;
  onCancelEnhancement?: () => void;
}

const WorkerProgressDisplay = React.memo(({ workers, onCancelJob, enhancementSession, onCancelEnhancement }: WorkerProgressDisplayProps) => {
  const activeWorkers = workers.filter(worker => worker.status !== 'idle');
  const showEnhancement = enhancementSession && (enhancementSession.stage === 'enhancing' || enhancementSession.stage === 'failed');

  if (activeWorkers.length === 0 && !showEnhancement) return null;

  return (
    <div className="space-y-2 mb-6">
      {/* Enhancement Session Card - Shows when enhancing or failed */}
      {showEnhancement && (
        <div className={`rounded-lg p-4 border ${
          enhancementSession?.stage === 'failed' 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {enhancementSession?.stage === 'failed' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              )}
              <span className="text-sm font-medium text-white">
                {enhancementSession?.stage === 'failed' ? 'Enhancement Failed' : 'Enhancing'}
              </span>
            </div>
            
            {onCancelEnhancement && enhancementSession?.stage === 'enhancing' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEnhancement}
                className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                data-testid="button-cancel-enhancement"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <p className={`text-sm mb-2 ${
            enhancementSession?.stage === 'failed' ? 'text-red-400' : 'text-gray-300'
          }`}>
            {enhancementSession?.stage === 'failed' 
              ? (enhancementSession.error || 'Enhancement failed, using original prompt')
              : (enhancementSession?.progressText || 'Enhancing prompt...')
            }
          </p>
          
          {enhancementSession?.stage === 'enhancing' && (
            <Progress value={50} className="h-2" />
          )}
        </div>
      )}

      {/* Worker Cards - Show when jobs are running */}
      {activeWorkers.map((worker, index) => (
        <div key={worker.id || index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {worker.status === 'running' && <Clock className="w-4 h-4 text-blue-400" />}
              {worker.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
              {worker.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className="text-sm font-medium text-white capitalize">{worker.status}</span>
            </div>
            
            {worker.status === 'running' && worker.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancelJob(worker.id!)}
                className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                data-testid={`button-cancel-worker-${worker.id}`}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <p className="text-sm text-gray-300 mb-2 truncate">
            {worker.prompt || 'Processing...'}
          </p>
          
          {worker.status === 'running' && (
            <Progress value={worker.progress} className="h-2" />
          )}
          
          {worker.status === 'failed' && worker.error && (
            <p className="text-red-400 text-xs mt-1">{worker.error}</p>
          )}
        </div>
      ))}
    </div>
  );
});

WorkerProgressDisplay.displayName = 'WorkerProgressDisplay';

export default WorkerProgressDisplay;