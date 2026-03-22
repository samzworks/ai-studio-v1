import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Save, FileText, WandSparkles as Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RandomPrompt {
  id: number;
  prompt: string;
  createdAt: string;
}

export default function RandomPromptsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [promptsText, setPromptsText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const { data: prompts = [], isLoading } = useQuery<RandomPrompt[]>({
    queryKey: ["/api/admin/random-prompts"],
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/random-prompts/count"],
  });

  // Update textarea when prompts are loaded
  useEffect(() => {
    if (prompts.length > 0) {
      setPromptsText(prompts.map(p => p.prompt).join('\n'));
    }
  }, [prompts]);

  const savePromptsMutation = useMutation({
    mutationFn: async (promptsData: string) => {
      const response = await fetch("/api/admin/random-prompts/save", {
        method: "POST",
        body: JSON.stringify({ prompts: promptsData }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save prompts");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/random-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/random-prompts/count"] });
      toast({
        title: t('toasts.success'),
        description: data.message || t('toasts.updated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.error'),
        description: error.message || t('toasts.failed'),
        variant: "destructive",
      });
    },
  });

  const uploadCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch("/api/admin/random-prompts/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/random-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/random-prompts/count"] });
      setCsvFile(null);
      // Reset file input
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      toast({
        title: t('toasts.success'),
        description: data.message || t('toasts.uploaded'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.error'),
        description: error.message || t('toasts.failed'),
        variant: "destructive",
      });
    },
  });

  const handleSaveTextarea = () => {
    savePromptsMutation.mutate(promptsText);
  };

  const handleCsvUpload = () => {
    if (csvFile) {
      uploadCsvMutation.mutate(csvFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-random-prompts-management">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Random Prompts Management
              </CardTitle>
              <CardDescription>
                Manage the list of random prompts shown to users when they click the random button
              </CardDescription>
            </div>
            <Badge variant="secondary" data-testid="badge-prompts-count">
              {countData?.count || 0} prompts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Upload Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload CSV File
            </Label>
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with one prompt per line. This will replace all existing prompts.
            </p>
            <div className="flex gap-3">
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                data-testid="input-csv-file"
                className="flex-1"
              />
              <Button
                onClick={handleCsvUpload}
                disabled={!csvFile || uploadCsvMutation.isPending}
                data-testid="button-upload-csv"
              >
                {uploadCsvMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          {/* Manual Edit Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Edit Prompts Manually
            </Label>
            <p className="text-sm text-muted-foreground">
              Enter one prompt per line. This will replace all existing prompts when saved.
            </p>
            <Textarea
              value={promptsText}
              onChange={(e) => setPromptsText(e.target.value)}
              placeholder="Enter prompts, one per line..."
              className="min-h-[300px] font-mono text-sm"
              data-testid="textarea-prompts"
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {promptsText.split('\n').filter(line => line.trim()).length} prompts in editor
              </p>
              <Button
                onClick={handleSaveTextarea}
                disabled={savePromptsMutation.isPending}
                data-testid="button-save-prompts"
              >
                <Save className="h-4 w-4 mr-2" />
                {savePromptsMutation.isPending ? "Saving..." : "Save Prompts"}
              </Button>
            </div>
          </div>

          {isLoading && (
            <p className="text-center text-muted-foreground">Loading prompts...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
