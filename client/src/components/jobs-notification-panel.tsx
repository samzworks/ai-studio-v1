import { useState, useEffect } from "react";
import { useGenerationJobs } from "@/hooks/useGenerationJobs";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, Loader2, CheckCircle, AlertCircle, Timer as Clock, XCircle, ChevronDown, ChevronUp, ImageIcon, WandSparkles as Sparkles } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ImageGenerationJob } from "@shared/schema";

interface JobsNotificationPanelProps {
  className?: string;
  maxHeight?: string;
}

export default function JobsNotificationPanel({ 
  className,
  maxHeight = "300px"
}: JobsNotificationPanelProps) {
  const { t } = useTranslation();
  const { 
    jobs, 
    activeJobs, 
    queuedJobs, 
    hasActiveJobs,
    cancelJob,
    isCancelling,
    queueStatus 
  } = useGenerationJobs();
  
  const [isOpen, setIsOpen] = useState(true);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  const allActiveJobs = [...activeJobs, ...queuedJobs];
  const runningCount = activeJobs.length;
  const queuedCount = queuedJobs.length;
  const totalActive = runningCount + queuedCount;

  useEffect(() => {
    if (totalActive > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [totalActive]);

  const handleCancelJob = async (jobId: string) => {
    setCancellingJobId(jobId);
    try {
      await cancelJob(jobId);
    } catch (error) {
      console.error('[JobsPanel] Failed to cancel job:', error);
    } finally {
      setCancellingJobId(null);
    }
  };

  const truncatePrompt = (prompt: string, maxLength: number = 50) => {
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
    
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs capitalize", variants[status] || "")}
        data-testid={`badge-status-${status}`}
      >
        {status}
      </Badge>
    );
  };

  const formatTimeAgo = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (totalActive === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        "border rounded-lg bg-card shadow-sm",
        className
      )}
      data-testid="jobs-notification-panel"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 hover:bg-accent/50"
            data-testid="button-toggle-jobs-panel"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                {t('jobs.generationQueue', 'Generation Queue')}
              </span>
              {totalActive > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {runningCount > 0 && `${runningCount} running`}
                  {runningCount > 0 && queuedCount > 0 && ", "}
                  {queuedCount > 0 && `${queuedCount} queued`}
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <ScrollArea 
            className="p-2" 
            style={{ maxHeight }}
            data-testid="jobs-list-container"
          >
            <div className="space-y-2">
              {allActiveJobs.map((job) => (
                <JobCard 
                  key={job.id}
                  job={job}
                  onCancel={() => handleCancelJob(job.id)}
                  isCancelling={cancellingJobId === job.id}
                  truncatePrompt={truncatePrompt}
                  getStatusIcon={getStatusIcon}
                  getStatusBadge={getStatusBadge}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          </ScrollArea>
          
          {queueStatus && (
            <div className="px-3 py-2 border-t text-xs text-muted-foreground flex justify-center">
              <span>
                {t('jobs.active', 'Active')}: {queueStatus.userCounts.total}/{queueStatus.limits.maxActiveJobsPerUser}
              </span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface JobCardProps {
  job: ImageGenerationJob;
  onCancel: () => void;
  isCancelling: boolean;
  truncatePrompt: (prompt: string, maxLength?: number) => string;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusBadge: (status: string) => JSX.Element;
  formatTimeAgo: (date: Date | string) => string;
}

function JobCard({
  job,
  onCancel,
  isCancelling,
  truncatePrompt,
  getStatusIcon,
  getStatusBadge,
  formatTimeAgo
}: JobCardProps) {
  const { t } = useTranslation();
  const canCancel = job.status === 'running' || job.status === 'queued';
  
  return (
    <div 
      className={cn(
        "p-3 rounded-md border bg-background/50",
        job.status === 'running' && "border-blue-200 dark:border-blue-800",
        job.status === 'queued' && "border-yellow-200 dark:border-yellow-800"
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
              {truncatePrompt(job.prompt, 60)}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {getStatusBadge(job.status)}
              <span className="text-xs text-muted-foreground">
                {job.model}
              </span>
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
            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={onCancel}
            disabled={isCancelling}
            data-testid={`button-cancel-${job.id}`}
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
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
            className="h-1.5"
            data-testid={`progress-${job.id}`}
          />
        </div>
      )}
      
      {job.status === 'queued' && job.queuePosition && (
        <div className="mt-2 text-xs text-muted-foreground">
          {t('jobs.queuePosition', 'Position in queue')}: #{job.queuePosition}
        </div>
      )}
      
      {job.status === 'failed' && job.error && (
        <div className="mt-2 text-xs text-destructive">
          {job.error}
        </div>
      )}
    </div>
  );
}
