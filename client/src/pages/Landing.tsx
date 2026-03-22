import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImagePlus as ImageIcon,
  Clapperboard as Video,
  Film,
  WandSparkles as Sparkles,
  CirclePlay as Play,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import ParallelGenerationForm from "@/components/parallel-generation-form";
import VideoGenerationForm from "@/components/video-generation-form";
import { queryClient } from "@/lib/queryClient";
import type { HeroSlide } from "@shared/schema";

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

interface CreateCard {
  id: string;
  title: string;
  description: string;
  icon: typeof ImageIcon;
  action: "modal-image" | "modal-video" | "navigate";
  route?: string;
  initialModel?: string;
  imageConfigKey?: string;
}

type ModalType =
  | { type: "image"; initialModel?: string }
  | { type: "video"; initialModel?: string }
  | { type: "login-required" }
  | null;

function getServiceIcon(title: string) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("image")) return ImageIcon;
  if (lowerTitle.includes("video")) return Video;
  if (lowerTitle.includes("film") || lowerTitle.includes("studio")) return Film;
  return Sparkles;
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { getConfig } = useSiteConfig();
  const isArabic = i18n.language?.startsWith("ar");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedMedia, setSelectedMedia] = useState<FeaturedItem | null>(null);

  const { data: serviceCards = [] } = useQuery<ServiceCard[]>({
    queryKey: ["/api/homepage/service-cards"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredItems = [] } = useQuery<FeaturedItem[]>({
    queryKey: ["/api/homepage/featured-items"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: heroSlides = [] } = useQuery<HeroSlide[]>({
    queryKey: ["/api/hero-slides"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const createCards = useMemo<CreateCard[]>(
    () => [
      {
        id: "alfia-saudi",
        title: t("landing.cards.alfiaSaudiStyle"),
        description: t("landing.cards.alfiaSaudiDesc"),
        icon: Sparkles,
        action: "modal-image",
        initialModel: "saudi-model-pro",
        imageConfigKey: "service_card_image_alfia_saudi",
      },
      {
        id: "create-image",
        title: t("landing.cards.createImage"),
        description: t("landing.cards.createImageDesc"),
        icon: ImageIcon,
        action: "modal-image",
        imageConfigKey: "service_card_image_create_image",
      },
      {
        id: "create-video",
        title: t("landing.cards.createVideo"),
        description: t("landing.cards.createVideoDesc"),
        icon: Video,
        action: "modal-video",
        imageConfigKey: "service_card_image_create_video",
      },
      {
        id: "film-studio",
        title: t("landing.cards.filmStudio"),
        description: t("landing.cards.filmStudioDesc"),
        icon: Film,
        action: "navigate",
        route: "/film-studio",
        imageConfigKey: "service_card_image_film_studio",
      },
    ],
    [t],
  );

  const defaultServiceCards = useMemo<ServiceCard[]>(
    () => [
      {
        id: 1,
        title: t("landing.imageGeneration"),
        titleAr: null,
        description: t("landing.imageGenerationDesc"),
        descriptionAr: null,
        imageUrl: null,
        linkUrl: "/create",
        linkType: "internal",
        modalType: null,
        initialModel: null,
        sortOrder: 0,
        isActive: true,
      },
      {
        id: 2,
        title: t("landing.videoGeneration"),
        titleAr: null,
        description: t("landing.videoGenerationDesc"),
        descriptionAr: null,
        imageUrl: null,
        linkUrl: "/video-studio",
        linkType: "internal",
        modalType: null,
        initialModel: null,
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 3,
        title: t("landing.filmStudioPromo"),
        titleAr: null,
        description: t("landing.filmStudioPromoDesc"),
        descriptionAr: null,
        imageUrl: null,
        linkUrl: "/film-studio",
        linkType: "internal",
        modalType: null,
        initialModel: null,
        sortOrder: 2,
        isActive: true,
      },
    ],
    [t],
  );

  const activeServiceCards = useMemo(() => {
    const filtered = serviceCards
      .filter((card) => card.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 3);
    return filtered.length > 0 ? filtered : defaultServiceCards;
  }, [defaultServiceCards, serviceCards]);

  const activeFeaturedItems = useMemo(() => {
    return featuredItems
      .filter((item) => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [featuredItems]);

  const featuredShowcaseItems = useMemo(
    () => activeFeaturedItems.slice(0, 5),
    [activeFeaturedItems],
  );

  const activeHeroSlides = useMemo(() => {
    return heroSlides
      .filter((slide) => slide.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [heroSlides]);

  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [isHeroAutoPlaying, setIsHeroAutoPlaying] = useState(true);
  const heroResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCurrentHeroSlide(0);
  }, [activeHeroSlides.length]);

  useEffect(() => {
    if (!isHeroAutoPlaying || activeHeroSlides.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % activeHeroSlides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [activeHeroSlides.length, isHeroAutoPlaying]);

  useEffect(() => {
    return () => {
      if (heroResumeTimeoutRef.current) {
        clearTimeout(heroResumeTimeoutRef.current);
      }
    };
  }, []);

  const pauseHeroAutoplay = useCallback(() => {
    setIsHeroAutoPlaying(false);
    if (heroResumeTimeoutRef.current) {
      clearTimeout(heroResumeTimeoutRef.current);
    }
    heroResumeTimeoutRef.current = setTimeout(() => {
      setIsHeroAutoPlaying(true);
    }, 10000);
  }, []);

  const nextHeroSlide = useCallback(() => {
    if (activeHeroSlides.length <= 1) return;
    setCurrentHeroSlide((prev) => (prev + 1) % activeHeroSlides.length);
    pauseHeroAutoplay();
  }, [activeHeroSlides.length, pauseHeroAutoplay]);

  const prevHeroSlide = useCallback(() => {
    if (activeHeroSlides.length <= 1) return;
    setCurrentHeroSlide((prev) => (prev - 1 + activeHeroSlides.length) % activeHeroSlides.length);
    pauseHeroAutoplay();
  }, [activeHeroSlides.length, pauseHeroAutoplay]);

  const goToHeroSlide = useCallback(
    (index: number) => {
      setCurrentHeroSlide(index);
      pauseHeroAutoplay();
    },
    [pauseHeroAutoplay],
  );

  const currentHeroSlideData = activeHeroSlides[currentHeroSlide];

  const heroTitle = isArabic
    ? currentHeroSlideData?.titleAr ||
      currentHeroSlideData?.title ||
      t("landing.heroTitle", "Unleash Your Creative Potential")
    : currentHeroSlideData?.title || t("landing.heroTitle", "Unleash Your Creative Potential");
  const heroSubtitle = isArabic
    ? currentHeroSlideData?.subtitleAr ||
      currentHeroSlideData?.subtitle ||
      t(
        "landing.heroDesc",
        "Create stunning images, generate professional videos, and explore AI-powered tools designed for creators.",
      )
    : currentHeroSlideData?.subtitle ||
      t(
        "landing.heroDesc",
        "Create stunning images, generate professional videos, and explore AI-powered tools designed for creators.",
      );

  const heroImage =
    currentHeroSlideData?.imageUrl ||
    getConfig("landing_hero_visual") ||
    getConfig("service_card_image_create_image") ||
    activeFeaturedItems[0]?.thumbnailUrl ||
    activeFeaturedItems[0]?.imageUrl ||
    "";
  const heroTransitionKey = currentHeroSlideData
    ? `slide-${currentHeroSlideData.id}`
    : `fallback-${heroImage || "default"}`;

  const serviceFallbackImages = [
    getConfig("service_card_image_alfia_saudi"),
    getConfig("service_card_image_create_image"),
    getConfig("service_card_image_create_video"),
  ];

  const handleServiceCardClick = (card: ServiceCard) => {
    if (card.linkType === "external" && card.linkUrl) {
      window.open(card.linkUrl, "_blank");
      return;
    }
    if (card.linkType === "internal" && card.linkUrl) {
      setLocation(card.linkUrl);
      return;
    }
    if (card.linkType === "modal") {
      if (!isAuthenticated) {
        setActiveModal({ type: "login-required" });
        return;
      }
      if (card.modalType === "image") {
        setActiveModal({ type: "image", initialModel: card.initialModel || undefined });
      } else if (card.modalType === "video") {
        setActiveModal({ type: "video", initialModel: card.initialModel || undefined });
      }
    }
  };

  const handleCreateCardClick = (card: CreateCard) => {
    if (card.action === "navigate" && card.route) {
      setLocation(card.route);
      return;
    }
    if (!isAuthenticated) {
      setActiveModal({ type: "login-required" });
      return;
    }
    if (card.action === "modal-image") {
      setActiveModal({ type: "image", initialModel: card.initialModel });
    } else if (card.action === "modal-video") {
      setActiveModal({ type: "video" });
    }
  };

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleImageGenerated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/images"] });
  }, []);

  const handleVideoGenerated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
  }, []);

  const handleImageGenerationStart = useCallback(() => {
    setActiveModal(null);
    setLocation("/images");
  }, [setLocation]);

  const handleVideoGenerationStart = useCallback(() => {
    setActiveModal(null);
    setLocation("/video-studio");
  }, [setLocation]);

  return (
    <div
      className="relative overflow-hidden bg-[#04081d] text-slate-100 antialiased selection:bg-[#1F56F5]/30 selection:text-white"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(91,52,225,0.24),transparent_40%),radial-gradient(circle_at_82%_18%,rgba(0,176,255,0.18),transparent_35%),radial-gradient(circle_at_50%_78%,rgba(168,85,247,0.14),transparent_45%),linear-gradient(180deg,#050a22_0%,#0a1440_45%,#090a24_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1160px] px-4 pb-12 pt-8 md:px-6 md:pt-10">
        <section className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div key={`hero-copy-${heroTransitionKey}`} className="animate-fade-in space-y-4">
              <Badge
                variant="outline"
                className="w-fit border-[#1F56F5]/60 bg-[#1F56F5]/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#dbe6ff]"
              >
                {t("landing.badge", "AI Creative Studio")}
              </Badge>

              <h1
                className={`max-w-xl bg-gradient-to-b from-slate-100 via-[#9cb6ff] to-[#1F56F5] bg-clip-text font-extrabold text-transparent ${
                  isArabic
                    ? "text-3xl leading-[1.32] pb-1 sm:text-4xl md:text-5xl md:leading-[1.38]"
                    : "text-3xl leading-[1.12] sm:text-4xl md:text-5xl md:leading-[1.15]"
                }`}
              >
                {heroTitle}
              </h1>
              <p
                className={`max-w-xl text-base text-slate-200/85 ${
                  isArabic
                    ? "pt-3 leading-[1.65] md:pt-2 md:text-[1.3rem] md:leading-[1.7]"
                    : "pt-1 leading-relaxed md:text-[1.35rem] md:leading-relaxed"
                }`}
              >
                {heroSubtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                className="h-11 rounded-full bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(31,86,245,0.35)] transition-all duration-200 hover:opacity-90 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-primary))] focus:ring-offset-2 focus:ring-offset-[#04081d]"
                onClick={() =>
                  document.getElementById("create-section")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {t("landing.startCreatingNow")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 rounded-full border-white/25 bg-white/10 px-7 text-sm text-slate-100 hover:bg-white/15"
                onClick={() => setLocation("/gallery")}
              >
                {t("landing.viewGallery")}
              </Button>
            </div>
          </div>

          <div className="animate-fade-in rounded-3xl border border-[#1F56F5]/35 bg-gradient-to-br from-[#0b1746]/90 via-[#111d54]/80 to-[#091436]/95 p-2 shadow-[0_20px_70px_rgba(31,86,245,0.38)]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070e2a]">
              {heroImage ? (
                <img
                  key={`hero-image-${heroTransitionKey}`}
                  src={heroImage}
                  alt={heroTitle}
                  className="h-[280px] w-full object-cover animate-fade-in will-change-[opacity] md:h-[320px]"
                />
              ) : (
                <div
                  key={`hero-fallback-${heroTransitionKey}`}
                  className="flex h-[280px] items-center justify-center animate-fade-in md:h-[320px]"
                >
                  <Sparkles className="h-14 w-14 text-[#21B0F8]/75" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030813]/60 via-transparent to-transparent" />

              {activeHeroSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F56F5]/55 bg-[#0c1f56]/60 text-[#c8d8ff] shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-[#1F56F5]/25"
                    onClick={prevHeroSlide}
                    data-testid="button-hero-prev"
                    aria-label="Previous hero slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#1F56F5]/55 bg-[#0c1f56]/60 text-[#c8d8ff] shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-[#1F56F5]/25"
                    onClick={nextHeroSlide}
                    data-testid="button-hero-next"
                    aria-label="Next hero slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                    {activeHeroSlides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => goToHeroSlide(index)}
                        className={`min-h-0 min-w-0 rounded-full p-0 transition-all duration-200 ${
                          currentHeroSlide === index
                            ? "h-2 w-2 bg-[#1F56F5] shadow-[0_0_10px_rgba(31,86,245,0.55)]"
                            : "h-1.5 w-1.5 bg-[#6f87c7]/45 hover:bg-[#1F56F5]/70"
                        }`}
                        aria-label={`Go to hero slide ${index + 1}`}
                        data-testid={`button-hero-dot-${index}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section
          id="create-section"
          className="mt-8 grid gap-4 lg:grid-cols-5"
          data-testid="create-tools-section"
        >
          <div
            className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3"
            data-testid="promo-cards-section"
          >
            {activeServiceCards.map((card, index) => {
              const displayTitle = isArabic && card.titleAr ? card.titleAr : card.title;
              const displayDescription = isArabic && card.descriptionAr ? card.descriptionAr : card.description;
              const IconComponent = getServiceIcon(card.title);
              const cardImage = card.imageUrl || serviceFallbackImages[index] || "";

              return (
                <button
                  key={card.id}
                  type="button"
                  className="group relative min-h-[260px] overflow-hidden rounded-2xl border border-white/15 bg-[#060d2e]/80 text-left transition-all hover:-translate-y-1 hover:border-[#1F56F5]/55 hover:shadow-[0_18px_40px_rgba(31,86,245,0.35)]"
                  onClick={() => handleServiceCardClick(card)}
                  data-testid={`promo-card-${card.id}`}
                >
                  {cardImage ? (
                    <img
                      src={cardImage}
                      alt={displayTitle}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1f3d93]/70 to-[#050b24]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md">
                      <IconComponent className="h-4 w-4 text-[#c8d8ff]" />
                    </span>
                    <h3 className="line-clamp-2 text-2xl font-semibold leading-tight text-white">
                      {displayTitle}
                    </h3>
                    <p className="mt-1 line-clamp-3 text-base leading-snug text-white/85">
                      {displayDescription}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2" data-testid="create-cards-grid">
            {createCards.map((card) => {
              const imageUrl = card.imageConfigKey ? getConfig(card.imageConfigKey) : "";
              return (
                <button
                  key={card.id}
                  type="button"
                  className="group relative min-h-[124px] overflow-hidden rounded-2xl border border-white/15 bg-[#060d2f]/85 p-4 text-left transition-all hover:-translate-y-1 hover:border-[#1F56F5]/55 hover:shadow-[0_14px_34px_rgba(31,86,245,0.35)]"
                  onClick={() => handleCreateCardClick(card)}
                  data-testid={`card-create-${card.id}`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={card.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#09153f]/40 via-[#09153f]/85 to-[#070b1f]" />

                  <div className="relative z-10">
                    <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <card.icon className="h-4 w-4 text-[#c8d8ff]" />
                    </span>
                    <h3 className="line-clamp-1 text-lg font-semibold text-slate-100">{card.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-300/90">
                      {card.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {featuredShowcaseItems.length > 0 && (
          <section className="mt-14" data-testid="featured-gallery-section">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold leading-tight text-slate-100">
                  {t("landing.discoverProjects")}
                </h2>
                <p className="mt-1 text-base text-slate-300/85">{t("landing.discoverDescription")}</p>
              </div>

              <Link href="/gallery">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-full border-white/25 bg-white/10 px-6 text-slate-100 hover:bg-white/15"
                  data-testid="button-view-gallery"
                >
                  {t("landing.viewGallery")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {featuredShowcaseItems.map((item) => {
                const mediaPreview = item.thumbnailUrl || item.imageUrl || "";
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-white/15 bg-[#060e2f]/90 text-left transition-all hover:-translate-y-1 hover:border-[#1F56F5]/55 hover:shadow-[0_14px_34px_rgba(31,86,245,0.32)]"
                    onClick={() => setSelectedMedia(item)}
                    data-testid={`featured-item-${item.id}`}
                  >
                    {mediaPreview ? (
                      <img
                        src={mediaPreview}
                        alt={item.prompt || "Featured item"}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : null}

                    <div
                      className={`absolute inset-0 ${
                        mediaPreview
                          ? "bg-gradient-to-t from-black/90 via-black/60 to-black/15"
                          : "bg-gradient-to-br from-[#0f1c57] via-[#0d1438] to-[#0a0f28]"
                      }`}
                    />

                    {item.itemType === "video" && (
                      <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white">
                        <Play className="h-4 w-4" />
                      </span>
                    )}

                    <p className="relative z-10 p-4 text-base leading-snug text-slate-100 line-clamp-4">
                      {item.prompt || `${item.itemType} #${item.itemId}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <Dialog open={activeModal?.type === "login-required"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-md border-blue-950/70 bg-[#0b1230]">
          <DialogTitle className="text-center text-xl font-bold text-white">
            {t("landing.signInToCreate")}
          </DialogTitle>
          <div className="py-4 text-center">
            <p className="mb-6 text-slate-300">{t("landing.signInDescription")}</p>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => (window.location.href = "/api/login")}
                data-testid="modal-signup-button"
              >
                {t("landing.signInSignUp")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleCloseModal}
                className="text-slate-300 hover:text-white"
                data-testid="modal-cancel-button"
              >
                {t("landing.maybeLater")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal?.type === "image"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto border-blue-950/70 bg-[#0b1230] sm:max-w-lg [&>button]:text-white [&>button]:hover:text-slate-300"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-center text-xl font-bold text-white">
            {t("landing.imageGeneration")}
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

      <Dialog open={activeModal?.type === "video"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto border-blue-950/70 bg-[#0b1230] sm:max-w-lg [&>button]:text-white [&>button]:hover:text-slate-300"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-center text-xl font-bold text-white">
            {t("landing.videoGeneration")}
          </DialogTitle>
          <div className="pt-2">
            {activeModal?.type === "video" && (
              <VideoGenerationForm
                onVideoGenerated={handleVideoGenerated}
                onMobileClose={handleCloseModal}
                onGenerationStart={handleVideoGenerationStart}
                initialModel={activeModal.initialModel}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedMedia(null)}
          data-testid="media-modal"
        >
          <div className="relative max-h-[90vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-11 right-0 text-white transition-colors hover:text-[#21B0F8]"
              onClick={() => setSelectedMedia(null)}
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            {selectedMedia.itemType === "video" ? (
              <video
                src={selectedMedia.imageUrl || ""}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />
            ) : (
              <img
                src={selectedMedia.imageUrl || ""}
                alt={selectedMedia.prompt || "Featured item"}
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />
            )}
            {selectedMedia.prompt && (
              <p className="mt-4 text-center text-white">{selectedMedia.prompt}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
