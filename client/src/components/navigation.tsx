import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CircleUserRound as User, DoorOpen as LogOut, Shield, Menu, WalletCards as CreditCard, BellRing as Bell, TimerReset as History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@/hooks/useAuth";
import { NavCreditBalance } from "./nav-credit-balance";
import { LanguageSwitcher } from "./language-switcher";
import { QueueNavButton } from "./queue-nav-button";

interface CreditRequest {
  id: number;
  userId: string;
  requestedAmount: number;
  message: string;
  status: "pending" | "approved" | "rejected";
  approvedAmount: number | null;
  adminNote: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
}

export function Navigation() {
  const [location] = useLocation();
  const { isAuthenticated, user, isAdmin } = useAuth();
  const { getConfig } = useSiteConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const typedUser = user;

  // Fetch pending credit requests for admins
  const { data: adminPendingRequests } = useQuery<CreditRequest[]>({
    queryKey: ["/api/credit-requests", { status: "pending" }],
    queryFn: async () => {
      if (!isAdmin) return [];
      const response = await fetch("/api/credit-requests?status=pending");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30000,
  });

  // Fetch user's credit requests to check for status updates
  const { data: userRequests } = useQuery<CreditRequest[]>({
    queryKey: ["/api/credit-requests"],
    queryFn: async () => {
      if (isAdmin) return [];
      const response = await fetch("/api/credit-requests");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isAuthenticated && !isAdmin,
    refetchInterval: 10000,
  });

  const adminPendingCount = adminPendingRequests?.length || 0;
  const userNotificationCount = userRequests?.filter(r => r.status !== "pending").length || 0;

  const { data: pricingConfig } = useQuery<{ showNavLink?: boolean }>({
    queryKey: ["/api/pricing-page/nav-config"],
    queryFn: async () => {
      const response = await fetch("/api/pricing-page/nav-config");
      if (!response.ok) return { showNavLink: false };
      return response.json();
    },
    staleTime: 60000,
  });

  const showPricingNav = pricingConfig?.showNavLink !== false;
  const navButtonBaseClass = "w-full md:w-auto h-7 justify-start md:justify-center px-2 rounded-md text-sm font-medium transition-colors duration-150";
  const navButtonInactiveClass = "text-white/75 bg-transparent hover:bg-transparent hover:text-white";
  const navButtonActiveClass = "text-[#21B0F8] bg-transparent underline decoration-[#21B0F8]/75 decoration-2 underline-offset-[7px]";
  const navButtonClass = (active: boolean) =>
    `${navButtonBaseClass} ${active ? navButtonActiveClass : navButtonInactiveClass}`;
  const getUserInitials = () => {
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName[0]}${typedUser.lastName[0]}`.toUpperCase();
    }
    if (typedUser?.email) {
      return typedUser.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName} ${typedUser.lastName}`;
    }
    if (typedUser?.firstName) {
      return typedUser.firstName;
    }
    if (typedUser?.email) {
      return typedUser.email.split('@')[0];
    }
    return "User";
  };

  const NavigationContent = () => (
    <>
      {isAuthenticated ? (
        <>
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/")}
              data-testid="button-home-nav"
            >
              {t('navigation.home', 'Home')}
            </Button>
          </Link>
          {/* Create link hidden for now
          <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant={location === "/create" ? "default" : "ghost"}
              size="sm"
              className="text-white w-full md:w-auto justify-start md:justify-center hover:bg-emerald-600/30 hover:text-emerald-300 px-2"
              data-testid="button-create-nav"
            >
              {t('navigation.create')}
            </Button>
          </Link>
          */}
          <Link href="/images" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/images")}
            >
              {t('navigation.image')}
            </Button>
          </Link>
          <Link href="/video-studio" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/video-studio")}
            >
              {t('navigation.video')}
            </Button>
          </Link>
          <Link href="/film-studio" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/film-studio")}
            >
              {t('navigation.filmStudio')}
            </Button>
          </Link>

          <Link href="/gallery" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/gallery")}
            >
              {t('navigation.public', 'Community')}
            </Button>
          </Link>
          <Link href="/favorites" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/favorites")}
            >
              {t('navigation.favorites', 'Favorites')}
            </Button>
          </Link>
          <Link href="/history" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/history")}
            >
              {t('navigation.myWork', 'My Work')}
            </Button>
          </Link>

          {showPricingNav && (
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                size="sm"
                className={navButtonClass(location === "/pricing")}
                data-testid="button-pricing-nav"
              >
                {t('navigation.pricing', 'Pricing')}
              </Button>
            </Link>
          )}

        </>
      ) : (
        <>
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/")}
              data-testid="button-home-nav-guest"
            >
              {t('navigation.home', 'Home')}
            </Button>
          </Link>
          <Link href="/gallery" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="ghost"
              size="sm"
              className={navButtonClass(location === "/gallery")}
            >
              {t('navigation.public', 'Community')}
            </Button>
          </Link>
          {showPricingNav && (
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                size="sm"
                className={navButtonClass(location === "/pricing")}
                data-testid="button-pricing-nav-guest"
              >
                {t('navigation.pricing', 'Pricing')}
              </Button>
            </Link>
          )}
          <a href="/api/login" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="default"
              size="sm"
              className="w-full md:w-auto h-7 rounded-md justify-start md:justify-center px-3 text-sm font-medium bg-[#1F56F5]/20 text-[#21B0F8] border border-[#1F56F5]/35 hover:bg-[#1F56F5]/25 shadow-none"
            >
              {t('navigation.signIn')}
            </Button>
          </a>
        </>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1F56F5]/20 bg-[#060b1a]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[#060b1a]/75">
      <div className="container max-w-5xl mx-auto px-4 py-1.5">
        <div className="flex items-center justify-between">
          {/* Logo - Left */}
          <Link href="/" className="flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              {getConfig("site_logo") && (
                <img
                  src={getConfig("site_logo")}
                  alt="Logo"
                  className="object-contain w-10 h-10 md:w-12 md:h-12"
                />
              )}
              <div className="font-bold text-sm md:text-base text-slate-100">
                {getConfig("site_name", "Tkoeen")}
              </div>
            </div>
          </Link>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center justify-center flex-1 gap-1">
            <NavigationContent />

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Generation Queue Button (Desktop) */}
            {isAuthenticated && (
              <QueueNavButton />
            )}

            {/* User Notification Bell (Desktop) */}
            {isAuthenticated && !isAdmin && (
              <Link href="/buy-credits">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 relative"
                  data-testid="button-notifications"
                >
                  <Bell className="h-5 w-5" />
                  {userNotificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center animate-pulse text-xs"
                      data-testid="badge-user-notification-count"
                    >
                      {userNotificationCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {/* Desktop Credit Balance */}
            {isAuthenticated && (
              <div className="ml-2">
                <NavCreditBalance />
              </div>
            )}

            {/* Desktop User Menu */}
            {isAuthenticated && (
              <div className="ml-4 pl-4 border-l border-slate-700/70">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2 text-white hover:bg-white/10">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={typedUser?.profileImageUrl || undefined} alt={getDisplayName()} />
                        <AvatarFallback className="bg-gradient-to-r from-primary to-purple-600 text-white text-xs">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm hidden lg:block">{getDisplayName()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{getDisplayName()}</p>
                        {typedUser?.email && (
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {typedUser.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link href="/profile">
                      <DropdownMenuItem data-testid="menu-item-profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>{t('navigation.profile', 'Profile')}</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/history">
                      <DropdownMenuItem data-testid="menu-item-history">
                        <History className="mr-2 h-4 w-4" />
                        <span>{t('navigation.myWork', 'My Work')}</span>
                      </DropdownMenuItem>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <DropdownMenuItem data-testid="menu-item-admin">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>{t('navigation.admin', 'Admin')}</span>
                          {adminPendingCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                              data-testid="badge-admin-pending-count-menu"
                            >
                              {adminPendingCount}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      </Link>
                    )}
                    <Link href="/credits">
                      <DropdownMenuItem data-testid="menu-item-usage">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>{t('navigation.usageHistory', 'Usage & History')}</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('navigation.logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Generation Queue Button (Mobile) */}
            {isAuthenticated && (
              <QueueNavButton />
            )}

            {/* User Notification Bell (Mobile) */}
            {isAuthenticated && !isAdmin && (
              <Link href="/buy-credits">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 relative p-2"
                  data-testid="button-notifications-mobile"
                >
                  <Bell className="h-5 w-5" />
                  {userNotificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center animate-pulse text-xs"
                      data-testid="badge-user-notification-count-mobile"
                    >
                      {userNotificationCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {/* Mobile Credit Balance */}
            {isAuthenticated && (
              <NavCreditBalance />
            )}

            {/* Mobile User Avatar */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 p-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={typedUser?.profileImageUrl || undefined} alt={getDisplayName()} />
                      <AvatarFallback className="bg-gradient-to-r from-primary to-purple-600 text-white text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{getDisplayName()}</p>
                      {typedUser?.email && (
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {typedUser.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link href="/profile">
                    <DropdownMenuItem data-testid="menu-item-profile-mobile">
                      <User className="mr-2 h-4 w-4" />
                      <span>{t('navigation.profile', 'Profile')}</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/history">
                    <DropdownMenuItem data-testid="menu-item-history-mobile">
                      <History className="mr-2 h-4 w-4" />
                      <span>{t('navigation.myWork', 'My Work')}</span>
                    </DropdownMenuItem>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem data-testid="menu-item-admin-mobile">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>{t('navigation.admin', 'Admin')}</span>
                        {adminPendingCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                            data-testid="badge-admin-pending-count-menu-mobile"
                          >
                            {adminPendingCount}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <Link href="/credits">
                    <DropdownMenuItem data-testid="menu-item-usage-mobile">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>{t('navigation.usageHistory', 'Usage & History')}</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('navigation.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white p-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 bg-gray-900 border-gray-800">
                <div className="flex flex-col space-y-4 mt-8">
                  <NavigationContent />
                  <div className="pt-4 border-t border-gray-700">
                    <LanguageSwitcher />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}


