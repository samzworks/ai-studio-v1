import { Link, useLocation } from "wouter";
import { Home, Compass as Globe, GalleryHorizontal as FolderOpen, CircleUserRound as User, WandSparkles as Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

export function MobileFooterNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  if (!isMobile || !isAuthenticated) {
    return null;
  }

  const navItems = [
    { href: "/", icon: Home, label: t('mobileNav.home') },
    { href: "/gallery", icon: Globe, label: t('mobileNav.public') },
    { href: "/create", icon: Sparkles, label: t('mobileNav.create'), isCenter: true },
    { href: "/history", icon: FolderOpen, label: t('mobileNav.myGallery', 'My Gallery') },
    { href: "/profile", icon: User, label: t('mobileNav.profile') },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 md:hidden"
      data-testid="mobile-footer-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const itemTestId = `button-${item.label.toLowerCase().replace(' ', '-')}-footer`;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-footer-link flex flex-col items-center justify-center -mt-5 rounded-[10px] outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                data-testid="button-create-footer"
                aria-current={isActive ? "page" : undefined}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] flex items-center justify-center shadow-md shadow-[#1F56F5]/30">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-[10px] mt-1 ${isActive ? "text-white" : "text-gray-400"}`}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-footer-link relative flex flex-col items-center justify-center py-2 px-3 min-w-[60px] rounded-[10px] outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              data-testid={itemTestId}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={`absolute top-0 h-[2px] w-7 transition-opacity ${
                  isActive ? "bg-[#21B0F8] opacity-100" : "opacity-0"
                }`}
              />
              <Icon 
                className={`w-5 h-5 ${
                  isActive ? "text-white" : "text-gray-300"
                }`} 
              />
              <span 
                className={`text-[10px] mt-1 ${
                  isActive ? "text-white" : "text-gray-300"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
