import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash as Trash2, ArrowUp, ArrowDown, ImagePlus as ImageIcon, Upload, Loader2, Clapperboard as VideoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface TeaserGalleryItem {
  id: number;
  imageUrl: string;
  captionEn: string;
  captionAr: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TeaserShowcaseVideo {
  id: number;
  videoUrl: string;
  captionEn: string;
  captionAr: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HeroVideos {
  id: number;
  desktopVideoUrl: string;
  mobileVideoUrl: string;
  isActive: boolean;
  updatedAt: string;
}

interface FormData {
  imageUrl: string;
  captionEn: string;
  captionAr: string;
  sortOrder: number;
  isActive: boolean;
}

const defaultFormData: FormData = {
  imageUrl: "",
  captionEn: "",
  captionAr: "",
  sortOrder: 0,
  isActive: true,
};

export default function TeaserGalleryManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeaserGalleryItem | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery<TeaserGalleryItem[]>({
    queryKey: ["/api/admin/teaser-gallery"],
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formDataUpload = new window.FormData();
      formDataUpload.append('image', file);
      
      const response = await fetch('/api/admin/teaser-gallery/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });
      
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = `Upload failed: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: result.imageUrl }));
      toast({ title: "Success", description: "Image uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/admin/teaser-gallery", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teaser-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teaser-gallery"] });
      setIsAddDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Success", description: "Gallery item created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create gallery item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FormData> }) => {
      return apiRequest("PATCH", `/api/admin/teaser-gallery/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teaser-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teaser-gallery"] });
      setEditingItem(null);
      setFormData(defaultFormData);
      toast({ title: "Success", description: "Gallery item updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update gallery item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/teaser-gallery/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teaser-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teaser-gallery"] });
      toast({ title: "Success", description: "Gallery item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete gallery item", variant: "destructive" });
    },
  });

  const sortMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: number; sortOrder: number }) => {
      return apiRequest("PATCH", `/api/admin/teaser-gallery/${id}/sort`, { sortOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teaser-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teaser-gallery"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: TeaserGalleryItem) => {
    setEditingItem(item);
    setFormData({
      imageUrl: item.imageUrl,
      captionEn: item.captionEn,
      captionAr: item.captionAr,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
  };

  const handleMoveUp = (item: TeaserGalleryItem, index: number) => {
    if (index === 0) return;
    const prevItem = items[index - 1];
    sortMutation.mutate({ id: item.id, sortOrder: prevItem.sortOrder });
    sortMutation.mutate({ id: prevItem.id, sortOrder: item.sortOrder });
  };

  const handleMoveDown = (item: TeaserGalleryItem, index: number) => {
    if (index === items.length - 1) return;
    const nextItem = items[index + 1];
    sortMutation.mutate({ id: item.id, sortOrder: nextItem.sortOrder });
    sortMutation.mutate({ id: nextItem.id, sortOrder: item.sortOrder });
  };

  const handleToggleActive = (item: TeaserGalleryItem) => {
    updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } });
  };

  const closeDialogs = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
    setFormData(defaultFormData);
  };

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Image *</Label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="/objects/generated-images/image-123.png or upload"
              required
              data-testid="input-image-url"
              className="flex-1"
            />
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="input-file-upload"
              />
              <Button type="button" variant="outline" disabled={isUploading} data-testid="button-upload">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a URL or click upload button to upload an image file
          </p>
        </div>
      </div>
      {formData.imageUrl && (
        <div className="border rounded-lg p-2 bg-muted/50">
          <a href={formData.imageUrl} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
            <img 
              src={formData.imageUrl} 
              alt="Preview" 
              className="max-h-32 mx-auto object-contain rounded hover:opacity-80 transition-opacity"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </a>
          <p className="text-xs text-center text-muted-foreground mt-1">Click to open in new window</p>
        </div>
      )}
      <div>
        <Label htmlFor="captionEn">Caption (English) *</Label>
        <Input
          id="captionEn"
          value={formData.captionEn}
          onChange={(e) => setFormData({ ...formData, captionEn: e.target.value })}
          placeholder="Saudi businessman in modern office"
          required
          data-testid="input-caption-en"
        />
      </div>
      <div>
        <Label htmlFor="captionAr">Caption (Arabic) *</Label>
        <Input
          id="captionAr"
          value={formData.captionAr}
          onChange={(e) => setFormData({ ...formData, captionAr: e.target.value })}
          placeholder="رجل أعمال سعودي في مكتب حديث"
          dir="rtl"
          required
          data-testid="input-caption-ar"
        />
      </div>
      <div>
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          type="number"
          value={formData.sortOrder}
          onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          data-testid="input-sort-order"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          data-testid="switch-is-active"
        />
        <Label htmlFor="isActive">Active (visible on teaser page)</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialogs} data-testid="button-cancel">
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-save"
        >
          {editingItem ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Teaser Gallery Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Teaser Gallery Management
            </CardTitle>
            <CardDescription>
              Manage the gallery images displayed on the teaser/landing page. Limit to 7 images for best display.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-gallery-item">
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Gallery Image</DialogTitle>
              </DialogHeader>
              <FormContent />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No gallery items yet. Click "Add Image" to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Preview</TableHead>
                <TableHead>Caption (EN)</TableHead>
                <TableHead>Caption (AR)</TableHead>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className={!item.isActive ? "opacity-50" : ""}>
                  <TableCell>
                    <a 
                      href={item.imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-16 h-12 bg-muted rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      title="Click to open in new window"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={item.captionEn}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </a>
                  </TableCell>
                  <TableCell className="max-w-40 truncate" title={item.captionEn}>
                    {item.captionEn}
                  </TableCell>
                  <TableCell className="max-w-40 truncate" dir="rtl" title={item.captionAr}>
                    {item.captionAr}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(item, index)}
                        disabled={index === 0}
                        data-testid={`button-move-up-${item.id}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <span className="text-xs w-4 text-center">{item.sortOrder}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(item, index)}
                        disabled={index === items.length - 1}
                        data-testid={`button-move-down-${item.id}`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={() => handleToggleActive(item)}
                      data-testid={`switch-active-${item.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && closeDialogs()}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Edit Gallery Image</DialogTitle>
                          </DialogHeader>
                          <FormContent />
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Gallery Item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this image from the teaser gallery.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Currently showing {items.filter(i => i.isActive).length} active image(s) on the teaser page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TeaserShowcaseVideoManagement() {
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [captionAr, setCaptionAr] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const { data: video, isLoading } = useQuery<TeaserShowcaseVideo>({
    queryKey: ["/api/admin/teaser-showcase-video"],
    staleTime: 0,
  });

  // Sync form with loaded data using useEffect
  useEffect(() => {
    if (video) {
      setVideoUrl(video.videoUrl);
      setCaptionEn(video.captionEn);
      setCaptionAr(video.captionAr);
      setIsActive(video.isActive);
    }
  }, [video]);

  const handleVideoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new window.FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/admin/teaser-showcase-video/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = `Upload failed: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      setVideoUrl(result.videoUrl);
      toast({ title: "Success", description: "Video uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload video", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = '';
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { videoUrl: string; captionEn: string; captionAr: string; isActive: boolean }) => {
      return apiRequest("PATCH", "/api/admin/teaser-showcase-video", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teaser-showcase-video"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teaser-showcase-video"] });
      toast({ title: "Success", description: "Showcase video updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update showcase video", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!videoUrl.trim()) {
      toast({ title: "Error", description: "Video URL is required", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ videoUrl, captionEn, captionAr, isActive });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="h-5 w-5" />
          Showcase Video
        </CardTitle>
        <CardDescription>
          Manage the 9:16 vertical video displayed in the Saudi Model section
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Video URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="/objects/generated-videos/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  data-testid="input-showcase-video-url"
                />
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => videoFileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-showcase-video"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Caption (English)</Label>
              <Input
                placeholder="Culturally aligned visuals"
                value={captionEn}
                onChange={(e) => setCaptionEn(e.target.value)}
                data-testid="input-showcase-caption-en"
              />
            </div>
            <div className="space-y-2">
              <Label>Caption (Arabic)</Label>
              <Input
                placeholder="صور متوافقة ثقافيًا"
                value={captionAr}
                onChange={(e) => setCaptionAr(e.target.value)}
                dir="rtl"
                data-testid="input-showcase-caption-ar"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-showcase-active"
              />
              <Label>Active</Label>
            </div>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-showcase"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
          <div className="flex justify-center">
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative w-48 aspect-[9/16] bg-black/20 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                  <video
                    src={videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs text-center truncate">{captionEn || "No caption"}</p>
                  </div>
                </div>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HeroVideosManagement() {
  const { toast } = useToast();
  const [desktopVideoUrl, setDesktopVideoUrl] = useState("");
  const [mobileVideoUrl, setMobileVideoUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isUploadingDesktop, setIsUploadingDesktop] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const { data: heroVideos, isLoading } = useQuery<HeroVideos>({
    queryKey: ["/api/admin/hero-videos"],
    staleTime: 0,
  });

  useEffect(() => {
    if (heroVideos) {
      setDesktopVideoUrl(heroVideos.desktopVideoUrl);
      setMobileVideoUrl(heroVideos.mobileVideoUrl);
      setIsActive(heroVideos.isActive);
    }
  }, [heroVideos]);

  const handleVideoUpload = async (file: File, type: 'desktop' | 'mobile') => {
    const setUploading = type === 'desktop' ? setIsUploadingDesktop : setIsUploadingMobile;
    const setUrl = type === 'desktop' ? setDesktopVideoUrl : setMobileVideoUrl;
    const fileInputRef = type === 'desktop' ? desktopFileInputRef : mobileFileInputRef;
    
    setUploading(true);
    try {
      const formData = new window.FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/admin/hero-videos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = `Upload failed: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      setUrl(result.videoUrl);
      toast({ title: "Success", description: `${type === 'desktop' ? 'Desktop' : 'Mobile'} video uploaded successfully` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload video", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { desktopVideoUrl: string; mobileVideoUrl: string; isActive: boolean }) => {
      return apiRequest("PATCH", "/api/admin/hero-videos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hero-videos"] });
      toast({ title: "Success", description: "Hero videos updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update hero videos", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!desktopVideoUrl.trim()) {
      toast({ title: "Error", description: "Desktop video URL is required", variant: "destructive" });
      return;
    }
    if (!mobileVideoUrl.trim()) {
      toast({ title: "Error", description: "Mobile video URL is required", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ desktopVideoUrl, mobileVideoUrl, isActive });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="h-5 w-5" />
          Hero Section Videos
        </CardTitle>
        <CardDescription>
          Manage the hero section background videos - upload separate videos for desktop (wide 16:9) and mobile (tall 9:16)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Desktop Video */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">Desktop</span>
              Wide Video (16:9)
            </h4>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="/videos/hero-desktop.mp4"
                  value={desktopVideoUrl}
                  onChange={(e) => setDesktopVideoUrl(e.target.value)}
                  data-testid="input-hero-desktop-url"
                />
                <input
                  ref={desktopFileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file, 'desktop');
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => desktopFileInputRef.current?.click()}
                  disabled={isUploadingDesktop}
                  data-testid="button-upload-hero-desktop"
                >
                  {isUploadingDesktop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {desktopVideoUrl && (
              <a href={desktopVideoUrl} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative aspect-video bg-black/20 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                  <video
                    src={desktopVideoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                </div>
              </a>
            )}
          </div>

          {/* Mobile Video */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <span className="text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">Mobile</span>
              Tall Video (9:16)
            </h4>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="/videos/hero-mobile.mp4"
                  value={mobileVideoUrl}
                  onChange={(e) => setMobileVideoUrl(e.target.value)}
                  data-testid="input-hero-mobile-url"
                />
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file, 'mobile');
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => mobileFileInputRef.current?.click()}
                  disabled={isUploadingMobile}
                  data-testid="button-upload-hero-mobile"
                >
                  {isUploadingMobile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {mobileVideoUrl && (
              <a href={mobileVideoUrl} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative w-32 aspect-[9/16] bg-black/20 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all cursor-pointer mx-auto">
                  <video
                    src={mobileVideoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                </div>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-hero-videos-active"
            />
            <Label>Active</Label>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-hero-videos"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
