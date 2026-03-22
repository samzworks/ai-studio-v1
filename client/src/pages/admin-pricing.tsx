import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Save, RefreshCw, Loader2, Check, X, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FixedSizeList as List } from "react-window";
import { AdminLayout, AdminContentSkeleton } from "@/components/AdminLayout";

interface PricingRule {
  id: number;
  featureType: string;
  featureValue: string;
  creditCost: number;
  isActive: boolean;
  priority: number;
  metadata: any;
}

interface PendingEdit {
  id: number;
  field: string;
  value: any;
  isSaving?: boolean;
  error?: string;
}

interface RowSavingState {
  [ruleId: number]: {
    [field: string]: boolean;
  };
}

// Pagination constants
const RULES_PER_PAGE = 20;
const ROW_HEIGHT = 60;

export default function AdminPricing() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [newRule, setNewRule] = useState({
    featureType: "",
    featureValue: "",
    creditCost: 0,
    priority: 100
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Local state for tracking edits and pagination
  const [editedRules, setEditedRules] = useState<Map<number, Partial<PricingRule>>>(new Map());
  const [savingStates, setSavingStates] = useState<RowSavingState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [useVirtualization, setUseVirtualization] = useState(false);
  const debounceTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch pricing rules with optimized settings
  const { data: rules = [], isLoading, refetch } = useQuery<PricingRule[]>({
    queryKey: ["/api/admin/pricing-rules"],
    staleTime: Infinity, // Never auto-refetch
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
  });

  // Determine if we should use virtualization based on rule count
  useEffect(() => {
    setUseVirtualization(rules.length > 50);
  }, [rules.length]);

  // Optimized update rule mutation with optimistic updates
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<PricingRule> }) => {
      return await apiRequest("PATCH", `/api/admin/pricing-rules/${id}`, updates);
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/admin/pricing-rules"] });

      // Snapshot the previous value
      const previousRules = queryClient.getQueryData<PricingRule[]>(["/api/admin/pricing-rules"]);

      // Optimistically update the cache
      queryClient.setQueryData<PricingRule[]>(["/api/admin/pricing-rules"], (oldRules = []) => {
        return oldRules.map(rule => 
          rule.id === id ? { ...rule, ...updates } : rule
        );
      });

      // Mark this specific field as saving
      setSavingStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          ...Object.keys(updates).reduce((acc, field) => ({ ...acc, [field]: true }), {})
        }
      }));

      return { previousRules };
    },
    onSuccess: (data, { id, updates }) => {
      // Clear saving states for this rule's fields
      setSavingStates(prev => {
        const newState = { ...prev };
        if (newState[id]) {
          Object.keys(updates).forEach(field => {
            delete newState[id][field];
          });
          if (Object.keys(newState[id]).length === 0) {
            delete newState[id];
          }
        }
        return newState;
      });

      // Remove from edited rules
      setEditedRules(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    },
    onError: (error: any, { id, updates }, context) => {
      // Rollback on error
      if (context?.previousRules) {
        queryClient.setQueryData(["/api/admin/pricing-rules"], context.previousRules);
      }

      // Clear saving states
      setSavingStates(prev => {
        const newState = { ...prev };
        if (newState[id]) {
          Object.keys(updates).forEach(field => {
            delete newState[id][field];
          });
          if (Object.keys(newState[id]).length === 0) {
            delete newState[id];
          }
        }
        return newState;
      });

      toast({
        title: t("toasts.failedToUpdate"),
        description: error.message || t("toasts.couldNotSaveChanges"),
        variant: "destructive"
      });
    }
  });

  // Optimized delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/pricing-rules/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/pricing-rules"] });
      const previousRules = queryClient.getQueryData<PricingRule[]>(["/api/admin/pricing-rules"]);
      
      // Optimistically remove from cache
      queryClient.setQueryData<PricingRule[]>(["/api/admin/pricing-rules"], (oldRules = []) => {
        return oldRules.filter(rule => rule.id !== id);
      });

      return { previousRules };
    },
    onSuccess: () => {
      toast({
        title: t("toasts.success"),
        description: t("toasts.pricingRuleDeleted"),
        variant: "default"
      });
    },
    onError: (error: any, id, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(["/api/admin/pricing-rules"], context.previousRules);
      }
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failedToDeletePricingRule"),
        variant: "destructive"
      });
    }
  });

  // Optimized add rule mutation
  const addRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      return await apiRequest("POST", "/api/admin/pricing-rules", rule);
    },
    onMutate: async (newRule) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/pricing-rules"] });
      const previousRules = queryClient.getQueryData<PricingRule[]>(["/api/admin/pricing-rules"]);
      
      // Optimistically add to cache with temporary ID
      const tempRule = { ...newRule, id: Date.now(), isActive: true };
      queryClient.setQueryData<PricingRule[]>(["/api/admin/pricing-rules"], (oldRules = []) => {
        return [...oldRules, tempRule];
      });

      return { previousRules, tempRule };
    },
    onSuccess: (data, variables, context) => {
      setNewRule({ featureType: "", featureValue: "", creditCost: 0, priority: 100 });
      setIsAddDialogOpen(false);
      
      // Replace temp rule with real data
      queryClient.setQueryData<PricingRule[]>(["/api/admin/pricing-rules"], (oldRules = []) => {
        return oldRules.map(rule => 
          rule.id === context?.tempRule.id ? (data as any) : rule
        );
      });

      toast({
        title: t("toasts.success"),
        description: t("toasts.pricingRuleAdded"),
        variant: "default"
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(["/api/admin/pricing-rules"], context.previousRules);
      }
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failedToAddPricingRule"),
        variant: "destructive"
      });
    }
  });

  // Debounced update function
  const debouncedUpdate = useCallback((id: number, field: string, value: any) => {
    const key = `${id}-${field}`;
    
    // Clear existing timeout
    if (debounceTimeouts.current.has(key)) {
      clearTimeout(debounceTimeouts.current.get(key)!);
    }

    // Update local state immediately for UI responsiveness
    setEditedRules(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || {};
      newMap.set(id, { ...existing, [field]: value });
      return newMap;
    });

    // Set new timeout for server update
    const timeout = setTimeout(() => {
      updateRuleMutation.mutate({ id, updates: { [field]: value } });
      debounceTimeouts.current.delete(key);
    }, 500);

    debounceTimeouts.current.set(key, timeout);
  }, [updateRuleMutation]);

  // Get effective value for a rule field (local edit or original)
  const getEffectiveValue = useCallback((rule: PricingRule, field: keyof PricingRule) => {
    const edited = editedRules.get(rule.id);
    return edited && field in edited ? edited[field] : rule[field];
  }, [editedRules]);

  // Immediate toggle for switches (no debouncing needed for boolean values)
  const handleToggle = useCallback((id: number, field: string, value: boolean) => {
    updateRuleMutation.mutate({ id, updates: { [field]: value } });
  }, [updateRuleMutation]);

  const handleAddRule = () => {
    if (!newRule.featureType || !newRule.featureValue || newRule.creditCost < 0) {
      toast({
        title: t("validation.error"),
        description: t("validation.allFieldsRequired"),
        variant: "error-outline"
      });
      return;
    }
    addRuleMutation.mutate(newRule);
  };

  const getFeatureTypeBadgeColor = useCallback((type: string) => {
    switch (type) {
      case "model": return "bg-blue-100 text-blue-800";
      case "enhancement": return "bg-green-100 text-green-800";
      case "quality": return "bg-purple-100 text-purple-800";
      case "image_count": return "bg-orange-100 text-orange-800";
      case "aspect_ratio": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }, []);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    refetch();
    toast({
      title: t("toasts.refreshed"),
      description: t("toasts.pricingRulesRefreshed"),
      variant: "default"
    });
  }, [refetch, toast, t]);

  // Pagination logic
  const totalPages = Math.ceil(rules.length / RULES_PER_PAGE);
  const paginatedRules = useMemo(() => {
    if (useVirtualization) return rules;
    const startIndex = (currentPage - 1) * RULES_PER_PAGE;
    return rules.slice(startIndex, startIndex + RULES_PER_PAGE);
  }, [rules, currentPage, useVirtualization]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      debounceTimeouts.current.forEach(timeout => clearTimeout(timeout));
      debounceTimeouts.current.clear();
    };
  }, []);

  // Create the memoized pricing rule row component
  const PricingRuleRow = memo(function PricingRuleRow({ 
    rule, 
    index, 
    style 
  }: { 
    rule: PricingRule; 
    index: number; 
    style?: React.CSSProperties;
  }) {
    const creditCost = getEffectiveValue(rule, 'creditCost') as number;
    const priority = getEffectiveValue(rule, 'priority') as number;
    const isActive = getEffectiveValue(rule, 'isActive') as boolean;
    
    const isSavingCreditCost = savingStates[rule.id]?.creditCost;
    const isSavingPriority = savingStates[rule.id]?.priority;
    const isSavingIsActive = savingStates[rule.id]?.isActive;

    return (
      <div style={style} className="grid grid-cols-6 gap-4 p-2 border-b items-center">
        <div>
          <Badge className={getFeatureTypeBadgeColor(rule.featureType)}>
            {rule.featureType}
          </Badge>
        </div>
        <div className="font-mono text-sm">
          {rule.featureValue}
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              value={creditCost}
              onChange={(e) => debouncedUpdate(rule.id, "creditCost", parseInt(e.target.value) || 0)}
              className="w-20"
            />
            {isSavingCreditCost && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={priority}
              onChange={(e) => debouncedUpdate(rule.id, "priority", parseInt(e.target.value) || 100)}
              className="w-20"
            />
            {isSavingPriority && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => handleToggle(rule.id, "isActive", checked)}
            />
            {isSavingIsActive && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleteRuleMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Pricing Rule</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this pricing rule for "{rule.featureType}: {rule.featureValue}"? 
                  This action cannot be undone and will immediately affect pricing calculations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteRuleMutation.mutate(rule.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Rule
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  });

  // Virtualized list item renderer
  const VirtualListItem = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const rule = rules[index];
    return <PricingRuleRow key={rule.id} rule={rule} index={index} style={style} />;
  }, [rules, getEffectiveValue, savingStates, getFeatureTypeBadgeColor, debouncedUpdate, handleToggle, deleteRuleMutation]);

  return (
    <AdminLayout 
      title="Pricing Rules Management"
      description="Configure credit costs for models, enhancements, and features"
      actions={
        <>
          <Button variant="outline" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <Button 
            variant="outline" 
            onClick={handleManualRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Pricing Rule</DialogTitle>
                <DialogDescription>
                  Create a new pricing rule for models, enhancements, or other features.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="featureType">Feature Type</Label>
                  <Select 
                    value={newRule.featureType} 
                    onValueChange={(value) => setNewRule({ ...newRule, featureType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select feature type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="model">Model</SelectItem>
                      <SelectItem value="enhancement">Enhancement</SelectItem>
                      <SelectItem value="style_upload">Style Upload</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="image_count">Image Count</SelectItem>
                      <SelectItem value="aspect_ratio">Aspect Ratio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="featureValue">Feature Value</Label>
                  <Input
                    id="featureValue"
                    value={newRule.featureValue}
                    onChange={(e) => setNewRule({ ...newRule, featureValue: e.target.value })}
                    placeholder="e.g., flux-pro, prompt_enhancement, hd"
                  />
                </div>
                <div>
                  <Label htmlFor="creditCost">Credit Cost</Label>
                  <Input
                    id="creditCost"
                    type="number"
                    min="0"
                    value={newRule.creditCost}
                    onChange={(e) => setNewRule({ ...newRule, creditCost: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 100 })}
                    placeholder="Higher priority rules take precedence"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRule}
                    disabled={addRuleMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {isLoading ? (
        <AdminContentSkeleton />
      ) : (

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Pricing Rules ({rules.length})</CardTitle>
              <CardDescription>
                Changes are debounced and saved automatically. {useVirtualization ? 'Using virtualization for performance.' : `Showing ${paginatedRules.length} of ${rules.length} rules.`}
              </CardDescription>
            </div>
            {Object.keys(editedRules).length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {Object.keys(editedRules).length} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 p-2 font-medium text-sm border-b">
              <div>Feature Type</div>
              <div>Feature Value</div>
              <div>Credit Cost</div>
              <div>Priority</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {/* Optimized Rendering */}
            {useVirtualization ? (
              /* Virtualized rendering for large lists */
              <div className="border rounded-md">
                <List
                  height={Math.min(600, rules.length * ROW_HEIGHT)}
                  itemCount={rules.length}
                  itemSize={ROW_HEIGHT}
                  width="100%"
                >
                  {VirtualListItem}
                </List>
              </div>
            ) : (
              /* Paginated rendering for smaller lists */
              <div className="space-y-2">
                {paginatedRules.map((rule: PricingRule) => (
                  <PricingRuleRow key={rule.id} rule={rule} index={0} />
                ))}
              </div>
            )}

            {/* Pagination Controls for non-virtualized view */}
            {!useVirtualization && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Performance Stats */}
            <div className="text-xs text-muted-foreground border-t pt-2">
              Performance mode: {useVirtualization ? 'Virtualized' : 'Paginated'} | 
              Total rules: {rules.length} | 
              Rendering: {useVirtualization ? rules.length : paginatedRules.length} items
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </AdminLayout>
  );
}