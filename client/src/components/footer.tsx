import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const { i18n, t } = useTranslation();
  const { config } = useSiteConfig();
  const isRTL = i18n.language === 'ar';

  const legalLinks = [
    { href: "/legal/terms", labelEn: "Terms of Service", labelAr: "شروط الخدمة" },
    { href: "/legal/privacy", labelEn: "Privacy Policy", labelAr: "سياسة الخصوصية" },
    { href: "/legal/cookies", labelEn: "Cookie Policy", labelAr: "سياسة ملفات تعريف الارتباط" },
    { href: "/legal/content-policy", labelEn: "Content Policy", labelAr: "سياسة المحتوى" },
    { href: "/legal/billing", labelEn: "Billing Policy", labelAr: "سياسة الفوترة" },
    { href: "/legal/copyright", labelEn: "Copyright", labelAr: "الملكية الفكرية" },
    { href: "/legal/gallery-terms", labelEn: "Gallery Terms", labelAr: "شروط المعرض" },
    { href: "/legal/notice", labelEn: "Legal Notice", labelAr: "إشعار قانوني" },
  ];

  return (
    <footer 
      className={cn("border-t border-white/10 bg-gray-900/50 backdrop-blur-sm", className)}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              {config?.site_logo && (
                <img
                  src={config.site_logo}
                  alt={config?.site_name || "Logo"}
                  className="h-8 object-contain"
                />
              )}
              <span className="text-white/70 text-sm">
                {config?.site_name || "Tkoeen"}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <Link href="/contact">
                <span className="text-white/50 hover:text-white transition-colors cursor-pointer">
                  {isRTL ? "اتصل بنا" : "Contact"}
                </span>
              </Link>
              <a
                href="mailto:support@tkoeen.net"
                className="text-white/50 hover:text-white transition-colors"
              >
                support@tkoeen.net
              </a>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span className="text-white/40 hover:text-white/70 transition-colors cursor-pointer">
                  {isRTL ? link.labelAr : link.labelEn}
                </span>
              </Link>
            ))}
          </div>

          <div className="text-center text-white/30 text-xs">
            © {new Date().getFullYear()} {config?.site_name || "Tkoeen"}. {isRTL ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </div>
        </div>
      </div>
    </footer>
  );
}
