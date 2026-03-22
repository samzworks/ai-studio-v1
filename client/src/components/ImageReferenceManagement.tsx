import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
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
import { Plus, Edit, Trash as Trash2, Upload, X, ImagePlus as ImageIcon } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ImageReferenceCategory, ImageReferenceImage } from "@shared/schema";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().min(0).default(0),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function ImageReferenceManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<ImageReferenceCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);

  const { data: categories = [], isLoading } = useQuery<ImageReferenceCategory[]>({
    queryKey: ["/api/image-references/categories"],
  });

  const { data: categoryImages = [] } = useQuery<ImageReferenceImage[]>({
    queryKey: ["/api/image-references/categories", selectedCategory, "images"],
    queryFn: () => 
      fetch(`/api/image-references/categories/${selectedCategory}/images`).then(res => res.json()),
    enabled: !!selectedCategory,
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      isActive: true,
      sortOrder: 0,
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await fetch("/api/image-references/categories", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-references/categories"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: t('toasts.success'),
        description: t('toasts.created'),
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

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CategoryFormData> }) => {
      const response = await fetch(`/api/image-references/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-references/categories"] });
      setEditingCategory(null);
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: t('toasts.success'),
        description: t('toasts.updated'),
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/image-references/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-references/categories"] });
      if (selectedCategory) {
        setSelectedCategory(null);
      }
      toast({
        title: t('toasts.success'),
        description: t('toasts.deleted'),
      });
    },
  });

  const uploadImagesMutation = useMutation({
    mutationFn: async ({ categoryId, files }: { categoryId: number; files: FileList }) => {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }
      
      const response = await fetch(`/api/image-references/categories/${categoryId}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-references/categories", selectedCategory, "images"] });
      setUploadFiles(null);
      toast({
        title: t('toasts.success'),
        description: t('toasts.uploaded'),
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/image-references/images/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-references/categories", selectedCategory, "images"] });
      toast({
        title: t('toasts.success'),
        description: t('toasts.deleted'),
      });
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleEdit = (category: ImageReferenceCategory) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleUpload = () => {
    if (!selectedCategory || !uploadFiles || uploadFiles.length === 0) return;
    
    if (categoryImages.length + uploadFiles.length > 10) {
      toast({
        title: t('toasts.error'),
        description: t('toasts.maxImagesPerCategory'),
        variant: "destructive",
      });
      return;
    }
    
    uploadImagesMutation.mutate({ categoryId: selectedCategory, files: uploadFiles });
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Reference Categories</CardTitle>
              <CardDescription>Manage image reference categories for Saudi Model</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingCategory(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-category">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update category details" : "Create a new reference category"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Jazan, Riyadh" {...field} data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., jazan, riyadh" {...field} data-testid="input-category-slug" />
                          </FormControl>
                          <FormDescription>
                            Lowercase letters, numbers, and hyphens only
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Description of this category" {...field} data-testid="input-category-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sortOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Order</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-category-sort" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>
                              Make this category available for use
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-category-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending} data-testid="button-save-category">
                        {editingCategory ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {categories.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No categories yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedCategory === category.id ? "border-primary bg-accent" : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                    data-testid={`category-item-${category.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{category.name}</h3>
                          {!category.isActive && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Slug: {category.slug}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(category);
                          }}
                          data-testid={`button-edit-category-${category.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this category and all its images?")) {
                              deleteCategoryMutation.mutate(category.id);
                            }
                          }}
                          data-testid={`button-delete-category-${category.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference Images</CardTitle>
          <CardDescription>
            {selectedCategory 
              ? `Manage images for ${categories.find(c => c.id === selectedCategory)?.name || "category"} (max 10)`
              : "Select a category to manage images"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedCategory ? (
            <>
              {categoryImages.length < 10 && (
                <div className="mb-4">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setUploadFiles(e.target.files)}
                    className="mb-2"
                    data-testid="input-upload-images"
                  />
                  <Button
                    onClick={handleUpload}
                    disabled={!uploadFiles || uploadImagesMutation.isPending}
                    data-testid="button-upload-images"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Images
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    {categoryImages.length} / 10 images uploaded
                  </p>
                </div>
              )}
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 gap-4">
                  {categoryImages.map((image) => (
                    <div key={image.id} className="relative group" data-testid={`image-item-${image.id}`}>
                      <img
                        src={image.url}
                        alt={`Reference ${image.id}`}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          if (confirm("Delete this image?")) {
                            deleteImageMutation.mutate(image.id);
                          }
                        }}
                        data-testid={`button-delete-image-${image.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a category to view images</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
