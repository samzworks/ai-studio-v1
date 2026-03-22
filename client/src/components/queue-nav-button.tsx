import { useState } from "react";
import { useGenerationJobs } from "@/hooks/useGenerationJobs";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";
import { 
  X, Loader2, CheckCircle, AlertCircle, Timer as Clock, XCircle, ImageIcon, Layers } from "lucide-react";
import type { ImageGenerationJob } from "@shared/schema";

export function QueueNavButton() {
  const { t } = useTranslation();
  const { 
    jobs,
    activeJobs, 
    queuedJobs, 
    hasActiveJobs,
    cancelJob,
    dismissJob,
    queueStatus 
  } = useGenerationJobs();
  
  const [isOpen, setIsOpen] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [dismissingJobId, setDismissingJobId] = useState<string | null>(null);

  // Include failed jobs in the dropdown so users can dismiss them
  const failedJobs = jobs.filter(job => job.status === 'failed');
  const allVisibleJobs = [...activeJobs, ...queuedJobs, ...failedJobs];
  const runningCount = activeJobs.length;
  const queuedCount = queuedJobs.length;
  const failedCount = failedJobs.length;
  const totalActive = runningCount + queuedCount;

  const handleCancelJob = async (jobId: string) => {
    setCancellingJobId(jobId);
    try {
      await cancelJob(jobId);
    } catch (error) {
      console.error('[QueueNav] Failed to cancel job:', error);
    } finally {
      setCancellingJobId(null);
    }
  };

  const handleDismissJob = async (jobId: string) => {
    setDismissingJobId(jobId);
    try {
      await dismissJob(jobId);
    } catch (error) {
      console.error('[QueueNav] Failed to dismiss job:', error);
    } finally {
      setDismissingJobId(null);
    }
  };

  const truncatePrompt = (prompt: string, maxLength: number = 40) => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + "...";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <ImageIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      queued: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    
    const statusLabels: Record<string, string> = {
      running: t('jobs.running', 'Running'),
      queued: t('jobs.queued', 'Queued'),
      completed: t('jobs.completed', 'Done'),
      failed: t('jobs.failed', 'Failed'),
      cancelled: t('jobs.cancelled', 'Cancelled'),
    };
    
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs", variants[status] || "")}
        data-testid={`badge-status-${status}`}
      >
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const formatTimeAgo = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-white hover:bg-white/10 relative p-2"
          data-testid="button-queue-nav"
        >
          <Layers 
            className={cn(
              "h-5 w-5 transition-colors",
              hasActiveJobs ? "text-green-400" : "text-gray-400"
            )} 
          />
          {totalActive > 0 && (
            <Badge 
              variant="default"
              className={cn(
                "absolute -top-1 -right-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center text-xs",
                hasActiveJobs ? "bg-green-500 hover:bg-green-500" : "bg-gray-500"
              )}
              data-testid="badge-queue-count"
            >
              {totalActive}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 max-w-[calc(100vw-32px)] p-0" 
        align="end"
        side="bottom"
        sideOffset={8}
        alignOffset={-8}
        collisionPadding={16}
        avoidCollisions={true}
        data-testid="queue-popover-content"
      >
        <div className="p-3 border-b min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-medium text-sm shrink-0">
              {t('jobs.generationQueue', 'Generation Queue')}
            </h4>
            {(totalActive > 0 || failedCount > 0) && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {runningCount > 0 && `${runningCount} ${t('jobs.running', 'running')}`}
                {runningCount > 0 && queuedCount > 0 && ", "}
                {queuedCount > 0 && `${queuedCount} ${t('jobs.queued', 'queued')}`}
                {(runningCount > 0 || queuedCount > 0) && failedCount > 0 && ", "}
                {failedCount > 0 && `${failedCount} ${t('jobs.failed', 'failed')}`}
              </Badge>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          {allVisibleJobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground min-w-0">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('jobs.noActiveJobs', 'No active jobs')}</p>
              <p className="text-xs mt-1">{t('jobs.startGenerating', 'Start generating to see jobs here')}</p>
            </div>
          ) : (
            <div className="p-2 space-y-2 min-w-0">
              {allVisibleJobs.map((job) => (
                <JobCard 
                  key={job.id}
                  job={job}
                  onCancel={() => handleCancelJob(job.id)}
                  onDismiss={() => handleDismissJob(job.id)}
                  isCancelling={cancellingJobId === job.id}
                  isDismissing={dismissingJobId === job.id}
                  truncatePrompt={truncatePrompt}
                  getStatusIcon={getStatusIcon}
                  getStatusBadge={getStatusBadge}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="px-3 py-2 border-t text-xs text-muted-foreground flex justify-center gap-2 flex-wrap bg-muted/50 min-w-0">
          <span className="shrink-0">
            {t('jobs.active', 'Active')}: {totalActive}/{queueStatus?.limits.maxActiveJobsPerUser ?? 8}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface JobCardProps {
  job: ImageGenerationJob;
  onCancel: () => void;
  onDismiss: () => void;
  isCancelling: boolean;
  isDismissing: boolean;
  truncatePrompt: (prompt: string, maxLength?: number) => string;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusBadge: (status: string) => JSX.Element;
  formatTimeAgo: (date: Date | string) => string;
}

function JobCard({
  job,
  onCancel,
  onDismiss,
  isCancelling,
  isDismissing,
  truncatePrompt,
  getStatusIcon,
  getStatusBadge,
  formatTimeAgo
}: JobCardProps) {
  const { t } = useTranslation();
  const canCancel = job.status === 'running' || job.status === 'queued';
  const canDismiss = job.status === 'failed';
  
  return (
    <div 
      className={cn(
        "p-2.5 rounded-md border bg-background/50",
        job.status === 'running' && "border-blue-200 dark:border-blue-800",
        job.status === 'queued' && "border-yellow-200 dark:border-yellow-800",
        job.status === 'failed' && "border-red-200 dark:border-red-800"
      )}
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {getStatusIcon(job.status)}
          <div className="flex-1 min-w-0">
            <p 
              className="text-sm font-medium truncate" 
              title={job.prompt}
              data-testid={`text-prompt-${job.id}`}
            >
              {truncatePrompt(job.prompt, 35)}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {getStatusBadge(job.status)}
              {job.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(job.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
            onClick={onCancel}
            disabled={isCancelling}
            data-testid={`button-cancel-${job.id}`}
          >
            {isCancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        
        {canDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
            onClick={onDismiss}
            disabled={isDismissing}
            data-testid={`button-dismiss-${job.id}`}
          >
            {isDismissing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
      
      {job.status === 'running' && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{job.stage || t('jobs.processing', 'Processing...')}</span>
            <span>{job.progress || 0}%</span>
          </div>
          <Progress 
            value={job.progress || 0} 
            className="h-1"
            data-testid={`progress-${job.id}`}
          />
        </div>
      )}
      
      {job.status === 'queued' && job.queuePosition && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          {t('jobs.position', 'Position')}: #{job.queuePosition}
        </div>
      )}
      
      {job.status === 'failed' && job.error && (
        <div className="mt-1.5 text-xs text-destructive truncate" title={job.error}>
          {job.error}
        </div>
      )}
    </div>
  );
}
