import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Coins, Calendar, Timer as Clock, ChevronLeft, ChevronRight, WalletCards as CreditCard, AlertTriangle, ImagePlus as Image, Clapperboard as Video, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface CreditLedgerEntry {
  id: number;
  userId: string;
  sourceType: string;
  sourceId: string | null;
  amount: number;
  expiresAt: string | null;
  description: string | null;
  metadata: any;
  createdAt: string;
}

interface UsageHistoryResponse {
  entries: CreditLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalPointsConsumed: number;
}

interface ExpiringCreditsResponse {
  entries: CreditLedgerEntry[];
}

interface CreditLedgerResponse {
  entries: CreditLedgerEntry[];
  totalBalance: number;
}

export default function Credits() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: creditLedger, isLoading: isLoadingBalance } = useQuery<CreditLedgerResponse>({
    queryKey: ["/api/credits/ledger"],
    enabled: isAuthenticated,
  });

  const { data: expiringCredits, isLoading: isLoadingExpiring } = useQuery<ExpiringCreditsResponse>({
    queryKey: ["/api/credits/expiring"],
    enabled: isAuthenticated,
  });

  const { data: usageHistory, isLoading: isLoadingUsage } = useQuery<UsageHistoryResponse>({
    queryKey: [`/api/credits/usage?page=${currentPage}&pageSize=${pageSize}`],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  // Format model ID to user-friendly display name
  const formatModelName = (modelId: string): string => {
    if (!modelId || modelId === 'Unknown' || modelId === 'deduction') {
      return t('credits.unknownModel', 'Unknown');
    }
    
    // Model display name mappings
    const modelDisplayNames: Record<string, string> = {
      'fal-nano-banana-txt2img': 'Nano Banana',
      'fal-nano-banana-edit': 'Nano Banana',
      'fal-nano-banana-img2img': 'Nano Banana',
      'fal-nano-banana-pro': 'Nano Banana Pro',
      'fal-nano-banana-pro-txt2img': 'Nano Banana Pro',
      'fal-nano-banana-pro-edit': 'Nano Banana Pro',
      'fal-saudi-model': 'Saudi Model',
      'fal-saudi-model-pro': 'Saudi Model Pro',
      'fal-flux-schnell': 'Flux Schnell',
      'fal-flux-dev': 'Flux Dev',
      'fal-flux-pro': 'Flux Pro',
      'fal-z-image-turbo': 'Z-Image Turbo',
      'fal-seedream-4.5-txt2img': 'Seedream 4.5',
      'fal-seedream-4.5-img2img': 'Seedream 4.5',
      'fal-imagen-4': 'Imagen 4',
      'fal-imagen-4-fast': 'Imagen 4 Fast',
      'fal-gpt-image-1.5-txt2img-low': 'GPT Image 1.5',
      'fal-gpt-image-1.5-txt2img-high': 'GPT Image 1.5 HD',
      'wan-2.2-t2v-fast': 'WAN 2.2 Turbo',
      'wan-2.2-i2v-fast': 'WAN 2.2 Turbo',
      'wan-2.5-preview-t2v': 'WAN 2.5 Preview',
      'wan-2.5-preview-i2v': 'WAN 2.5 Preview',
      'wan-2.6-t2v': 'WAN 2.6',
      'wan-2.6-i2v': 'WAN 2.6',
      'fal-veo3-t2v': 'Veo 3',
      'fal-veo3-i2v': 'Veo 3',
      'fal-veo3-fast-t2v': 'Veo 3 Fast',
      'fal-veo3-fast-i2v': 'Veo 3 Fast',
      'fal-luma-dream-machine': 'Luma Dream Machine',
      'sora-2-text-to-video': 'Sora 2',
      'sora-2-image-to-video': 'Sora 2',
      'kling-2.6-pro-t2v': 'Kling 2.6 Pro',
      'kling-2.6-pro-i2v': 'Kling 2.6 Pro',
    };
    
    if (modelDisplayNames[modelId]) {
      return modelDisplayNames[modelId];
    }
    
    // Try to format unknown model IDs nicely
    return modelId
      .replace(/^fal-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const parseUsageEntry = (entry: CreditLedgerEntry) => {
    let operationType = t('credits.aiOperation', 'AI Operation');
    let model = t('credits.unknownModel', 'Unknown');
    
    try {
      if (entry.metadata) {
        const metadata = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
        if (metadata?.operationType) {
          operationType = metadata.operationType;
        }
        if (metadata?.model) {
          model = formatModelName(metadata.model);
        }
        if (metadata?.operation) {
          operationType = metadata.operation;
        }
      }
    } catch (e) {
      // Metadata parsing failed, use fallback from description
    }
    
    // If no model from metadata, try extracting from description
    if (model === t('credits.unknownModel', 'Unknown') && entry.description) {
      // Match "Image generation: model-name" or "Video generation: model-name"
      const descMatch = entry.description.match(/:\s*([^\s,]+)$/);
      if (descMatch) {
        model = formatModelName(descMatch[1]);
      }
    }
    
    if (entry.description && operationType === t('credits.aiOperation', 'AI Operation')) {
      const desc = entry.description.toLowerCase();
      if (desc.includes('image')) {
        operationType = t('credits.imageGeneration', 'Image Generation');
      } else if (desc.includes('video')) {
        operationType = t('credits.videoGeneration', 'Video Generation');
      } else if (desc.includes('upscale') || desc.includes('enhance')) {
        operationType = t('credits.enhancement', 'Enhancement');
      } else if (desc.includes('film') || desc.includes('storyboard')) {
        operationType = t('credits.filmStudio', 'Film Studio');
      }
    }
    
    return { operationType, model };
  };

  const getOperationIcon = (operationType: string) => {
    const type = operationType.toLowerCase();
    if (type.includes('image')) return <Image className="h-4 w-4 text-purple-400" />;
    if (type.includes('video')) return <Video className="h-4 w-4 text-blue-400" />;
    if (type.includes('enhance') || type.includes('upscale')) return <Wand2 className="h-4 w-4 text-amber-400" />;
    return <Coins className="h-4 w-4 text-emerald-400" />;
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'signup_bonus': return t('credits.signupBonus', 'Signup Bonus');
      case 'subscription_credit': return t('credits.subscriptionCredit', 'Subscription Credit');
      case 'topup': return t('credits.topup', 'Credit Purchase');
      case 'admin_grant': return t('credits.adminGrant', 'Admin Grant');
      case 'refund': return t('credits.refund', 'Refund');
      case 'coupon': return t('credits.coupon', 'Coupon');
      case 'promotion': return t('credits.promotion', 'Promotion');
      case 'referral': return t('credits.referral', 'Referral Bonus');
      default: return sourceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-3xl mx-auto px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/profile")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back to Profile')}
        </Button>

        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Coins className="h-6 w-6 text-emerald-400" />
          {t('credits.title', 'Credit Usage')}
        </h1>

        {/* Credit Balance Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-emerald-400" />
              {t('credits.balance', 'Credit Balance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBalance ? (
              <Skeleton className="h-12 w-32 bg-gray-700" />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('credits.available', 'Available Credits')}</span>
                <span className="text-4xl font-bold text-emerald-400">
                  {creditLedger?.totalBalance || 0}
                </span>
              </div>
            )}
            <Button 
              variant="default" 
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setLocation("/buy-credits")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {t('credits.buyCredits', 'Buy More Credits')}
            </Button>
          </CardContent>
        </Card>

        {/* Expiring Credits Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              {t('credits.expiring', 'Credits Expiring Soon')}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {t('credits.expiringDesc', 'Credits from subscriptions and promotions that will expire')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingExpiring ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full bg-gray-700" />
                <Skeleton className="h-12 w-full bg-gray-700" />
              </div>
            ) : expiringCredits?.entries && expiringCredits.entries.length > 0 ? (
              <div className="space-y-2">
                {expiringCredits.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-900/50 border border-gray-700">
                    <div>
                      <p className="text-sm text-white font-medium">{getSourceTypeLabel(entry.sourceType)}</p>
                      <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {t('credits.expiresOn', 'Expires')} {format(new Date(entry.expiresAt!), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                      {entry.amount} {t('credits.credits', 'credits')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">
                {t('credits.noExpiring', 'No credits expiring soon')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Usage History Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  {t('credits.usageHistory', 'Usage History')}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {t('credits.usageHistoryDesc', 'All operations that used your credits')}
                </CardDescription>
              </div>
              {!isLoadingUsage && usageHistory && usageHistory.totalPointsConsumed > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">{t('credits.totalConsumed', 'Total Consumed')}</p>
                  <p className="text-2xl font-bold text-red-400">-{usageHistory.totalPointsConsumed}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingUsage ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-gray-700" />
                ))}
              </div>
            ) : usageHistory?.entries && usageHistory.entries.length > 0 ? (
              <>
                <div className="space-y-2">
                  {usageHistory.entries.map((entry) => {
                    const { operationType, model } = parseUsageEntry(entry);
                    const creditsUsed = Math.abs(entry.amount);
                    
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-900/50 border border-gray-700">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getOperationIcon(operationType)}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{operationType}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {t('credits.model', 'Model')}: <span className="text-purple-400">{model}</span>
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-red-400 border-red-400/30">
                          -{creditsUsed}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {usageHistory.totalPages > 1 && (
                  <>
                    <Separator className="bg-gray-700 my-4" />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400">
                        {t('credits.showingPage', 'Page {{current}} of {{total}}', { 
                          current: usageHistory.page, 
                          total: usageHistory.totalPages 
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="border-gray-600"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(usageHistory.totalPages, p + 1))}
                          disabled={currentPage >= usageHistory.totalPages}
                          className="border-gray-600"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('credits.totalOperations', 'Total: {{count}} operations', { count: usageHistory.total })}
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm py-8 text-center">
                {t('credits.noUsage', 'No credit usage yet. Start creating to see your history!')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
