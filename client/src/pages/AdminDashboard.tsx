import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, Images, Activity, BarChart3, Shield, Trash as Trash2, Eye, EyeOff, UserX, UserCheck, Crown, RotateCcw, Clipboard as Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import SiteConfigurationPanel from "@/components/SiteConfigurationPanel";
import ReportsManagement from "@/components/reports-management";
import AiStylesManagement from "@/components/ai-styles-management";
import VideoStylesManagement from "@/components/video-styles-management";
import VideoModelManagement from "@/components/video-model-management";
import { HeroSlidesPanel } from "@/components/HeroSlidesPanel";
import PromptManagement from "@/pages/prompt-management";
import TranslationManagement from "@/pages/translation-management";
import ImageReferenceManagement from "@/components/ImageReferenceManagement";
import RandomPromptsManagement from "@/components/RandomPromptsManagement";
import CreditRequestsManagement from "@/components/CreditRequestsManagement";
import TeaserGalleryManagement, { TeaserShowcaseVideoManagement, HeroVideosManagement } from "@/components/TeaserGalleryManagement";
import HomepageManagement from "@/components/HomepageManagement";
import GalleryManagement from "@/components/GalleryManagement";
import SubscriptionPlansManagement from "@/components/SubscriptionPlansManagement";
import TopupPacksManagement from "@/components/TopupPacksManagement";
import CouponsManagement from "@/components/CouponsManagement";
import UserSubscriptionManagement from "@/components/UserSubscriptionManagement";
import PricingPageManagement from "@/components/PricingPageManagement";
import ModerationLogsPanel from "@/components/ModerationLogsPanel";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  isActive: boolean;
  publicByDefault: boolean;
  createdAt: string;
}

interface Image {
  id: number;
  ownerId: string;
  prompt: string;
  url: string;
  isPublic: boolean;
  model: string;
  createdAt: string;
  ownerName?: string;
}

interface Video {
  id: number;
  ownerId: string;
  prompt: string;
  url: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  model: string;
  duration: number;
  status: string;
  createdAt: string;
  ownerName?: string;
}

interface AdminLog {
  id: number;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: any;
  createdAt: string;
  adminName?: string;
}

interface Stats {
  totalUsers: number;
  totalImages: number;
  publicImages: number;
  privateImages: number;
  dailyGenerations: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [imageSearchTerm, setImageSearchTerm] = useState("");
  const [videoSearchTerm, setVideoSearchTerm] = useState("");
  const [imagePage, setImagePage] = useState(1);
  const imagesPerPage = 30;
  const [videoPage, setVideoPage] = useState(1);
  const videosPerPage = 30;

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery<{
    users: User[];
    total: number;
  }>({
    queryKey: ["/api/admin/users"],
    enabled: selectedTab === "users",
  });

