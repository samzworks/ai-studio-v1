import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Database, DollarSign, Percent, Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface PricingSetting {
  key: string;
  value: any;
  description: string;
  updatedAt: string;
  updatedBy: string;
}

interface PricingOperation {
  operationId: string;
  displayName: string;
  provider: string;
  category: string;
  baseCostUsd: number;
  perOperationMarginPercent: number | null;
  defaultQuantity: number;
  isActive: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string;
}

export default function AdminPricing() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [editingOperation, setEditingOperation] = useState<string | null>(null);
  const [operationUpdates, setOperationUpdates] = useState<Record<string, Partial<PricingOperation>>>({});

  const { data: settings, isLoading: settingsLoading } = useQuery<PricingSetting[]>({
    queryKey: ["/api/admin/pricing/settings"],
  });

  const { data: operations, isLoading: operationsLoading } = useQuery<PricingOperation[]>({
    queryKey: ["/api/admin/pricing/operations"],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/pricing/settings/${key}`, { value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/settings"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.settingUpdated"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.settingUpdateFailed"),
        variant: "destructive",
      });
    },
  });

  const updateOperationMutation = useMutation({
    mutationFn: async ({ operationId, updates }: { operationId: string; updates: Partial<PricingOperation> }) => {
      const res = await apiRequest("PATCH", `/api/admin/pricing/operations/${operationId}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/operations"] });
      setEditingOperation(null);
      setOperationUpdates({});
      toast({
        title: t("toasts.success"),
        description: t("toasts.operationUpdated"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.operationUpdateFailed"),
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = async (key: string, value: any) => {
    updateSettingMutation.mutate({ key, value });
  };

  const handleOperationUpdate = (operationId: string) => {
    const updates = operationUpdates[operationId];
    if (updates) {
      updateOperationMutation.mutate({ operationId, updates });
    }
  };

  const getSettingValue = (key: string) => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value;
  };

  const creditUsdRate = getSettingValue("credit_usd_rate") || 0.01;
  const generalMargin = getSettingValue("general_margin_percent") || 35;
  const roundingMode = getSettingValue("rounding_mode") || "ceil";

  const calculateEffectivePrice = (op: PricingOperation) => {
    const margin = op.perOperationMarginPercent ?? generalMargin;
    const effectiveUsd = op.baseCostUsd * (1 + margin / 100);
    const credits = Math.ceil(effectiveUsd / creditUsdRate);
    return { effectiveUsd, credits, margin };
  };

  return (
    <div className="container mx-auto py-8 px-4" data-testid="admin-pricing-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="page-title">Pricing System Management</h1>
        <p className="text-muted-foreground" data-testid="page-description">
          Configure pricing settings and manage the AI operations catalog
        </p>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            Global Settings
          </TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <Database className="w-4 h-4 mr-2" />
            Operations Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card data-testid="card-credit-mapping">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Credit to USD Mapping
                </CardTitle>
                <CardDescription>
                  Exchange rate between credits and USD (1 credit = ${creditUsdRate.toFixed(4)})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="credit-rate">Credit Rate (USD)</Label>
                    <Input
                      id="credit-rate"
                      type="number"
                      step="0.0001"
                      defaultValue={creditUsdRate}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value > 0) {
                          handleSettingChange("credit_usd_rate", value);
                        }
                      }}
                      data-testid="input-credit-rate"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">Equivalent</div>
                    <div className="text-2xl font-bold" data-testid="text-credit-equivalent">
                      1 credit = ${creditUsdRate.toFixed(4)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-margin-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  General Margin
                </CardTitle>
                <CardDescription>
                  Default profit margin applied to all operations (unless overridden per-operation)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="general-margin">General Margin (%)</Label>
                    <Input
                      id="general-margin"
                      type="number"
                      step="1"
                      defaultValue={generalMargin}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value >= 0) {
                          handleSettingChange("general_margin_percent", value);
                        }
                      }}
                      data-testid="input-general-margin"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">Example Calculation</div>
                    <div className="text-sm font-mono" data-testid="text-margin-example">
                      $0.10 base × (1 + {generalMargin}%) = ${(0.10 * (1 + generalMargin / 100)).toFixed(4)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-rounding-mode">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Rounding Mode
                </CardTitle>
                <CardDescription>
                  How to round fractional credits (ceil = always round up to avoid under-charging)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="rounding-mode">Rounding Mode</Label>
                    <Select
                      value={roundingMode}
                      onValueChange={(value) => handleSettingChange("rounding_mode", value)}
                    >
                      <SelectTrigger data-testid="select-rounding-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ceil">Ceil (Round Up)</SelectItem>
                        <SelectItem value="floor">Floor (Round Down)</SelectItem>
                        <SelectItem value="round">Round (Nearest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">Example</div>
                    <div className="text-sm font-mono" data-testid="text-rounding-example">
                      15.3 credits → {roundingMode === "ceil" ? "16" : roundingMode === "floor" ? "15" : "15"} credits
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations">
          <Card data-testid="card-operations-catalog">
            <CardHeader>
              <CardTitle>Operations Catalog</CardTitle>
              <CardDescription>
                Manage base costs and margins for all AI operations ({operations?.length || 0} operations)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {operationsLoading ? (
                <div className="text-center py-8" data-testid="loading-operations">Loading operations...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operation</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Base Cost (USD)</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right">Effective Price</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations?.map((op) => {
                        const { effectiveUsd, credits, margin } = calculateEffectivePrice(op);
                        const isEditing = editingOperation === op.operationId;
                        const updates = operationUpdates[op.operationId] || {};

                        return (
                          <TableRow key={op.operationId} data-testid={`row-operation-${op.operationId}`}>
                            <TableCell className="font-medium">{op.displayName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" data-testid={`badge-provider-${op.operationId}`}>
                                {op.provider}
                              </Badge>
                            </TableCell>
                            <TableCell>{op.category}</TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.0001"
                                  defaultValue={op.baseCostUsd}
                                  onChange={(e) => {
                                    setOperationUpdates({
                                      ...operationUpdates,
                                      [op.operationId]: {
                                        ...updates,
                                        baseCostUsd: parseFloat(e.target.value),
                                      },
                                    });
                                  }}
                                  className="w-24 text-right"
                                  data-testid={`input-base-cost-${op.operationId}`}
                                />
                              ) : (
                                <span data-testid={`text-base-cost-${op.operationId}`}>
                                  ${op.baseCostUsd.toFixed(4)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="1"
                                  placeholder={generalMargin.toString()}
                                  defaultValue={op.perOperationMarginPercent || ""}
                                  onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : null;
                                    setOperationUpdates({
                                      ...operationUpdates,
                                      [op.operationId]: {
                                        ...updates,
                                        perOperationMarginPercent: value,
                                      },
                                    });
                                  }}
                                  className="w-20 text-right"
                                  data-testid={`input-margin-${op.operationId}`}
                                />
                              ) : (
                                <span data-testid={`text-margin-${op.operationId}`}>
                                  {margin.toFixed(0)}%
                                  {op.perOperationMarginPercent === null && (
                                    <span className="text-muted-foreground text-xs ml-1">(default)</span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-effective-price-${op.operationId}`}>
                              ${effectiveUsd.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-bold" data-testid={`text-credits-${op.operationId}`}>
                              {credits}
                            </TableCell>
                            <TableCell>
                              <Badge variant={op.isActive ? "default" : "secondary"} data-testid={`badge-status-${op.operationId}`}>
                                {op.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleOperationUpdate(op.operationId)}
                                    disabled={updateOperationMutation.isPending}
                                    data-testid={`button-save-${op.operationId}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingOperation(null);
                                      setOperationUpdates({});
                                    }}
                                    data-testid={`button-cancel-${op.operationId}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingOperation(op.operationId)}
                                  data-testid={`button-edit-${op.operationId}`}
                                >
                                  Edit
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
