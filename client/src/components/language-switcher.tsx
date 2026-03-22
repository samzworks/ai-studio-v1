import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const isEnglish = currentLanguage.startsWith('en');

  // Effect to handle RTL direction
  useEffect(() => {
    const isArabic = currentLanguage.startsWith('ar');
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const toggleLanguage = () => {
    const newLanguage = isEnglish ? 'ar' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex h-7 items-center gap-1.5 rounded-md border border-white/15 bg-transparent px-2.5 text-sm text-white/85 transition-colors hover:bg-white/5 hover:text-white"
      data-testid="button-language-toggle"
    >
      <span
        className="text-sm"
        lang={isEnglish ? "ar" : "en"}
        dir={isEnglish ? "rtl" : "ltr"}
        style={isEnglish ? { fontFamily: "'Cairo', 'Inter', sans-serif" } : undefined}
      >
        {isEnglish ? "\u0639\u0631\u0628\u064a" : "EN"}
      </span>
    </button>
  );
}
