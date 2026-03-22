import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash as Trash2, Eye, EyeOff, Clapperboard as Video, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoStyle {
  id: number;
  name: string;
  promptText: string;
  isVisible: boolean;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const videoStyleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  promptText: z.string().min(1, "Prompt is required"),
  category: z.string().default("general"),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().min(0).default(0),
});

type VideoStyleFormData = z.infer<typeof videoStyleSchema>;

export default function VideoStylesManagement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<VideoStyle | null>(null);

  const { data: styles = [], isLoading } = useQuery<VideoStyle[]>({
    queryKey: ["/api/admin/video-styles"],
  });

  const form = useForm<VideoStyleFormData>({
    resolver: zodResolver(videoStyleSchema),
    defaultValues: {
      name: "",
      promptText: "",
      category: "general",
      isVisible: true,
      sortOrder: 0,
    },
  });

  const createStyleMutation = useMutation({
    mutationFn: async (data: VideoStyleFormData) => {
      const response = await fetch("/api/admin/video-styles", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-styles"] });
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
    mutationFn: async ({ id, data }: { id: number; data: VideoStyleFormData }) => {
      const response = await fetch(`/api/admin/video-styles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-styles"] });
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
      const response = await fetch(`/api/admin/video-styles/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-styles"] });
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
      const response = await fetch(`/api/admin/video-styles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-styles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-styles"] });
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

  const openCreateDialog = () => {
    setEditingStyle(null);
    form.reset({
      name: "",
      promptText: "",
      category: "general",
      isVisible: true,
      sortOrder: styles.length,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (style: VideoStyle) => {
    setEditingStyle(style);
    form.reset({
      name: style.name,
      promptText: style.promptText,
      category: style.category,
      isVisible: style.isVisible,
      sortOrder: style.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: VideoStyleFormData) => {
    if (editingStyle) {
      updateStyleMutation.mutate({ id: editingStyle.id, data });
    } else {
      createStyleMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold tracking-tight">Video Styles</h3>
          <p className="text-muted-foreground">
            Manage video generation styles that users can apply to their videos
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Style
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStyle ? "Edit Video Style" : "Create Video Style"}
              </DialogTitle>
              <DialogDescription>
                {editingStyle 
                  ? "Update the video style settings and prompts."
                  : "Create a new video style that users can apply to their video generations."
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
                          <Input placeholder="e.g., Cinematic" {...field} />
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
                          <Input placeholder="e.g., cinematic, artistic, motion" {...field} />
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
                  name="promptText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt Text</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., cinematic style with dramatic lighting and smooth camera movements"
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This text will be automatically added to user prompts when they select this style
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
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Lower numbers appear first in the list
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isVisible"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Visible to Users</FormLabel>
                          <FormDescription>
                            Controls whether this style appears in the user interface
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300"
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
                    {(createStyleMutation.isPending || updateStyleMutation.isPending) && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {editingStyle ? "Update Style" : "Create Style"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : styles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No video styles created yet</p>
            <p className="text-sm">Create your first style to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 p-4">
              {styles.map((style: VideoStyle) => (
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
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${style.name}"? This action cannot be undone.`)) {
                            deleteStyleMutation.mutate(style.id);
                          }
                        }}
                        disabled={deleteStyleMutation.isPending}
                        className="text-red-600 hover:text-red-700"
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
      </div>
    </div>
  );
}