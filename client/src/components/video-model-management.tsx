import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash as Trash2, SlidersHorizontal as Settings, Timer as Clock, ToggleLeft, ToggleRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VideoModelConfig {
  id: number;
  modelId: string;
  estimatedTimeSeconds: number;
  customStageLabels?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VideoModel {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
}

const videoModelConfigSchema = z.object({
  modelId: z.string().min(1, "Model ID is required"),
  estimatedTimeSeconds: z.number().min(10, "Must be at least 10 seconds").max(600, "Must be less than 10 minutes"),
  customStageLabels: z.array(z.string().min(1, "Stage label cannot be empty")).optional(),
  isActive: z.boolean().default(true),
});

type VideoModelConfigFormData = z.infer<typeof videoModelConfigSchema>;

export default function VideoModelManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VideoModelConfig | null>(null);
  const [stageLabelsText, setStageLabelsText] = useState("");

  // Fetch available video models (from ai-models.ts)
  const { data: videoModels = [] } = useQuery<VideoModel[]>({
    queryKey: ["/api/video-models"],
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
  });

  // Fetch video model configurations
  const { data: configs = [], isLoading } = useQuery<VideoModelConfig[]>({
    queryKey: ["/api/admin/video-model-configs"],
  });

  const form = useForm<VideoModelConfigFormData>({
    resolver: zodResolver(videoModelConfigSchema),
    defaultValues: {
      modelId: "",
      estimatedTimeSeconds: 60,
      customStageLabels: undefined,
      isActive: true,
    },
  });

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (data: VideoModelConfigFormData) => {
      return await apiRequest("POST", "/api/admin/video-model-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-model-configs"] });
      setIsDialogOpen(false);
      form.reset();
      setStageLabelsText("");
      toast({
        title: t('toasts.success'),
        description: t('toasts.created'),
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

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ modelId, data }: { modelId: string; data: Partial<VideoModelConfigFormData> }) => {
      return await apiRequest("PUT", `/api/admin/video-model-configs/${modelId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-model-configs"] });
      setIsDialogOpen(false);
      setEditingConfig(null);
      form.reset();
      setStageLabelsText("");
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

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return await apiRequest("DELETE", `/api/admin/video-model-configs/${modelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-model-configs"] });
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

  // Handle form submission
  const onSubmit = (data: VideoModelConfigFormData) => {
    // Parse custom stage labels from textarea
    const customLabels = stageLabelsText.trim() 
      ? stageLabelsText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
      : undefined;

    const configData = {
      ...data,
      customStageLabels: customLabels,
    };

    if (editingConfig) {
      updateConfigMutation.mutate({ modelId: editingConfig.modelId, data: configData });
    } else {
      createConfigMutation.mutate(configData);
    }
  };

  // Handle edit
  const handleEdit = (config: VideoModelConfig) => {
    setEditingConfig(config);
    form.reset({
      modelId: config.modelId,
      estimatedTimeSeconds: config.estimatedTimeSeconds,
      isActive: config.isActive,
    });
    setStageLabelsText(config.customStageLabels?.join('\n') || "");
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (modelId: string) => {
    if (confirm("Are you sure you want to delete this configuration?")) {
      deleteConfigMutation.mutate(modelId);
    }
  };

  // Get available models for selection (exclude already configured ones)
  const availableModels = videoModels.filter(model => 
    !configs.some(config => config.modelId === model.id)
  );

  const getModelName = (modelId: string) => {
    const model = videoModels.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Video Model Progress Configurations
            </CardTitle>
            <CardDescription>
              Configure estimated generation times and progress UI settings for video models
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingConfig(null);
                form.reset();
                setStageLabelsText("");
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Edit Configuration" : "Add Video Model Configuration"}
                </DialogTitle>
                <DialogDescription>
                  Configure progress tracking settings for a video generation model
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="modelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Model</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            disabled={!!editingConfig}
                            className="w-full p-2 border rounded-md"
                          >
                            <option value="">Select a model</option>
                            {(editingConfig ? videoModels : availableModels).map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name} ({model.provider})
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimatedTimeSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Generation Time (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="10"
                            max="600"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  <div className="space-y-2">
                    <Label>Custom Stage Labels (one per line, optional)</Label>
                    <Textarea
                      placeholder="Analyzing prompt...&#10;Building scene...&#10;Animating frames...&#10;Enhancing details...&#10;Finalizing video...&#10;Wrapping up..."
                      value={stageLabelsText}
                      onChange={(e) => setStageLabelsText(e.target.value)}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use default stage labels. Each line represents a stage.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Active Configuration</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Whether this configuration is currently active
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createConfigMutation.isPending || updateConfigMutation.isPending}>
                      {createConfigMutation.isPending || updateConfigMutation.isPending ? "Saving..." : (editingConfig ? "Update" : "Create")}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading configurations...</div>
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Configurations</h3>
            <p className="text-muted-foreground mb-4">
              Add your first video model configuration to enable progress tracking.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {configs.map((config) => (
                <div key={config.modelId} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{getModelName(config.modelId)}</h4>
                      <p className="text-sm text-muted-foreground">Model ID: {config.modelId}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{config.estimatedTimeSeconds}s estimated</span>
                        </div>
                        <Badge variant={config.isActive ? "default" : "outline"}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {config.customStageLabels && config.customStageLabels.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Custom stages:</p>
                          <div className="text-xs text-muted-foreground">
                            {config.customStageLabels.slice(0, 3).join(" → ")}
                            {config.customStageLabels.length > 3 && " → ..."}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(config)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(config.modelId)}
                        disabled={deleteConfigMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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