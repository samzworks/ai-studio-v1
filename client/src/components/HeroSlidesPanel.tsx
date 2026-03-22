import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Plus, Edit, Trash as Trash2, Eye, EyeOff, MoveUp, MoveDown, ImagePlus as ImageIcon, Upload, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { HeroSlide } from "@shared/schema";

interface HeroSlideFormData {
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

interface FileUploadFormData {
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  imageFile: File | null;
  sortOrder: number;
  isActive: boolean;
}

export function HeroSlidesPanel() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [imageInputMethod, setImageInputMethod] = useState<"url" | "upload">("url");
  const [formData, setFormData] = useState<HeroSlideFormData>({
    title: "",
    titleAr: "",
    subtitle: "",
    subtitleAr: "",
    imageUrl: "",
    sortOrder: 0,
    isActive: true,
  });
  const [fileFormData, setFileFormData] = useState<FileUploadFormData>({
    title: "",
    titleAr: "",
    subtitle: "",
    subtitleAr: "",
    imageFile: null,
    sortOrder: 0,
    isActive: true,
  });

  // Fetch all hero slides
  const { data: slides = [], isLoading } = useQuery<HeroSlide[]>({
    queryKey: ["/api/admin/hero-slides"],
  });

  // Create slide mutation (URL)
  const createSlideMutation = useMutation({
    mutationFn: async (data: HeroSlideFormData) => {
      const response = await fetch("/api/admin/hero-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create slide");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.heroSlideCreated"),
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Create slide mutation (File Upload)
  const createSlideWithFileMutation = useMutation({
    mutationFn: async (data: FileUploadFormData) => {
      if (!data.imageFile) throw new Error("No image file selected");
      
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("titleAr", data.titleAr);
      formData.append("subtitle", data.subtitle);
      formData.append("subtitleAr", data.subtitleAr);
      formData.append("sortOrder", data.sortOrder.toString());
      formData.append("isActive", data.isActive.toString());
      formData.append("image", data.imageFile);

      const response = await fetch("/api/admin/hero-slides/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to create slide");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.heroSlideCreated"),
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: t("toasts.error"),
        description: error.message || t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Update slide mutation
  const updateSlideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<HeroSlideFormData> }) => {
      const response = await fetch(`/api/admin/hero-slides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update slide");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.heroSlideUpdated"),
      });
      setEditingSlide(null);
      resetForm();
    },
    onError: () => {
      toast({
        title: t("toasts.error"),
        description: t("toasts.failed"),
        variant: "error-outline" as any,
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/hero-slides/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error("Failed to toggle status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.updated"),
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

  // Delete slide mutation
  const deleteSlideMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/hero-slides/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete slide");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({
        title: t("toasts.success"),
        description: t("toasts.heroSlideDeleted"),
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

  const resetForm = () => {
    setFormData({
      title: "",
      titleAr: "",
      subtitle: "",
      subtitleAr: "",
      imageUrl: "",
      sortOrder: 0,
      isActive: true,
    });
    setFileFormData({
      title: "",
      titleAr: "",
      subtitle: "",
      subtitleAr: "",
      imageFile: null,
      sortOrder: 0,
      isActive: true,
    });
    setImageInputMethod("url");
  };

  const handleCreateSlide = () => {
    if (imageInputMethod === "url") {
      createSlideMutation.mutate(formData);
    } else {
      createSlideWithFileMutation.mutate(fileFormData);
    }
  };

  const handleUpdateSlide = () => {
    if (!editingSlide) return;
    updateSlideMutation.mutate({ id: editingSlide.id, data: formData });
  };

  const handleEditSlide = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setFormData({
      title: slide.title,
      titleAr: slide.titleAr || "",
      subtitle: slide.subtitle,
      subtitleAr: slide.subtitleAr || "",
      imageUrl: slide.imageUrl,
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
    });
  };

  const handleToggleStatus = (id: number, isActive: boolean) => {
    toggleStatusMutation.mutate({ id, isActive });
  };

  const handleDeleteSlide = (id: number) => {
    if (confirm("Are you sure you want to delete this hero slide?")) {
      deleteSlideMutation.mutate(id);
    }
  };

  const sortedSlides = [...slides].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Hero Slides Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Hero Slide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Hero Slide</DialogTitle>
            </DialogHeader>
            
            <Tabs value={imageInputMethod} onValueChange={(value) => setImageInputMethod(value as "url" | "upload")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Image URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">Title (Large Headline)</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter main headline"
                  />
                </div>
                <div>
                  <Label htmlFor="titleAr">Title (Arabic)</Label>
                  <Input
                    id="titleAr"
                    value={formData.titleAr}
                    onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                    placeholder="أدخل العنوان الرئيسي بالعربية"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label htmlFor="subtitle">Subtitle (Secondary Text)</Label>
                  <Textarea
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Enter secondary text"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="subtitleAr">Subtitle (Arabic)</Label>
                  <Textarea
                    id="subtitleAr"
                    value={formData.subtitleAr}
                    onChange={(e) => setFormData({ ...formData, subtitleAr: e.target.value })}
                    placeholder="أدخل النص الثانوي بالعربية"
                    rows={3}
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                  />
                </div>
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="upload-title">Title (Large Headline)</Label>
                  <Input
                    id="upload-title"
                    value={fileFormData.title}
                    onChange={(e) => setFileFormData({ ...fileFormData, title: e.target.value })}
                    placeholder="Enter main headline"
                  />
                </div>
                <div>
                  <Label htmlFor="upload-titleAr">Title (Arabic)</Label>
                  <Input
                    id="upload-titleAr"
                    value={fileFormData.titleAr}
                    onChange={(e) => setFileFormData({ ...fileFormData, titleAr: e.target.value })}
                    placeholder="أدخل العنوان الرئيسي بالعربية"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label htmlFor="upload-subtitle">Subtitle (Secondary Text)</Label>
                  <Textarea
                    id="upload-subtitle"
                    value={fileFormData.subtitle}
                    onChange={(e) => setFileFormData({ ...fileFormData, subtitle: e.target.value })}
                    placeholder="Enter secondary text"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="upload-subtitleAr">Subtitle (Arabic)</Label>
                  <Textarea
                    id="upload-subtitleAr"
                    value={fileFormData.subtitleAr}
                    onChange={(e) => setFileFormData({ ...fileFormData, subtitleAr: e.target.value })}
                    placeholder="أدخل النص الثانوي بالعربية"
                    rows={3}
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label htmlFor="imageFile">Image File</Label>
                  <div className="mt-2">
                    <Input
                      id="imageFile"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setFileFormData({ ...fileFormData, imageFile: file });
                      }}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload JPG, PNG, or WebP images. Recommended size: 1920x1080px
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="upload-sortOrder">Sort Order</Label>
                  <Input
                    id="upload-sortOrder"
                    type="number"
                    value={fileFormData.sortOrder}
                    onChange={(e) => setFileFormData({ ...fileFormData, sortOrder: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="upload-isActive"
                    checked={fileFormData.isActive}
                    onCheckedChange={(checked) => setFileFormData({ ...fileFormData, isActive: checked })}
                  />
                  <Label htmlFor="upload-isActive">Active</Label>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSlide}
                disabled={createSlideMutation.isPending || createSlideWithFileMutation.isPending}
              >
                {createSlideMutation.isPending || createSlideWithFileMutation.isPending ? "Creating..." : "Create Slide"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading hero slides...</div>
      ) : sortedSlides.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No hero slides found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first hero slide to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedSlides.map((slide) => (
            <Card key={slide.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{slide.title}</CardTitle>
                      <Badge variant={slide.isActive ? "default" : "secondary"}>
                        {slide.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">Order: {slide.sortOrder}</Badge>
                    </div>
                    {slide.titleAr && (
                      <p className="text-base font-medium" dir="rtl">
                        {slide.titleAr}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
                    {slide.subtitleAr && (
                      <p className="text-sm text-muted-foreground mt-1" dir="rtl">
                        {slide.subtitleAr}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(slide.id, !slide.isActive)}
                      disabled={toggleStatusMutation.isPending}
                    >
                      {slide.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSlide(slide)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSlide(slide.id)}
                      disabled={deleteSlideMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-muted-foreground"><ImageIcon class="w-8 h-8" /></div>';
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingSlide && (
        <Dialog open={true} onOpenChange={() => setEditingSlide(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Hero Slide</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title (Large Headline)</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter main headline"
                />
              </div>
              <div>
                <Label htmlFor="edit-titleAr">Title (Arabic)</Label>
                <Input
                  id="edit-titleAr"
                  value={formData.titleAr}
                  onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                  placeholder="أدخل العنوان الرئيسي بالعربية"
                  dir="rtl"
                />
              </div>
              <div>
                <Label htmlFor="edit-subtitle">Subtitle (Secondary Text)</Label>
                <Textarea
                  id="edit-subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Enter secondary text"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-subtitleAr">Subtitle (Arabic)</Label>
                <Textarea
                  id="edit-subtitleAr"
                  value={formData.subtitleAr}
                  onChange={(e) => setFormData({ ...formData, subtitleAr: e.target.value })}
                  placeholder="أدخل النص الثانوي بالعربية"
                  rows={3}
                  dir="rtl"
                />
              </div>
              <div>
                <Label htmlFor="edit-imageUrl">Image URL</Label>
                <Input
                  id="edit-imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="Enter image URL"
                />
              </div>
              <div>
                <Label htmlFor="edit-sortOrder">Sort Order</Label>
                <Input
                  id="edit-sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingSlide(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateSlide}
                  disabled={updateSlideMutation.isPending}
                >
                  Update Slide
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
