import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Timer as Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CreditRequest {
  id: number;
  userId: string;
  message: string;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAmount?: number;
  adminNote?: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function CreditRequestsManagement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const { data: requests, isLoading } = useQuery<CreditRequest[]>({
    queryKey: ["/api/credit-requests", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/credit-requests" 
        : `/api/credit-requests?status=${statusFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch credit requests");
      return response.json();
    },
  });

  const processRequestMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      approvedAmount, 
      adminNote 
    }: { 
      id: number; 
      status: 'approved' | 'rejected'; 
      approvedAmount?: number; 
      adminNote?: string;
    }) => {
      const body: any = { status };
      if (status === 'approved' && approvedAmount) {
        body.approvedAmount = approvedAmount;
      }
      if (adminNote) {
        body.adminNote = adminNote;
      }
      
      const response = await fetch(`/api/credit-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new Error('Failed to process credit request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-requests"] });
      setSelectedRequest(null);
      setApprovedAmount("");
      setAdminNote("");
      toast({
        title: t("toasts.success"),
        description: t("toasts.operationCompleted"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    
    const amount = parseInt(approvedAmount);
    if (!approvedAmount || isNaN(amount) || amount <= 0) {
      toast({
        title: t("toasts.invalidAmount"),
        description: t("toasts.invalidAmountDescription"),
        variant: "error-outline" as any,
      });
      return;
    }

    processRequestMutation.mutate({
      id: selectedRequest.id,
      status: 'approved',
      approvedAmount: amount,
      adminNote,
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;

    processRequestMutation.mutate({
      id: selectedRequest.id,
      status: 'rejected',
      adminNote,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getUserName = (request: CreditRequest) => {
    if (request.user) {
      if (request.user.firstName && request.user.lastName) {
        return `${request.user.firstName} ${request.user.lastName}`;
      }
      return request.user.email || 'Unknown';
    }
    return 'Unknown';
  };

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Credit Requests</CardTitle>
              <CardDescription>Manage user credit requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  {pendingCount} Pending
                </Badge>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requests</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests && requests.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getUserName(request)}</div>
                          <div className="text-sm text-muted-foreground">{request.user?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.requestedAmount} credits</div>
                        {request.approvedAmount && request.status === 'approved' && (
                          <div className="text-sm text-muted-foreground">
                            Approved: {request.approvedAmount}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate">{request.message}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(request.createdAt), "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(request.createdAt), "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setApprovedAmount(request.requestedAmount.toString());
                              setAdminNote("");
                            }}
                            data-testid={`button-review-${request.id}`}
                          >
                            Review
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setApprovedAmount("");
                              setAdminNote("");
                            }}
                            data-testid={`button-view-${request.id}`}
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {statusFilter === "all" 
                ? "No credit requests found" 
                : `No ${statusFilter} credit requests`}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Credit Request Details</DialogTitle>
            <DialogDescription>
              Review and process this credit request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">User</Label>
                  <div className="font-medium">{getUserName(selectedRequest)}</div>
                  <div className="text-sm text-muted-foreground">{selectedRequest.user?.email}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Requested Amount</Label>
                <div className="font-medium text-lg">{selectedRequest.requestedAmount} credits</div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Message</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  {selectedRequest.message}
                </div>
              </div>

              {selectedRequest.status === 'pending' ? (
                <>
                  <div>
                    <Label htmlFor="approvedAmount">Approved Amount (Credits)</Label>
                    <Input
                      id="approvedAmount"
                      type="number"
                      min="1"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      placeholder="Enter approved amount"
                      data-testid="input-approved-amount"
                    />
                  </div>

                  <div>
                    <Label htmlFor="adminNote">Admin Note (Optional)</Label>
                    <Textarea
                      id="adminNote"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add a note for the user..."
                      rows={3}
                      data-testid="input-admin-note"
                    />
                  </div>
                </>
              ) : (
                <>
                  {selectedRequest.approvedAmount && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Approved Amount</Label>
                      <div className="font-medium">{selectedRequest.approvedAmount} credits</div>
                    </div>
                  )}
                  {selectedRequest.adminNote && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Admin Note</Label>
                      <div className="mt-1 p-3 bg-muted rounded-md">
                        {selectedRequest.adminNote}
                      </div>
                    </div>
                  )}
                  {selectedRequest.processedAt && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Processed At</Label>
                      <div className="text-sm">
                        {format(new Date(selectedRequest.processedAt), "PPpp")}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {selectedRequest?.status === 'pending' && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={processRequestMutation.isPending}
                data-testid="button-reject-request"
              >
                {processRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </>
                )}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processRequestMutation.isPending}
                data-testid="button-approve-request"
              >
                {processRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
