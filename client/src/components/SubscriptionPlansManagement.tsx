import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash as Trash2, Eye, EyeOff, Crown, Zap, Clapperboard as Video, Film, Lock, DollarSign, Percent, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface FeatureFlags {
  image_generation?: boolean;
  video_generation?: boolean;
  film_studio?: boolean;
  can_make_private?: boolean;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  displayNameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  isActive: boolean;
  isFree: boolean;
  billingPeriodMonths: number;
  priceCents: number;
  currency: string;
  includedCredits: number;
  creditExpiryPolicy: string;
  featureFlags: FeatureFlags;
  stripePriceId: string | null;
  stripeProductId: string | null;
  annualPriceCents: number | null;
  annualStripePriceId: string | null;
  discountActive: boolean;
  discountPriceCents: number | null;
  discountAnnualPriceCents: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const defaultFeatureFlags: FeatureFlags = {
  image_generation: true,
  video_generation: false,
  film_studio: false,
  can_make_private: false,
};

const billingPeriodOptions = [
  { value: "1", label: "Monthly" },
  { value: "3", label: "Quarterly (3 months)" },
  { value: "6", label: "Semi-Annual (6 months)" },
  { value: "12", label: "Annual" },
];

export default function SubscriptionPlansManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    displayNameAr: "",
    description: "",
    descriptionAr: "",
    isActive: true,
    isFree: false,
    billingPeriodMonths: 1,
    priceCents: 0,
    currency: "usd",
    includedCredits: 0,
    creditExpiryPolicy: "expires_end_of_period_no_rollover",
    featureFlags: { ...defaultFeatureFlags },
    stripePriceId: "",
    stripeProductId: "",
    annualPriceCents: 0,
    annualStripePriceId: "",
    discountActive: false,
    discountPriceCents: 0,
    discountAnnualPriceCents: 0,
    sortOrder: 0,
  });

  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/subscription-plans", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Plan created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/admin/subscription-plans/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Plan updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/subscription-plans/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Plan deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      displayName: "",
      displayNameAr: "",
      description: "",
      descriptionAr: "",
      isActive: true,
      isFree: false,
      billingPeriodMonths: 1,
      priceCents: 0,
      currency: "usd",
      includedCredits: 0,
      creditExpiryPolicy: "expires_end_of_period_no_rollover",
      featureFlags: { ...defaultFeatureFlags },
      stripePriceId: "",
      stripeProductId: "",
      annualPriceCents: 0,
      annualStripePriceId: "",
      discountActive: false,
      discountPriceCents: 0,
      discountAnnualPriceCents: 0,
      sortOrder: 0,
    });
    setEditingPlan(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      displayName: plan.displayName,
      displayNameAr: plan.displayNameAr || "",
      description: plan.description || "",
      descriptionAr: plan.descriptionAr || "",
      isActive: plan.isActive,
      isFree: plan.isFree,
      billingPeriodMonths: plan.billingPeriodMonths,
      priceCents: plan.priceCents,
      currency: plan.currency,
      includedCredits: plan.includedCredits,
      creditExpiryPolicy: plan.creditExpiryPolicy,
      featureFlags: plan.featureFlags || { ...defaultFeatureFlags },
      stripePriceId: plan.stripePriceId || "",
      stripeProductId: plan.stripeProductId || "",
      annualPriceCents: plan.annualPriceCents || 0,
      annualStripePriceId: plan.annualStripePriceId || "",
      discountActive: plan.discountActive || false,
      discountPriceCents: plan.discountPriceCents || 0,
      discountAnnualPriceCents: plan.discountAnnualPriceCents || 0,
      sortOrder: plan.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleFeatureFlag = (flag: keyof FeatureFlags) => {
    setFormData((prev) => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [flag]: !prev.featureFlags[flag],
      },
    }));
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getBillingPeriodLabel = (months: number) => {
    const option = billingPeriodOptions.find((o) => o.value === String(months));
    return option?.label || `${months} months`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Subscription Plans</h2>
          <p className="text-muted-foreground">Manage subscription plans and pricing</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="btn-create-plan">
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
              <DialogDescription>
                {editingPlan ? "Update the subscription plan details" : "Add a new subscription plan"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Internal Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., pro_monthly"
                    required
                    data-testid="input-plan-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g., Pro Plan"
                    required
                    data-testid="input-plan-display-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Plan description for users"
                  data-testid="input-plan-description"
                />
              </div>

              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Arabic Translations (العربية)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayNameAr" className="text-foreground">Display Name (Arabic)</Label>
                    <Input
                      id="displayNameAr"
                      value={formData.displayNameAr}
                      onChange={(e) => setFormData({ ...formData, displayNameAr: e.target.value })}
                      placeholder="e.g., الخطة الاحترافية"
                      dir="rtl"
                      data-testid="input-plan-display-name-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionAr" className="text-foreground">Description (Arabic)</Label>
                    <Textarea
                      id="descriptionAr"
                      value={formData.descriptionAr}
                      onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                      placeholder="وصف الخطة بالعربية"
                      dir="rtl"
                      data-testid="input-plan-description-ar"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingPeriod">Billing Period</Label>
                  <Select
                    value={String(formData.billingPeriodMonths)}
                    onValueChange={(value) => setFormData({ ...formData, billingPeriodMonths: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-billing-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {billingPeriodOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="includedCredits">Included Credits</Label>
                  <Input
                    id="includedCredits"
                    type="number"
                    value={formData.includedCredits}
                    onChange={(e) => setFormData({ ...formData, includedCredits: parseInt(e.target.value) || 0 })}
                    placeholder="Credits per billing period"
                    data-testid="input-plan-credits"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="Display order"
                  data-testid="input-plan-sort-order"
                />
              </div>

              <div className="space-y-4">
                <Label>Pricing</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priceCents" className="text-sm text-muted-foreground">Monthly Price (in cents)</Label>
                    <Input
                      id="priceCents"
                      type="number"
                      value={formData.priceCents}
                      onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 999 for $9.99"
                      disabled={formData.isFree}
                      data-testid="input-plan-price"
                    />
                    <p className="text-xs text-muted-foreground">
                      Display: {formatPrice(formData.priceCents, formData.currency)}/mo
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annualPriceCents" className="text-sm text-muted-foreground">Annual Price (in cents)</Label>
                    <Input
                      id="annualPriceCents"
                      type="number"
                      value={formData.annualPriceCents}
                      onChange={(e) => setFormData({ ...formData, annualPriceCents: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 9900 for $99/year"
                      disabled={formData.isFree}
                      data-testid="input-annual-price"
                    />
                    <p className="text-xs text-muted-foreground">
                      Display: {formatPrice(formData.annualPriceCents, formData.currency)}/yr
                      {formData.priceCents > 0 && formData.annualPriceCents > 0 && (
                        <span className="ml-2 text-green-600">
                          (Save {Math.round((1 - formData.annualPriceCents / (formData.priceCents * 12)) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-500" />
                  <Label>Discount / Offer</Label>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Switch
                    checked={formData.discountActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, discountActive: checked })}
                    disabled={formData.isFree}
                    data-testid="switch-discount-active"
                  />
                  <Label>Enable Discount</Label>
                </div>
                {formData.discountActive && (
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                    <div className="space-y-2">
                      <Label htmlFor="discountPriceCents" className="text-sm text-muted-foreground">Discounted Monthly Price (cents)</Label>
                      <Input
                        id="discountPriceCents"
                        type="number"
                        value={formData.discountPriceCents}
                        onChange={(e) => setFormData({ ...formData, discountPriceCents: parseInt(e.target.value) || 0 })}
                        placeholder="e.g., 799 for $7.99"
                        data-testid="input-discount-price"
                      />
                      <p className="text-xs text-muted-foreground">
                        Display: {formatPrice(formData.discountPriceCents, formData.currency)}/mo
                        {formData.priceCents > 0 && formData.discountPriceCents > 0 && formData.discountPriceCents < formData.priceCents && (
                          <span className="ml-2 text-orange-600 font-medium">
                            ({Math.round((1 - formData.discountPriceCents / formData.priceCents) * 100)}% off)
                          </span>
                        )}
                        {formData.discountPriceCents > 0 && formData.discountPriceCents >= formData.priceCents && (
                          <span className="ml-2 text-red-600 font-medium">
                            (Must be lower than original price)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountAnnualPriceCents" className="text-sm text-muted-foreground">Discounted Annual Price (cents)</Label>
                      <Input
                        id="discountAnnualPriceCents"
                        type="number"
                        value={formData.discountAnnualPriceCents}
                        onChange={(e) => setFormData({ ...formData, discountAnnualPriceCents: parseInt(e.target.value) || 0 })}
                        placeholder="e.g., 7900 for $79/year"
                        data-testid="input-discount-annual-price"
                      />
                      <p className="text-xs text-muted-foreground">
                        Display: {formatPrice(formData.discountAnnualPriceCents, formData.currency)}/yr
                        {formData.annualPriceCents > 0 && formData.discountAnnualPriceCents > 0 && formData.discountAnnualPriceCents < formData.annualPriceCents && (
                          <span className="ml-2 text-orange-600 font-medium">
                            ({Math.round((1 - formData.discountAnnualPriceCents / formData.annualPriceCents) * 100)}% off)
                          </span>
                        )}
                        {formData.discountAnnualPriceCents > 0 && formData.annualPriceCents > 0 && formData.discountAnnualPriceCents >= formData.annualPriceCents && (
                          <span className="ml-2 text-red-600 font-medium">
                            (Must be lower than original price)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label>Stripe Integration</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripePriceId" className="text-sm text-muted-foreground">Monthly Stripe Price ID</Label>
                    <Input
                      id="stripePriceId"
                      value={formData.stripePriceId}
                      onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                      placeholder="price_xxx (monthly)"
                      data-testid="input-stripe-price-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annualStripePriceId" className="text-sm text-muted-foreground">Annual Stripe Price ID</Label>
                    <Input
                      id="annualStripePriceId"
                      value={formData.annualStripePriceId}
                      onChange={(e) => setFormData({ ...formData, annualStripePriceId: e.target.value })}
                      placeholder="price_xxx (annual)"
                      data-testid="input-annual-stripe-price-id"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripeProductId" className="text-sm text-muted-foreground">Stripe Product ID</Label>
                  <Input
                    id="stripeProductId"
                    value={formData.stripeProductId}
                    onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                    placeholder="prod_xxx"
                    data-testid="input-stripe-product-id"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Feature Flags</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm">Image Generation</span>
                    </div>
                    <Switch
                      checked={formData.featureFlags.image_generation}
                      onCheckedChange={() => toggleFeatureFlag("image_generation")}
                      data-testid="switch-image-generation"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Video Generation</span>
                    </div>
                    <Switch
                      checked={formData.featureFlags.video_generation}
                      onCheckedChange={() => toggleFeatureFlag("video_generation")}
                      data-testid="switch-video-generation"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">Film Studio</span>
                    </div>
                    <Switch
                      checked={formData.featureFlags.film_studio}
                      onCheckedChange={() => toggleFeatureFlag("film_studio")}
                      data-testid="switch-film-studio"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Can Make Private</span>
                    </div>
                    <Switch
                      checked={formData.featureFlags.can_make_private}
                      onCheckedChange={() => toggleFeatureFlag("can_make_private")}
                      data-testid="switch-can-make-private"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isFree}
                    onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked, priceCents: checked ? 0 : formData.priceCents })}
                    data-testid="switch-is-free"
                  />
                  <Label>Free Plan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                  <Label>Active (Visible)</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="btn-save-plan"
                >
                  {editingPlan ? "Update Plan" : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading plans...
                  </TableCell>
                </TableRow>
              ) : !plans || plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No subscription plans found. Create your first plan to get started.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {plan.isFree && <Crown className="w-4 h-4 text-yellow-500" />}
                        <div>
                          <div className="font-medium">{plan.displayName}</div>
                          <div className="text-xs text-muted-foreground">{plan.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getBillingPeriodLabel(plan.billingPeriodMonths)}</TableCell>
                    <TableCell>
                      {plan.isFree ? (
                        <Badge variant="secondary">Free</Badge>
                      ) : plan.discountActive && (plan.discountPriceCents || plan.discountAnnualPriceCents) ? (
                        <div className="space-y-1">
                          {plan.discountPriceCents && plan.discountPriceCents > 0 && plan.discountPriceCents < plan.priceCents && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground line-through text-sm">
                                  {formatPrice(plan.priceCents, plan.currency)}
                                </span>
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                  <Percent className="w-3 h-3 mr-1" />
                                  {Math.round((1 - plan.discountPriceCents / plan.priceCents) * 100)}% off
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                                <DollarSign className="w-3 h-3" />
                                {formatPrice(plan.discountPriceCents, plan.currency)}/mo
                              </div>
                            </>
                          )}
                          {plan.discountAnnualPriceCents && plan.discountAnnualPriceCents > 0 && plan.annualPriceCents && plan.discountAnnualPriceCents < plan.annualPriceCents && (
                            <div className="text-xs text-muted-foreground">
                              Annual: <span className="line-through">{formatPrice(plan.annualPriceCents, plan.currency)}</span>
                              {" → "}
                              <span className="text-green-600 dark:text-green-400 font-medium">{formatPrice(plan.discountAnnualPriceCents, plan.currency)}</span>
                              <span className="ml-1 text-orange-600">
                                ({Math.round((1 - plan.discountAnnualPriceCents / plan.annualPriceCents) * 100)}% off)
                              </span>
                            </div>
                          )}
                          {(!plan.discountPriceCents || plan.discountPriceCents >= plan.priceCents) && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatPrice(plan.priceCents, plan.currency)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatPrice(plan.priceCents, plan.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.includedCredits} credits</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {plan.featureFlags?.image_generation && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            Img
                          </Badge>
                        )}
                        {plan.featureFlags?.video_generation && (
                          <Badge variant="secondary" className="text-xs">
                            <Video className="w-3 h-3 mr-1" />
                            Vid
                          </Badge>
                        )}
                        {plan.featureFlags?.film_studio && (
                          <Badge variant="secondary" className="text-xs">
                            <Film className="w-3 h-3 mr-1" />
                            Film
                          </Badge>
                        )}
                        {plan.featureFlags?.can_make_private && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Private
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          <Eye className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(plan)}
                          data-testid={`btn-edit-plan-${plan.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${plan.displayName}"?`)) {
                              deleteMutation.mutate(plan.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`btn-delete-plan-${plan.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>
    </div>
  );
}
