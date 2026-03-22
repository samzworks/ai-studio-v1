import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash as Trash2, Eye, EyeOff, Tag, Percent, DollarSign, Calendar, Users, Clipboard as Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface Coupon {
  id: number;
  code: string;
  name: string | null;
  description: string | null;
  type: "percent" | "fixed_amount";
  value: number;
  appliesTo: "plans" | "topups" | "both";
  allowedPlanIds: number[] | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  minPurchaseCents: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface CouponRedemption {
  id: number;
  userId: string;
  appliedTo: string;
  referenceId: string;
  discountAmountCents: number;
  createdAt: string;
}

export default function CouponsManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [viewingRedemptions, setViewingRedemptions] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    type: "percent" as "percent" | "fixed_amount",
    value: 10,
    appliesTo: "both" as "plans" | "topups" | "both",
    maxRedemptions: null as number | null,
    maxRedemptionsPerUser: 1,
    minPurchaseCents: null as number | null,
    expiresAt: "",
    isActive: true,
  });

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const { data: redemptions } = useQuery<CouponRedemption[]>({
    queryKey: ["/api/admin/coupons", viewingRedemptions, "redemptions"],
    queryFn: async () => {
      if (!viewingRedemptions) return [];
      const res = await fetch(`/api/admin/coupons/${viewingRedemptions}/redemptions`);
      if (!res.ok) throw new Error("Failed to fetch redemptions");
      return res.json();
    },
    enabled: !!viewingRedemptions,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/coupons", {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Coupon created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/admin/coupons/${id}`, {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Coupon updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/coupons/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Coupon deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "percent",
      value: 10,
      appliesTo: "both",
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      minPurchaseCents: null,
      expiresAt: "",
      isActive: true,
    });
    setEditingCoupon(null);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name || "",
      description: coupon.description || "",
      type: coupon.type as "percent" | "fixed_amount",
      value: coupon.value,
      appliesTo: coupon.appliesTo as "plans" | "topups" | "both",
      maxRedemptions: coupon.maxRedemptions,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
      minPurchaseCents: coupon.minPurchaseCents,
      expiresAt: coupon.expiresAt ? format(new Date(coupon.expiresAt), "yyyy-MM-dd'T'HH:mm") : "",
      isActive: coupon.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatValue = (coupon: Coupon) => {
    if (coupon.type === "percent") {
      return `${coupon.value}%`;
    }
    return `$${(coupon.value / 100).toFixed(2)}`;
  };

  const filteredCoupons = coupons?.filter((c) =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Coupons & Offers</h2>
          <p className="text-muted-foreground">Manage discount codes and promotions</p>
        </div>
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Search coupons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
            data-testid="input-search-coupons"
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="btn-create-coupon">
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
                <DialogDescription>
                  {editingCoupon ? "Update the coupon details" : "Add a new discount coupon"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Coupon Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., SAVE20"
                      required
                      className="uppercase"
                      data-testid="input-coupon-code"
                    />
                    <Button type="button" variant="outline" onClick={generateCode}>
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Internal Name (optional)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Summer Sale 2025"
                    data-testid="input-coupon-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "percent" | "fixed_amount") => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger data-testid="select-coupon-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">
                      {formData.type === "percent" ? "Percentage" : "Amount (cents)"}
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                      required
                      data-testid="input-coupon-value"
                    />
                    {formData.type === "percent" && (
                      <p className="text-xs text-muted-foreground">{formData.value}% off</p>
                    )}
                    {formData.type === "fixed_amount" && (
                      <p className="text-xs text-muted-foreground">${(formData.value / 100).toFixed(2)} off</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Applies To</Label>
                  <Select
                    value={formData.appliesTo}
                    onValueChange={(value: "plans" | "topups" | "both") => setFormData({ ...formData, appliesTo: value })}
                  >
                    <SelectTrigger data-testid="select-coupon-applies-to">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both Plans & Top-ups</SelectItem>
                      <SelectItem value="plans">Subscription Plans Only</SelectItem>
                      <SelectItem value="topups">Credit Top-ups Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxRedemptions">Max Redemptions (total)</Label>
                    <Input
                      id="maxRedemptions"
                      type="number"
                      value={formData.maxRedemptions ?? ""}
                      onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Unlimited"
                      data-testid="input-coupon-max-redemptions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxRedemptionsPerUser">Max Per User</Label>
                    <Input
                      id="maxRedemptionsPerUser"
                      type="number"
                      value={formData.maxRedemptionsPerUser}
                      onChange={(e) => setFormData({ ...formData, maxRedemptionsPerUser: parseInt(e.target.value) || 1 })}
                      required
                      data-testid="input-coupon-max-per-user"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    data-testid="input-coupon-expires"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-coupon-active"
                  />
                  <Label>Active (can be redeemed)</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="btn-save-coupon"
                  >
                    {editingCoupon ? "Update Coupon" : "Create Coupon"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading coupons...
                  </TableCell>
                </TableRow>
              ) : !filteredCoupons || filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {searchTerm ? "No coupons match your search" : "No coupons found. Create your first coupon to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-500" />
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {coupon.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyCode(coupon.code)}
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {coupon.name || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {coupon.type === "percent" ? (
                          <><Percent className="w-3 h-3 mr-1" />{coupon.value}%</>
                        ) : (
                          <><DollarSign className="w-3 h-3 mr-1" />{(coupon.value / 100).toFixed(2)}</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {coupon.appliesTo === "both" ? "All" : coupon.appliesTo === "plans" ? "Plans" : "Top-ups"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm"
                        onClick={() => setViewingRedemptions(viewingRedemptions === coupon.id ? null : coupon.id)}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        {coupon.redemptionCount}
                        {coupon.maxRedemptions && ` / ${coupon.maxRedemptions}`}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {coupon.expiresAt ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(coupon.expiresAt), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          <Eye className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(coupon)}
                          data-testid={`btn-edit-coupon-${coupon.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) {
                              deleteMutation.mutate(coupon.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`btn-delete-coupon-${coupon.id}`}
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

      {viewingRedemptions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Redemptions for {coupons?.find((c) => c.id === viewingRedemptions)?.code}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {redemptions && redemptions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Applied To</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.userId}</TableCell>
                      <TableCell>{r.appliedTo}</TableCell>
                      <TableCell>${(r.discountAmountCents / 100).toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">No redemptions yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
