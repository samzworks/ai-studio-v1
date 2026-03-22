import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// Import translation files as fallback
import enCommon from '../locales/en/common.json';
import arCommon from '../locales/ar/common.json';

const resources = {
  en: {
    common: enCommon
  },
  ar: {
    common: arCommon
  }
};

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Use local resources as primary source with backend as fallback
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    // Backend configuration to fetch translations from API (as fallback)
    backend: {
      loadPath: '/api/i18n/{{lng}}?namespace={{ns}}',
      allowMultiLoading: false,
      crossDomain: false,
      withCredentials: false,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false
    },

    ns: ['common'],
    defaultNS: 'common',

    // Use local bundled resources, backend can override if needed
    partialBundledLanguages: true,
    
    // Development-only missing key detection with more visible errors
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: process.env.NODE_ENV === 'development' ? (lng, ns, key, fallbackValue) => {
      console.error(`[i18n] ⚠️ MISSING TRANSLATION KEY: ${ns}:${key} for language: ${lng}`);
      console.error(`[i18n] 💡 Add this key to client/src/locales/${lng}/common.json`);
    } : undefined,
    
    // Return key as fallback in development to make missing keys obvious
    returnNull: false,
    returnEmptyString: false,
  });

// Function to set HTML direction based on language
export function setHtmlDirection(language: string) {
  const isRTL = language === 'ar';
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}

// Listen for language changes and update HTML direction
i18n.on('languageChanged', (lng) => {
  setHtmlDirection(lng);
});

// Set initial direction
if (typeof document !== 'undefined') {
  setHtmlDirection(i18n.language);
}

export default i18n;