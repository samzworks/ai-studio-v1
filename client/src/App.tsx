import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { GlobalToastProvider } from "@/components/global-toast-provider";
import { CreditProvider } from "@/contexts/CreditContext";
import { GenerationJobsProvider } from "@/contexts/GenerationJobsContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import '@/lib/i18n';
import '@/lib/zod-i18n';
import { Navigation } from "@/components/navigation";
import { MobileFooterNav } from "@/components/mobile-footer-nav";
import { Footer } from "@/components/footer";

const Home = lazy(() => import("@/pages/home"));
const LegalPage = lazy(() => import("@/pages/legal"));
const Profile = lazy(() => import("@/pages/profile"));
const Landing = lazy(() => import("@/pages/Landing"));
const PublicGallery = lazy(() => import("@/pages/public-gallery"));
const Favorites = lazy(() => import("@/pages/favorites"));
const History = lazy(() => import("@/pages/history"));
const VideoStudio = lazy(() => import("@/pages/video-studio"));
const FilmStudio = lazy(() => import("@/pages/film-studio"));
const Create = lazy(() => import("@/pages/create"));
const BuyCredits = lazy(() => import("@/pages/buy-credits"));
const Credits = lazy(() => import("@/pages/credits"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminPricing = lazy(() => import("@/pages/AdminPricing"));
const AdminCredits = lazy(() => import("@/pages/admin-credits"));
const PromptManagement = lazy(() => import("@/pages/prompt-management"));
const TranslationManagement = lazy(() => import("@/pages/translation-management"));
const Contact = lazy(() => import("@/pages/contact"));
const Pricing = lazy(() => import("@/pages/pricing"));
const ManageSubscription = lazy(() => import("@/pages/manage-subscription"));
const TeaserHome = lazy(() => import("@/pages/TeaserHome"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Unauthorized = lazy(() => import("@/pages/unauthorized"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center" data-testid="page-loader">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
      </div>
    </div>
  );
}

function LoadingText() {
  const { t } = useTranslation();
  return <div className="text-white">{t('common.loading')}</div>;
}

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  useEffect(() => {
    const initTheme = async () => {
      const { initializeTheme } = await import("@/lib/theme-service");
      initializeTheme();
    };

    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    const timer = hasIdleCallback
      ? window.requestIdleCallback(initTheme)
      : window.setTimeout(initTheme, 100);

    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(timer as number);
      } else {
        window.clearTimeout(timer as number);
      }
    };
  }, []);

  useEffect(() => {
    const initSession = async () => {
      const { autoFixSession, forceUserStateReset } = await import("@/utils/cache-buster");
      autoFixSession();

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true') {
        forceUserStateReset();
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    };

    initSession();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#030815] via-[#07152e] to-[#030815] flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <LoadingText />
          </div>
        </div>
      </div>
    );
  }

  const isTeaserPage = window.location.pathname === '/teaser';

  if (isTeaserPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <TeaserHome />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030815] via-[#07152e] to-[#030815] flex flex-col">
      <Navigation />
      <div className="flex-1 pb-20 md:pb-8">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/images" component={isAuthenticated ? Home : Unauthorized} />
            <Route path="/create" component={isAuthenticated ? Create : Unauthorized} />
            <Route path="/gallery" component={PublicGallery} />
            <Route path="/contact" component={Contact} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/video-studio" component={isAuthenticated ? VideoStudio : Unauthorized} />
            <Route path="/film-studio" component={isAuthenticated ? FilmStudio : Unauthorized} />
            <Route path="/favorites" component={isAuthenticated ? Favorites : Unauthorized} />
            <Route path="/history" component={isAuthenticated ? History : Unauthorized} />
            <Route path="/profile" component={isAuthenticated ? Profile : Unauthorized} />
            <Route path="/buy-credits" component={isAuthenticated ? BuyCredits : Unauthorized} />
            <Route path="/credits" component={isAuthenticated ? Credits : Unauthorized} />
            <Route path="/manage-subscription" component={isAuthenticated ? ManageSubscription : Unauthorized} />
            <Route path="/admin" component={isAdmin ? AdminDashboard : Unauthorized} />
            <Route path="/admin/pricing" component={isAdmin ? AdminPricing : Unauthorized} />
            <Route path="/admin/credits" component={isAdmin ? AdminCredits : Unauthorized} />
            <Route path="/admin/prompts" component={isAdmin ? PromptManagement : Unauthorized} />
            <Route path="/admin/translations" component={isAdmin ? TranslationManagement : Unauthorized} />
            <Route path="/legal/:page" component={LegalPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>
      <Footer />
      <MobileFooterNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CreditProvider>
        <GenerationJobsProvider>
          <TooltipProvider>
            <GlobalToastProvider>
              <Router />
            </GlobalToastProvider>
          </TooltipProvider>
        </GenerationJobsProvider>
      </CreditProvider>
    </QueryClientProvider>
  );
}

export default App;
