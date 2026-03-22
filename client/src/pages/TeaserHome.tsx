import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  motion, AnimatePresence, useScroll, useTransform, useSpring, } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Users, ImagePlus as Image, Clapperboard as Video, Film, Folder, Shield, Check, X, ChevronDown, ChevronUp, Compass as Globe, Menu, WandSparkles as Sparkles, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { content, Language } from "@/lib/teaser-content";
import "@/styles/teaser-theme.css";
import { useSiteConfig } from "@/hooks/useSiteConfig";

function useMouseParallax(intensity: number = 0.05) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) * intensity;
      const y = (e.clientY - window.innerHeight / 2) * intensity;
      setPosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [intensity]);

  return position;
}

interface OrbProps {
  orb: {
    size: number;
    color: string;
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    blur: number;
    speed: number;
  };
  index: number;
  mouseX: number;
}

function FloatingOrb({ orb, index, mouseX }: OrbProps) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 3000], [0, -300 * orb.speed]);
  const springY = useSpring(y, { stiffness: 50, damping: 20 });

  return (
    <motion.div
      className="absolute rounded-full opacity-20"
      style={{
        width: orb.size,
        height: orb.size,
        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
        filter: `blur(${orb.blur}px)`,
        left: orb.left,
        right: orb.right,
        top: orb.top,
        bottom: orb.bottom,
        y: springY,
        x: mouseX * (index + 1) * 0.5,
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.15, 0.25, 0.15],
      }}
      transition={{
        duration: 8 + index * 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

function FloatingOrbs() {
  const mouse = useMouseParallax(0.02);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Disable floating orbs on mobile to prevent performance issues
  if (isMobile) return null;

  const orbs = [
    {
      size: 400,
      color: "#1F56F5",
      left: "10%",
      top: "20%",
      blur: 150,
      speed: 0.1,
    },
    {
      size: 300,
      color: "#1F56F5",
      right: "15%",
      top: "40%",
      blur: 120,
      speed: 0.15,
    },
    {
      size: 250,
      color: "hsl(170, 100%, 45%)",
      left: "5%",
      bottom: "30%",
      blur: 100,
      speed: 0.08,
    },
    {
      size: 350,
      color: "hsl(200, 100%, 50%)",
      right: "10%",
      bottom: "20%",
      blur: 130,
      speed: 0.12,
    },
    {
      size: 200,
      color: "hsl(160, 100%, 50%)",
      left: "50%",
      top: "10%",
      blur: 80,
      speed: 0.2,
    },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {orbs.map((orb, i) => (
        <FloatingOrb key={i} orb={orb} index={i} mouseX={mouse.x} />
      ))}
    </div>
  );
}

const defaultHeroVideo = "/videos/31kjPOxbbzyPUtA9rq0Yr_909WCA2C.mp4";

interface HeroVideos {
  id: number;
  desktopVideoUrl: string;
  mobileVideoUrl: string;
  isActive: boolean;
}

interface TeaserGalleryItem {
  id: number;
  imageUrl: string;
  captionEn: string;
  captionAr: string;
  sortOrder: number;
  isActive: boolean;
}

interface TeaserShowcaseVideo {
  id: number;
  videoUrl: string;
  captionEn: string;
  captionAr: string;
  isActive: boolean;
}

const fallbackGalleryImages = [
  {
    imageUrl: "/images/86-7cd9a60a-73b0-492b-a270-69da7dd69d0d.jpg",
    captionEn: "Saudi businessman in modern office",
    captionAr: "رجل أعمال سعودي في مكتب حديث",
  },
  {
    imageUrl:
      "/objects/generated-images/image-508-e40898d3-7209-420b-bfa0-c7b47e5df93e.png",
    captionEn: "Traditional Saudi culture",
    captionAr: "الثقافة السعودية التقليدية",
  },
  {
    imageUrl:
      "/objects/generated-images/image-323-1902f1fd-7b88-4256-bfe6-bcb2ef604191.png",
    captionEn: "Saudi heritage",
    captionAr: "التراث السعودي",
  },
  {
    imageUrl:
      "/objects/generated-images/image-318-3652b664-4a73-46f2-bd60-2f9cda94bddc.png",
    captionEn: "Modern Saudi Arabia",
    captionAr: "المملكة العربية السعودية الحديثة",
  },
  {
    imageUrl:
      "/objects/generated-images/image-305-9c70d3f9-8fae-4957-bdad-4e66df2d0b19.png",
    captionEn: "Saudi lifestyle",
    captionAr: "نمط الحياة السعودي",
  },
  {
    imageUrl:
      "/objects/generated-images/image-310-9ee3df12-e6a1-46d8-88da-39d2f2fbe05b.png",
    captionEn: "Saudi art",
    captionAr: "الفن السعودي",
  },
  {
    imageUrl:
      "/objects/generated-images/image-313-2c0484b5-ab7c-4521-9aac-1691e5027fa8.png",
    captionEn: "Saudi vision",
    captionAr: "الرؤية السعودية",
  },
];

const iconMap: Record<string, React.ElementType> = {
  users: Users,
  image: Image,
  video: Video,
  film: Film,
  folder: Folder,
  shield: Shield,
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function TeaserHome() {
  const [language, setLanguage] = useState<Language>("en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    country: "",
    usage: "",
    generate: "",
    social: "",
    notes: "",
  });
  const waitlistRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const { getConfig } = useSiteConfig();
  const siteLogo = getConfig("site_logo");

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 200]);
  const heroScale = useTransform(heroScrollProgress, [0, 1], [1, 1.1]);
  const heroTextY = useTransform(heroScrollProgress, [0, 1], [0, -100]);

  const { data: galleryItems } = useQuery<TeaserGalleryItem[]>({
    queryKey: ["/api/teaser-gallery"],
  });

  const { data: showcaseVideo } = useQuery<TeaserShowcaseVideo | null>({
    queryKey: ["/api/teaser-showcase-video"],
  });

  const { data: heroVideos } = useQuery<HeroVideos | null>({
    queryKey: ["/api/hero-videos"],
  });

  // Track screen size for responsive hero video
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Get the appropriate hero video URL based on screen size
  const heroVideoUrl =
    heroVideos?.isActive !== false
      ? isMobile
        ? heroVideos?.mobileVideoUrl || defaultHeroVideo
        : heroVideos?.desktopVideoUrl || defaultHeroVideo
      : defaultHeroVideo;

  const displayGalleryItems =
    galleryItems && galleryItems.length > 0
      ? galleryItems
          .filter((item) => item.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            imageUrl: item.imageUrl,
            captionEn: item.captionEn,
            captionAr: item.captionAr,
          }))
      : fallbackGalleryImages;

  const t = content[language];
  const isRTL = language === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const scrollToWaitlist = () => {
    waitlistRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ar" : "en"));
  };

  return (
    <div className="teaser-page" dir={isRTL ? "rtl" : "ltr"}>
      <div className="parallax-grid" />
      <FloatingOrbs />

      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4"
        style={{
          background: "rgba(10, 10, 15, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="teaser-container-lg flex items-center justify-between">
          <div className="flex items-center">
            {siteLogo && (
              <img src={siteLogo} alt="Logo" className="h-12 object-contain" />
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            <a
              href="#features"
              className="text-white/70 hover:text-white transition-colors"
              data-testid="nav-product"
            >
              {t.header.nav.product}
            </a>
            <a
              href="#saudi-model"
              className="text-white/70 hover:text-white transition-colors"
              data-testid="nav-saudi-model"
            >
              {t.header.nav.saudiModel}
            </a>
            <a
              href="#gallery"
              className="text-white/70 hover:text-white transition-colors"
              data-testid="nav-gallery"
            >
              {t.header.nav.gallery}
            </a>
            <a
              href="#how-it-works"
              className="text-white/70 hover:text-white transition-colors"
              data-testid="nav-how-it-works"
            >
              {t.header.nav.howItWorks}
            </a>
            <a
              href="#faq"
              className="text-white/70 hover:text-white transition-colors"
              data-testid="nav-faq"
            >
              {t.header.nav.faq}
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="button-language-toggle"
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm">
                {language === "en" ? "عربي" : "EN"}
              </span>
            </button>

            <button
              onClick={scrollToWaitlist}
              className="hidden md:block neon-button-primary"
              data-testid="button-join-waitlist-header"
            >
              {t.header.joinWaitlist}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden mt-4 pb-4 border-t border-white/10"
            >
              <nav className="flex flex-col gap-4 pt-4">
                <a
                  href="#features"
                  className="text-white/70 hover:text-white transition-colors py-2"
                >
                  {t.header.nav.product}
                </a>
                <a
                  href="#saudi-model"
                  className="text-white/70 hover:text-white transition-colors py-2"
                >
                  {t.header.nav.saudiModel}
                </a>
                <a
                  href="#gallery"
                  className="text-white/70 hover:text-white transition-colors py-2"
                >
                  {t.header.nav.gallery}
                </a>
                <a
                  href="#how-it-works"
                  className="text-white/70 hover:text-white transition-colors py-2"
                >
                  {t.header.nav.howItWorks}
                </a>
                <a
                  href="#faq"
                  className="text-white/70 hover:text-white transition-colors py-2"
                >
                  {t.header.nav.faq}
                </a>
                <button
                  onClick={scrollToWaitlist}
                  className="neon-button-primary mt-2"
                  data-testid="button-join-waitlist-mobile"
                >
                  {t.header.joinWaitlist}
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-24 overflow-hidden"
      >
        <motion.div
          className="hero-video-container"
          style={{ scale: heroScale }}
        >
          <motion.video
            key={heroVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ y: heroY }}
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </motion.video>
          <div className="hero-video-overlay" />
        </motion.div>

        <motion.div
          className="teaser-container relative z-10 px-4 md:px-8"
          style={{
            y: heroTextY,
          }}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-2xl"
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="neon-badge" data-testid="badge-beta">
                {t.hero.badge}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
              data-testid="text-hero-title"
            >
              <span className="neon-gradient-text text-[45px]">
                {t.hero.title}
              </span>
            </motion.h1>

            <motion.ul
              variants={fadeInUp}
              className="flex flex-col gap-3 mb-10 max-w-2xl mx-auto"
            >
              {t.hero.bullets.map((bullet, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-left"
                  style={{ textAlign: isRTL ? "right" : "left" }}
                >
                  <Check className="w-5 h-5 text-[#21B0F8] mt-0.5 flex-shrink-0" />
                  <span className="text-white/80">{bullet}</span>
                </li>
              ))}
            </motion.ul>

            <motion.div
              variants={fadeInUp}
              className={`flex flex-col sm:flex-row gap-4 ${isRTL ? "justify-end" : "justify-start"} items-center`}
            >
              <button
                onClick={scrollToWaitlist}
                className="neon-button-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                data-testid="button-join-waitlist-hero"
              >
                {t.hero.primaryCta}
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={scrollToGallery}
                className="neon-button-secondary w-full sm:w-auto"
                data-testid="button-see-samples-hero"
              >
                {t.hero.secondaryCta}
              </button>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              className="mt-6 text-sm text-white/50"
            >
              {t.hero.microcopy}
            </motion.p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <ChevronDown className="w-8 h-8 text-white/30" />
          </motion.div>
        </motion.div>
      </section>
      {/* Feature Highlight Section */}
      <section id="saudi-model" className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <motion.div variants={fadeInUp}>
              <h2
                className="text-3xl md:text-4xl font-bold mb-6"
                style={{
                  fontFamily: isRTL
                    ? "Cairo, sans-serif"
                    : "Outfit, sans-serif",
                }}
                data-testid="text-feature-title"
              >
                {t.featureHighlight.title}
              </h2>
              <p className="text-white/70 text-lg mb-8 leading-relaxed">
                {t.featureHighlight.description}
              </p>
              <ul className="space-y-4">
                {t.featureHighlight.highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#1F56F5] to-[#1F56F5] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-black" />
                    </div>
                    <span className="text-white/80">{highlight}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {showcaseVideo?.isActive !== false && (
              <motion.div
                variants={fadeInUp}
                className="relative flex justify-center"
              >
                <div className="glass-card overflow-hidden w-full max-w-[320px]">
                  <video
                    src={
                      showcaseVideo?.videoUrl ||
                      "/videos/demo.mp4"
                    }
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full aspect-[9/16] object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white/80 text-sm text-center">
                      {language === "en"
                        ? showcaseVideo?.captionEn ||
                          "Culturally aligned visuals"
                        : showcaseVideo?.captionAr || "صور متوافقة ثقافيًا"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>
      {/* Core Features Section */}
      <section id="features" className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title mb-12"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.coreFeatures.title}
            </motion.h2>

            <motion.div
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {t.coreFeatures.cards.map((card, index) => {
                const Icon = iconMap[card.icon] || Sparkles;
                return (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className="glass-card p-6 group cursor-pointer"
                    data-testid={`card-feature-${index}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:bg-gradient-to-r group-hover:from-[#1F56F5] group-hover:to-[#1F56F5] transition-all duration-300">
                      <Icon className="w-6 h-6 text-[#21B0F8] group-hover:text-black transition-colors duration-300" />
                    </div>
                    <h3
                      className="text-xl font-semibold mb-2"
                      style={{
                        fontFamily: isRTL
                          ? "Cairo, sans-serif"
                          : "Outfit, sans-serif",
                      }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-white/60">{card.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Gallery Section */}
      <section id="gallery" ref={galleryRef} className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.gallery.title}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-center text-white/60 mb-12 max-w-2xl mx-auto"
            >
              {t.gallery.subtitle}
            </motion.p>

            <motion.div
              variants={stagger}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {displayGalleryItems.slice(0, 7).map((item, index) => {
                const caption = isRTL ? item.captionAr : item.captionEn;
                return (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className={`gallery-item glass-card overflow-hidden group cursor-pointer ${index === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
                    style={{ animationDelay: `${index * 0.5}s` }}
                    data-testid={`card-gallery-${index}`}
                  >
                    <div
                      className={`${index === 0 ? "aspect-square" : "aspect-[4/3]"} bg-gradient-to-br from-[hsl(240,10%,8%)] to-[hsl(240,10%,12%)] overflow-hidden`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3 bg-black/30">
                      <p className="text-sm text-white/70 line-clamp-1">
                        {caption}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Comparison Section */}
      <section className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title mb-12"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.comparison.title}
            </motion.h2>

            <motion.div
              variants={stagger}
              className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              <motion.div
                variants={fadeInUp}
                className="comparison-card general"
              >
                <h3
                  className="text-xl font-semibold mb-6 text-white/60"
                  style={{
                    fontFamily: isRTL
                      ? "Cairo, sans-serif"
                      : "Outfit, sans-serif",
                  }}
                >
                  {t.comparison.general.title}
                </h3>
                <ul className="space-y-4">
                  {t.comparison.general.points.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-white/60">{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div variants={fadeInUp} className="comparison-card saudi">
                <h3
                  className="text-xl font-semibold mb-6 neon-gradient-text"
                  style={{
                    fontFamily: isRTL
                      ? "Cairo, sans-serif"
                      : "Outfit, sans-serif",
                  }}
                >
                  {t.comparison.saudi.title}
                </h3>
                <ul className="space-y-4">
                  {t.comparison.saudi.points.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#21B0F8] mt-0.5 flex-shrink-0" />
                      <span className="text-white/90">{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* How It Works Section */}
      <section id="how-it-works" className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title mb-12"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.howItWorks.title}
            </motion.h2>

            <motion.div variants={stagger} className="max-w-2xl mx-auto">
              {t.howItWorks.steps.map((step, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="timeline-step"
                >
                  <div className="timeline-number">{index + 1}</div>
                  <div className="pt-2">
                    <p className="text-lg text-white/80">{step}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Invite Only Section */}
      <section className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="glass-card p-8 md:p-12 text-center max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="mb-4">
              <span className="neon-badge">{t.hero.badge}</span>
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="text-2xl md:text-3xl font-bold mb-4"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.inviteOnly.title}
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-white/70 mb-6">
              {t.inviteOnly.description}
            </motion.p>
            <motion.p
              variants={fadeInUp}
              className="text-sm text-white/50 italic"
            >
              {t.inviteOnly.influencerNote}
            </motion.p>
          </motion.div>
        </div>
      </section>
      {/* Waitlist Form Section */}
      <section
        ref={waitlistRef}
        className="teaser-section"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(31, 86, 245, 0.03))",
        }}
      >
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="max-w-xl mx-auto"
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.waitlist.title}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-center text-white/60 mb-8"
            >
              {t.waitlist.subtitle}
            </motion.p>

            <AnimatePresence mode="wait">
              {formSubmitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-8 text-center success-animation"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#1F56F5] to-[#1F56F5] flex items-center justify-center">
                    <Check className="w-8 h-8 text-black" />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-2"
                    style={{
                      fontFamily: isRTL
                        ? "Cairo, sans-serif"
                        : "Outfit, sans-serif",
                    }}
                  >
                    {t.waitlist.success.title}
                  </h3>
                  <p className="text-white/70">{t.waitlist.success.message}</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  variants={stagger}
                  onSubmit={handleSubmit}
                  className="glass-card p-6 md:p-8 space-y-5"
                >
                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.fullName} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      className="neon-input"
                      data-testid="input-full-name"
                    />
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.email} *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="neon-input"
                      data-testid="input-email"
                    />
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.country}
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      placeholder={t.waitlist.fields.countryDefault}
                      className="neon-input"
                      data-testid="input-country"
                    />
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.usage}
                    </label>
                    <select
                      value={formData.usage}
                      onChange={(e) =>
                        setFormData({ ...formData, usage: e.target.value })
                      }
                      className="neon-select"
                      data-testid="select-usage"
                    >
                      <option value="">---</option>
                      {t.waitlist.fields.usageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.generate}
                    </label>
                    <select
                      value={formData.generate}
                      onChange={(e) =>
                        setFormData({ ...formData, generate: e.target.value })
                      }
                      className="neon-select"
                      data-testid="select-generate"
                    >
                      <option value="">---</option>
                      {t.waitlist.fields.generateOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.social}
                    </label>
                    <input
                      type="text"
                      value={formData.social}
                      onChange={(e) =>
                        setFormData({ ...formData, social: e.target.value })
                      }
                      className="neon-input"
                      data-testid="input-social"
                    />
                  </motion.div>

                  <motion.div variants={fadeInUp}>
                    <label className="block text-sm text-white/70 mb-2">
                      {t.waitlist.fields.notes}
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="neon-input min-h-[100px] resize-none"
                      data-testid="input-notes"
                    />
                  </motion.div>

                  <motion.div variants={fadeInUp} className="pt-2">
                    <button
                      type="submit"
                      className="neon-button-primary w-full"
                      data-testid="button-submit-waitlist"
                    >
                      {t.waitlist.submitButton}
                    </button>
                    <p className="text-center text-sm text-white/40 mt-4">
                      {t.waitlist.microcopy}
                    </p>
                  </motion.div>

                  <motion.p
                    variants={fadeInUp}
                    className="text-center text-xs text-white/30"
                  >
                    {t.waitlist.privacy}
                  </motion.p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
      {/* FAQ Section */}
      <section id="faq" className="teaser-section">
        <div className="teaser-container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="max-w-2xl mx-auto"
          >
            <motion.h2
              variants={fadeInUp}
              className="teaser-section-title mb-8"
              style={{
                fontFamily: isRTL ? "Cairo, sans-serif" : "Outfit, sans-serif",
              }}
            >
              {t.faq.title}
            </motion.h2>

            <motion.div variants={fadeInUp} className="neon-accordion">
              {t.faq.items.map((item, index) => (
                <div key={index} className="neon-accordion-item">
                  <button
                    onClick={() =>
                      setOpenFaqIndex(openFaqIndex === index ? null : index)
                    }
                    className="neon-accordion-trigger"
                    data-testid={`button-faq-${index}`}
                  >
                    <span>{item.question}</span>
                    {openFaqIndex === index ? (
                      <ChevronUp className="w-5 h-5 text-[#21B0F8]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/40" />
                    )}
                  </button>
                  <AnimatePresence>
                    {openFaqIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="neon-accordion-content">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/10">
        <div className="teaser-container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center">
              {siteLogo && (
                <img
                  src={siteLogo}
                  alt="Logo"
                  className="h-10 object-contain"
                />
              )}
            </div>

            <p className="text-white/50 text-sm text-center">
              {t.footer.tagline}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 text-xs">
            <Link href="/legal/cookies"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'سياسة ملفات تعريف الارتباط' : 'Cookie Policy'}</span></Link>
            <Link href="/legal/content-policy"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'سياسة المحتوى' : 'Content Policy'}</span></Link>
            <Link href="/legal/billing"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'سياسة الفوترة' : 'Billing Policy'}</span></Link>
            <Link href="/legal/copyright"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'الملكية الفكرية' : 'Copyright'}</span></Link>
            <Link href="/legal/gallery-terms"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'شروط المعرض' : 'Gallery Terms'}</span></Link>
            <Link href="/legal/notice"><span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">{isRTL ? 'إشعار قانوني' : 'Legal Notice'}</span></Link>
          </div>

          <div className="text-center mt-8 text-white/30 text-xs">
            © {new Date().getFullYear()} {t.header.logo}. {isRTL ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </div>
        </div>
      </footer>
    </div>
  );
}

