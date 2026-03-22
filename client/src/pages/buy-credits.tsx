import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, AlertCircle, CheckCircle, XCircle, Timer as Clock, WalletCards as CreditCard, Zap, Crown, WandSparkles as Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface CreditRequest {
  id: number;
  message: string;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAmount?: number;
  adminNote?: string;
  processedAt?: string;
  createdAt: string;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  priceCents: number;
  includedCredits: number;
  billingPeriodMonths: number;
  featureFlags: Record<string, boolean>;
  stripePriceId: string | null;
  isActive: boolean;
}

interface TopupPack {
  id: number;
  name: string;
  creditsAmount: number;
  priceCents: number;
  expiresInDays: number;
  stripePriceId: string | null;
  isActive: boolean;
}

interface StripeStatus {
  configured: boolean;
}

export default function BuyCredits() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const { toast } = useToast();

  const { data: stripeStatus } = useQuery<StripeStatus>({
    queryKey: ["/api/stripe/status"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: packs, isLoading: packsLoading } = useQuery<TopupPack[]>({
    queryKey: ["/api/topup-packs"],
  });

  const { data: myRequests } = useQuery<CreditRequest[]>({
    queryKey: ["/api/credit-requests"],
    queryFn: async () => {
      const response = await fetch("/api/credit-requests");
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 10000,
  });

  const subscriptionCheckout = useMutation({
    mutationFn: async ({ planId, couponCode }: { planId: number; couponCode?: string }) => {
      const response = await apiRequest("POST", "/api/stripe/checkout/subscription", { planId, couponCode });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: t('buyCredits.checkoutError'),
        description: error.message || t('buyCredits.checkoutErrorDescription'),
        variant: "destructive",
      });
    },
  });

  const topupCheckout = useMutation({
    mutationFn: async ({ packId }: { packId: number }) => {
      const response = await apiRequest("POST", "/api/stripe/checkout/topup", { packId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: t('buyCredits.checkoutError'),
        description: error.message || t('buyCredits.checkoutErrorDescription'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: t('toasts.messageRequired'),
        description: t('toasts.messageRequiredDescription'),
        variant: "error-outline"
      });
      return;
    }

    const amount = parseInt(requestedAmount);
    if (!requestedAmount || isNaN(amount) || amount <= 0) {
      toast({
        title: t('toasts.invalidAmount'),
        description: t('toasts.invalidAmountDescription'),
        variant: "error-outline"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/credit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          requestedAmount: amount,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit credit request');
      }
      
      toast({
        title: t('toasts.requestSent'),
        description: t('toasts.requestSentDescription'),
        variant: "default"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/credit-requests"] });
      
      setMessage("");
      setRequestedAmount("");
    } catch (error) {
      console.error("Error submitting credit request:", error);
      toast({
        title: t('toasts.error'),
        description: t('toasts.failedToSendRequest'),
        variant: "error-outline"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { formatPrice } = useCurrency();

  const getBillingPeriodLabel = (months: number) => {
    if (months === 1) return t('buyCredits.perMonth');
    if (months === 12) return t('buyCredits.perYear');
    return t('buyCredits.everyNMonths', { n: months });
  };

  const stripeConfigured = stripeStatus?.configured ?? false;
  const activePlans = plans?.filter(p => p.isActive && p.stripePriceId) || [];
  const activePacks = packs?.filter(p => p.isActive && p.stripePriceId) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('buyCredits.title')}</h1>
          <p className="text-muted-foreground">{t('buyCredits.subtitle')}</p>
        </div>

        {stripeConfigured && (activePlans.length > 0 || activePacks.length > 0) ? (
          <Tabs defaultValue="subscriptions" className="mb-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
                <Crown className="h-4 w-4 mr-2" />
                {t('buyCredits.subscriptions')}
              </TabsTrigger>
              <TabsTrigger value="credits" data-testid="tab-credits">
                <Zap className="h-4 w-4 mr-2" />
                {t('buyCredits.creditPacks')}
              </TabsTrigger>
              <TabsTrigger value="request" data-testid="tab-request">
                <Send className="h-4 w-4 mr-2" />
                {t('buyCredits.requestCredits')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subscriptions" className="mt-6">
              {plansLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activePlans.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('buyCredits.noPlansAvailable')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activePlans.map((plan) => (
                    <Card key={plan.id} className="relative flex flex-col" data-testid={`plan-card-${plan.id}`}>
                      {plan.featureFlags?.popular && (
                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {t('buyCredits.popular')}
                        </Badge>
                      )}
                      <CardHeader>
                        <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                        <CardDescription>{plan.name}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="mb-4">
                          <span className="text-3xl font-bold">{formatPrice(plan.priceCents)}</span>
                          <span className="text-muted-foreground ml-1">{getBillingPeriodLabel(plan.billingPeriodMonths)}</span>
                        </div>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{t('buyCredits.creditsIncluded', { amount: plan.includedCredits })}</span>
                          </li>
                          {plan.featureFlags?.video_generation && (
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>{t('buyCredits.videoGeneration')}</span>
                            </li>
                          )}
                          {plan.featureFlags?.film_studio && (
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>{t('buyCredits.filmStudio')}</span>
                            </li>
                          )}
                          {plan.featureFlags?.can_make_private && (
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>{t('buyCredits.privateGallery')}</span>
                            </li>
                          )}
                        </ul>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                        <div className="w-full">
                          <Input
                            placeholder={t('buyCredits.couponPlaceholder')}
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="mb-2"
                            data-testid={`coupon-input-${plan.id}`}
                          />
                        </div>
                        <Button 
                          className="w-full"
                          disabled={subscriptionCheckout.isPending}
                          onClick={() => subscriptionCheckout.mutate({ planId: plan.id, couponCode: couponCode || undefined })}
                          data-testid={`subscribe-button-${plan.id}`}
                        >
                          {subscriptionCheckout.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          {t('buyCredits.subscribe')}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credits" className="mt-6">
              {packsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activePacks.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('buyCredits.noPacksAvailable')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activePacks.map((pack) => (
                    <Card key={pack.id} className="flex flex-col" data-testid={`pack-card-${pack.id}`}>
                      <CardHeader>
                        <CardTitle className="text-xl">{pack.name}</CardTitle>
                        <CardDescription>
                          {t('buyCredits.creditsExpireIn', { days: pack.expiresInDays })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="mb-4">
                          <span className="text-3xl font-bold">{formatPrice(pack.priceCents)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-lg">
                          <Zap className="h-5 w-5 text-yellow-500" />
                          <span className="font-semibold">{pack.creditsAmount} {t('buyCredits.credits')}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {formatPrice(Math.round(pack.priceCents / pack.creditsAmount * 100) / 100)} {t('buyCredits.perCredit')}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          className="w-full"
                          disabled={topupCheckout.isPending}
                          onClick={() => topupCheckout.mutate({ packId: pack.id })}
                          data-testid={`buy-pack-button-${pack.id}`}
                        >
                          {topupCheckout.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          {t('buyCredits.buyNow')}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="request" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('buyCredits.requestCreditsTitle')}</CardTitle>
                  <CardDescription>{t('buyCredits.requestCreditsDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <CreditRequestForm
                    message={message}
                    setMessage={setMessage}
                    requestedAmount={requestedAmount}
                    setRequestedAmount={setRequestedAmount}
                    isSubmitting={isSubmitting}
                    handleSubmit={handleSubmit}
                    myRequests={myRequests}
                    t={t}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t('buyCredits.title')}</CardTitle>
              <CardDescription>{t('buyCredits.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <CreditRequestForm
                message={message}
                setMessage={setMessage}
                requestedAmount={requestedAmount}
                setRequestedAmount={setRequestedAmount}
                isSubmitting={isSubmitting}
                handleSubmit={handleSubmit}
                myRequests={myRequests}
                t={t}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreditRequestForm({
  message,
  setMessage,
  requestedAmount,
  setRequestedAmount,
  isSubmitting,
  handleSubmit,
  myRequests,
  t,
}: {
  message: string;
  setMessage: (value: string) => void;
  requestedAmount: string;
  setRequestedAmount: (value: string) => void;
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  myRequests?: CreditRequest[];
  t: (key: string, options?: any) => string;
}) {
  return (
    <div className="space-y-6">
      {myRequests && myRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">{t('buyCredits.recentRequests')}</h3>
          <div className="space-y-2">
            {myRequests.slice(0, 5).map((request) => {
              const getStatusIcon = () => {
                switch (request.status) {
                  case 'approved':
                    return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />;
                  case 'rejected':
                    return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
                  default:
                    return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />;
                }
              };

              const getStatusBadge = () => {
                switch (request.status) {
                  case 'approved':
                    return <Badge variant="default" className="capitalize bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">{t('buyCredits.statusApproved')}</Badge>;
                  case 'rejected':
                    return <Badge variant="destructive" className="capitalize">{t('buyCredits.statusRejected')}</Badge>;
                  default:
                    return <Badge variant="secondary" className="capitalize">{t('buyCredits.statusPending')}</Badge>;
                }
              };

              const getBgColor = () => {
                switch (request.status) {
                  case 'approved':
                    return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';
                  case 'rejected':
                    return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
                  default:
                    return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900';
                }
              };

              const getTextColor = () => {
                switch (request.status) {
                  case 'approved':
                    return 'text-green-900 dark:text-green-100';
                  case 'rejected':
                    return 'text-red-900 dark:text-red-100';
                  default:
                    return 'text-yellow-900 dark:text-yellow-100';
                }
              };

              return (
                <div 
                  key={request.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg ${getBgColor()}`}
                  data-testid={`request-${request.id}`}
                >
                  {getStatusIcon()}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${getTextColor()}`}>
                        {t('buyCredits.creditsRequested', { amount: request.requestedAmount })}
                      </span>
                      {getStatusBadge()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {request.status === 'approved' && request.approvedAmount && (
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        {t('buyCredits.creditsAdded', { amount: request.approvedAmount })}
                      </p>
                    )}
                    {request.adminNote && (
                      <p className="text-sm text-muted-foreground italic mt-1">
                        {t('buyCredits.adminNote', { note: request.adminNote })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {t('buyCredits.closedBetaTitle')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {t('buyCredits.closedBetaDescription')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="requestedAmount">
            {t('buyCredits.requestedAmountLabel')}
          </Label>
          <Input
            id="requestedAmount"
            type="number"
            min="1"
            placeholder={t('buyCredits.requestedAmountPlaceholder')}
            value={requestedAmount}
            onChange={(e) => setRequestedAmount(e.target.value)}
            data-testid="input-requested-amount"
          />
          <p className="text-sm text-muted-foreground">
            {t('buyCredits.requestedAmountHint')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">
            {t('buyCredits.messageLabel')}
          </Label>
          <Textarea
            id="message"
            placeholder={t('buyCredits.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="resize-none"
            data-testid="input-message"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting || !message.trim() || !requestedAmount}
          data-testid="button-submit-request"
        >
          {isSubmitting ? (
            <>
              <Send className="h-4 w-4 mr-2 animate-pulse" />
              {t('buyCredits.sending')}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {t('buyCredits.sendRequest')}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
