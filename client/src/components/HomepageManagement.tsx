import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash as Trash2, ArrowUp, ArrowDown, ImagePlus as ImageIcon, Upload, Loader2, Star, Megaphone, WandSparkles as Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { IMAGE_BASE_MODELS, VIDEO_BASE_MODELS } from "@shared/model-routing";

interface ServiceCard {
  id: number;
  title: string;
  titleAr: string | null;
  description: string;
  descriptionAr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkType: string;
  modalType: string | null;
  initialModel: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ImageModelConfig {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  category: string;
  description: string;
}

interface VideoModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
}

interface PromotionBar {
  id: number;
  text: string;
  buttonText: string | null;
  buttonUrl: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  isActive: boolean;
}

interface FeaturedItem {
  id: number;
  itemType: string;
  itemId: number;
  sortOrder: number;
  isActive: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
}

interface HomepageCta {
  id: number;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  backgroundImageUrl: string | null;
  isActive: boolean;
}

interface PublicItem {
  id: number;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  type: 'image' | 'video';
}

// Service Cards Panel
function ServiceCardsPanel() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ServiceCard | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    titleAr: "",
    description: "",
    descriptionAr: "",
    imageUrl: "",
    linkUrl: "",
    linkType: "internal",
    modalType: "",
    initialModel: "",
    sortOrder: 0,
    isActive: true
  });

  // Use base models from model-routing for consistent IDs
  const imageModels = IMAGE_BASE_MODELS.filter(m => m.mediaType === "image");
  const videoModels = VIDEO_BASE_MODELS;

  const { data: cards = [], isLoading } = useQuery<ServiceCard[]>({
    queryKey: ["/api/admin/homepage/service-cards"],
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formDataUpload = new window.FormData();
      formDataUpload.append('image', file);
      
      const response = await fetch('/api/admin/homepage/service-cards/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: result.imageUrl }));
      toast({ title: "Success", description: "Image uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => apiRequest("POST", "/api/admin/homepage/service-cards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/service-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/service-cards"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Service card created" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => 
      apiRequest("PATCH", `/api/admin/homepage/service-cards/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/service-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/service-cards"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Service card updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/homepage/service-cards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/service-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/service-cards"] });
      toast({ title: "Success", description: "Service card deleted" });
    },
  });

  const resetForm = () => {
    setFormData({ title: "", titleAr: "", description: "", descriptionAr: "", imageUrl: "", linkUrl: "", linkType: "internal", modalType: "", initialModel: "", sortOrder: 0, isActive: true });
    setEditingCard(null);
  };

  const handleEdit = (card: ServiceCard) => {
    setEditingCard(card);
    setFormData({
      title: card.title,
      titleAr: card.titleAr || "",
      description: card.description,
      descriptionAr: card.descriptionAr || "",
      imageUrl: card.imageUrl || "",
      linkUrl: card.linkUrl || "",
      linkType: card.linkType,
      modalType: card.modalType || "",
      initialModel: card.initialModel || "",
      sortOrder: card.sortOrder,
      isActive: card.isActive
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Service Cards
            </CardTitle>
            <CardDescription>Top 3 promotional cards shown at the top of the homepage</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Card
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Link Type</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.title} className="w-16 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-12 bg-gray-700 rounded flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{card.title}</TableCell>
                  <TableCell className="max-w-xs truncate">{card.description}</TableCell>
                  <TableCell>{card.linkType}</TableCell>
                  <TableCell>{card.sortOrder}</TableCell>
                  <TableCell>
                    <Switch checked={card.isActive} onCheckedChange={(checked) => 
                      updateMutation.mutate({ id: card.id, data: { isActive: checked } })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(card)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service Card?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(card.id)}>Delete</AlertDialogAction>
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingCard ? "Edit Service Card" : "Add Service Card"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 max-h-[calc(90vh-120px)] pr-4">
            <form onSubmit={handleSubmit} className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label>Title (English)</Label>
                <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Title (Arabic) - العنوان بالعربية</Label>
                <Input value={formData.titleAr} onChange={(e) => setFormData(prev => ({ ...prev, titleAr: e.target.value }))} dir="rtl" placeholder="أدخل العنوان بالعربية" />
              </div>
              <div className="space-y-2">
                <Label>Description (English)</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Description (Arabic) - الوصف بالعربية</Label>
                <Textarea value={formData.descriptionAr} onChange={(e) => setFormData(prev => ({ ...prev, descriptionAr: e.target.value }))} dir="rtl" placeholder="أدخل الوصف بالعربية" />
              </div>
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex gap-2">
                  <Input value={formData.imageUrl} onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="Image URL" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </div>
                {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded mt-2" />}
              </div>
              <div className="space-y-2">
                <Label>Link Type</Label>
                <Select value={formData.linkType} onValueChange={(v) => setFormData(prev => ({ ...prev, linkType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Link</SelectItem>
                    <SelectItem value="external">External Link</SelectItem>
                    <SelectItem value="modal">Open Modal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.linkType === "modal" ? (
                <>
                  <div className="space-y-2">
                    <Label>Modal Type</Label>
                    <Select value={formData.modalType} onValueChange={(v) => setFormData(prev => ({ ...prev, modalType: v, initialModel: "" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image Generation</SelectItem>
                        <SelectItem value="video">Video Generation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.modalType && (
                    <div className="space-y-2">
                      <Label>Pre-selected Model (optional)</Label>
                      <Select value={formData.initialModel || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, initialModel: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="No model pre-selected" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No model pre-selected</SelectItem>
                          {formData.modalType === "image" ? (
                            imageModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.displayName || model.name}
                              </SelectItem>
                            ))
                          ) : (
                            videoModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.displayName || model.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The model that will be pre-selected when a user clicks this card
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Link URL</Label>
                  <Input value={formData.linkUrl} onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))} placeholder="/create" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input type="number" value={formData.sortOrder} onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))} />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingCard ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Promotion Bar Panel
function PromotionBarPanel() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    text: "",
    buttonText: "",
    buttonUrl: "",
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    isActive: true
  });

  const { data: promotionBar, isLoading } = useQuery<PromotionBar | null>({
    queryKey: ["/api/admin/homepage/promotion-bar"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => apiRequest("PUT", "/api/admin/homepage/promotion-bar", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/promotion-bar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/promotion-bar"] });
      toast({ title: "Success", description: "Promotion bar updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (promotionBar && formData.text === "") {
    setFormData({
      text: promotionBar.text,
      buttonText: promotionBar.buttonText || "",
      buttonUrl: promotionBar.buttonUrl || "",
      backgroundColor: promotionBar.backgroundColor || "#1a1a2e",
      textColor: promotionBar.textColor || "#ffffff",
      isActive: promotionBar.isActive
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Promotion Bar
        </CardTitle>
        <CardDescription>Banner displayed below the service cards</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Text</Label>
            <Textarea value={formData.text} onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))} placeholder="Your promotional message" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Button Text (optional)</Label>
              <Input value={formData.buttonText} onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))} placeholder="Learn More" />
            </div>
            <div className="space-y-2">
              <Label>Button URL</Label>
              <Input value={formData.buttonUrl} onChange={(e) => setFormData(prev => ({ ...prev, buttonUrl: e.target.value }))} placeholder="/pricing" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <Input type="color" value={formData.backgroundColor} onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-12 h-10 p-1" />
                <Input value={formData.backgroundColor} onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-2">
                <Input type="color" value={formData.textColor} onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))} className="w-12 h-10 p-1" />
                <Input value={formData.textColor} onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))} />
            <Label>Active</Label>
          </div>
          
          {formData.text && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: formData.backgroundColor, color: formData.textColor }}>
              <p className="text-center">{formData.text}</p>
            </div>
          )}

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Featured Items Panel
function FeaturedItemsPanel() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'image' | 'video'>('image');

  const { data: featuredItems = [], isLoading } = useQuery<FeaturedItem[]>({
    queryKey: ["/api/admin/homepage/featured-items"],
  });

  // Use admin endpoints to get ALL images and videos (not just public ones)
  const { data: allImagesData } = useQuery<{ images: PublicItem[], total: number }>({
    queryKey: ["/api/admin/images?limit=2000"],
  });
  const allImages = allImagesData?.images || [];

  const { data: allVideosData } = useQuery<{ videos: PublicItem[], total: number }>({
    queryKey: ["/api/admin/videos?limit=2000"],
  });
  const allVideos = allVideosData?.videos || [];

  const addMutation = useMutation({
    mutationFn: async (data: { itemType: string; itemId: number; sortOrder: number }) => 
      apiRequest("POST", "/api/admin/homepage/featured-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/featured-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/featured-items"] });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Featured item added" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/homepage/featured-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/featured-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/featured-items"] });
      toast({ title: "Success", description: "Featured item removed" });
    },
  });

  const featuredIds = new Set(featuredItems.map(item => `${item.itemType}-${item.itemId}`));
  
  const availableImages = allImages.filter(img => !featuredIds.has(`image-${img.id}`));
  const availableVideos = allVideos.filter(vid => !featuredIds.has(`video-${vid.id}`));

  const handleAdd = (type: 'image' | 'video', id: number) => {
    addMutation.mutate({ itemType: type, itemId: id, sortOrder: featuredItems.length });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Featured Gallery Items
            </CardTitle>
            <CardDescription>Select up to 20 public items to showcase on the homepage</CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} disabled={featuredItems.length >= 20}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : featuredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No featured items yet. Add items from the public gallery.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {featuredItems.map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-800">
                  {item.thumbnailUrl || item.imageUrl ? (
                    <img 
                      src={item.thumbnailUrl || item.imageUrl} 
                      alt={item.prompt || "Featured item"} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="absolute top-2 left-2">
                  <span className={`text-xs px-2 py-1 rounded ${item.itemType === 'video' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                    {item.itemType}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeMutation.mutate(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <p className="mt-1 text-xs text-gray-400 truncate">{item.prompt || `${item.itemType} #${item.itemId}`}</p>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Featured Item</DialogTitle>
            </DialogHeader>
            
            <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as 'image' | 'video')}>
              <TabsList>
                <TabsTrigger value="image">Images ({availableImages.length})</TabsTrigger>
                <TabsTrigger value="video">Videos ({availableVideos.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="image" className="mt-4">
                {availableImages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No more public images available</p>
                ) : (
                  <ScrollArea className="h-[50vh]">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                      {availableImages.map((img) => (
                        <div 
                          key={img.id} 
                          className="aspect-square overflow-hidden rounded-lg bg-gray-800 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                          onClick={() => handleAdd('image', img.id)}
                        >
                          <img src={img.thumbnailUrl || img.url} alt={img.prompt} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
              
              <TabsContent value="video" className="mt-4">
                {availableVideos.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No more public videos available</p>
                ) : (
                  <ScrollArea className="h-[50vh]">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                      {availableVideos.map((vid) => (
                        <div 
                          key={vid.id} 
                          className="aspect-square overflow-hidden rounded-lg bg-gray-800 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                          onClick={() => handleAdd('video', vid.id)}
                        >
                          <img src={vid.thumbnailUrl || vid.url} alt={vid.prompt} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// CTA Panel
function CtaPanel() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    buttonText: "",
    buttonUrl: "",
    backgroundImageUrl: "",
    isActive: true
  });

  const { data: cta, isLoading } = useQuery<HomepageCta | null>({
    queryKey: ["/api/admin/homepage/cta"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => apiRequest("PUT", "/api/admin/homepage/cta", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage/cta"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/cta"] });
      toast({ title: "Success", description: "CTA updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (cta && formData.title === "") {
    setFormData({
      title: cta.title,
      description: cta.description,
      buttonText: cta.buttonText,
      buttonUrl: cta.buttonUrl,
      backgroundImageUrl: cta.backgroundImageUrl || "",
      isActive: cta.isActive
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call to Action</CardTitle>
        <CardDescription>Bottom section encouraging users to take action</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ready to Create?" required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Start generating amazing content today" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Button Text</Label>
              <Input value={formData.buttonText} onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))} placeholder="Get Started" required />
            </div>
            <div className="space-y-2">
              <Label>Button URL</Label>
              <Input value={formData.buttonUrl} onChange={(e) => setFormData(prev => ({ ...prev, buttonUrl: e.target.value }))} placeholder="/create" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Background Image URL (optional)</Label>
            <Input value={formData.backgroundImageUrl} onChange={(e) => setFormData(prev => ({ ...prev, backgroundImageUrl: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))} />
            <Label>Active</Label>
          </div>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Main Homepage Management Component
export default function HomepageManagement() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Homepage Management</h2>
        <p className="text-gray-400">Configure the content displayed on the main homepage</p>
      </div>
      
      <Tabs defaultValue="service-cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="service-cards">Service Cards</TabsTrigger>
          <TabsTrigger value="promotion">Promotion Bar</TabsTrigger>
          <TabsTrigger value="featured">Featured Items</TabsTrigger>
          <TabsTrigger value="cta">Call to Action</TabsTrigger>
        </TabsList>
        
        <TabsContent value="service-cards">
          <ServiceCardsPanel />
        </TabsContent>
        
        <TabsContent value="promotion">
          <PromotionBarPanel />
        </TabsContent>
        
        <TabsContent value="featured">
          <FeaturedItemsPanel />
        </TabsContent>
        
        <TabsContent value="cta">
          <CtaPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
