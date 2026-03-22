import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash as Trash2, Loader2, Star, Pin, ImagePlus as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface GalleryItem {
  id: number;
  itemType: string;
  itemId: number;
  isFeatured: boolean;
  isStickyTop: boolean;
  sortOrder: number;
  isActive: boolean;
  imageUrl?: string;
  thumbnailUrl?: string | null;
  prompt?: string;
  width?: number;
  height?: number;
}

interface PublicItem {
  id: number;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  type: 'image' | 'video';
}

export default function GalleryManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'image' | 'video'>('image');

  const { data: galleryItems = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ["/api/admin/gallery/items"],
  });

  const { data: allImagesData } = useQuery<{ images: PublicItem[], total: number }>({
    queryKey: ["/api/admin/images?limit=2000&publicOnly=true"],
  });
  
  const { data: allVideosData } = useQuery<{ videos: PublicItem[], total: number }>({
    queryKey: ["/api/admin/videos?limit=2000&publicOnly=true"],
  });

  const allImages = (allImagesData?.images || []).filter((img: any) => img.isPublic);
  const allVideos = (allVideosData?.videos || []).filter((vid: any) => vid.isPublic);

  const addMutation = useMutation({
    mutationFn: async (data: { itemType: string; itemId: number; sortOrder: number }) => 
      apiRequest("POST", "/api/admin/gallery/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/curated"] });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Item added to gallery" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<GalleryItem> }) => 
      apiRequest("PATCH", `/api/admin/gallery/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/curated"] });
      toast({ title: "Success", description: "Gallery item updated" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/gallery/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/curated"] });
      toast({ title: "Success", description: "Item removed from gallery" });
    },
  });

  const galleryItemIds = new Set(galleryItems.map(item => `${item.itemType}-${item.itemId}`));
  
  const availableImages = allImages.filter((img: any) => !galleryItemIds.has(`image-${img.id}`));
  const availableVideos = allVideos.filter((vid: any) => !galleryItemIds.has(`video-${vid.id}`));

  const handleAdd = (type: 'image' | 'video', id: number) => {
    addMutation.mutate({ itemType: type, itemId: id, sortOrder: galleryItems.length });
  };

  const handleToggleFeatured = (item: GalleryItem) => {
    updateMutation.mutate({ id: item.id, data: { isFeatured: !item.isFeatured } });
  };

  const handleToggleStickyTop = (item: GalleryItem) => {
    updateMutation.mutate({ id: item.id, data: { isStickyTop: !item.isStickyTop } });
  };

  const stickyItems = galleryItems.filter(item => item.isStickyTop);
  const featuredItems = galleryItems.filter(item => item.isFeatured && !item.isStickyTop);
  const regularItems = galleryItems.filter(item => !item.isFeatured && !item.isStickyTop);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Public Gallery Management</h2>
        <p className="text-gray-400">Select which public items appear on the /gallery page. Only admin-approved items will be shown.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Gallery Items ({galleryItems.length})
              </CardTitle>
              <CardDescription>
                Select public images and videos to display on the gallery page. Featured items get special styling.
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : galleryItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items in the gallery yet. Add public images and videos to show on the gallery page.
            </div>
          ) : (
            <div className="space-y-6">
              {stickyItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Pin className="w-4 h-4 text-orange-400" />
                    Sticky Top ({stickyItems.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {stickyItems.map((item) => (
                      <GalleryItemCard 
                        key={item.id} 
                        item={item} 
                        onToggleFeatured={handleToggleFeatured}
                        onToggleStickyTop={handleToggleStickyTop}
                        onRemove={(id) => removeMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {featuredItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Featured ({featuredItems.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {featuredItems.map((item) => (
                      <GalleryItemCard 
                        key={item.id} 
                        item={item} 
                        onToggleFeatured={handleToggleFeatured}
                        onToggleStickyTop={handleToggleStickyTop}
                        onRemove={(id) => removeMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {regularItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Regular Items ({regularItems.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {regularItems.map((item) => (
                      <GalleryItemCard 
                        key={item.id} 
                        item={item} 
                        onToggleFeatured={handleToggleFeatured}
                        onToggleStickyTop={handleToggleStickyTop}
                        onRemove={(id) => removeMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Item to Public Gallery</DialogTitle>
              </DialogHeader>
              
              <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as 'image' | 'video')}>
                <TabsList>
                  <TabsTrigger value="image">Public Images ({availableImages.length})</TabsTrigger>
                  <TabsTrigger value="video">Public Videos ({availableVideos.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="image" className="mt-4">
                  {availableImages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No more public images available</p>
                  ) : (
                    <ScrollArea className="h-[50vh]">
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                        {availableImages.map((img: any) => (
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
                        {availableVideos.map((vid: any) => (
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
    </div>
  );
}

function GalleryItemCard({ 
  item, 
  onToggleFeatured, 
  onToggleStickyTop, 
  onRemove 
}: { 
  item: GalleryItem; 
  onToggleFeatured: (item: GalleryItem) => void;
  onToggleStickyTop: (item: GalleryItem) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="relative group">
      <div className={`aspect-square overflow-hidden rounded-lg bg-gray-800 ${item.isFeatured ? 'ring-2 ring-yellow-400' : ''} ${item.isStickyTop ? 'ring-2 ring-orange-400' : ''}`}>
        {item.thumbnailUrl || item.imageUrl ? (
          <img 
            src={item.thumbnailUrl || item.imageUrl} 
            alt={item.prompt || "Gallery item"} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-600" />
          </div>
        )}
      </div>
      
      <div className="absolute top-2 left-2 flex gap-1">
        <span className={`text-xs px-2 py-1 rounded ${item.itemType === 'video' ? 'bg-purple-500' : 'bg-blue-500'}`}>
          {item.itemType}
        </span>
        {item.isFeatured && (
          <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-black">
            <Star className="w-3 h-3" />
          </span>
        )}
        {item.isStickyTop && (
          <span className="text-xs px-2 py-1 rounded bg-orange-500 text-white">
            <Pin className="w-3 h-3" />
          </span>
        )}
      </div>
      
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Label htmlFor={`featured-${item.id}`} className="text-white cursor-pointer">Featured</Label>
            <Switch 
              id={`featured-${item.id}`}
              checked={item.isFeatured}
              onCheckedChange={() => onToggleFeatured(item)}
              className="scale-75"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`sticky-${item.id}`} className="text-white cursor-pointer">Top</Label>
            <Switch 
              id={`sticky-${item.id}`}
              checked={item.isStickyTop}
              onCheckedChange={() => onToggleStickyTop(item)}
              className="scale-75"
            />
          </div>
        </div>
      </div>
      
      <p className="mt-1 text-xs text-gray-400 truncate">{item.prompt || `${item.itemType} #${item.itemId}`}</p>
    </div>
  );
}
