import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ArrowRight, WandSparkles as Sparkles, Crown, Zap, Star, TrendingUp, Film, Lock, Clapperboard as Video, Shield, WalletCards as CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { 
  PricingPageConfig, 
  PricingFaqItem, 
  PlanDisplayOverride,
  CreditPackDisplayOverride,
  UpgradeReasonMapping,
  SubscriptionPlan,
  TopupPack
} from "@shared/schema";

type FullPricingData = {
  config: PricingPageConfig | null;
  plans: (SubscriptionPlan & { displayOverride?: PlanDisplayOverride; annualVariant?: SubscriptionPlan })[];
  creditPacks: (TopupPack & { displayOverride?: CreditPackDisplayOverride })[];
  faqItems: PricingFaqItem[];
  comparisonSections: any[];
  upgradeReasonMappings: UpgradeReasonMapping[];
};

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  role?: string;
}

const iconMap: Record<string, any> = {
  Video: Video,
  Film: Film,
  Lock: Lock,
  Crown: Crown,
  Sparkles: Sparkles,
  Zap: Zap,
  Star: Star,
  Shield: Shield,
  TrendingUp: TrendingUp,
};

export default function PricingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar' || i18n.dir() === 'rtl';
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const params = new URLSearchParams(searchString);
  const upgradeParam = params.get('upgrade');
  const reasonParam = params.get('reason');

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annually'>('monthly');

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: pricingData, isLoading } = useQuery<FullPricingData>({
    queryKey: ["/api/pricing-page/public"],
  });

  const { data: upgradeReason } = useQuery<UpgradeReasonMapping>({
    queryKey: ["/api/pricing-page/upgrade-reason", reasonParam],
    enabled: !!reasonParam,
    queryFn: async () => {
      const res = await fetch(`/api/pricing-page/upgrade-reason/${reasonParam}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (pricingData?.config?.defaultBillingView) {
      setBillingPeriod(pricingData.config.defaultBillingView as 'monthly' | 'annually');
    }
  }, [pricingData]);

  const subscriptionCheckout = useMutation({
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
        title: "Checkout Error",
        description: error.message || "Failed to start checkout",
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
        title: "Checkout Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  // Query user entitlements to check subscription status
  const { data: entitlements } = useQuery<{ plan?: { name: string } }>({
    queryKey: ["/api/me/entitlements"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/me/entitlements");
      if (!response.ok) return null;
      return response.json();
    },
  });

  const isPaidPlan = entitlements?.plan?.name && 
    !entitlements.plan.name.toLowerCase().includes('free') &&
    !entitlements.plan.name.toLowerCase().includes('trial');

  const handleSubscribe = (planId: number, isAnnual: boolean) => {
    if (!user) {
      window.location.href = `/api/login`;
      return;
    }
    
    if (config?.subscriptionComingSoon) {
      const message = isRtl && config?.comingSoonMessageAr 
        ? config.comingSoonMessageAr 
        : (config?.comingSoonMessage || "Coming soon, we are currently in beta testing stage");
      toast({
        title: t('pricing.comingSoon', 'Coming Soon') as string,
        description: message,
        variant: "warning",
        persistent: true,
      });
      return;
    }
    
    subscriptionCheckout.mutate({ planId, isAnnual });
  };

  const handleBuyPack = (packId: number) => {
    if (!user) {
      window.location.href = `/api/login`;
      return;
    }
    // Check if user has a paid plan
    if (!isPaidPlan) {
      toast({
        title: t('pricing.paidPlanRequired', 'Paid Plan Required') as string,
        description: t('pricing.paidPlanRequiredDescription', 'Credit packs are only available for users with a paid subscription. Please subscribe to a plan first.') as string,
        variant: "warning",
        persistent: true,
      });
      return;
    }
    topupCheckout.mutate({ packId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const config = pricingData?.config;
  const plans = pricingData?.plans || [];
  const creditPacks = pricingData?.creditPacks || [];
  const faqItems = pricingData?.faqItems || [];
  const comparisonSections = pricingData?.comparisonSections || [];

  const monthlyPlans = plans.filter(p => p.billingPeriodMonths === 1 && p.isActive);
  const featuredPlanId = config?.featuredPlanId;

  const getDisplayPrice = (plan: typeof plans[0]) => {
    if (billingPeriod === 'annually' && plan.annualPriceCents) {
      const hasDiscount = plan.discountActive && plan.discountAnnualPriceCents && plan.discountAnnualPriceCents < plan.annualPriceCents;
      return {
        priceCents: hasDiscount ? plan.discountAnnualPriceCents! : plan.annualPriceCents,
        pricePerMonth: Math.round((hasDiscount ? plan.discountAnnualPriceCents! : plan.annualPriceCents) / 12),
        isAnnual: true,
        stripePriceId: plan.annualStripePriceId || plan.stripePriceId,
        originalPriceCents: hasDiscount ? plan.annualPriceCents : undefined,
        discountPercent: hasDiscount ? Math.round((1 - plan.discountAnnualPriceCents! / plan.annualPriceCents) * 100) : undefined,
        hasDiscount,
      };
    }
    const hasDiscount = plan.discountActive && plan.discountPriceCents && plan.discountPriceCents < plan.priceCents;
    return {
      priceCents: hasDiscount ? plan.discountPriceCents! : plan.priceCents,
      pricePerMonth: hasDiscount ? plan.discountPriceCents! : plan.priceCents,
      isAnnual: false,
      stripePriceId: plan.stripePriceId,
      originalPriceCents: hasDiscount ? plan.priceCents : undefined,
      discountPercent: hasDiscount ? Math.round((1 - plan.discountPriceCents! / plan.priceCents) * 100) : undefined,
      hasDiscount,
    };
  };

  const ReasonIcon = reasonParam && upgradeReason?.icon ? iconMap[upgradeReason.icon] : Sparkles;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.18),transparent_38%),linear-gradient(180deg,#030815_0%,#061126_48%,#030815_100%)]" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="container max-w-7xl mx-auto px-4 py-12 md:py-20">
        {upgradeParam === '1' && upgradeReason && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-xl bg-gradient-to-r from-[#1F56F5]/15 via-[#1F56F5]/10 to-transparent border border-[#1F56F5]/30"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-[#1F56F5]/20">
                <ReasonIcon className="h-6 w-6 text-[#21B0F8]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-100" data-testid="text-upgrade-reason-title">
                  {isRtl && upgradeReason.titleAr ? upgradeReason.titleAr : upgradeReason.title}
                </h3>
                <p className="text-slate-300 mt-1" data-testid="text-upgrade-reason-description">
                  {isRtl && upgradeReason.descriptionAr ? upgradeReason.descriptionAr : upgradeReason.description}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-slate-50 mb-4"
            data-testid="text-page-title"
          >
            {isRtl && config?.pageTitleAr ? config.pageTitleAr : (config?.pageTitle || "Choose Your Plan")}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-300 max-w-2xl mx-auto"
            data-testid="text-page-subtitle"
          >
            {isRtl && config?.pageSubtitleAr ? config.pageSubtitleAr : (config?.pageSubtitle || "Unlock the full power of AI-generated content")}
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-12"
          dir="ltr"
        >
          <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-slate-100' : 'text-slate-400'}`}>
            {t('pricing.monthly', 'Monthly')}
          </span>
          <Switch
            checked={billingPeriod === 'annually'}
            onCheckedChange={(checked) => setBillingPeriod(checked ? 'annually' : 'monthly')}
            data-testid="switch-billing-period"
          />
          <span className={`text-sm font-medium ${billingPeriod === 'annually' ? 'text-slate-100' : 'text-slate-400'}`}>
            {t('pricing.annually', 'Annually')}
          </span>
          <Badge 
            variant="outline"
            className={billingPeriod === 'annually' ? '!bg-green-500 !text-white !border-green-600' : '!bg-zinc-700 !text-zinc-300 !border-zinc-600'}
          >
            {t('pricing.save', 'Save')} <span style={{ unicodeBidi: 'embed', direction: 'ltr' }}>20%</span>
          </Badge>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {monthlyPlans.map((plan, index) => {
            const priceInfo = getDisplayPrice(plan);
            const override = plan.displayOverride;
            const isFeatured = plan.id === featuredPlanId;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card 
                  className={`relative h-full flex flex-col overflow-visible pt-2 border ${isFeatured ? 'bg-gradient-to-b from-[#1e3a66]/95 via-[#152f53]/95 to-[#0b1528]/95 border-[#1F56F5]/45 shadow-[0_0_45px_rgba(31,86,245,0.24)] scale-[1.03]' : 'bg-[#070d1d]/92 border-white/12 shadow-[0_14px_30px_rgba(2,6,23,0.55)]'}`}
                  data-testid={`card-plan-${plan.id}`}
                >
                  {(override?.badgeText || isFeatured) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#1F56F5] text-slate-950 px-4 py-1 border border-[#1F56F5]/70">
                        {isRtl && override?.badgeTextAr ? override.badgeTextAr : (override?.badgeText || 'Most Popular')}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-slate-100">
                        {isRtl && plan.displayNameAr ? plan.displayNameAr : (plan.displayName || plan.name)}
                      </CardTitle>
                      {plan.name.toLowerCase().includes('pro') && <Crown className="h-5 w-5 text-amber-500" />}
                      {plan.name.toLowerCase().includes('basic') && <Zap className="h-5 w-5 text-blue-500" />}
                    </div>
                    {(override?.marketingLabel || (isRtl && plan.descriptionAr) || plan.description) && (
                      <CardDescription className="text-slate-300/90">
                        {isRtl && override?.marketingLabelAr 
                          ? override.marketingLabelAr 
                          : override?.marketingLabel 
                            ? override.marketingLabel 
                            : isRtl && plan.descriptionAr 
                              ? plan.descriptionAr 
                              : plan.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 text-slate-200">
                    <div className="mb-6">
                      {priceInfo.hasDiscount && priceInfo.originalPriceCents && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg text-slate-400 line-through">
                            {formatPrice(priceInfo.isAnnual ? Math.round(priceInfo.originalPriceCents / 12) : priceInfo.originalPriceCents)}
                          </span>
                          <Badge className="bg-orange-500 text-white">
                            {priceInfo.discountPercent}% {t('pricing.off', 'OFF')}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-slate-50">
                          {formatPrice(priceInfo.pricePerMonth)}
                        </span>
                        <span className="text-slate-300">/{t('pricing.month', 'mo')}</span>
                      </div>
                      {priceInfo.isAnnual && (
                        <p className="text-sm text-slate-400 mt-1">
                          {t('pricing.billedAnnually', {price: formatPrice(priceInfo.priceCents), defaultValue: `Billed ${formatPrice(priceInfo.priceCents)} annually`})}
                        </p>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-slate-100 mb-3">
                      {t('pricing.whatsIncluded', "What's included")}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#21B0F8]" />
                        <span className="font-medium">{plan.includedCredits.toLocaleString()} {t('pricing.credits', 'credits')}</span>
                        <span className="text-slate-400 text-sm">/ {t('pricing.month', 'month')}</span>
                      </div>
                      
                      {/* Use admin-defined features if available, otherwise fall back to featureFlags */}
                      {(() => {
                        const features = isRtl && override?.highlightFeaturesAr && Array.isArray(override.highlightFeaturesAr) && override.highlightFeaturesAr.length > 0
                          ? override.highlightFeaturesAr as string[]
                          : override?.highlightFeatures && Array.isArray(override.highlightFeatures) && override.highlightFeatures.length > 0
                            ? override.highlightFeatures as string[]
                            : null;
                        
                        if (features) {
                          return features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-[#21B0F8]" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ));
                        }
                        
                        // Fallback to featureFlags with labels
                        const featureLabels: Record<string, string> = {
                          image_generation: t('pricing.features.imageGeneration', 'Image Generation') as string,
                          video_generation: t('pricing.features.videoGeneration', 'Video Generation') as string,
                          can_make_private: t('pricing.features.privateContent', 'Private Content') as string,
                          film_studio: t('pricing.features.filmStudio', 'Film Studio Access') as string,
                          can_use_premium_models: t('pricing.features.premiumModels', 'Premium AI Models') as string,
                          can_batch_generate: t('pricing.features.batchGeneration', 'Batch Generation') as string,
                        };
                        
                        if (!plan.featureFlags) return null;
                        return Object.entries(plan.featureFlags as Record<string, boolean>)
                          .filter(([, value]) => value === true)
                          .map(([key]) => (
                            <div key={key} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-[#21B0F8]" />
                              <span className="text-sm">{featureLabels[key] || key}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button 
                      className="w-full font-semibold"
                      variant="default"
                      onClick={() => handleSubscribe(plan.id, priceInfo.isAnnual)}
                      disabled={subscriptionCheckout.isPending}
                      data-testid={`button-subscribe-${plan.id}`}
                    >
                      {subscriptionCheckout.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {user ? t('pricing.subscribe', 'Subscribe') : t('pricing.getStarted', 'Get Started')}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {config?.showCreditPacks !== false && creditPacks.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-credit-packs-title">
                {t('pricing.needMoreCredits', 'Need More Credits?')}
              </h2>
              <p className="text-muted-foreground">
                {t('pricing.creditPacksDescription', 'Top up your account with credit packs')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPacks.filter(p => p.isActive && p.displayOverride?.isVisible !== false).map((pack, index) => {
                const override = pack.displayOverride;
                return (
                  <motion.div
                    key={pack.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card className="relative h-full hover:border-primary/50 transition-colors" data-testid={`card-pack-${pack.id}`}>
                      {override?.badgeText && (
                        <div className="absolute -top-2 right-4">
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                            {isRtl && override?.badgeTextAr ? override.badgeTextAr : override.badgeText}
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="h-5 w-5 text-amber-500" />
                          {pack.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold mb-1">
                          {pack.creditsAmount.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground text-sm mb-4">
                          {t('pricing.credits', 'credits')}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatPrice(pack.priceCents)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('pricing.expiresIn', 'Expires in')} {pack.expiresInDays} {t('pricing.days', 'days')}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => handleBuyPack(pack.id)}
                          disabled={topupCheckout.isPending}
                          data-testid={`button-buy-pack-${pack.id}`}
                        >
                          {topupCheckout.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPaidPlan ? (
                            <>
                              <CreditCard className="h-4 w-4 mr-2" />
                              {t('pricing.buyNow', 'Buy Now')}
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              {t('pricing.paidPlanRequired', 'Paid Plan Required')}
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {comparisonSections.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-comparison-title">
                {t('pricing.compareFeatures', 'Compare Features')}
              </h2>
              <p className="text-muted-foreground">
                {t('pricing.compareFeaturesDescription', 'See what each plan offers')}
              </p>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">{t('pricing.feature', 'Feature')}</TableHead>
                      {monthlyPlans.map(plan => (
                        <TableHead key={plan.id} className="text-center">
                          {plan.displayName || plan.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonSections.map(section => (
                      <>
                        <TableRow key={`section-${section.id}`} className="bg-muted/50">
                          <TableCell colSpan={monthlyPlans.length + 1} className="font-semibold">
                            {isRtl && section.titleAr ? section.titleAr : section.title}
                          </TableCell>
                        </TableRow>
                        {section.rows?.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              {isRtl && row.labelAr ? row.labelAr : row.label}
                            </TableCell>
                            {monthlyPlans.map(plan => {
                              const cell = row.cells?.find((c: any) => c.planId === plan.id);
                              if (row.rowType === 'boolean') {
                                return (
                                  <TableCell key={plan.id} className="text-center">
                                    {cell?.valueBoolean ? (
                                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                                    ) : (
                                      <X className="h-5 w-5 text-muted-foreground mx-auto" />
                                    )}
                                  </TableCell>
                                );
                              }
                              return (
                                <TableCell key={plan.id} className="text-center">
                                  {isRtl && cell?.valueTextAr ? cell.valueTextAr : (cell?.valueText || '-')}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {faqItems.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-faq-title">
                {t('pricing.frequentlyAsked', 'Frequently Asked Questions')}
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={item.id} value={`item-${item.id}`}>
                  <AccordionTrigger className="text-left" data-testid={`accordion-faq-${item.id}`}>
                    {isRtl && item.questionAr ? item.questionAr : item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {isRtl && item.answerAr ? item.answerAr : item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {config?.smallNote && (
          <div className="text-center mt-12 text-sm text-muted-foreground">
            {isRtl && config?.smallNoteAr ? config.smallNoteAr : config.smallNote}
          </div>
        )}
      </div>
    </div>
  );
}

