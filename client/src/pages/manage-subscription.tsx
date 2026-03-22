import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Crown, Check, AlertCircle, Calendar, WalletCards as CreditCard, ArrowRight, Loader2, XCircle, RefreshCw, WandSparkles as Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { SubscriptionPlan } from "@shared/schema";

interface UserSubscription {
  id: number;
  userId: string;
  planId: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan?: SubscriptionPlan;
}

interface SubscriptionResponse {
  plan: SubscriptionPlan | null;
  status: string;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  cancelAtPeriodEnd?: boolean;
  id?: number;
}

export default function ManageSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<SubscriptionPlan | null>(null);

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated,
  });

  const { data: allPlans, isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription/plans"],
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/cancel");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setShowCancelDialog(false);
      toast({
        title: t('subscription.cancelSuccess', 'Subscription Cancelled'),
        description: t('subscription.cancelSuccessDesc', 'Your subscription will end at the current billing period.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('subscription.cancelError', 'Cancellation Failed'),
        description: error.message || t('subscription.cancelErrorDesc', 'Failed to cancel subscription. Please try again.'),
        variant: "destructive",
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/reactivate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setShowReactivateDialog(false);
      toast({
        title: t('subscription.reactivateSuccess', 'Subscription Reactivated'),
        description: t('subscription.reactivateSuccessDesc', 'Your subscription will continue as normal.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('subscription.reactivateError', 'Reactivation Failed'),
        description: error.message || t('subscription.reactivateErrorDesc', 'Failed to reactivate subscription. Please try again.'),
        variant: "destructive",
      });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ planId, isAnnual }: { planId: number; isAnnual: boolean }) => {
      const response = await apiRequest("POST", "/api/stripe/checkout/subscription", { planId, isAnnual });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: t('subscription.changeError', 'Plan Change Failed'),
        description: error.message || t('subscription.changeErrorDesc', 'Failed to change plan. Please try again.'),
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || !user) {
    setLocation("/");
    return null;
  }

  const currentPlan = subscription?.plan;
  const isFreePlan = currentPlan?.isFree || subscription?.status === "free";
  const isCancelling = subscription?.cancelAtPeriodEnd;
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;

  const activePlans = allPlans?.filter(p => p.isActive && p.billingPeriodMonths === 1) || [];

  const getPlanType = (plan: SubscriptionPlan): 'current' | 'upgrade' | 'downgrade' | 'same' => {
    if (!currentPlan) return plan.isFree ? 'current' : 'upgrade';
    if (plan.id === currentPlan.id) return 'current';
    if (plan.priceCents > (currentPlan.priceCents || 0)) return 'upgrade';
    if (plan.priceCents < (currentPlan.priceCents || 0)) return 'downgrade';
    return 'same';
  };

  const handlePlanChange = (plan: SubscriptionPlan) => {
    setSelectedUpgradePlan(plan);
  };

  const confirmPlanChange = () => {
    if (selectedUpgradePlan) {
      changePlanMutation.mutate({ planId: selectedUpgradePlan.id, isAnnual: false });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/profile")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.backToProfile', 'Back to Profile')}
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('subscription.manageTitle', 'Manage Your Subscription')}</h1>
          <p className="text-gray-400">{t('subscription.manageDesc', 'View your current plan, upgrade, downgrade, or cancel your subscription.')}</p>
        </div>

        {isLoadingSubscription ? (
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-48 bg-gray-700" />
                <Skeleton className="h-4 w-64 bg-gray-700" />
                <Skeleton className="h-4 w-32 bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gray-800/50 border-gray-700 mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-xl flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      {t('subscription.currentPlan', 'Current Plan')}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-1">
                      {t('subscription.yourActiveSubscription', 'Your active subscription details')}
                    </CardDescription>
                  </div>
                  {!isFreePlan && (
                    <Badge className={isCancelling ? "bg-orange-600" : "bg-emerald-600"}>
                      {isCancelling 
                        ? t('subscription.cancelling', 'Cancelling') 
                        : t('subscription.active', 'Active')}
                    </Badge>
                  )}
                  {isFreePlan && (
                    <Badge variant="secondary">{t('subscription.free', 'Free')}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {currentPlan?.displayName || currentPlan?.name || t('subscription.freeTrial', 'Free Trial')}
                      </h3>
                      {currentPlan?.includedCredits && currentPlan.includedCredits > 0 && (
                        <p className="text-gray-400 mt-1">
                          {t('subscription.creditsPerMonth', '{{credits}} credits/month', { credits: currentPlan.includedCredits })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {isFreePlan ? t('subscription.freePrice', '$0.00') : formatPrice(currentPlan?.priceCents || 0)}
                        <span className="text-sm text-gray-400 font-normal">/mo</span>
                      </div>
                    </div>
                  </div>

                  {!isFreePlan && periodEnd && (
                    <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-white font-medium">
                          {isCancelling 
                            ? t('subscription.endsOn', 'Subscription ends on')
                            : t('subscription.renewsOn', 'Next billing date')}
                        </p>
                        <p className="text-gray-400">{format(periodEnd, 'MMMM d, yyyy')}</p>
                      </div>
                    </div>
                  )}

                  {isCancelling && (
                    <Alert className="bg-orange-900/20 border-orange-600">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <AlertDescription className="text-orange-300">
                        {t('subscription.cancellingWarning', 'Your subscription is set to cancel at the end of the billing period. You will lose access to premium features after {{date}}.', 
                          { date: periodEnd ? format(periodEnd, 'MMMM d, yyyy') : '' })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {currentPlan?.featureFlags ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3">{String(t('subscription.includedFeatures', 'Included Features'))}</h4>
                      <div className="flex flex-wrap gap-2">
                        {(currentPlan.featureFlags as Record<string, boolean>).image_generation && (
                          <Badge variant="outline" className="text-gray-300 border-gray-600">
                            {String(t('subscription.imageGeneration', 'Image Generation'))}
                          </Badge>
                        )}
                        {(currentPlan.featureFlags as Record<string, boolean>).video_generation && (
                          <Badge variant="outline" className="text-gray-300 border-gray-600">
                            {String(t('subscription.videoGeneration', 'Video Generation'))}
                          </Badge>
                        )}
                        {(currentPlan.featureFlags as Record<string, boolean>).film_studio && (
                          <Badge variant="outline" className="text-gray-300 border-gray-600">
                            {String(t('subscription.filmStudio', 'Film Studio'))}
                          </Badge>
                        )}
                        {(currentPlan.featureFlags as Record<string, boolean>).can_make_private && (
                          <Badge variant="outline" className="text-gray-300 border-gray-600">
                            {String(t('subscription.privateContent', 'Private Content'))}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 border-t border-gray-700 pt-6">
                {!isFreePlan && !isCancelling && (
                  <Button 
                    variant="outline" 
                    className="border-red-600 text-red-400 hover:bg-red-900/20"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('subscription.cancelSubscription', 'Cancel Subscription')}
                  </Button>
                )}
                {isCancelling && (
                  <Button 
                    variant="outline" 
                    className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20"
                    onClick={() => setShowReactivateDialog(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('subscription.reactivate', 'Reactivate Subscription')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        )}

        <Separator className="bg-gray-700 my-8" />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{t('subscription.availablePlans', 'Available Plans')}</h2>
          <p className="text-gray-400">{t('subscription.choosePlan', 'Choose a plan that fits your needs')}</p>
        </div>

        {isLoadingPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700">
                <CardContent className="py-8">
                  <Skeleton className="h-6 w-24 bg-gray-700 mb-4" />
                  <Skeleton className="h-8 w-20 bg-gray-700 mb-4" />
                  <Skeleton className="h-4 w-full bg-gray-700" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activePlans.map((plan, index) => {
              const planType = getPlanType(plan);
              const isCurrent = planType === 'current';
              const isUpgrade = planType === 'upgrade';
              const isDowngrade = planType === 'downgrade';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card 
                    className={`relative h-full flex flex-col ${
                      isCurrent 
                        ? 'border-emerald-500 bg-emerald-900/10' 
                        : 'border-gray-700 bg-gray-800/50'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-600">
                          {t('subscription.currentPlanBadge', 'Current Plan')}
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        {plan.displayName || plan.name}
                        {plan.name.toLowerCase().includes('pro') && <Crown className="h-4 w-4 text-amber-500" />}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1">
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">
                          {formatPrice(plan.priceCents)}
                        </span>
                        <span className="text-gray-400">/mo</span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-400" />
                          <span className="text-gray-300">
                            {plan.includedCredits.toLocaleString()} {t('subscription.credits', 'credits')}/mo
                          </span>
                        </div>
                        
                        {plan.featureFlags ? Object.entries(plan.featureFlags as Record<string, boolean>)
                          .filter(([, value]) => value === true)
                          .slice(0, 4)
                          .map(([key]) => {
                            const label = key.replace(/_/g, ' ');
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-400" />
                                <span className="text-gray-300 text-sm capitalize">
                                  {label}
                                </span>
                              </div>
                            );
                          }) : null}
                      </div>
                    </CardContent>

                    <CardFooter>
                      {isCurrent ? (
                        <Button disabled className="w-full" variant="outline">
                          <Check className="h-4 w-4 mr-2" />
                          {t('subscription.currentPlanButton', 'Current Plan')}
                        </Button>
                      ) : (
                        <Button 
                          className="w-full"
                          variant={isUpgrade ? "default" : "outline"}
                          onClick={() => handlePlanChange(plan)}
                          disabled={changePlanMutation.isPending}
                        >
                          {changePlanMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {isUpgrade && t('subscription.upgrade', 'Upgrade')}
                              {isDowngrade && t('subscription.downgrade', 'Downgrade')}
                              {!isUpgrade && !isDowngrade && t('subscription.switchTo', 'Switch to')}
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">{t('subscription.confirmCancel', 'Cancel Subscription?')}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('subscription.confirmCancelDesc', 'Your subscription will remain active until the end of your current billing period on {{date}}. After that, you will lose access to premium features.', 
                  { date: periodEnd ? format(periodEnd, 'MMMM d, yyyy') : '' })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                {t('common.keepSubscription', 'Keep Subscription')}
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {t('subscription.confirmCancelButton', 'Yes, Cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">{t('subscription.confirmReactivate', 'Reactivate Subscription?')}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('subscription.confirmReactivateDesc', 'Your subscription will continue as normal and you will be billed on your next billing date.')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button variant="outline" onClick={() => setShowReactivateDialog(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t('subscription.confirmReactivateButton', 'Reactivate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedUpgradePlan} onOpenChange={() => setSelectedUpgradePlan(null)}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedUpgradePlan && getPlanType(selectedUpgradePlan) === 'upgrade'
                  ? t('subscription.confirmUpgrade', 'Upgrade to {{plan}}?', { plan: selectedUpgradePlan?.displayName || selectedUpgradePlan?.name })
                  : t('subscription.confirmDowngrade', 'Downgrade to {{plan}}?', { plan: selectedUpgradePlan?.displayName || selectedUpgradePlan?.name })}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {selectedUpgradePlan && getPlanType(selectedUpgradePlan) === 'upgrade'
                  ? t('subscription.upgradeDesc', 'You will be redirected to complete your upgrade. Your new plan will include {{credits}} credits per month.', 
                      { credits: selectedUpgradePlan?.includedCredits.toLocaleString() })
                  : t('subscription.downgradeDesc', 'You will be redirected to complete your plan change. Your new plan will include {{credits}} credits per month.', 
                      { credits: selectedUpgradePlan?.includedCredits.toLocaleString() })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button variant="outline" onClick={() => setSelectedUpgradePlan(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button 
                onClick={confirmPlanChange}
                disabled={changePlanMutation.isPending}
              >
                {changePlanMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {t('subscription.proceedToCheckout', 'Proceed to Checkout')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
