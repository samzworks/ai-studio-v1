import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, DoorOpen as LogOut, WalletCards as CreditCard, SlidersHorizontal as Settings, Heart, Camera, Pencil, Crown, Coins, Loader2, ExternalLink, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface CreditLedgerEntry {
  id: number;
  userId: string;
  sourceType: string;
  amount: number;
  remainingAmount: number;
  expiresAt: string | null;
  description: string | null;
  createdAt: string;
}

interface CreditLedgerResponse {
  entries: CreditLedgerEntry[];
  totalBalance: number;
}

interface SubscriptionResponse {
  plan: {
    id: number;
    name: string;
    displayName: string;
    isFree: boolean;
    priceCents: number;
    includedCredits: number;
    featureFlags: {
      image_generation: boolean;
      video_generation: boolean;
      film_studio: boolean;
      can_make_private: boolean;
    };
  } | null;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const { data: creditLedger, isLoading: isLoadingCredits } = useQuery<CreditLedgerResponse>({
    queryKey: ["/api/credits/ledger"],
    enabled: isAuthenticated,
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditingName(false);
      toast({
        title: t('profile.nameUpdated', 'Name updated'),
        description: t('profile.nameUpdatedDesc', 'Your name has been updated successfully.'),
      });
    },
    onError: () => {
      toast({
        title: t('profile.updateError', 'Update failed'),
        description: t('profile.updateErrorDesc', 'Failed to update your name. Please try again.'),
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      toast({
        title: t('profile.invalidImage', 'Invalid image'),
        description: t('profile.invalidImageDesc', 'Please select a valid image file (PNG, JPG, etc.)'),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('profile.imageTooLarge', 'Image too large'),
        description: t('profile.imageTooLargeDesc', 'Please select an image smaller than 10MB.'),
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/profile/image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t('profile.imageUpdated', 'Profile image updated'),
        description: t('profile.imageUpdatedDesc', 'Your profile image has been updated successfully.'),
      });
    } catch (error) {
      toast({
        title: t('profile.uploadError', 'Upload failed'),
        description: t('profile.uploadErrorDesc', 'Failed to upload your profile image. Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!isAuthenticated || !user) {
    setLocation("/");
    return null;
  }

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const handleSaveName = () => {
    updateProfileMutation.mutate({ firstName, lastName });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-4"
          data-testid="button-back-profile"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>

        {/* Profile Header Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6" data-testid="card-profile">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4 relative">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={getDisplayName()} />
                  <AvatarFallback className="bg-emerald-600 text-2xl text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {isEditingName ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div>
                  <Label htmlFor="firstName" className="text-gray-400 text-sm">{t('profile.firstName', 'First Name')}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-gray-400 text-sm">{t('profile.lastName', 'Last Name')}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingName(false)}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('common.save', 'Save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-white text-xl" data-testid="text-profile-name">
                  {getDisplayName()}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setFirstName(user?.firstName || "");
                    setLastName(user?.lastName || "");
                    setIsEditingName(true);
                  }}
                >
                  <Pencil className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            )}
            <CardDescription className="text-gray-400" data-testid="text-profile-email">
              {user?.email}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Subscription/Plan Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              {t('profile.subscription', 'Subscription')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSubscription ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-32 bg-gray-700" />
                <Skeleton className="h-4 w-48 bg-gray-700" />
              </div>
            ) : subscription?.plan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{subscription.plan.displayName}</span>
                      {subscription.plan.isFree ? (
                        <Badge variant="secondary">{t('profile.freePlan', 'Free')}</Badge>
                      ) : (
                        <Badge className="bg-emerald-600">{t('profile.activePlan', 'Active')}</Badge>
                      )}
                    </div>
                    {subscription.plan.includedCredits > 0 && (
                      <p className="text-sm text-gray-400 mt-1">
                        {t('profile.includedCredits', '{{credits}} credits/month', { credits: subscription.plan.includedCredits })}
                      </p>
                    )}
                  </div>
                  {!subscription.plan.isFree && (
                    <div className="text-right">
                      <p className="text-white font-medium">
                        ${(subscription.plan.priceCents / 100).toFixed(2)}/mo
                      </p>
                      {subscription.currentPeriodEnd && (
                        <p className="text-xs text-gray-400">
                          {subscription.cancelAtPeriodEnd 
                            ? t('profile.endsOn', 'Ends {{date}}', { date: format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy') })
                            : t('profile.renewsOn', 'Renews {{date}}', { date: format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy') })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {subscription.plan.featureFlags.image_generation && (
                    <Badge variant="outline" className="text-gray-300 border-gray-600">{t('profile.imageGen', 'Image Generation')}</Badge>
                  )}
                  {subscription.plan.featureFlags.video_generation && (
                    <Badge variant="outline" className="text-gray-300 border-gray-600">{t('profile.videoGen', 'Video Generation')}</Badge>
                  )}
                  {subscription.plan.featureFlags.film_studio && (
                    <Badge variant="outline" className="text-gray-300 border-gray-600">{t('profile.filmStudio', 'Film Studio')}</Badge>
                  )}
                  {subscription.plan.featureFlags.can_make_private && (
                    <Badge variant="outline" className="text-gray-300 border-gray-600">{t('profile.privateContent', 'Private Content')}</Badge>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full mt-3 border-gray-600 text-gray-300 hover:text-white"
                  onClick={() => setLocation("/manage-subscription")}
                >
                  {subscription.plan.isFree 
                    ? t('profile.upgradePlan', 'Upgrade Plan') 
                    : t('profile.managePlan', 'Manage Plan')}
                </Button>
              </div>
            ) : (
              <div className="text-gray-400">
                {t('profile.noPlan', 'No active subscription')}
                <Button 
                  variant="outline" 
                  className="w-full mt-3 border-gray-600 text-gray-300 hover:text-white"
                  onClick={() => setLocation("/manage-subscription")}
                >
                  {t('profile.viewPlans', 'View Plans')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credits Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-emerald-400" />
              {t('profile.credits', 'Credits')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCredits ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24 bg-gray-700" />
                <Skeleton className="h-4 w-full bg-gray-700" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{t('profile.totalBalance', 'Total Balance')}</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {creditLedger?.totalBalance || 0}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-gray-600 text-gray-300 hover:text-white"
                    onClick={() => setLocation("/credits")}
                  >
                    {t('profile.viewUsage', 'View Usage & History')}
                  </Button>
                  <Button 
                    variant="default" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setLocation("/buy-credits")}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('profile.buyCredits', 'Buy Credits')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">{t('profile.quickActions', 'Quick Actions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700/50 py-6"
              onClick={() => setLocation("/history")}
              data-testid="button-history-profile"
            >
              <Settings className="h-5 w-5 mr-3 text-gray-400" />
              {t('profile.myCreations', 'My Creations')}
            </Button>

            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700/50 py-6"
              onClick={() => setLocation("/favorites")}
              data-testid="button-favorites-profile"
            >
              <Heart className="h-5 w-5 mr-3 text-gray-400" />
              {t('profile.favorites', 'Favorites')}
            </Button>

            <Separator className="bg-gray-700" />

            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20 py-6"
              onClick={handleLogout}
              data-testid="button-logout-profile"
            >
              <LogOut className="h-5 w-5 mr-3" />
              {t('profile.logout', 'Log Out')}
            </Button>
          </CardContent>
        </Card>

        {/* Account Security Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              {t('profile.accountSecurity', 'Account Security')}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {t('profile.securityDesc', 'Manage your account security settings through Replit')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              {t('profile.replitAuthInfo', 'Your account is secured through Replit authentication. To change your password or manage security settings, visit your Replit account settings.')}
            </p>
            <Button 
              variant="outline" 
              className="w-full border-gray-600 text-gray-300 hover:text-white"
              onClick={() => window.open('https://replit.com/account', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('profile.replitSettings', 'Open Replit Account Settings')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
