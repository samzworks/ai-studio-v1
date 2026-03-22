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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash as Trash2, Eye, EyeOff, Coins, Calendar, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface TopupPack {
  id: number;
  name: string;
  description: string | null;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  expiresInDays: number;
  isActive: boolean;
  stripePriceId: string | null;
  stripeProductId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function TopupPacksManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<TopupPack | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    creditsAmount: 100,
    priceCents: 999,
    currency: "usd",
    expiresInDays: 90,
    isActive: true,
    stripePriceId: "",
    stripeProductId: "",
    sortOrder: 0,
  });

  const { data: packs, isLoading } = useQuery<TopupPack[]>({
    queryKey: ["/api/admin/topup-packs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/topup-packs", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credit pack created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topup-packs"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/admin/topup-packs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credit pack updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topup-packs"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/topup-packs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credit pack deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topup-packs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      creditsAmount: 100,
      priceCents: 999,
      currency: "usd",
      expiresInDays: 90,
      isActive: true,
      stripePriceId: "",
      stripeProductId: "",
      sortOrder: 0,
    });
    setEditingPack(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (pack: TopupPack) => {
    setEditingPack(pack);
    setFormData({
      name: pack.name,
      description: pack.description || "",
      creditsAmount: pack.creditsAmount,
      priceCents: pack.priceCents,
      currency: pack.currency,
      expiresInDays: pack.expiresInDays,
      isActive: pack.isActive,
      stripePriceId: pack.stripePriceId || "",
      stripeProductId: pack.stripeProductId || "",
      sortOrder: pack.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPack) {
      updateMutation.mutate({ id: editingPack.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const pricePerCredit = (cents: number, credits: number) => {
    if (credits === 0) return "N/A";
    return `$${(cents / credits / 100).toFixed(4)}/credit`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Top-up Credit Packs</h2>
          <p className="text-muted-foreground">Manage purchasable credit packs</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="btn-create-pack">
              <Plus className="w-4 h-4 mr-2" />
              Create Pack
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPack ? "Edit Credit Pack" : "Create Credit Pack"}</DialogTitle>
              <DialogDescription>
                {editingPack ? "Update the credit pack details" : "Add a new credit pack for users to purchase"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pack Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 100 Credits Starter Pack"
                  required
                  data-testid="input-pack-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Pack description for users"
                  data-testid="input-pack-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="creditsAmount">Credits Amount</Label>
                  <Input
                    id="creditsAmount"
                    type="number"
                    value={formData.creditsAmount}
                    onChange={(e) => setFormData({ ...formData, creditsAmount: parseInt(e.target.value) || 0 })}
                    required
                    data-testid="input-pack-credits"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceCents">Price (cents)</Label>
                  <Input
                    id="priceCents"
                    type="number"
                    value={formData.priceCents}
                    onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
                    required
                    data-testid="input-pack-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(formData.priceCents, formData.currency)} ({pricePerCredit(formData.priceCents, formData.creditsAmount)})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiresInDays">Expires In (days)</Label>
                  <Input
                    id="expiresInDays"
                    type="number"
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 90 })}
                    required
                    data-testid="input-pack-expires"
                  />
                  <p className="text-xs text-muted-foreground">
                    Credits expire {formData.expiresInDays} days after purchase
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-pack-sort"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Stripe Integration</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Stripe Price ID (price_xxx)"
                      value={formData.stripePriceId}
                      onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                      data-testid="input-pack-stripe-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Stripe Product ID (prod_xxx)"
                      value={formData.stripeProductId}
                      onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                      data-testid="input-pack-stripe-product"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-pack-active"
                />
                <Label>Active (Visible in store)</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="btn-save-pack"
                >
                  {editingPack ? "Update Pack" : "Create Pack"}
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
                <TableHead>Pack Name</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Per Credit</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading packs...
                  </TableCell>
                </TableRow>
              ) : !packs || packs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No credit packs found. Create your first pack to get started.
                  </TableCell>
                </TableRow>
              ) : (
                packs.map((pack) => (
                  <TableRow key={pack.id} data-testid={`row-pack-${pack.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="font-medium">{pack.name}</div>
                          {pack.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-48">
                              {pack.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {pack.creditsAmount.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatPrice(pack.priceCents, pack.currency)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {pricePerCredit(pack.priceCents, pack.creditsAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {pack.expiresInDays} days
                      </div>
                    </TableCell>
                    <TableCell>
                      {pack.isActive ? (
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
                          onClick={() => openEditDialog(pack)}
                          data-testid={`btn-edit-pack-${pack.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${pack.name}"?`)) {
                              deleteMutation.mutate(pack.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`btn-delete-pack-${pack.id}`}
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
