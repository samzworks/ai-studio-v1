import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Zap, WandSparkles as Sparkles } from "lucide-react";
import { useTranslation } from 'react-i18next';

// Memoized Generate Button to prevent unnecessary re-renders
export const MemoizedGenerateButton = memo(function GenerateButton({
  isLoading,
  canAfford,
  totalCost,
  onClick,
  disabled,
}: {
  isLoading: boolean;
  canAfford: boolean;
  totalCost: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const buttonText = isLoading ? t('generation.generating') : (
    <span className="flex items-center gap-1">
      {t('generation.generate')} {totalCost} <Coins className="w-4 h-4" />
    </span>
  );
  const buttonVariant = canAfford ? "default" : "destructive";
  
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={isLoading || !canAfford || disabled}
      variant={buttonVariant}
      size="lg"
      className="w-full font-semibold"
    >
      <Zap className="w-4 h-4 mr-2" />
      {buttonText}
    </Button>
  );
});

// Memoized Credit Display
export const MemoizedCreditDisplay = memo(function CreditDisplay({
  balance,
  totalCost,
}: {
  balance: number;
  totalCost: number;
}) {
  const { t } = useTranslation();
  const canAfford = balance >= totalCost;
  const remainingCredits = balance - totalCost;
  
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-muted-foreground" />
        <span>{t('generation.credits.currentBalance')}: {balance.toLocaleString()}</span>
      </div>
      {canAfford ? (
        <Badge variant="secondary" className="text-green-600">
          {t('generation.credits.after')}: {remainingCredits.toLocaleString()}
        </Badge>
      ) : (
        <Badge variant="destructive">
          {t('generation.credits.insufficientCredits')}
        </Badge>
      )}
    </div>
  );
});

// Memoized Pricing Breakdown
export const MemoizedPricingBreakdown = memo(function PricingBreakdown({
  baseCost,
  additionalCosts,
  totalCost,
}: {
  baseCost: number;
  additionalCosts: { feature: string; cost: number }[];
  totalCost: number;
}) {
  const { t } = useTranslation();
  if (additionalCosts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        {t('generation.credits.baseCost')}: {baseCost} <Coins className="w-3 h-3" />
      </div>
    );
  }
  
  return (
    <Card className="mt-2">
      <CardContent className="p-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between items-center">
            <span>{t('generation.credits.baseCost')}:</span>
            <span className="flex items-center gap-1">{baseCost} <Coins className="w-3 h-3" /></span>
          </div>
          {additionalCosts.map((cost, index) => (
            <div key={index} className="flex justify-between items-center text-muted-foreground">
              <span>{cost.feature}:</span>
              <span className="flex items-center gap-1">+{cost.cost} <Coins className="w-3 h-3" /></span>
            </div>
          ))}
          <hr className="my-2" />
          <div className="flex justify-between items-center font-semibold">
            <span>{t('generation.credits.total')}:</span>
            <span className="flex items-center gap-1">{totalCost} <Coins className="w-3 h-3" /></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// Memoized Enhancement Toggle
export const MemoizedEnhancementToggle = memo(function EnhancementToggle({
  enhancePrompt,
  setEnhancePrompt,
  isEnhancing,
}: {
  enhancePrompt: boolean;
  setEnhancePrompt: (value: boolean) => void;
  isEnhancing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="enhance-prompt"
        checked={enhancePrompt}
        onChange={(e) => setEnhancePrompt(e.target.checked)}
        disabled={isEnhancing}
        className="rounded border-gray-300"
      />
      <label htmlFor="enhance-prompt" className="text-sm flex items-center gap-1">
        <Sparkles className="w-4 h-4" />
        {t('generation.enhancement.enhancePrompt')} {isEnhancing && t('generation.enhancement.processing')}
      </label>
    </div>
  );
});