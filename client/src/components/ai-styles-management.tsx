import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Palette, Plus, Edit, Trash as Trash2, Eye, EyeOff } from "lucide-react";

interface AiStyle {
  id: number;
  name: string;
  description?: string;
  promptText: string;
  isVisible: boolean;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const aiStyleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  promptText: z.string().min(1, "Prompt is required"),
  category: z.string().default("general"),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().min(0).default(0),
});

type AiStyleFormData = z.infer<typeof aiStyleSchema>;

export default function AiStylesManagement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingStyle, setEditingStyle] = useState<AiStyle | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: styles = [], isLoading } = useQuery<AiStyle[]>({
    queryKey: ["/api/admin/ai-styles"],
  });

  const form = useForm<AiStyleFormData>({
    resolver: zodResolver(aiStyleSchema),
    defaultValues: {
      name: "",
      description: "",
      promptText: "",
      category: "general",
      isVisible: true,
      sortOrder: 0,
    },
  });

  const createStyleMutation = useMutation({
    mutationFn: async (data: AiStyleFormData) => {
      const response = await fetch("/api/admin/ai-styles", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-styles"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: t("toasts.success"),
        description: t("toasts.styleCreated"),
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

  const updateStyleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AiStyleFormData }) => {
      const response = await fetch(`/api/admin/ai-styles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-styles"] });
      setIsDialogOpen(false);
      setEditingStyle(null);
      form.reset();
      toast({
        title: t("toasts.success"),
        description: t("toasts.styleUpdated"),
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

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: number; isVisible: boolean }) => {
      const response = await fetch(`/api/admin/ai-styles/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-styles"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.updated"),
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

  const deleteStyleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/ai-styles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-styles"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.styleDeleted"),
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

  const initDefaultStylesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/ai-styles/init-defaults", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-styles"] });
      toast({
        title: t("toasts.success"),
        description: `Created ${data.created} new styles, ${data.skipped} already existed`,
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

  const openCreateDialog = () => {
    setEditingStyle(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (style: AiStyle) => {
    setEditingStyle(style);
    form.reset({
      name: style.name,
      description: style.description || "",
      promptText: style.promptText,
      category: style.category,
      isVisible: style.isVisible,
      sortOrder: style.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: AiStyleFormData) => {
    if (editingStyle) {
      updateStyleMutation.mutate({ id: editingStyle.id, data });
    } else {
      createStyleMutation.mutate(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              AI Styles Management
            </CardTitle>
            <CardDescription>
              Create and manage custom AI generation styles that users can apply to their prompts.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => initDefaultStylesMutation.mutate()}
              disabled={initDefaultStylesMutation.isPending}
              data-testid="button-init-default-styles"
            >
              {initDefaultStylesMutation.isPending ? "Loading..." : "Load Default Styles"}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} data-testid="button-add-style">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Style
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingStyle ? "Edit AI Style" : "Create AI Style"}
                </DialogTitle>
                <DialogDescription>
                  {editingStyle 
                    ? "Update the AI style settings and prompts."
                    : "Create a new AI style that users can apply to their image generations."
                  }
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Style Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Photorealistic" {...field} />
                          </FormControl>
                          <FormDescription>
                            The name users will see in the style selector
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., photography, art, design" {...field} />
                          </FormControl>
                          <FormDescription>
                            Category for organizing styles
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the style" {...field} />
                        </FormControl>
                        <FormDescription>
                          Help users understand when to use this style
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promptText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AI Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the prompt that will be added to user inputs"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt will be combined with user prompts to enhance image generation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sortOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Order</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Lower numbers appear first in lists
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isVisible"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Visible to Users</FormLabel>
                            <FormDescription>
                              Whether this style appears in the user interface
                            </FormDescription>
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
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createStyleMutation.isPending || updateStyleMutation.isPending}
                    >
                      {editingStyle ? "Update Style" : "Create Style"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : styles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No AI styles created yet</p>
            <p className="text-sm">Create your first style to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {styles.map((style: AiStyle) => (
                <div key={style.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-lg">{style.name}</h3>
                        <Badge variant="outline">{style.category}</Badge>
                        <Badge variant={style.isVisible ? "default" : "secondary"}>
                          {style.isVisible ? (
                            <>
                              <Eye className="w-3 h-3 mr-1" />
                              Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 mr-1" />
                              Hidden
                            </>
                          )}
                        </Badge>
                      </div>
                      {style.description && (
                        <p className="text-sm text-muted-foreground">{style.description}</p>
                      )}
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Prompt:</span>
                          <p className="text-sm mt-1 bg-muted p-2 rounded">{style.promptText}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sort Order: {style.sortOrder}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(style)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleVisibilityMutation.mutate({ 
                          id: style.id, 
                          isVisible: !style.isVisible 
                        })}
                        disabled={toggleVisibilityMutation.isPending}
                      >
                        {style.isVisible ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Show
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${style.name}"?`)) {
                            deleteStyleMutation.mutate(style.id);
                          }
                        }}
                        disabled={deleteStyleMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
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