import { memo } from "react";
import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useCredits } from "@/contexts/CreditContext";

export const CreditBalance = memo(function CreditBalance() {
  const [, navigate] = useLocation();
  const { credits, isLoading } = useCredits();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  const balance = credits?.balance || 0;
  const isLowBalance = balance < 20;

  return (
    <Card className={`w-full ${isLowBalance ? 'border-orange-500' : 'border-gray-700'}`}>
      <CardContent className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className={`w-4 h-4 ${isLowBalance ? 'text-orange-500' : 'text-primary'}`} />
            <span className={`font-semibold ${isLowBalance ? 'text-orange-500' : 'text-white'}`}>
              {balance.toLocaleString()} credits
            </span>
          </div>
          {isLowBalance && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate("/pricing")}
              className="text-orange-500 border-orange-500 hover:bg-orange-50 h-6 px-2 text-xs"
            >
              Top Up
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});