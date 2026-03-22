import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, ArrowLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdminLayout, AdminContentSkeleton } from "@/components/AdminLayout";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
}

interface CreditOperation {
  userId: string;
  amount: number;
  reason: string;
}

export default function AdminCredits() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [operation, setOperation] = useState<CreditOperation>({
    userId: "",
    amount: 0,
    reason: ""
  });
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);

  // Search users
  const { data: searchResults = [], isLoading: isSearching } = useQuery<User[]>({
    queryKey: ["/api/admin/users/search", searchQuery],
    queryFn: () => fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json()),
    enabled: searchQuery.length >= 2
  });

  // Get user credits info
  const { data: userCredits, refetch: refetchCredits } = useQuery<{ balance: number; lifetimeEarned: number }>({
    queryKey: ["/api/admin/credits", selectedUser?.id],
    queryFn: selectedUser ? () => fetch(`/api/admin/credits/${selectedUser.id}`).then(res => res.json()) : undefined,
    enabled: !!selectedUser?.id
  });

  // Grant credits mutation
  const grantCreditsMutation = useMutation({
    mutationFn: async (data: CreditOperation) => {
      return await apiRequest("POST", "/api/admin/credits/grant", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credits"] });
      refetchCredits();
      setOperation({ userId: "", amount: 0, reason: "" });
      setIsGrantDialogOpen(false);
      toast({
        title: t("toasts.success"),
        description: t("toasts.creditsGranted"),
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failed"),
        variant: "error-outline"
      });
    }
  });

  // Revoke credits mutation
  const revokeCreditsMutation = useMutation({
    mutationFn: async (data: CreditOperation) => {
      return await apiRequest("POST", "/api/admin/credits/revoke", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credits"] });
      refetchCredits();
      setOperation({ userId: "", amount: 0, reason: "" });
      setIsRevokeDialogOpen(false);
      toast({
        title: t("toasts.success"),
        description: t("toasts.creditsRevoked"),
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failed"),
        variant: "error-outline"
      });
    }
  });

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setOperation(prev => ({ ...prev, userId: user.id }));
  };

  const handleGrantCredits = () => {
    if (!operation.userId || operation.amount <= 0 || !operation.reason.trim()) {
      toast({
        title: t("validation.error"),
        description: t("validation.creditsRequired"),
        variant: "error-outline"
      });
      return;
    }
    grantCreditsMutation.mutate(operation);
  };

  const handleRevokeCredits = () => {
    if (!operation.userId || operation.amount <= 0 || !operation.reason.trim()) {
      toast({
        title: t("validation.error"),
        description: t("validation.creditsRequired"),
        variant: "error-outline"
      });
      return;
    }
    revokeCreditsMutation.mutate(operation);
  };

  return (
    <AdminLayout 
      title="Credit Management"
      description="Grant or revoke credits for users"
      actions={
        <Button variant="outline" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      }
    >
      {/* While there's no heavy loading state for this page, we maintain consistency */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Search */}
        <Card>
          <CardHeader>
            <CardTitle>Find User</CardTitle>
            <CardDescription>
              Search by email or name to select a user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {isSearching && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUser?.id === user.id
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{user.name || user.email}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                        <Badge variant={user.isActive ? "outline" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="text-center py-4 text-muted-foreground">
                No users found matching "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected User & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Operations</CardTitle>
            <CardDescription>
              Grant or revoke credits for the selected user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedUser ? (
              <>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{selectedUser.name || selectedUser.email}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                  {userCredits && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {userCredits.balance} credits
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex-1">
                        <Plus className="h-4 w-4 mr-2" />
                        Grant Credits
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Grant Credits</DialogTitle>
                        <DialogDescription>
                          Add credits to {selectedUser.name || selectedUser.email}'s account
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label htmlFor="grantAmount">Amount to Grant</Label>
                          <Input
                            id="grantAmount"
                            type="number"
                            min="1"
                            value={operation.amount}
                            onChange={(e) => setOperation(prev => ({ 
                              ...prev, 
                              amount: parseInt(e.target.value) || 0 
                            }))}
                            placeholder="Enter amount..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="grantReason">Reason</Label>
                          <Input
                            id="grantReason"
                            value={operation.reason}
                            onChange={(e) => setOperation(prev => ({ 
                              ...prev, 
                              reason: e.target.value 
                            }))}
                            placeholder="e.g., Account credit adjustment"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setIsGrantDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleGrantCredits}
                            disabled={grantCreditsMutation.isPending}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Grant Credits
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <Minus className="h-4 w-4 mr-2" />
                        Revoke Credits
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Revoke Credits</DialogTitle>
                        <DialogDescription>
                          Remove credits from {selectedUser.name || selectedUser.email}'s account
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label htmlFor="revokeAmount">Amount to Revoke</Label>
                          <Input
                            id="revokeAmount"
                            type="number"
                            min="1"
                            value={operation.amount}
                            onChange={(e) => setOperation(prev => ({ 
                              ...prev, 
                              amount: parseInt(e.target.value) || 0 
                            }))}
                            placeholder="Enter amount..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="revokeReason">Reason</Label>
                          <Input
                            id="revokeReason"
                            value={operation.reason}
                            onChange={(e) => setOperation(prev => ({ 
                              ...prev, 
                              reason: e.target.value 
                            }))}
                            placeholder="e.g., Policy violation adjustment"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setIsRevokeDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleRevokeCredits}
                            disabled={revokeCreditsMutation.isPending}
                          >
                            <Minus className="h-4 w-4 mr-2" />
                            Revoke Credits
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Search and select a user to manage their credits
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}