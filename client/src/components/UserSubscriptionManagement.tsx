import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CircleUserRound as User, WalletCards as CreditCard, Coins, Plus, Minus, Calendar, AlertCircle, Crown, RefreshCw, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface UserInfo {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserSubscription {
  id: number;
  userId: string;
  planId: number;
  planName?: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

interface UserCredits {
  balance: number;
  ledgerEntries?: LedgerEntry[];
}

interface LedgerEntry {
  id: number;
  sourceType: string;
  amount: number;
  expiresAt: string | null;
  description: string | null;
  createdAt: string;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  isFree: boolean;
}

export default function UserSubscriptionManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [isDeductDialogOpen, setIsDeductDialogOpen] = useState(false);
  const [isAssignPlanDialogOpen, setIsAssignPlanDialogOpen] = useState(false);
  
  const [grantFormData, setGrantFormData] = useState({
    amount: 100,
    expiresInDays: 90,
    description: "",
  });
  
  const [deductFormData, setDeductFormData] = useState({
    amount: 10,
    description: "",
  });

  const [assignPlanId, setAssignPlanId] = useState<string>("");

  const { data: searchResults, isLoading: isSearching, refetch: searchUsers } = useQuery<UserInfo[]>({
    queryKey: ["/api/admin/users/search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    enabled: searchTerm.length >= 2,
  });

  const { data: userSubscription, isLoading: isLoadingSubscription } = useQuery<UserSubscription | null>({
    queryKey: ["/api/admin/users", selectedUser?.id, "subscription"],
    queryFn: async () => {
      if (!selectedUser) return null;
      try {
        const res = await fetch(`/api/admin/users/${selectedUser.id}/subscription`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch subscription");
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!selectedUser,
  });

  const { data: userCredits, isLoading: isLoadingCredits, refetch: refetchCredits } = useQuery<UserCredits>({
    queryKey: ["/api/admin/users", selectedUser?.id, "credits"],
    queryFn: async () => {
      if (!selectedUser) return { balance: 0 };
      const [balanceRes, ledgerRes] = await Promise.all([
        fetch(`/api/admin/credits/${selectedUser.id}`),
        fetch(`/api/admin/users/${selectedUser.id}/credit-ledger`)
      ]);
      if (!balanceRes.ok) throw new Error("Failed to fetch credits");
      const balanceData = await balanceRes.json();
      let ledgerEntries: LedgerEntry[] = [];
      if (ledgerRes.ok) {
        ledgerEntries = await ledgerRes.json();
      }
      return { balance: balanceData.balance, ledgerEntries };
    },
    enabled: !!selectedUser,
  });

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  const grantCreditsMutation = useMutation({
    mutationFn: async (data: typeof grantFormData & { userId: string }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
      const res = await apiRequest("POST", `/api/admin/users/${data.userId}/credits`, {
        amount: data.amount,
        expiresAt: expiresAt.toISOString(),
        reason: data.description || `Admin grant of ${data.amount} credits`,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credits granted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id, "credits"] });
      setIsGrantDialogOpen(false);
      setGrantFormData({ amount: 100, expiresInDays: 90, description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deductCreditsMutation = useMutation({
    mutationFn: async (data: typeof deductFormData & { userId: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${data.userId}/credits`, {
        amount: -data.amount,
        reason: data.description || `Admin deduction of ${data.amount} credits`,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credits deducted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id, "credits"] });
      setIsDeductDialogOpen(false);
      setDeductFormData({ amount: 10, description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: number }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/assign-plan`, { planId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Plan assigned successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id, "subscription"] });
      setIsAssignPlanDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, immediately }: { userId: string; immediately: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/cancel-subscription`, { immediately });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Subscription cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id, "subscription"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500",
      trialing: "bg-blue-500",
      canceled: "bg-gray-500",
      past_due: "bg-orange-500",
      unpaid: "bg-red-500",
    };
    return (
      <Badge className={variants[status] || "bg-gray-500"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">User Subscription Management</h2>
        <p className="text-muted-foreground">Search users and manage their subscriptions and credits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by email, name, or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-users"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>

          {searchResults && searchResults.length > 0 && (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((user) => (
                    <TableRow
                      key={user.id}
                      className={selectedUser?.id === user.id ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ID: {user.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.role === "admin" && (
                            <Badge variant="default">
                              <Crown className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          <Badge variant={user.isActive ? "outline" : "destructive"}>
                            {user.isActive ? "Active" : "Suspended"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={selectedUser?.id === user.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          {selectedUser?.id === user.id ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Subscription
                </CardTitle>
                <CardDescription>
                  {selectedUser.firstName} {selectedUser.lastName}'s subscription status
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignPlanDialogOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Assign Plan
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingSubscription ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : userSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge variant="outline">{userSubscription.planName || `Plan ${userSubscription.planId}`}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(userSubscription.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Period End</span>
                    <span className="text-sm">
                      {format(new Date(userSubscription.currentPeriodEnd), "MMM d, yyyy")}
                    </span>
                  </div>
                  {userSubscription.cancelAtPeriodEnd && (
                    <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/20 rounded">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-orange-700 dark:text-orange-300">
                        Cancels at period end
                      </span>
                    </div>
                  )}
                  {userSubscription.stripeSubscriptionId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Stripe ID</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {userSubscription.stripeSubscriptionId.slice(0, 20)}...
                      </code>
                    </div>
                  )}
                  {userSubscription.status === "active" && !userSubscription.cancelAtPeriodEnd && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (confirm("Cancel this subscription at period end?")) {
                            cancelSubscriptionMutation.mutate({ userId: selectedUser.id, immediately: false });
                          }
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel at Period End
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No active subscription</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsAssignPlanDialogOpen(true)}
                  >
                    Assign a Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Credits
                </CardTitle>
                <CardDescription>
                  Current credit balance and management
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGrantDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Grant
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeductDialogOpen(true)}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Deduct
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCredits ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-primary">
                      {userCredits?.balance?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Available Credits</div>
                  </div>
                  
                  {userCredits?.ledgerEntries && userCredits.ledgerEntries.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
                      <ScrollArea className="h-40">
                        <div className="space-y-2">
                          {userCredits.ledgerEntries.slice(0, 10).map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                            >
                              <div>
                                <div className="font-medium">{entry.sourceType}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(entry.createdAt), "MMM d, HH:mm")}
                                </div>
                              </div>
                              <div className={entry.amount >= 0 ? "text-green-600" : "text-red-600"}>
                                {entry.amount >= 0 ? "+" : ""}{entry.amount}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add credits to {selectedUser?.firstName} {selectedUser?.lastName}'s account
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedUser) {
                grantCreditsMutation.mutate({ ...grantFormData, userId: selectedUser.id });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="grantAmount">Amount</Label>
              <Input
                id="grantAmount"
                type="number"
                value={grantFormData.amount}
                onChange={(e) => setGrantFormData({ ...grantFormData, amount: parseInt(e.target.value) || 0 })}
                required
                data-testid="input-grant-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grantExpires">Expires In (days)</Label>
              <Input
                id="grantExpires"
                type="number"
                value={grantFormData.expiresInDays}
                onChange={(e) => setGrantFormData({ ...grantFormData, expiresInDays: parseInt(e.target.value) || 90 })}
                data-testid="input-grant-expires"
              />
              <p className="text-xs text-muted-foreground">
                Credits will expire on {format(new Date(Date.now() + grantFormData.expiresInDays * 24 * 60 * 60 * 1000), "MMM d, yyyy")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grantDescription">Reason (optional)</Label>
              <Textarea
                id="grantDescription"
                value={grantFormData.description}
                onChange={(e) => setGrantFormData({ ...grantFormData, description: e.target.value })}
                placeholder="Why are you granting these credits?"
                data-testid="input-grant-description"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGrantDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={grantCreditsMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                Grant {grantFormData.amount} Credits
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeductDialogOpen} onOpenChange={setIsDeductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deduct Credits</DialogTitle>
            <DialogDescription>
              Remove credits from {selectedUser?.firstName} {selectedUser?.lastName}'s account
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedUser) {
                deductCreditsMutation.mutate({ ...deductFormData, userId: selectedUser.id });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="deductAmount">Amount</Label>
              <Input
                id="deductAmount"
                type="number"
                value={deductFormData.amount}
                onChange={(e) => setDeductFormData({ ...deductFormData, amount: parseInt(e.target.value) || 0 })}
                required
                data-testid="input-deduct-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deductDescription">Reason</Label>
              <Textarea
                id="deductDescription"
                value={deductFormData.description}
                onChange={(e) => setDeductFormData({ ...deductFormData, description: e.target.value })}
                placeholder="Why are you deducting these credits?"
                required
                data-testid="input-deduct-description"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeductDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deductCreditsMutation.isPending}>
                <Minus className="w-4 h-4 mr-2" />
                Deduct {deductFormData.amount} Credits
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignPlanDialogOpen} onOpenChange={setIsAssignPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Subscription Plan</DialogTitle>
            <DialogDescription>
              Manually assign a plan to {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedUser && assignPlanId) {
                assignPlanMutation.mutate({ userId: selectedUser.id, planId: parseInt(assignPlanId) });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                <SelectTrigger data-testid="select-assign-plan">
                  <SelectValue placeholder="Choose a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.displayName} {plan.isFree && "(Free)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignPlanDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!assignPlanId || assignPlanMutation.isPending}>
                Assign Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
