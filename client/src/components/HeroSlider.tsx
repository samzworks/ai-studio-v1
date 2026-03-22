import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HeroSlide } from "@shared/schema";

export function HeroSlider() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Fetch active hero slides
  const { data: slides = [], isLoading } = useQuery<HeroSlide[]>({
    queryKey: ["/api/hero-slides"],
  });

  // Auto-slide functionality
  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, slides.length]);

  // Reset to first slide when slides change
  useEffect(() => {
    setCurrentSlide(0);
  }, [slides]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000); // Resume auto-play after 10 seconds
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000); // Resume auto-play after 10 seconds
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000); // Resume auto-play after 10 seconds
  };

  if (isLoading) {
    return (
      <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] bg-gradient-to-br from-primary/20 via-secondary/10 to-primary/20 animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-64 h-8 bg-primary/20 rounded-lg mx-auto"></div>
            <div className="w-96 h-4 bg-secondary/20 rounded mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] bg-gradient-to-br from-primary/20 via-secondary/10 to-primary/20">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 px-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Welcome to Tkoeen
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto">
              Create stunning images with the power of AI. Transform your ideas into visual masterpieces.
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => window.location.href = '/api/login'}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];
  const slideTitle = isArabic ? currentSlideData.titleAr || currentSlideData.title : currentSlideData.title;
  const slideSubtitle = isArabic
    ? currentSlideData.subtitleAr || currentSlideData.subtitle
    : currentSlideData.subtitle;

  return (
    <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] overflow-hidden group">
      {/* Background Image */}
      <div className="absolute inset-0 transition-transform duration-700 ease-in-out">
        <img
          src={currentSlideData.imageUrl}
          alt={slideTitle}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 600'%3e%3crect width='1200' height='600' fill='%23083c4c'/%3e%3c/svg%3e";
          }}
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-6 px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            {slideTitle}
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
            {slideSubtitle}
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-base md:text-lg px-6 md:px-8 py-4 md:py-6 mt-6 md:mt-8 touch-friendly"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-get-started"
          >
            Get Started
          </Button>
        </div>
      </div>

      {/* Navigation Arrows - Always visible on mobile, hover-triggered on desktop */}
      {slides.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 touch-friendly"
            onClick={prevSlide}
            data-testid="button-previous-slide"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 touch-friendly"
            onClick={nextSlide}
            data-testid="button-next-slide"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </>
      )}

      {/* Line Navigation - Touch-friendly on mobile */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`transition-all duration-300 touch-friendly ${
                index === currentSlide
                  ? "bg-white"
                  : "bg-white/40 hover:bg-white/60"
              }`}
              style={{
                width: '40px',
                height: '12px',
                minHeight: '12px',
                minWidth: '40px'
              }}
              onClick={() => goToSlide(index)}
              data-testid={`button-slide-${index}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Auto-play Indicator */}
      {slides.length > 1 && isAutoPlaying && (
        <div className="absolute top-4 right-4 opacity-50">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}
