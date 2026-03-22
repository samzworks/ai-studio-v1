import { storage } from "../storage";
import { cacheManager } from "../cache/cache-manager";
import type { PricingRule } from "@shared/schema";

export interface GenerationCostDetails {
  baseCost: number;
  additionalCosts: { feature: string; cost: number }[];
  totalCost: number;
}

export class PricingService {
  private static instance: PricingService;
  private readonly CACHE_KEY = "pricing_rules";
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for pricing rules

  private constructor() {}

  static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService();
    }
    return PricingService.instance;
  }

  private async getRules(): Promise<PricingRule[]> {
    // Try to get from cache first
    const cached = cacheManager.get<PricingRule[]>(this.CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Fetch from database and cache
    const rules = await storage.getActivePricingRules();
    cacheManager.set(this.CACHE_KEY, rules, this.CACHE_DURATION);
    return rules;
  }

  clearCache(): void {
    cacheManager.delete(this.CACHE_KEY);
  }

  async calculateGenerationCost(params: {
    model: string;
    enhancePrompt?: boolean;
    imageCount?: number;
    aspectRatio?: string;
    quality?: string;
    styleImageUrl?: string;
  }): Promise<GenerationCostDetails> {
    const rules = await this.getRules();
    const costs: { feature: string; cost: number }[] = [];
    
    // Base model cost
    const modelRule = rules.find(r => 
      r.featureType === "model" && r.featureValue === params.model
    );
    const baseCost = modelRule?.creditCost || 10; // Default 10 credits
    
    // Prompt enhancement cost
    if (params.enhancePrompt) {
      const enhanceRule = rules.find(r => 
        r.featureType === "enhancement" && r.featureValue === "prompt_enhancement"
      );
      if (enhanceRule) {
        costs.push({ feature: "Prompt Enhancement", cost: enhanceRule.creditCost });
      }
    }
    
    // Style image upload cost
    if (params.styleImageUrl) {
      const styleUploadRule = rules.find(r => 
        r.featureType === "style_upload" && r.featureValue === "enabled"
      );
      if (styleUploadRule && styleUploadRule.isActive) {
        costs.push({ feature: "Style Image Upload", cost: styleUploadRule.creditCost });
      }
    }
    
    // Image count multiplier
    const imageCount = params.imageCount || 1;
    if (imageCount > 1) {
      const multiImageRule = rules.find(r => 
        r.featureType === "image_count" && r.featureValue === imageCount.toString()
      );
      if (multiImageRule) {
        costs.push({ 
          feature: `${imageCount} Images`, 
          cost: multiImageRule.creditCost - baseCost // Additional cost
        });
      } else {
        // Default: each additional image costs 80% of base
        costs.push({ 
          feature: `${imageCount} Images`, 
          cost: Math.floor(baseCost * 0.8 * (imageCount - 1))
        });
      }
    }
    
    // Quality adjustment
    if (params.quality && params.quality !== "standard") {
      const qualityRule = rules.find(r => 
        r.featureType === "quality" && r.featureValue === params.quality
      );
      if (qualityRule) {
        costs.push({ feature: `${params.quality} Quality`, cost: qualityRule.creditCost });
      }
    }
    
    // Aspect ratio adjustment (e.g., ultra-wide or tall)
    if (params.aspectRatio) {
      const aspectRule = rules.find(r => 
        r.featureType === "aspect_ratio" && r.featureValue === params.aspectRatio
      );
      if (aspectRule) {
        costs.push({ feature: `${params.aspectRatio} Aspect`, cost: aspectRule.creditCost });
      }
    }
    
    const totalAdditionalCost = costs.reduce((sum, item) => sum + item.cost, 0);
    const totalCost = baseCost + totalAdditionalCost;
    
    return {
      baseCost,
      additionalCosts: costs,
      totalCost
    };
  }

  async canAffordGeneration(userId: string, cost: number): Promise<boolean> {
    const userCredits = await storage.getUserCredits(userId);
    return userCredits ? userCredits.balance >= cost : false;
  }
}

export const pricingService = PricingService.getInstance();