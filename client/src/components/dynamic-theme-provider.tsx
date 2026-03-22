
import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Converts a hex color to HSL values (h s% l%)
 * Handles 3-digit and 6-digit hex codes
 */
function hexToHSL(hex: string): string | null {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    // Handle 3-digit hex
    if (!result) {
        const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if (shortResult) {
            result = [
                shortResult[0],
                shortResult[1] + shortResult[1],
                shortResult[2] + shortResult[2],
                shortResult[3] + shortResult[3]
            ] as RegExpExecArray;
        }
    }

    if (!result) return null;

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function DynamicThemeProvider() {
    const { config } = useSiteConfig();

    useEffect(() => {
        console.log("DynamicThemeProvider: Config changed", config);
        if (!config) return;

        const root = document.documentElement;

        // Apply primary color if set
        if (config.primary_color) {
            const hsl = hexToHSL(config.primary_color);
            console.log("DynamicTheme: Setting primary color", config.primary_color, hsl);
            if (hsl) {
                root.style.setProperty("--primary", hsl);
                // Also update ring color to match primary for consistency
                root.style.setProperty("--ring", hsl);
            }
        } else {
            console.log("DynamicTheme: No primary_color in config");
        }

        // Apply secondary color if set
        if (config.secondary_color) {
            const hsl = hexToHSL(config.secondary_color);
            if (hsl) {
                root.style.setProperty("--secondary", hsl);
            }
        }

        // Apply accent color if set
        if (config.accent_color) {
            const hsl = hexToHSL(config.accent_color);
            if (hsl) {
                root.style.setProperty("--accent", hsl);
            }
        }

        // Apply background color if set (be careful with this one as it changes the whole theme base)
        if (config.background_color) {
            const hsl = hexToHSL(config.background_color);
            if (hsl) {
                root.style.setProperty("--background", hsl);
            }
        }

    }, [config]);

    return null; // This component doesn't render anything visible
}
