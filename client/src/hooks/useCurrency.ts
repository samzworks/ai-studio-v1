import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface SiteConfig {
  default_currency?: string;
  [key: string]: any;
}

const CURRENCY_CONFIG: Record<string, { code: string; symbolEn: string; symbolAr: string }> = {
  USD: { code: "USD", symbolEn: "$", symbolAr: "$" },
  EUR: { code: "EUR", symbolEn: "€", symbolAr: "€" },
  SAR: { code: "SAR", symbolEn: "SAR", symbolAr: "ر.س" },
};

export function useCurrency() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const { data: config } = useQuery<SiteConfig>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
  });

  const currencyCode = config?.default_currency || "USD";
  const currencyConfig = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.USD;

  // Always use English locale for Western numerals (0-9)
  const formatPrice = (cents: number): string => {
    const amount = cents / 100;
    const formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    const symbol = isArabic ? currencyConfig.symbolAr : currencyConfig.symbolEn;
    
    // For Arabic, put symbol after the number
    if (isArabic) {
      return `${formattedNumber} ${symbol}`;
    }
    // For English with SAR, put symbol after
    if (currencyCode === "SAR") {
      return `${formattedNumber} ${symbol}`;
    }
    // For other currencies in English, put symbol before
    return `${symbol}${formattedNumber}`;
  };

  const formatPriceWithSymbol = (cents: number): string => {
    const amount = (cents / 100).toFixed(2);
    const symbol = isArabic ? currencyConfig.symbolAr : currencyConfig.symbolEn;
    
    if (isArabic || currencyCode === "SAR") {
      return `${amount} ${symbol}`;
    }
    return `${symbol}${amount}`;
  };

  return {
    currencyCode: currencyConfig.code,
    currencySymbol: isArabic ? currencyConfig.symbolAr : currencyConfig.symbolEn,
    formatPrice,
    formatPriceWithSymbol,
  };
}
