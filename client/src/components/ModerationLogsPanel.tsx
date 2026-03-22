import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Shield, Eye, RefreshCw, ChevronLeft, ChevronRight, Save, RotateCcw, FileText } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ModerationLog {
  id: number;
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  prompt: string;
  negativePrompt?: string | null;
  verdict: "ALLOW" | "ALLOW_WITH_REWRITE" | "BLOCK" | "ESCALATE";
  policyTags: string[] | null;
  reasons: string[] | null;
  safeRewrite: string | null;
  createdAt: string;
}

interface ModerationLogsResponse {
  logs: ModerationLog[];
  total: number;
  limit: number;
  offset: number;
}

interface SiteConfig {
  key: string;
  value: string;
  description: string;
  category: string;
  dataType: string;
}

interface ModerationPromptResponse {
  prompt: string;
  defaultPrompt: string;
  isUsingDefault: boolean;
}

export default function ModerationLogsPanel() {
  const { toast } = useToast();
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const logsPerPage = 20;
  const [selectedLog, setSelectedLog] = useState<ModerationLog | null>(null);
  const [promptText, setPromptText] = useState("");
  const [hasPromptChanges, setHasPromptChanges] = useState(false);

  const { data: moderationStatus, isLoading: statusLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/moderation-status"],
  });

  const { data: siteConfig } = useQuery<SiteConfig[]>({
    queryKey: ["/api/site-config"],
  });

  const { data: promptData, isLoading: promptLoading } = useQuery<ModerationPromptResponse>({
    queryKey: ["/api/admin/moderation-prompt"],
  });

  useEffect(() => {
    if (promptData?.prompt && !hasPromptChanges) {
      setPromptText(promptData.prompt);
    }
  }, [promptData?.prompt, hasPromptChanges]);

  const updatePromptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return apiRequest("PUT", "/api/admin/moderation-prompt", { prompt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation-prompt"] });
      setHasPromptChanges(false);
      toast({
        title: "Prompt Updated",
        description: "The moderation system prompt has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save moderation prompt.",
        variant: "destructive",
      });
    },
  });

  const resetPromptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/admin/moderation-prompt");
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setPromptText(data.defaultPrompt || "");
      setHasPromptChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation-prompt"] });
      toast({
        title: "Prompt Reset",
        description: "The moderation system prompt has been reset to default.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset moderation prompt.",
        variant: "destructive",
      });
    },
  });

  const moderationEnabled = siteConfig?.find(c => c.key === "moderation_enabled")?.value === "true";

  const { data: logsData, isLoading: logsLoading, refetch } = useQuery<ModerationLogsResponse>({
    queryKey: ["/api/admin/moderation-logs", verdictFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(logsPerPage));
      params.set("offset", String((page - 1) * logsPerPage));
      if (verdictFilter !== "all") {
        params.set("verdict", verdictFilter);
      }
      const response = await fetch(`/api/admin/moderation-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch moderation logs");
      return response.json();
    },
  });

  const toggleModerationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/site-config/moderation_enabled", {
        value: enabled ? "true" : "false",
      });
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation-status"] });
      toast({
        title: "Moderation Updated",
        description: `Prompt moderation has been ${enabled ? "enabled" : "disabled"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update moderation setting.",
        variant: "destructive",
      });
    },
  });

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "ALLOW":
        return <Badge className="bg-green-500">ALLOW</Badge>;
      case "ALLOW_WITH_REWRITE":
        return <Badge className="bg-blue-500">REWRITTEN</Badge>;
      case "BLOCK":
        return <Badge className="bg-red-500">BLOCKED</Badge>;
      case "ESCALATE":
        return <Badge className="bg-orange-500">ESCALATE</Badge>;
      default:
        return <Badge>{verdict}</Badge>;
    }
  };

  const totalPages = logsData ? Math.ceil(logsData.total / logsPerPage) : 0;

  const blockedCount = logsData?.logs.filter(l => l.verdict === "BLOCK").length || 0;
  const escalatedCount = logsData?.logs.filter(l => l.verdict === "ESCALATE").length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Content Moderation</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Saudi/GCC cultural safety moderation for AI-generated content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {moderationEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={moderationEnabled}
              onCheckedChange={(checked) => toggleModerationMutation.mutate(checked)}
              disabled={toggleModerationMutation.isPending}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{logsData?.total || 0}</div>
                <p className="text-xs text-muted-foreground">Total Checked</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">
                  {logsData?.logs.filter(l => l.verdict === "ALLOW").length || 0}
                </div>
                <p className="text-xs text-muted-foreground">Allowed</p>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{blockedCount}</div>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{escalatedCount}</div>
                <p className="text-xs text-muted-foreground">Escalated</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Customize the AI moderation rules and guidelines
                {promptData?.isUsingDefault && (
                  <Badge variant="secondary" className="ml-2">Using Default</Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {promptLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Loading prompt...
            </div>
          ) : (
            <>
              <Textarea
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setHasPromptChanges(true);
                }}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Enter the moderation system prompt..."
              />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {promptText.length} characters
                  {hasPromptChanges && (
                    <span className="text-orange-500 ml-2">(unsaved changes)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetPromptMutation.mutate()}
                    disabled={resetPromptMutation.isPending || promptData?.isUsingDefault}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updatePromptMutation.mutate(promptText)}
                    disabled={updatePromptMutation.isPending || !hasPromptChanges || !promptText.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updatePromptMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Moderation Logs</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={verdictFilter} onValueChange={(v) => { setVerdictFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by verdict" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verdicts</SelectItem>
                <SelectItem value="ALLOW">Allow</SelectItem>
                <SelectItem value="ALLOW_WITH_REWRITE">Rewritten</SelectItem>
                <SelectItem value="BLOCK">Blocked</SelectItem>
                <SelectItem value="ESCALATE">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : !logsData?.logs.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No moderation logs found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead className="max-w-xs">Prompt</TableHead>
                    <TableHead>Policy Tags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.logs.map((log) => (
                    <TableRow key={log.id} className={log.verdict === "BLOCK" || log.verdict === "ESCALATE" ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.createdAt), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{[log.firstName, log.lastName].filter(Boolean).join(" ") || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{log.email || log.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getVerdictBadge(log.verdict)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {(log.prompt || "").slice(0, 60)}{(log.prompt?.length || 0) > 60 ? "..." : ""}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {log.policyTags?.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(log.policyTags?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{log.policyTags!.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Moderation Details
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] pr-4">
                              <div className="space-y-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div>
                                    <span className="text-sm text-muted-foreground">User: </span>
                                    <span className="font-medium">{[log.firstName, log.lastName].filter(Boolean).join(" ") || "Unknown"}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm text-muted-foreground">Verdict: </span>
                                    {getVerdictBadge(log.verdict)}
                                  </div>
                                  <div>
                                    <span className="text-sm text-muted-foreground">Time: </span>
                                    {format(new Date(log.createdAt), "PPpp")}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2">Prompt</h4>
                                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                                    {log.prompt}
                                  </div>
                                </div>

                                {log.safeRewrite && (
                                  <div>
                                    <h4 className="font-medium mb-2 text-blue-600">Safe Rewrite</h4>
                                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md text-sm whitespace-pre-wrap">
                                      {log.safeRewrite}
                                    </div>
                                  </div>
                                )}

                                {log.reasons && log.reasons.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2 text-red-600">Reasons</h4>
                                    <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md text-sm">
                                      {log.reasons.join(", ")}
                                    </div>
                                  </div>
                                )}

                                {log.policyTags && log.policyTags.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2">Policy Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {log.policyTags.map((tag, i) => (
                                        <Badge key={i} variant="secondary">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-muted-foreground">
                                  User ID: {log.userId} | Log ID: {log.id}
                                  {log.email && ` | Email: ${log.email}`}
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * logsPerPage) + 1}-{Math.min(page * logsPerPage, logsData.total)} of {logsData.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
