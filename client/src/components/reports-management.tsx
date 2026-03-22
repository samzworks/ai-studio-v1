import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, Trash as Trash2, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImageReport {
  id: number;
  imageId: number;
  reporterId: string;
  reason: string;
  description?: string;
  status: "pending" | "dismissed" | "resolved";
  createdAt: string;
  reporterName?: string;
  imageThumbnail?: string;
}

export default function ReportsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<ImageReport | null>(null);

  const { data: reports = [], isLoading } = useQuery<ImageReport[]>({
    queryKey: ["/api/admin/reports"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: number; status: string }) => {
      return await apiRequest(`/api/admin/reports/${reportId}/status`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({
        title: t('toasts.success'),
        description: t('toasts.updated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.error'),
        description: error.message || t('toasts.failed'),
        variant: "error-outline" as any,
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return await apiRequest(`/api/admin/reports/${reportId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({
        title: t('toasts.success'),
        description: t('toasts.deleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.error'),
        description: error.message || t('toasts.failed'),
        variant: "error-outline" as any,
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "dismissed": return "bg-gray-500";
      case "resolved": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <AlertTriangle className="w-4 h-4" />;
      case "dismissed": return <XCircle className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Image Reports Management
        </CardTitle>
        <CardDescription>
          Review and manage user-reported images. Take action on inappropriate content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No reports found</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {reports.map((report: ImageReport) => (
                <div key={report.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(report.status)} text-white`}>
                          {getStatusIcon(report.status)}
                          <span className="ml-1 capitalize">{report.status}</span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Report #{report.id}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="font-medium">Reason: {report.reason}</p>
                        {report.description && (
                          <p className="text-sm text-muted-foreground">
                            Description: {report.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Reported by: {report.reporterName || "Unknown"} on{" "}
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {report.imageThumbnail && (
                      <div className="ml-4">
                        <img
                          src={report.imageThumbnail}
                          alt="Reported content"
                          className="w-16 h-16 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedReport(report)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>

                    {report.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ 
                            reportId: report.id, 
                            status: "dismissed" 
                          })}
                          disabled={updateStatusMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ 
                            reportId: report.id, 
                            status: "resolved" 
                          })}
                          disabled={updateStatusMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolve
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteReportMutation.mutate(report.id)}
                      disabled={deleteReportMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}