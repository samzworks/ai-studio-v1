import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Image, Clapperboard as Video, Film, WandSparkles as Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import ParallelGenerationForm from "@/components/parallel-generation-form";
import VideoGenerationForm from "@/components/video-generation-form";
import { queryClient } from "@/lib/queryClient";
import { useSiteConfig } from "@/hooks/useSiteConfig";

type FilterType = "all" | "image" | "video";
type ModalType = { type: "image"; initialModel?: string } | { type: "video" } | null;

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  icon: typeof Image;
  category: "image" | "video";
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  action: "modal-image" | "modal-video" | "navigate";
  route?: string;
  initialModel?: string;
  imageConfigKey?: string;
}

export default function Create() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const { getConfig } = useSiteConfig();

  const serviceCards: ServiceCard[] = [
    {
      id: "alfia-saudi",
      title: t('landing.cards.alfiaSaudiStyle'),
      description: t('landing.cards.alfiaSaudiDesc'),
      icon: Sparkles,
      category: "image",
      badge: t('landing.badges.image'),
      badgeVariant: "default",
      action: "modal-image",
      initialModel: "saudi-model-pro",
      imageConfigKey: "service_card_image_alfia_saudi",
    },
    {
      id: "create-image",
      title: t('landing.cards.createImage'),
      description: t('landing.cards.createImageDesc'),
      icon: Image,
      category: "image",
      badge: t('landing.badges.image'),
      badgeVariant: "secondary",
      action: "modal-image",
      imageConfigKey: "service_card_image_create_image",
    },
    {
      id: "create-video",
      title: t('landing.cards.createVideo'),
      description: t('landing.cards.createVideoDesc'),
      icon: Video,
      category: "video",
      badge: t('landing.badges.video'),
      badgeVariant: "secondary",
      action: "modal-video",
      imageConfigKey: "service_card_image_create_video",
    },
    {
      id: "film-studio",
      title: t('landing.cards.filmStudio'),
      description: t('landing.cards.filmStudioDesc'),
      icon: Film,
      category: "video",
      badge: t('landing.badges.video'),
      badgeVariant: "default",
      action: "navigate",
      route: "/film-studio",
      imageConfigKey: "service_card_image_film_studio",
    },
  ];

  const filteredCards = useMemo(() => {
    if (activeFilter === "all") return serviceCards;
    return serviceCards.filter((card) => card.category === activeFilter);
  }, [activeFilter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: t('create.filterAll') },
    { key: "image", label: t('create.filterImages') },
    { key: "video", label: t('create.filterVideos') },
  ];

  const handleCardClick = (card: ServiceCard) => {
    if (card.action === "modal-image") {
      setActiveModal({ type: "image", initialModel: card.initialModel });
    } else if (card.action === "modal-video") {
      setActiveModal({ type: "video" });
    } else if (card.action === "navigate" && card.route) {
      setLocation(card.route);
    }
  };

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  // Called when image generation completes - just invalidate cache
  const handleImageGenerated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/images"] });
  }, []);

  // Called when video generation completes - just invalidate cache
  const handleVideoGenerated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
  }, []);

  // Called when image generation starts - navigate to image gallery
  const handleImageGenerationStart = useCallback(() => {
    setActiveModal(null);
    setLocation("/images");
  }, [setLocation]);

  // Called when video generation starts - navigate to video gallery
  const handleVideoGenerationStart = useCallback(() => {
    setActiveModal(null);
    setLocation("/video-studio");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))]">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white" data-testid="text-create-title">
            {t('create.title')}
          </h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="filter-tabs">
          {filters.map((filter) => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className={
                activeFilter === filter.key
                  ? "bg-white text-black hover:bg-white/90"
                  : "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              }
              data-testid={`button-filter-${filter.key}`}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Service Cards Grid */}
        <div 
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          data-testid="cards-grid"
        >
          {filteredCards.map((card) => (
            <Card
              key={card.id}
              className="group cursor-pointer bg-gray-800/50 border-gray-700 hover:border-gray-500 transition-all duration-200 overflow-hidden"
              onClick={() => handleCardClick(card)}
              data-testid={`card-service-${card.id}`}
            >
              <CardContent className="p-0">
                {/* Card Image Area */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden">
                  {card.badge && (
                    <Badge
                      variant={card.badgeVariant}
                      className={`absolute top-2 left-2 text-xs z-10 ${
                        card.category === "image"
                          ? "bg-emerald-500 hover:bg-emerald-500"
                          : "bg-purple-500 hover:bg-purple-500"
                      }`}
                      data-testid={`badge-${card.id}`}
                    >
                      {card.badge}
                    </Badge>
                  )}
                  {card.imageConfigKey && getConfig(card.imageConfigKey) ? (
                    <img 
                      src={getConfig(card.imageConfigKey)} 
                      alt={card.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`${card.imageConfigKey && getConfig(card.imageConfigKey) ? 'hidden' : 'flex'} items-center justify-center absolute inset-0`}>
                    <card.icon className="w-12 h-12 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-3">
                  <h3 className="font-semibold text-white text-sm mb-1" data-testid={`text-title-${card.id}`}>
                    {card.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-2" data-testid={`text-desc-${card.id}`}>
                    {card.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Image Generation Modal - Boxed/Framed */}
      <Dialog open={activeModal?.type === "image"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent 
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 [&>button]:text-white [&>button]:hover:text-gray-300"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-xl font-bold text-white text-center">
            {t('landing.imageGeneration')}
          </DialogTitle>
          <div className="pt-2">
            {activeModal?.type === "image" && (
              <ParallelGenerationForm
                onImageGenerated={handleImageGenerated}
                onGenerationStart={handleImageGenerationStart}
                onMobileClose={handleCloseModal}
                initialModel={activeModal.initialModel}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Generation Modal - Boxed/Framed */}
      <Dialog open={activeModal?.type === "video"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent 
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 [&>button]:text-white [&>button]:hover:text-gray-300"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-xl font-bold text-white text-center">
            {t('landing.videoGeneration')}
          </DialogTitle>
          <div className="pt-2">
            {activeModal?.type === "video" && (
              <VideoGenerationForm
                onVideoGenerated={handleVideoGenerated}
                onMobileClose={handleCloseModal}
                onGenerationStart={handleVideoGenerationStart}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
