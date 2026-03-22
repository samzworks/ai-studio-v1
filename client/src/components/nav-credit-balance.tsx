import { memo, useState } from "react";
import { Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useCredits } from "@/contexts/CreditContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

export const NavCreditBalance = memo(function NavCreditBalance() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { credits, isLoading } = useCredits();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  const balance = credits?.balance || 0;
  const isLowBalance = balance < 20;

  if (isMobile) {
    // Mobile version - compact with tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/buy-credits")}
              className={`text-white hover:bg-white/10 p-2 ${
                isLowBalance ? 'text-orange-400 hover:text-orange-300' : ''
              }`}
              data-testid="button-credit-menu-mobile"
            >
              <Coins className={`w-4 h-4 ${isLowBalance ? 'text-orange-400' : 'text-white'}`} />
              <span className="ml-1 text-xs font-medium">
                {balance >= 1000 ? `${Math.floor(balance / 1000)}k` : balance}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{balance.toLocaleString()} credits</p>
            {isLowBalance && <p className="text-orange-400">Low balance - tap to top up</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Desktop version - full display with dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          data-testid="button-credit-menu"
        >
          <Coins className={`w-4 h-4 ${isLowBalance ? 'text-orange-400' : 'text-white'}`} />
          <span className={`text-sm font-medium ${isLowBalance ? 'text-orange-400' : 'text-white'}`}>
            {balance.toLocaleString()}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => navigate("/buy-credits")}
          className="cursor-pointer"
          data-testid="link-buy-credits"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('buyCredits.buyMoreCredits')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});