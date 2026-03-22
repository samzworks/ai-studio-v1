import { useCostEstimate } from "@/hooks/useCostEstimate";
import { DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CostEstimateProps {
  operationId: string;
  params?: Record<string, any>;
  enabled?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Component to display real-time cost estimates for AI operations
 * 
 * Usage:
 * <CostEstimate operationId="flux_schnell" params={{ quantity: 1 }} />
 */
export function CostEstimate({ 
  operationId, 
  params, 
  enabled = true,
  className = "",
  compact = false 
}: CostEstimateProps) {
  const { credits, isLoading, effectiveUsd } = useCostEstimate({ 
    operationId, 
    params, 
    enabled 
  });

  if (!enabled || !operationId) {
    return null;
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} data-testid="cost-estimate-compact">
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : credits !== null ? (
          <Badge variant="secondary" className="font-mono" data-testid="badge-credits">
            {credits} credits
          </Badge>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`} data-testid="cost-estimate-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Estimated Cost</span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Calculating...</span>
            </div>
          ) : credits !== null ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold" data-testid="text-credits">
                  {credits}
                </div>
                <div className="text-xs text-muted-foreground">credits</div>
              </div>
              {effectiveUsd !== null && (
                <div className="text-right">
                  <div className="text-sm font-mono text-muted-foreground" data-testid="text-usd">
                    ${effectiveUsd.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">USD</div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Unable to estimate</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline cost badge for compact display
 */
export function CostBadge({ 
  operationId, 
  params, 
  enabled = true 
}: Omit<CostEstimateProps, "compact" | "className">) {
  return <CostEstimate operationId={operationId} params={params} enabled={enabled} compact />;
}