  // Fetch images with pagination and search
  const { data: imagesData, isLoading: imagesLoading } = useQuery<{
    images: Image[];
    total: number;
  }>({
    queryKey: ["/api/admin/images", imagePage, imagesPerPage, imageSearchTerm],
    queryFn: async () => {
      const offset = (imagePage - 1) * imagesPerPage;
      const params = new URLSearchParams({
        limit: imagesPerPage.toString(),
        offset: offset.toString(),
      });
      if (imageSearchTerm) {
        params.set('search', imageSearchTerm);
      }
      const response = await fetch(`/api/admin/images?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch images");
      return response.json();
    },
    enabled: selectedTab === "images",
  });

  // Fetch videos with pagination and search
  const { data: videosData, isLoading: videosLoading } = useQuery<{
    videos: Video[];
    total: number;
  }>({
    queryKey: ["/api/admin/videos", videoPage, videosPerPage, videoSearchTerm],
    queryFn: async () => {
      const offset = (videoPage - 1) * videosPerPage;
      const params = new URLSearchParams({
        limit: videosPerPage.toString(),
        offset: offset.toString(),
      });
      if (videoSearchTerm) {
        params.set('search', videoSearchTerm);
      }
      const response = await fetch(`/api/admin/videos?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
    enabled: selectedTab === "videos",
  });

  // Fetch admin logs
  const { data: logsData, isLoading: logsLoading } = useQuery<{
    logs: AdminLog[];
  }>({
    queryKey: ["/api/admin/logs"],
    enabled: selectedTab === "logs",
  });

  // Fetch pending credit requests count for notification badge
  const { data: pendingRequestsCount } = useQuery<number>({
    queryKey: ["/api/credit-requests/pending/count"],
    queryFn: async () => {
      const response = await fetch("/api/credit-requests?status=pending");
      if (!response.ok) return 0;
      const data = await response.json();
      return Array.isArray(data) ? data.length : 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleUserRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update user role");

      toast({
        title: t("toasts.success"),
        description: t("toasts.userRoleUpdated", { role: newRole }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.userRoleUpdateFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleUserStatusChange = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) throw new Error("Failed to update user status");

      toast({
        title: t("toasts.success"),
        description: isActive ? t("toasts.userReactivated") : t("toasts.userSuspended"),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.userStatusUpdateFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete user");

      toast({
        title: t("toasts.success"),
        description: t("toasts.userDeleted"),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.userDeleteFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleResetUserCache = async (userId: string, userEmail: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to reset user cache");

      const result = await response.json();
      
      toast({
        title: t("toasts.success"),
        description: t("toasts.userCacheReset", { email: userEmail, count: result.actions?.sessionsCleared || 0 }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.userCacheResetFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleImageVisibilityChange = async (imageId: number, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/admin/images/${imageId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });

      if (!response.ok) throw new Error("Failed to update image visibility");

      toast({
        title: t("toasts.success"),
        description: isPublic ? t("toasts.imageMadePublic") : t("toasts.imageMadePrivate"),
      });

      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === '/api/admin/images' });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.imageVisibilityUpdateFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete image");

      toast({
        title: t("toasts.success"),
        description: t("toasts.imageDeleted"),
      });

      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === '/api/admin/images' });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.imageDeleteFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleVideoVisibilityChange = async (videoId: number, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/admin/videos/${videoId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });

      if (!response.ok) throw new Error("Failed to update video visibility");

      toast({
        title: t("toasts.success"),
        description: isPublic ? t("toasts.videoMadePublic") : t("toasts.videoMadePrivate"),
      });

      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === '/api/admin/videos' });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.videoVisibilityUpdateFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete video");

      toast({
        title: t("toasts.success"),
        description: t("toasts.videoDeleted"),
      });

      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === '/api/admin/videos' });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    } catch (error) {
      toast({
        title: t("toasts.error"),
        description: t("toasts.videoDeleteFailed"),
        variant: "error-outline" as any,
      });
    }
  };

  const filteredUsers = usersData?.users.filter(user =>
    user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(userSearchTerm.toLowerCase())
  ) || [];

  const filteredImages = imagesData?.images || [];

  // Reset page to 1 when switching to images tab, and clamp page if total shrinks
  useEffect(() => {
    if (selectedTab === "images" && imagesData?.total !== undefined) {
      const maxPage = Math.max(1, Math.ceil(imagesData.total / imagesPerPage));
      if (imagePage > maxPage) {
        setImagePage(maxPage);
      }
    }
  }, [selectedTab, imagesData?.total, imagePage, imagesPerPage]);

  // Reset page to 1 when switching to videos tab, and clamp page if total shrinks
  useEffect(() => {
    if (selectedTab === "videos" && videosData?.total !== undefined) {
      const maxPage = Math.max(1, Math.ceil(videosData.total / videosPerPage));
      if (videoPage > maxPage) {
        setVideoPage(maxPage);
      }
    }
  }, [selectedTab, videosData?.total, videoPage, videosPerPage]);

  const filteredVideos = videosData?.videos || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-3 md:py-6 px-3 md:px-4">
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <div className="overflow-x-auto mb-4 md:mb-6 scroll-smooth">
            <TabsList className="flex items-center gap-1 p-1 h-auto whitespace-nowrap min-w-max">
              <TabsTrigger value="overview" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-users">Users</TabsTrigger>
              <TabsTrigger value="credit-requests" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-credit-requests">
                <span className="flex items-center gap-2">
                  Credit Requests
                  {pendingRequestsCount && pendingRequestsCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs rounded-full animate-pulse">
                      {pendingRequestsCount}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="images" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-images">Images</TabsTrigger>
              <TabsTrigger value="videos" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-videos">Videos</TabsTrigger>
              <TabsTrigger value="prompts" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-prompts">Prompts</TabsTrigger>
              <TabsTrigger value="random-prompts" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-random-prompts">Random Prompts</TabsTrigger>
              <TabsTrigger value="reports" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-reports">Reports</TabsTrigger>
              <TabsTrigger value="ai-styles" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-ai-styles">AI Styles</TabsTrigger>
              <TabsTrigger value="video-styles" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-video-styles">Video Styles</TabsTrigger>
              <TabsTrigger value="video-models" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-video-models">Video Models</TabsTrigger>
              <TabsTrigger value="hero-slides" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-hero-slides">Hero Slides</TabsTrigger>
              <TabsTrigger value="teaser-gallery" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-teaser-gallery">Teaser Gallery</TabsTrigger>
              <TabsTrigger value="homepage" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-homepage">Homepage</TabsTrigger>
              <TabsTrigger value="gallery" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-gallery">Gallery</TabsTrigger>
              <TabsTrigger value="image-references" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-image-references">Image Reference</TabsTrigger>
              <TabsTrigger value="translations" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-translations">Translations</TabsTrigger>
              <TabsTrigger value="subscription-plans" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-subscription-plans">Plans</TabsTrigger>
              <TabsTrigger value="topup-packs" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-topup-packs">Credit Packs</TabsTrigger>
              <TabsTrigger value="coupons" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-coupons">Coupons</TabsTrigger>
              <TabsTrigger value="user-subscriptions" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-user-subscriptions">User Subs</TabsTrigger>
              <TabsTrigger value="pricing-page" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-pricing-page">Pricing Page</TabsTrigger>
              <TabsTrigger value="moderation" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-moderation">Moderation</TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-settings">Site Config</TabsTrigger>
              <TabsTrigger value="logs" className="shrink-0 px-3 py-2 h-11 text-xs md:text-sm" data-testid="tab-logs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalUsers || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                  <Images className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalImages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Public Images</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.publicImages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Daily Generations</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.dailyGenerations || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Access Navigation */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/pricing'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pricing Rules</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Manage model pricing and credit costs
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/credits'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Credit Manager</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Grant or revoke user credits
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedTab('prompts')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prompt Templates</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Manage AI prompt templates and variables
                  </div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedTab('translations')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Translation Management</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Edit all website text strings and translations
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <Input
                placeholder="Search users..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="max-w-sm h-11"
              />
              <div className="text-sm text-muted-foreground">
                Total: {usersData?.total || 0} users
              </div>
            </div>

            <Card>
              <ScrollArea className="w-full overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role === "admin" && <Crown className="w-3 h-3 mr-1" />}
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "destructive"}>
                            {user.isActive ? "Active" : "Suspended"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value: "user" | "admin") =>
                                handleUserRoleChange(user.id, value)
                              }
                            >
                              <SelectTrigger className="w-24 h-11 min-h-[44px] px-3">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="default"
                              className="min-h-[44px]"
                              onClick={() => handleUserStatusChange(user.id, !user.isActive)}
                            >
                              {user.isActive ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="default"
                              className="min-h-[44px]"
                              onClick={() => handleResetUserCache(user.id, user.email)}
                              title="Reset user cache and sessions"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="default" className="min-h-[44px]">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete {user.firstName} {user.lastName} and all their images. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user.id)}
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
                    ))
                  )}
                </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="credit-requests" className="space-y-4">
            <CreditRequestsManagement />
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <Input
                placeholder="Search images..."
                value={imageSearchTerm}
                onChange={(e) => {
                  setImageSearchTerm(e.target.value);
                  setImagePage(1);
                }}
                className="max-w-sm h-11"
              />
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Total: {imagesData?.total || 0} images
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImagePage(p => Math.max(1, p - 1))}
                    disabled={imagePage === 1 || imagesLoading}
                    data-testid="images-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm min-w-[100px] text-center">
                    Page {imagePage} of {Math.max(1, Math.ceil((imagesData?.total || 0) / imagesPerPage))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImagePage(p => p + 1)}
                    disabled={imagePage >= Math.ceil((imagesData?.total || 0) / imagesPerPage) || imagesLoading}
                    data-testid="images-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Card>
              <ScrollArea className="w-full overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[270px]">Image</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imagesLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Loading images...
                        </TableCell>
                      </TableRow>
                    ) : filteredImages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          No images found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredImages.map((image) => (
                        <TableRow key={image.id}>
                          <TableCell>
                            {image.url ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <div 
                                    className="bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ width: '250px', height: '250px' }}
                                    data-testid={`image-thumbnail-${image.id}`}
                                  >
                                    <img
                                      src={image.url}
                                      alt="Generated image"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] p-2">
                                  <img
                                    src={image.url}
                                    alt="Generated image"
                                    className="w-full h-full object-contain rounded-lg"
                                  />
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <div 
                                className="bg-muted rounded-lg overflow-hidden flex items-center justify-center text-sm text-muted-foreground"
                                style={{ width: '250px', height: '250px' }}
                              >
                                No image
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <div className="max-w-xs" title={image.prompt}>
                                <p className="line-clamp-4 text-sm">{image.prompt}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8 w-8 p-0"
                                onClick={async () => {
                                  if (!navigator.clipboard?.writeText) {
                                    toast({
                                      title: "Copy unavailable",
                                      description: "Clipboard access not supported in this browser",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  try {
                                    await navigator.clipboard.writeText(image.prompt);
                                    toast({
                                      title: "Copied!",
                                      description: "Prompt copied to clipboard",
                                    });
                                  } catch (err) {
                                    toast({
                                      title: "Copy failed",
                                      description: "Could not copy to clipboard. Try using HTTPS.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`copy-prompt-${image.id}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{image.ownerName || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{image.model}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={image.isPublic ? "default" : "secondary"}>
                              {image.isPublic ? "Public" : "Private"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(image.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="default"
                                className="min-h-[44px]"
                                onClick={() =>
                                  handleImageVisibilityChange(image.id, !image.isPublic)
                                }
                              >
                                {image.isPublic ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="default" className="min-h-[44px]">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Image</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this image. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteImage(image.id)}
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
                      ))
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>

            {/* Bottom pagination for convenience */}
            {(imagesData?.total || 0) > imagesPerPage && (
              <div className="flex justify-center items-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImagePage(p => Math.max(1, p - 1))}
                  disabled={imagePage === 1 || imagesLoading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm px-4">
                  Page {imagePage} of {Math.ceil((imagesData?.total || 0) / imagesPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImagePage(p => p + 1)}
                  disabled={imagePage >= Math.ceil((imagesData?.total || 0) / imagesPerPage) || imagesLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <Input
                placeholder="Search videos..."
                value={videoSearchTerm}
                onChange={(e) => {
                  setVideoSearchTerm(e.target.value);
                  setVideoPage(1);
                }}
                className="max-w-sm h-11"
              />
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Total: {videosData?.total || 0} videos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoPage(p => Math.max(1, p - 1))}
                    disabled={videoPage === 1 || videosLoading}
                    data-testid="videos-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm min-w-[100px] text-center">
                    Page {videoPage} of {Math.max(1, Math.ceil((videosData?.total || 0) / videosPerPage))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoPage(p => p + 1)}
                    disabled={videoPage >= Math.ceil((videosData?.total || 0) / videosPerPage) || videosLoading}
                    data-testid="videos-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Card>
              <ScrollArea className="w-full overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[270px]">Video</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videosLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Loading videos...
                        </TableCell>
                      </TableRow>
                    ) : filteredVideos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          No videos found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVideos.map((video) => (
                        <TableRow key={video.id}>
                          <TableCell>
                            {video.url || video.thumbnailUrl ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <div 
                                    className="bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ width: '250px', height: '250px' }}
                                    data-testid={`video-thumbnail-${video.id}`}
                                  >
                                    {video.thumbnailUrl ? (
                                      <img
                                        src={video.thumbnailUrl}
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : video.url ? (
                                      <video
                                        src={video.url}
                                        className="w-full h-full object-cover"
                                        muted
                                      />
                                    ) : null}
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] p-4 flex items-center justify-center">
                                  <video
                                    src={video.url}
                                    className="max-w-full max-h-[80vh] rounded-lg object-contain"
                                    controls
                                    autoPlay
                                  />
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <div 
                                className="bg-muted rounded-lg overflow-hidden flex items-center justify-center text-sm text-muted-foreground"
                                style={{ width: '250px', height: '250px' }}
                              >
                                No video
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <div className="max-w-xs" title={video.prompt}>
                                <p className="line-clamp-4 text-sm">{video.prompt}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8 w-8 p-0"
                                onClick={async () => {
                                  if (!navigator.clipboard?.writeText) {
                                    toast({
                                      title: "Copy unavailable",
                                      description: "Clipboard access not supported in this browser",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  try {
                                    await navigator.clipboard.writeText(video.prompt);
                                    toast({
                                      title: "Copied!",
                                      description: "Prompt copied to clipboard",
                                    });
                                  } catch (err) {
                                    toast({
                                      title: "Copy failed",
                                      description: "Could not copy to clipboard. Try using HTTPS.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`copy-video-prompt-${video.id}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{video.ownerName || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{video.model}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                video.status === "completed" ? "default" : 
                                video.status === "failed" ? "destructive" : 
                                "secondary"
                              }
                            >
                              {video.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={video.isPublic ? "default" : "secondary"}>
                              {video.isPublic ? "Public" : "Private"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(video.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="default"
                                className="min-h-[44px]"
                                onClick={() =>
                                  handleVideoVisibilityChange(video.id, !video.isPublic)
                                }
                                title={video.isPublic ? "Hide video" : "Show video"}
                              >
                                {video.isPublic ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="default" title="Delete video">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Video</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this video. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteVideo(video.id)}
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
                      ))
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>

            {/* Bottom pagination for convenience */}
            {(videosData?.total || 0) > videosPerPage && (
              <div className="flex justify-center items-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVideoPage(p => Math.max(1, p - 1))}
                  disabled={videoPage === 1 || videosLoading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm px-4">
                  Page {videoPage} of {Math.ceil((videosData?.total || 0) / videosPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVideoPage(p => p + 1)}
                  disabled={videoPage >= Math.ceil((videosData?.total || 0) / videosPerPage) || videosLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {logsLoading ? (
                    <div className="text-center py-8">Loading logs...</div>
                  ) : logsData?.logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No admin activity logs found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {logsData?.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 p-4 rounded-lg bg-muted/30"
                        >
                          <Activity className="w-4 h-4 mt-1 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.adminName}</span>
                              <Badge variant="outline">{log.action}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {log.targetType} {log.targetId}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                            {log.details && (
                              <div className="text-xs text-muted-foreground mt-2 bg-background rounded p-2">
                                {JSON.stringify(log.details, null, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsManagement />
          </TabsContent>

          <TabsContent value="ai-styles" className="space-y-6">
            <AiStylesManagement />
          </TabsContent>

          <TabsContent value="video-styles" className="space-y-6">
            <VideoStylesManagement />
          </TabsContent>

          <TabsContent value="video-models" className="space-y-6">
            <div className="space-y-6">
              <VideoModelManagement />
            </div>
          </TabsContent>

          <TabsContent value="hero-slides" className="space-y-6">
            <HeroSlidesPanel />
          </TabsContent>

          <TabsContent value="teaser-gallery" className="space-y-6">
            <HeroVideosManagement />
            <TeaserGalleryManagement />
            <TeaserShowcaseVideoManagement />
          </TabsContent>

          <TabsContent value="homepage" className="space-y-6">
            <HomepageManagement />
          </TabsContent>

          <TabsContent value="gallery" className="space-y-6">
            <GalleryManagement />
          </TabsContent>

          <TabsContent value="image-references" className="space-y-6">
            <ImageReferenceManagement />
          </TabsContent>

          <TabsContent value="prompts" className="space-y-6">
            <PromptManagement />
          </TabsContent>

          <TabsContent value="random-prompts" className="space-y-6">
            <RandomPromptsManagement />
          </TabsContent>

          <TabsContent value="translations" className="space-y-6">
            <TranslationManagement />
          </TabsContent>

          <TabsContent value="subscription-plans" className="space-y-6">
            <SubscriptionPlansManagement />
          </TabsContent>

          <TabsContent value="topup-packs" className="space-y-6">
            <TopupPacksManagement />
          </TabsContent>

          <TabsContent value="coupons" className="space-y-6">
            <CouponsManagement />
          </TabsContent>

          <TabsContent value="user-subscriptions" className="space-y-6">
            <UserSubscriptionManagement />
          </TabsContent>

          <TabsContent value="pricing-page" className="space-y-6">
            <PricingPageManagement />
          </TabsContent>

          <TabsContent value="moderation" className="space-y-6">
            <ModerationLogsPanel />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SiteConfigurationPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}