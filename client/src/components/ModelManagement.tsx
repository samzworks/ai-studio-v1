import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Eye, EyeOff, SlidersHorizontal as Settings, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import type { BaseModel } from "@shared/model-routing";

interface AdminModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  type: "image" | "video";
  showKey: string;
  displayNameKey: string;
  isVisible: boolean;
  displayName: string;
}

export default function ModelManagement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch admin models (variants for visibility control)
  const { data: models, isLoading } = useQuery<AdminModel[]>({
    queryKey: ["/api/admin/models"],
  });

  // Fetch base models for default model selection (these use base model IDs)
  const { data: baseImageModels = [] } = useQuery<BaseModel[]>({
    queryKey: ["/api/base-models/image"],
  });

  const { data: baseVideoModels = [] } = useQuery<BaseModel[]>({
    queryKey: ["/api/base-models/video"],
  });

  // Fetch current admin settings to get default models
  const { data: settings } = useQuery({
    queryKey: ["/api/admin/settings"],
    select: (data: any[]) => data.reduce((acc, setting) => ({
      ...acc,
      [setting.key]: setting.value
    }), {})
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async (data: { key: string; value: any; category: string; description?: string }) => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update setting");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.configurationSaved"),
      });
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Handle form change
  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setPendingChanges(prev => new Set(Array.from(prev).concat([key])));
  };

  // Get current value
  const getCurrentValue = (key: string, model: AdminModel) => {
    if (formData[key] !== undefined) return formData[key];
    if (key === model.showKey) return model.isVisible;
    if (key === model.displayNameKey) return model.displayName;
    return "";
  };

  // Save setting
  const saveSetting = async (key: string, value: any, description: string) => {
    await updateSettingMutation.mutateAsync({
      key,
      value,
      category: "models",
      description,
    });

    setPendingChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });

    // Clear form data for this key
    setFormData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  // Save all pending changes
  const saveAllChanges = async () => {
    const pendingKeys = Array.from(pendingChanges);
    for (const key of pendingKeys) {
      const model = models?.find(m => m.showKey === key || m.displayNameKey === key);
      if (model) {
        const value = formData[key];
        const description = key === model.showKey ? 
          `Show ${model.name} model` : 
          `${model.name} display name`;
        await saveSetting(key, value, description);
      }
    }
  };

  // Separate models by type
  const imageModels = models?.filter(model => model.type === "image") || [];
  const videoModels = models?.filter(model => model.type === "video") || [];

  // Get current default models
  const defaultImageModel = getCurrentValue("default_image_model", { showKey: "default_image_model", displayNameKey: "", isVisible: true } as AdminModel) || settings?.default_image_model || "";
  const defaultVideoModel = getCurrentValue("default_video_model", { showKey: "default_video_model", displayNameKey: "", isVisible: true } as AdminModel) || settings?.default_video_model || "";

  // Handle default model changes
  const handleDefaultModelChange = (modelType: 'image' | 'video', modelId: string) => {
    const key = `default_${modelType}_model`;
    handleChange(key, modelId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading models...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <CardTitle>AI Model Management</CardTitle>
          </div>
          {pendingChanges.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{pendingChanges.size} pending</Badge>
              <Button
                onClick={saveAllChanges}
                disabled={updateSettingMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Save All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Model Selection Section */}
        <div className="space-y-6 border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-medium">Default Models</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Image Model */}
            <div className="space-y-2">
              <Label htmlFor="default-image-model" className="text-sm font-medium">
                Default Image Model
              </Label>
              <Select
                value={defaultImageModel}
                onValueChange={(value) => handleDefaultModelChange('image', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default image model" />
                </SelectTrigger>
                <SelectContent>
                  {baseImageModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pendingChanges.has("default_image_model") && (
                <Button
                  size="sm"
                  onClick={() => saveSetting(
                    "default_image_model", 
                    defaultImageModel,
                    "Default image model"
                  )}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Default
                </Button>
              )}
            </div>

            {/* Default Video Model */}
            <div className="space-y-2">
              <Label htmlFor="default-video-model" className="text-sm font-medium">
                Default Video Model
              </Label>
              <Select
                value={defaultVideoModel}
                onValueChange={(value) => handleDefaultModelChange('video', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default video model" />
                </SelectTrigger>
                <SelectContent>
                  {baseVideoModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pendingChanges.has("default_video_model") && (
                <Button
                  size="sm"
                  onClick={() => saveSetting(
                    "default_video_model", 
                    defaultVideoModel,
                    "Default video model"
                  )}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Default
                </Button>
              )}
            </div>
          </div>
        </div>
        {models?.map((model, index) => {
          const visibilityValue = getCurrentValue(model.showKey, model);
          const displayNameValue = getCurrentValue(model.displayNameKey, model);
          const hasVisibilityChange = pendingChanges.has(model.showKey);
          const hasDisplayNameChange = pendingChanges.has(model.displayNameKey);

          return (
            <div key={model.id}>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{model.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {model.provider}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {model.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{model.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {visibilityValue ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={visibilityValue}
                      onCheckedChange={(checked) => handleChange(model.showKey, checked)}
                    />
                    {hasVisibilityChange && (
                      <Button
                        size="sm"
                        onClick={() => saveSetting(
                          model.showKey, 
                          visibilityValue,
                          `Show ${model.name} model`
                        )}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={model.displayNameKey} className="text-sm">
                      Display Name
                    </Label>
                    <Input
                      id={model.displayNameKey}
                      value={displayNameValue}
                      onChange={(e) => handleChange(model.displayNameKey, e.target.value)}
                      placeholder={model.name}
                      className="mt-1"
                    />
                  </div>
                  {hasDisplayNameChange && (
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        onClick={() => saveSetting(
                          model.displayNameKey, 
                          displayNameValue,
                          `${model.name} display name`
                        )}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {index < (models?.length || 0) - 1 && <Separator className="mt-6" />}
            </div>
          );
        })}

        {(!models || models.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No models found
          </div>
        )}
      </CardContent>
    </Card>
  );
}