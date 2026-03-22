import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash as Trash2, Edit, GripVertical, SlidersHorizontal as Settings, HelpCircle, Table2, Tag, ArrowUpDown, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { 
  PricingPageConfig, 
  PricingFaqItem, 
  PricingComparisonSection,
  PricingComparisonRow,
  PlanDisplayOverride,
  CreditPackDisplayOverride,
  UpgradeReasonMapping,
  AnnualPlanVariant,
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

export default function PricingPageManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("settings");

  const { data: pricingData, isLoading } = useQuery<FullPricingData>({
    queryKey: ["/api/pricing-page/public"],
  });

  const { data: allPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  const { data: allPacks } = useQuery<TopupPack[]>({
    queryKey: ["/api/admin/topup-packs"],
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-pricing-page-title">Pricing Page Management</h2>
          <p className="text-muted-foreground">Configure the public pricing page, FAQ, and feature comparison</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-pricing-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="plan-overrides" className="flex items-center gap-2" data-testid="tab-plan-overrides">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Plan Badges</span>
          </TabsTrigger>
          <TabsTrigger value="credit-pack-overrides" className="flex items-center gap-2" data-testid="tab-credit-pack-overrides">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Pack Badges</span>
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2" data-testid="tab-pricing-faq">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">FAQ</span>
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2" data-testid="tab-pricing-comparison">
            <Table2 className="h-4 w-4" />
            <span className="hidden sm:inline">Comparison</span>
          </TabsTrigger>
          <TabsTrigger value="upgrade-reasons" className="flex items-center gap-2" data-testid="tab-upgrade-reasons">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Upgrade Reasons</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <PricingPageSettingsTab config={pricingData?.config} plans={allPlans || []} />
        </TabsContent>

        <TabsContent value="plan-overrides" className="mt-6">
          <PlanOverridesTab plans={allPlans || []} overrides={pricingData?.plans?.map(p => p.displayOverride).filter(Boolean) as PlanDisplayOverride[] || []} />
        </TabsContent>

        <TabsContent value="credit-pack-overrides" className="mt-6">
          <CreditPackOverridesTab packs={allPacks || []} overrides={pricingData?.creditPacks?.map(p => p.displayOverride).filter(Boolean) as CreditPackDisplayOverride[] || []} />
        </TabsContent>

        <TabsContent value="faq" className="mt-6">
          <FaqManagementTab faqItems={pricingData?.faqItems || []} />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <ComparisonTableTab sections={pricingData?.comparisonSections || []} plans={allPlans || []} />
        </TabsContent>

        <TabsContent value="upgrade-reasons" className="mt-6">
          <UpgradeReasonsTab mappings={pricingData?.upgradeReasonMappings || []} plans={allPlans || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PricingPageSettingsTab({ config, plans }: { config: PricingPageConfig | null | undefined; plans: SubscriptionPlan[] }) {
  const { toast } = useToast();
  const [navVisible, setNavVisible] = useState(config?.navVisible ?? true);
  const [pageTitle, setPageTitle] = useState(config?.pageTitle ?? "Choose Your Plan");
  const [pageTitleAr, setPageTitleAr] = useState(config?.pageTitleAr ?? "");
  const [pageSubtitle, setPageSubtitle] = useState(config?.pageSubtitle ?? "");
  const [pageSubtitleAr, setPageSubtitleAr] = useState(config?.pageSubtitleAr ?? "");
  const [defaultBillingView, setDefaultBillingView] = useState(config?.defaultBillingView ?? "monthly");
  const [featuredPlanId, setFeaturedPlanId] = useState<number | undefined>(config?.featuredPlanId ?? undefined);
  const [showCreditPacks, setShowCreditPacks] = useState(config?.showCreditPacks ?? true);
  const [subscriptionComingSoon, setSubscriptionComingSoon] = useState(config?.subscriptionComingSoon ?? false);
  const [comingSoonMessage, setComingSoonMessage] = useState(config?.comingSoonMessage ?? "Coming soon, we are currently in beta testing stage");
  const [comingSoonMessageAr, setComingSoonMessageAr] = useState(config?.comingSoonMessageAr ?? "قريباً، نحن حالياً في مرحلة الاختبار التجريبي");
  const [smallNote, setSmallNote] = useState(config?.smallNote ?? "");
  const [smallNoteAr, setSmallNoteAr] = useState(config?.smallNoteAr ?? "");

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/pricing-page/admin/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page/public"] });
      toast({ title: "Settings saved", description: "Pricing page settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      navVisible,
      pageTitle,
      pageTitleAr,
      pageSubtitle,
      pageSubtitleAr,
      defaultBillingView,
      featuredPlanId: featuredPlanId || null,
      showCreditPacks,
      subscriptionComingSoon,
      comingSoonMessage,
      comingSoonMessageAr,
      smallNote,
      smallNoteAr,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page Settings</CardTitle>
        <CardDescription>Configure the pricing page header and display options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Switch id="nav-visible" checked={navVisible} onCheckedChange={setNavVisible} data-testid="switch-nav-visible" />
          <Label htmlFor="nav-visible">Show in navigation menu</Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="page-title">Page Title (English)</Label>
            <Input id="page-title" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} data-testid="input-page-title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-title-ar">Page Title (Arabic)</Label>
            <Input id="page-title-ar" value={pageTitleAr} onChange={(e) => setPageTitleAr(e.target.value)} dir="rtl" data-testid="input-page-title-ar" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="page-subtitle">Page Subtitle (English)</Label>
            <Textarea id="page-subtitle" value={pageSubtitle ?? ""} onChange={(e) => setPageSubtitle(e.target.value)} data-testid="input-page-subtitle" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-subtitle-ar">Page Subtitle (Arabic)</Label>
            <Textarea id="page-subtitle-ar" value={pageSubtitleAr ?? ""} onChange={(e) => setPageSubtitleAr(e.target.value)} dir="rtl" data-testid="input-page-subtitle-ar" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-billing">Default Billing View</Label>
            <Select value={defaultBillingView} onValueChange={setDefaultBillingView}>
              <SelectTrigger data-testid="select-default-billing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="featured-plan">Featured Plan</Label>
            <Select value={featuredPlanId?.toString() ?? "none"} onValueChange={(v) => setFeaturedPlanId(v && v !== "none" ? parseInt(v) : undefined)}>
              <SelectTrigger data-testid="select-featured-plan">
                <SelectValue placeholder="Select a plan to highlight" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="show-credit-packs" checked={showCreditPacks} onCheckedChange={setShowCreditPacks} data-testid="switch-show-credit-packs" />
          <Label htmlFor="show-credit-packs">Show credit packs section</Label>
        </div>

        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Subscription Coming Soon Mode</h3>
          <div className="flex items-center space-x-2 mb-4">
            <Switch id="subscription-coming-soon" checked={subscriptionComingSoon} onCheckedChange={setSubscriptionComingSoon} data-testid="switch-subscription-coming-soon" />
            <Label htmlFor="subscription-coming-soon">Enable "Coming Soon" mode for subscriptions</Label>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            When enabled, clicking subscribe will show a "coming soon" message instead of proceeding to checkout.
          </p>
          {subscriptionComingSoon && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coming-soon-message">Coming Soon Message (English)</Label>
                <Textarea id="coming-soon-message" value={comingSoonMessage ?? ""} onChange={(e) => setComingSoonMessage(e.target.value)} data-testid="input-coming-soon-message" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coming-soon-message-ar">Coming Soon Message (Arabic)</Label>
                <Textarea id="coming-soon-message-ar" value={comingSoonMessageAr ?? ""} onChange={(e) => setComingSoonMessageAr(e.target.value)} dir="rtl" data-testid="input-coming-soon-message-ar" />
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="small-note">Small Note (English)</Label>
            <Textarea id="small-note" value={smallNote ?? ""} onChange={(e) => setSmallNote(e.target.value)} placeholder="Optional note shown at the bottom" data-testid="input-small-note" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="small-note-ar">Small Note (Arabic)</Label>
            <Textarea id="small-note-ar" value={smallNoteAr ?? ""} onChange={(e) => setSmallNoteAr(e.target.value)} dir="rtl" data-testid="input-small-note-ar" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-settings">
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlanOverridesTab({ plans, overrides }: { plans: SubscriptionPlan[]; overrides: PlanDisplayOverride[] }) {
  const { toast } = useToast();
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<PlanDisplayOverride>>({});

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/pricing-page/admin/plan-overrides", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page/public"] });
      toast({ title: "Plan override saved" });
      setEditingPlanId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save override", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest("DELETE", `/api/pricing-page/admin/plan-overrides/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page/public"] });
      toast({ title: "Override deleted" });
    }
  });

  const handleEdit = (plan: SubscriptionPlan) => {
    const existing = overrides.find(o => o.planId === plan.id);
    setFormData(existing || { planId: plan.id, sortOrder: 0, isVisible: true });
    setEditingPlanId(plan.id);
  };

  const handleSave = () => {
    if (editingPlanId) {
      upsertMutation.mutate({ ...formData, planId: editingPlanId });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Display Overrides</CardTitle>
        <CardDescription>Add marketing badges, labels, and control visibility for each plan</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Marketing Label</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => {
              const override = overrides.find(o => o.planId === plan.id);
              return (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{override?.badgeText || "-"}</TableCell>
                  <TableCell>{override?.marketingLabel || "-"}</TableCell>
                  <TableCell>{override?.sortOrder ?? 0}</TableCell>
                  <TableCell>{override?.isVisible !== false ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)} data-testid={`button-edit-plan-override-${plan.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {override && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-delete-plan-override-${plan.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Override</AlertDialogTitle>
                            <AlertDialogDescription>Remove display override for {plan.name}?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(plan.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={editingPlanId !== null} onOpenChange={(open) => !open && setEditingPlanId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Plan Override</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Badge Text (e.g., "Most Popular")</Label>
                <Input value={formData.badgeText || ""} onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })} data-testid="input-badge-text" />
              </div>
              <div className="space-y-2">
                <Label>Badge Text (Arabic)</Label>
                <Input value={formData.badgeTextAr || ""} onChange={(e) => setFormData({ ...formData, badgeTextAr: e.target.value })} dir="rtl" data-testid="input-badge-text-ar" />
              </div>
              <div className="space-y-2">
                <Label>Marketing Label (e.g., "For professionals")</Label>
                <Input value={formData.marketingLabel || ""} onChange={(e) => setFormData({ ...formData, marketingLabel: e.target.value })} data-testid="input-marketing-label" />
              </div>
              <div className="space-y-2">
                <Label>Marketing Label (Arabic)</Label>
                <Input value={formData.marketingLabelAr || ""} onChange={(e) => setFormData({ ...formData, marketingLabelAr: e.target.value })} dir="rtl" data-testid="input-marketing-label-ar" />
              </div>
              <div className="space-y-2">
                <Label>Annual Savings Percent</Label>
                <Input type="number" value={formData.annualSavingsPercent || ""} onChange={(e) => setFormData({ ...formData, annualSavingsPercent: parseInt(e.target.value) || undefined })} data-testid="input-savings-percent" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={formData.sortOrder || 0} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-sort-order" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is-visible" checked={formData.isVisible !== false} onCheckedChange={(checked) => setFormData({ ...formData, isVisible: checked })} data-testid="switch-is-visible" />
                <Label htmlFor="is-visible">Visible on pricing page</Label>
              </div>
              <div className="space-y-2">
                <Label>Feature List (English) - one per line</Label>
                <Textarea 
                  value={Array.isArray(formData.highlightFeatures) ? (formData.highlightFeatures as string[]).join('\n') : ''} 
                  onChange={(e) => setFormData({ ...formData, highlightFeatures: e.target.value.split('\n').filter(f => f.trim()) })} 
                  placeholder="e.g.&#10;Image Generation&#10;Video Generation&#10;Film Studio Access"
                  rows={4}
                  data-testid="input-highlight-features" 
                />
                <p className="text-xs text-muted-foreground">These features will be displayed on the pricing card</p>
              </div>
              <div className="space-y-2">
                <Label>Feature List (Arabic) - one per line</Label>
                <Textarea 
                  value={Array.isArray(formData.highlightFeaturesAr) ? (formData.highlightFeaturesAr as string[]).join('\n') : ''} 
                  onChange={(e) => setFormData({ ...formData, highlightFeaturesAr: e.target.value.split('\n').filter(f => f.trim()) })} 
                  dir="rtl"
                  rows={4}
                  data-testid="input-highlight-features-ar" 
                />
              </div>
              <Button onClick={handleSave} disabled={upsertMutation.isPending} data-testid="button-save-override">
                {upsertMutation.isPending ? "Saving..." : "Save Override"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CreditPackOverridesTab({ packs, overrides }: { packs: TopupPack[]; overrides: CreditPackDisplayOverride[] }) {
  const { toast } = useToast();
  const [editingPackId, setEditingPackId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<CreditPackDisplayOverride>>({});

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/pricing-page/admin/credit-pack-overrides", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page/public"] });
      toast({ title: "Pack override saved" });
      setEditingPackId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save override", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (packId: number) => {
      return apiRequest("DELETE", `/api/pricing-page/admin/credit-pack-overrides/${packId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page/public"] });
      toast({ title: "Override deleted" });
    }
  });

  const handleEdit = (pack: TopupPack) => {
    const existing = overrides.find(o => o.packId === pack.id);
    setFormData(existing || { packId: pack.id, sortOrder: 0, isVisible: true });
    setEditingPackId(pack.id);
  };

  const handleSave = () => {
    if (editingPackId) {
      upsertMutation.mutate({ ...formData, packId: editingPackId });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Pack Display Overrides</CardTitle>
        <CardDescription>Add badges and control visibility for credit packs</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pack</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packs.map((pack) => {
              const override = overrides.find(o => o.packId === pack.id);
              return (
                <TableRow key={pack.id}>
                  <TableCell className="font-medium">{pack.name}</TableCell>
                  <TableCell>{pack.creditsAmount}</TableCell>
                  <TableCell>{override?.badgeText || "-"}</TableCell>
                  <TableCell>{override?.sortOrder ?? 0}</TableCell>
                  <TableCell>{override?.isVisible !== false ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(pack)} data-testid={`button-edit-pack-override-${pack.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {override && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-delete-pack-override-${pack.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Override</AlertDialogTitle>
                            <AlertDialogDescription>Remove display override for {pack.name}?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(pack.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={editingPackId !== null} onOpenChange={(open) => !open && setEditingPackId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Credit Pack Override</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Badge Text (e.g., "Best Value")</Label>
                <Input value={formData.badgeText || ""} onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })} data-testid="input-pack-badge-text" />
              </div>
              <div className="space-y-2">
                <Label>Badge Text (Arabic)</Label>
                <Input value={formData.badgeTextAr || ""} onChange={(e) => setFormData({ ...formData, badgeTextAr: e.target.value })} dir="rtl" data-testid="input-pack-badge-text-ar" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={formData.sortOrder || 0} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} data-testid="input-pack-sort-order" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="pack-visible" checked={formData.isVisible !== false} onCheckedChange={(checked) => setFormData({ ...formData, isVisible: checked })} data-testid="switch-pack-visible" />
                <Label htmlFor="pack-visible">Visible on pricing page</Label>
              </div>
              <Button onClick={handleSave} disabled={upsertMutation.isPending} data-testid="button-save-pack-override">
                {upsertMutation.isPending ? "Saving..." : "Save Override"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function FaqManagementTab({ faqItems }: { faqItems: PricingFaqItem[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [questionAr, setQuestionAr] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerAr, setAnswerAr] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const { data: items } = useQuery<PricingFaqItem[]>({
    queryKey: ["/api/pricing-page/admin/faq"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/pricing-page/admin/faq", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "FAQ item created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create FAQ item", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/pricing-page/admin/faq/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "FAQ item updated" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update FAQ item", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/pricing-page/admin/faq/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "FAQ item deleted" });
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setQuestion("");
    setQuestionAr("");
    setAnswer("");
    setAnswerAr("");
    setSortOrder(0);
    setIsActive(true);
  };

  const handleEdit = (item: PricingFaqItem) => {
    setEditingId(item.id);
    setQuestion(item.question);
    setQuestionAr(item.questionAr || "");
    setAnswer(item.answer);
    setAnswerAr(item.answerAr || "");
    setSortOrder(item.sortOrder);
    setIsActive(item.isActive);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const data = { question, questionAr, answer, answerAr, sortOrder, isActive };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const displayItems = items || faqItems;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>FAQ Items</CardTitle>
          <CardDescription>Manage frequently asked questions for the pricing page</CardDescription>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-add-faq">
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell className="max-w-md truncate">{item.question}</TableCell>
                <TableCell>{item.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} data-testid={`button-edit-faq-${item.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-delete-faq-${item.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this FAQ item?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Question (English)</Label>
                  <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} data-testid="input-faq-question" />
                </div>
                <div className="space-y-2">
                  <Label>Question (Arabic)</Label>
                  <Textarea value={questionAr} onChange={(e) => setQuestionAr(e.target.value)} dir="rtl" data-testid="input-faq-question-ar" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Answer (English)</Label>
                  <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} data-testid="input-faq-answer" />
                </div>
                <div className="space-y-2">
                  <Label>Answer (Arabic)</Label>
                  <Textarea value={answerAr} onChange={(e) => setAnswerAr(e.target.value)} dir="rtl" rows={4} data-testid="input-faq-answer-ar" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="w-24" data-testid="input-faq-sort-order" />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch id="faq-active" checked={isActive} onCheckedChange={setIsActive} data-testid="switch-faq-active" />
                  <Label htmlFor="faq-active">Active</Label>
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-faq">
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingId ? "Update FAQ" : "Create FAQ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ComparisonTableTab({ sections, plans }: { sections: any[]; plans: SubscriptionPlan[] }) {
  const { toast } = useToast();
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionTitleAr, setSectionTitleAr] = useState("");
  const [sectionSortOrder, setSectionSortOrder] = useState(0);

  const { data: allSections } = useQuery<any[]>({
    queryKey: ["/api/pricing-page/admin/comparison-sections"],
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/pricing-page/admin/comparison-sections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "Section created" });
      setShowSectionForm(false);
      setSectionTitle("");
      setSectionTitleAr("");
      setSectionSortOrder(0);
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/pricing-page/admin/comparison-sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "Section deleted" });
    }
  });

  const displaySections = allSections || sections;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Feature Comparison Table</CardTitle>
          <CardDescription>Manage sections and features for the plan comparison table</CardDescription>
        </div>
        <Button onClick={() => setShowSectionForm(true)} data-testid="button-add-section">
          <Plus className="h-4 w-4 mr-2" />
          Add Section
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {displaySections.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No comparison sections yet. Add a section to get started.</p>
        ) : (
          displaySections.map((section) => (
            <Card key={section.id} className="border">
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">Order: {section.sortOrder}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`button-delete-section-${section.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Section</AlertDialogTitle>
                      <AlertDialogDescription>This will delete the section and all its rows. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteSectionMutation.mutate(section.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{section.rows?.length || 0} rows in this section</p>
              </CardContent>
            </Card>
          ))
        )}

        <Dialog open={showSectionForm} onOpenChange={setShowSectionForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Comparison Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Section Title (English)</Label>
                <Input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} data-testid="input-section-title" />
              </div>
              <div className="space-y-2">
                <Label>Section Title (Arabic)</Label>
                <Input value={sectionTitleAr} onChange={(e) => setSectionTitleAr(e.target.value)} dir="rtl" data-testid="input-section-title-ar" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sectionSortOrder} onChange={(e) => setSectionSortOrder(parseInt(e.target.value) || 0)} data-testid="input-section-sort-order" />
              </div>
              <Button onClick={() => createSectionMutation.mutate({ title: sectionTitle, titleAr: sectionTitleAr, sortOrder: sectionSortOrder, isActive: true })} disabled={createSectionMutation.isPending} data-testid="button-save-section">
                {createSectionMutation.isPending ? "Creating..." : "Create Section"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function UpgradeReasonsTab({ mappings, plans }: { mappings: UpgradeReasonMapping[]; plans: SubscriptionPlan[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [reasonKey, setReasonKey] = useState("");
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [icon, setIcon] = useState("");
  const [recommendedPlanId, setRecommendedPlanId] = useState<number | undefined>(undefined);

  const { data: allMappings } = useQuery<UpgradeReasonMapping[]>({
    queryKey: ["/api/pricing-page/admin/upgrade-reasons"],
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/pricing-page/admin/upgrade-reasons", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "Upgrade reason saved" });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest("DELETE", `/api/pricing-page/admin/upgrade-reasons/${key}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-page"] });
      toast({ title: "Upgrade reason deleted" });
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingKey(null);
    setReasonKey("");
    setTitle("");
    setTitleAr("");
    setDescription("");
    setDescriptionAr("");
    setIcon("");
    setRecommendedPlanId(undefined);
  };

  const handleEdit = (mapping: UpgradeReasonMapping) => {
    setEditingKey(mapping.reasonKey);
    setReasonKey(mapping.reasonKey);
    setTitle(mapping.title);
    setTitleAr(mapping.titleAr || "");
    setDescription(mapping.description);
    setDescriptionAr(mapping.descriptionAr || "");
    setIcon(mapping.icon || "");
    setRecommendedPlanId(mapping.recommendedPlanId || undefined);
    setShowForm(true);
  };

  const handleSubmit = () => {
    upsertMutation.mutate({ reasonKey, title, titleAr, description, descriptionAr, icon, recommendedPlanId });
  };

  const displayMappings = allMappings || mappings;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Upgrade Reason Mappings</CardTitle>
          <CardDescription>Configure friendly messages for upgrade reasons (used with ?upgrade=1&reason=X)</CardDescription>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-add-upgrade-reason">
          <Plus className="h-4 w-4 mr-2" />
          Add Reason
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead>Recommended Plan</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayMappings.map((mapping) => (
              <TableRow key={mapping.reasonKey}>
                <TableCell className="font-mono text-sm">{mapping.reasonKey}</TableCell>
                <TableCell>{mapping.title}</TableCell>
                <TableCell>{mapping.icon || "-"}</TableCell>
                <TableCell>{plans.find(p => p.id === mapping.recommendedPlanId)?.name || "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(mapping)} data-testid={`button-edit-reason-${mapping.reasonKey}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-delete-reason-${mapping.reasonKey}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Upgrade Reason</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this upgrade reason mapping?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(mapping.reasonKey)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingKey ? "Edit Upgrade Reason" : "Add Upgrade Reason"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason Key (e.g., "video_generation", "film_studio")</Label>
                <Input value={reasonKey} onChange={(e) => setReasonKey(e.target.value)} disabled={!!editingKey} className="font-mono" data-testid="input-reason-key" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title (English)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-reason-title" />
                </div>
                <div className="space-y-2">
                  <Label>Title (Arabic)</Label>
                  <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" data-testid="input-reason-title-ar" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Description (English)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-reason-description" />
                </div>
                <div className="space-y-2">
                  <Label>Description (Arabic)</Label>
                  <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} dir="rtl" data-testid="input-reason-description-ar" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Icon (Lucide icon name)</Label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g., Video, Film, Lock" data-testid="input-reason-icon" />
                </div>
                <div className="space-y-2">
                  <Label>Recommended Plan</Label>
                  <Select value={recommendedPlanId?.toString() ?? "none"} onValueChange={(v) => setRecommendedPlanId(v && v !== "none" ? parseInt(v) : undefined)}>
                    <SelectTrigger data-testid="select-recommended-plan">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id.toString()}>{plan.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={upsertMutation.isPending} data-testid="button-save-reason">
                {upsertMutation.isPending ? "Saving..." : editingKey ? "Update Reason" : "Create Reason"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
