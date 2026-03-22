import { storage } from "../storage";
import type { PricingOperation, PricingSetting } from "@shared/schema";

// Cost snapshot interface for transaction audit trail
export interface CostSnapshot {
  operationId: string;
  baseCostUsd: number;
  units: number;
  marginPercent: number;
  effectiveUsd: number;
  credits: number;
  timestamp: string;
  // New fields for video pricing audit trail
  duration?: number;
  resolution?: string;
  audio_on?: boolean;
  billingMode?: string;
}

// Cost calculation result interface
export interface CalculatedCost {
  baseCostUsd: number;
  units: number;
  marginPercent: number;
  effectiveUsd: number;
  credits: number;
  snapshot: CostSnapshot;
}

/**
 * Pricing Calculator Service
 * 
 * Implements the credit pricing system:
 * - 1 credit = $0.01 USD (fixed)
 * - EffectivePrice = BaseCost * (1 + Margin%)
 * - Credits = ceil(EffectivePrice / $0.01) = ceil(EffectivePrice * 100)
 * 
 * Rounding: Always ceil to avoid under-charging
 */
export class PricingCalculator {
  private static instance: PricingCalculator;
  
  private settingsCache: Map<string, any> = new Map();
  private operationsCache: Map<string, PricingOperation> = new Map();
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): PricingCalculator {
    if (!PricingCalculator.instance) {
      PricingCalculator.instance = new PricingCalculator();
    }
    return PricingCalculator.instance;
  }

  /**
   * Clear all cached pricing data
   * Call this after admin updates to pricing settings or operations
   */
  clearCache(): void {
    this.settingsCache.clear();
    this.operationsCache.clear();
    this.cacheTimestamp = 0;
    console.log("Pricing calculator cache cleared");
  }

  /**
   * Load pricing settings with caching
   */
  private async loadSettings(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_DURATION && this.settingsCache.size > 0) {
      return; // Cache is still valid
    }

    const settings = await storage.getAllPricingSettings();
    this.settingsCache.clear();
    
    for (const setting of settings) {
      this.settingsCache.set(setting.key, setting.value);
    }
    
    this.cacheTimestamp = now;
  }

  /**
   * Get a pricing setting value
   */
  private async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.loadSettings();
    return this.settingsCache.get(key) ?? defaultValue;
  }

  /**
   * Get credit to USD exchange rate
   */
  async getCreditUsdRate(): Promise<number> {
    return await this.getSetting<number>('credit_usd_rate', 0.01);
  }

  /**
   * Get rounding mode
   */
  async getRoundingMode(): Promise<string> {
    return await this.getSetting<string>('rounding_mode', 'ceil');
  }

  /**
   * Get general margin percentage
   */
  async getGeneralMargin(): Promise<number> {
    return await this.getSetting<number>('general_margin_percent', 35);
  }

  /**
   * Get minimum charge in credits
   */
  async getMinCharge(): Promise<number> {
    return await this.getSetting<number>('min_charge_credits', 0);
  }

  /**
   * Get maximum charge in credits (0 = no limit)
   */
  async getMaxCharge(): Promise<number> {
    return await this.getSetting<number>('max_charge_credits', 0);
  }

  /**
   * Get pricing operation by operation ID
   */
  async getOperation(operationId: string): Promise<PricingOperation | null> {
    // Check cache first
    if (this.operationsCache.has(operationId)) {
      return this.operationsCache.get(operationId)!;
    }

    // Load from database
    const operation = await storage.getPricingOperation(operationId);
    if (operation) {
      this.operationsCache.set(operationId, operation);
      return operation;
    }
    
    return null;
  }

  /**
   * Calculate cost for an operation
   * 
   * @param operationId - The operation identifier (e.g., "video.veo3.generate")
   * @param units - Number of units (e.g., seconds for video, images for image gen)
   * @returns Calculated cost with snapshot
   */
  async calculateCost(operationId: string, units: number = 1): Promise<CalculatedCost> {
    // Get the operation
    const operation = await this.getOperation(operationId);
    if (!operation || !operation.isActive) {
      throw new Error(`Operation not found or inactive: ${operationId}`);
    }

    // Calculate base cost in USD
    const baseCostUsd = operation.baseCostUsd * units;

    // Determine which margin to apply
    const generalMargin = await this.getGeneralMargin();
    const marginPercent = operation.perOperationMarginPercent ?? generalMargin;

    // Calculate effective price with margin
    const effectiveUsd = baseCostUsd * (1 + marginPercent / 100);

    // Convert to credits with dynamic rate and rounding mode
    const creditUsdRate = await this.getCreditUsdRate();
    const roundingMode = await this.getRoundingMode();
    
    let credits: number;
    if (roundingMode === 'floor') {
      credits = Math.floor(effectiveUsd / creditUsdRate);
    } else if (roundingMode === 'round') {
      credits = Math.round(effectiveUsd / creditUsdRate);
    } else {
      // Default to ceil (round up) to avoid under-charging
      credits = Math.ceil(effectiveUsd / creditUsdRate);
    }

    // Apply min/max guards
    const minCharge = await this.getMinCharge();
    const maxCharge = await this.getMaxCharge();
    
    if (minCharge > 0 && credits < minCharge) {
      credits = minCharge;
    }
    if (maxCharge > 0 && credits > maxCharge) {
      credits = maxCharge;
    }

    // Create cost snapshot for audit
    const snapshot: CostSnapshot = {
      operationId,
      baseCostUsd,
      units,
      marginPercent,
      effectiveUsd,
      credits,
      timestamp: new Date().toISOString()
    };

    return {
      baseCostUsd,
      units,
      marginPercent,
      effectiveUsd,
      credits,
      snapshot
    };
  }

  /**
   * Calculate cost for multiple operations
   */
  async calculateBatchCost(items: Array<{ operationId: string; units: number }>): Promise<{
    items: CalculatedCost[];
    totalCredits: number;
    totalUsd: number;
  }> {
    const results = await Promise.all(
      items.map(item => this.calculateCost(item.operationId, item.units))
    );

    const totalCredits = results.reduce((sum, r) => sum + r.credits, 0);
    const totalUsd = results.reduce((sum, r) => sum + r.effectiveUsd, 0);

    return {
      items: results,
      totalCredits,
      totalUsd
    };
  }

  /**
   * Estimate cost preview for common quantities
   */
  async getCostPreview(operationId: string, quantities: number[] = [1, 5, 10, 30]): Promise<Array<{
    units: number;
    credits: number;
    usd: number;
  }>> {
    const results = await Promise.all(
      quantities.map(async (units) => {
        const cost = await this.calculateCost(operationId, units);
        return {
          units,
          credits: cost.credits,
          usd: cost.effectiveUsd
        };
      })
    );

    return results;
  }

  /**
   * Alias for calculateCost (backward compatibility)
   * Used by credit service
   * 
   * Safely extracts and parses units from various param formats
   * Now supports advanced billing modes for per-second, per-resolution video pricing
   */
  async calculate(operationId: string, params?: any): Promise<CalculatedCost> {
    // Get the operation
    const operation = await this.getOperation(operationId);
    if (!operation || !operation.isActive) {
      throw new Error(`Operation not found or inactive: ${operationId}`);
    }

    // Check if this operation uses advanced billing modes
    if (operation.billingMode && operation.rates) {
      return await this.calculateAdvancedCost(operation, params);
    }

    // LEGACY PATH: Use simple baseCostUsd * units calculation
    // Extract units from params, supporting multiple input formats
    let rawUnits: any;
    if (typeof params === 'object' && params !== null) {
      rawUnits = params.units || params.quantity || params.duration;
    } else {
      rawUnits = params;
    }
    
    // Parse and validate units
    let units = 1; // default
    if (rawUnits !== undefined && rawUnits !== null) {
      const parsed = typeof rawUnits === 'number' 
        ? rawUnits 
        : parseFloat(String(rawUnits));
      
      // Ensure valid positive number
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        units = parsed;
      } else {
        console.warn(`Invalid units parameter: ${rawUnits}, defaulting to 1`);
      }
    }
    
    return await this.calculateCost(operationId, units);
  }

  /**
   * Calculate cost using advanced billing modes (per-second, per-resolution, per-job-flat)
   * Supports:
   * - per_second: Cost = rate * seconds (with optional audio_on/audio_off tiers)
   * - per_second_with_resolution: Cost = rate_for_resolution * seconds
   * - per_job_flat_by_resolution: Cost = flat_price_for_resolution (duration fixed)
   */
  private async calculateAdvancedCost(
    operation: PricingOperation,
    params?: any
  ): Promise<CalculatedCost> {
    // Extract parameters
    const duration = params?.duration || params?.units || 1;
    const resolution = params?.resolution || '720p'; // default resolution
    const audioOn = params?.audio_on ?? params?.audioOn ?? false;
    
    let baseCostUsd = 0;
    let units = duration;
    const rates = operation.rates as any;

    console.log(`[PricingCalculator] Advanced billing for ${operation.operationId}:`, {
      billingMode: operation.billingMode,
      duration,
      resolution,
      audioOn,
      rates
    });

    // Calculate base USD cost based on billing mode
    switch (operation.billingMode) {
      case 'per_second': {
        // Example rates: 
        // - With audio tiers: { "audio_on": 0.40, "audio_off": 0.20 }
        // - Without audio tiers: { "default": 0.10 }
        let ratePerSecond: number;
        
        if (rates.default !== undefined) {
          // Simple default rate (no audio tiers, e.g., Sora 2 Standard)
          ratePerSecond = rates.default;
        } else {
          // Audio-tiered rates (e.g., VEO models)
          const audioKey = audioOn ? 'audio_on' : 'audio_off';
          ratePerSecond = rates[audioKey];
          
          if (!ratePerSecond) {
            throw new Error(`Missing rate for ${audioKey} in operation ${operation.operationId}`);
          }
        }
        
        baseCostUsd = ratePerSecond * Math.ceil(duration);
        console.log(`[PricingCalculator] per_second: ${ratePerSecond}/s * ${Math.ceil(duration)}s = $${baseCostUsd}`);
        break;
      }

      case 'per_second_with_resolution': {
        // Example rates: { "480p": 0.05, "720p": 0.10, "1080p": 0.15 }
        // OR with audio tiers: { "720p": { "audio_on": 0.40, "audio_off": 0.20 } }
        const resolutionRate = rates[resolution];
        
        if (!resolutionRate) {
          throw new Error(`Missing rate for resolution ${resolution} in operation ${operation.operationId}`);
        }

        let ratePerSecond: number;
        if (typeof resolutionRate === 'object') {
          // Resolution has audio tiers
          const audioKey = audioOn ? 'audio_on' : 'audio_off';
          ratePerSecond = resolutionRate[audioKey];
          if (!ratePerSecond) {
            throw new Error(`Missing audio tier ${audioKey} for resolution ${resolution} in operation ${operation.operationId}`);
          }
        } else {
          // Simple per-second rate
          ratePerSecond = resolutionRate;
        }
        
        baseCostUsd = ratePerSecond * Math.ceil(duration);
        console.log(`[PricingCalculator] per_second_with_resolution: ${ratePerSecond}/s * ${Math.ceil(duration)}s = $${baseCostUsd}`);
        break;
      }

      case 'per_job_flat_by_resolution': {
        // Example rates: { "480p": 0.05, "580p": 0.075, "720p": 0.10 }
        const flatPrice = rates[resolution];
        
        if (!flatPrice) {
          throw new Error(`Missing flat price for resolution ${resolution} in operation ${operation.operationId}`);
        }
        
        baseCostUsd = flatPrice;
        units = 1; // Flat pricing is per job, not per unit
        console.log(`[PricingCalculator] per_job_flat_by_resolution: $${flatPrice} for ${resolution}`);
        break;
      }

      case 'per_image_by_size': {
        // Example rates: { "1024x1024": 0.009, "1536x1024": 0.013, "1024x1536": 0.013 }
        const imageSize = params?.imageSize || '1024x1024';
        const quantity = params?.quantity || params?.units || 1;
        const pricePerImage = rates[imageSize];
        
        if (!pricePerImage) {
          // Fallback to first available rate if size not found
          const fallbackPrice = Object.values(rates)[0] as number || operation.baseCostUsd || 0.01;
          console.warn(`[PricingCalculator] Size ${imageSize} not found in rates, using fallback $${fallbackPrice}`);
          baseCostUsd = fallbackPrice * quantity;
        } else {
          baseCostUsd = pricePerImage * quantity;
        }
        
        units = quantity;
        console.log(`[PricingCalculator] per_image_by_size: $${pricePerImage || 'fallback'} * ${quantity} = $${baseCostUsd} for ${imageSize}`);
        break;
      }

      case 'per_image_by_resolution': {
        // Example rates: { "1K": 0.04, "2K": 0.08, "4K": 0.148 }
        const imageResolution = params?.resolution || '1K';
        const quantity = params?.quantity || params?.units || 1;
        const pricePerImage = rates[imageResolution];
        
        if (!pricePerImage) {
          // Fallback to first available rate if resolution not found
          const fallbackPrice = Object.values(rates)[0] as number || operation.baseCostUsd || 0.04;
          console.warn(`[PricingCalculator] Resolution ${imageResolution} not found in rates, using fallback $${fallbackPrice}`);
          baseCostUsd = fallbackPrice * quantity;
        } else {
          baseCostUsd = pricePerImage * quantity;
        }
        
        units = quantity;
        console.log(`[PricingCalculator] per_image_by_resolution: $${pricePerImage || 'fallback'} * ${quantity} = $${baseCostUsd} for ${imageResolution}`);
        break;
      }

      case 'per_second_with_image_input': {
        // Grok Imagine Video pricing: $0.05/sec + $0.002 for image input
        // Example rates: { "default": 0.05, "image_input_fee": 0.002 }
        const ratePerSecond = rates.default;
        const imageInputFee = rates.image_input_fee || 0;
        
        if (!ratePerSecond) {
          throw new Error(`Missing default rate in operation ${operation.operationId}`);
        }
        
        // Calculate: (rate * seconds) + image input fee
        baseCostUsd = (ratePerSecond * Math.ceil(duration)) + imageInputFee;
        console.log(`[PricingCalculator] per_second_with_image_input: ($${ratePerSecond}/s * ${Math.ceil(duration)}s) + $${imageInputFee} image fee = $${baseCostUsd}`);
        break;
      }

      default:
        throw new Error(`Unknown billing mode: ${operation.billingMode}`);
    }

    // Determine which margin to apply
    const generalMargin = await this.getGeneralMargin();
    const marginPercent = operation.perOperationMarginPercent ?? generalMargin;

    // Calculate effective price with margin
    const effectiveUsd = baseCostUsd * (1 + marginPercent / 100);

    // Convert to credits with dynamic rate and rounding mode
    const creditUsdRate = await this.getCreditUsdRate();
    const roundingMode = await this.getRoundingMode();
    
    let credits: number;
    if (roundingMode === 'floor') {
      credits = Math.floor(effectiveUsd / creditUsdRate);
    } else if (roundingMode === 'round') {
      credits = Math.round(effectiveUsd / creditUsdRate);
    } else {
      // Default to ceil (round up) to avoid under-charging
      credits = Math.ceil(effectiveUsd / creditUsdRate);
    }

    // Apply min/max guards
    const minCharge = await this.getMinCharge();
    const maxCharge = await this.getMaxCharge();
    
    if (minCharge > 0 && credits < minCharge) {
      credits = minCharge;
    }
    if (maxCharge > 0 && credits > maxCharge) {
      credits = maxCharge;
    }

    // Create cost snapshot for audit
    const snapshot: CostSnapshot = {
      operationId: operation.operationId,
      baseCostUsd,
      units,
      marginPercent,
      effectiveUsd,
      credits,
      timestamp: new Date().toISOString(),
      // Include video-specific parameters for audit trail
      duration,
      resolution,
      audio_on: audioOn,
      billingMode: operation.billingMode
    };

    console.log(`[PricingCalculator] Final cost: $${baseCostUsd} base → $${effectiveUsd} effective → ${credits} credits`);

    return {
      baseCostUsd,
      units,
      marginPercent,
      effectiveUsd,
      credits,
      snapshot
    };
  }

  /**
   * Convert credits to USD
   */
  async creditsToUsd(credits: number): Promise<number> {
    const rate = await this.getCreditUsdRate();
    return credits * rate;
  }

  /**
   * Convert USD to credits (respects rounding mode)
   */
  async usdToCredits(usd: number): Promise<number> {
    const rate = await this.getCreditUsdRate();
    const roundingMode = await this.getRoundingMode();
    
    if (roundingMode === 'floor') {
      return Math.floor(usd / rate);
    } else if (roundingMode === 'round') {
      return Math.round(usd / rate);
    } else {
      return Math.ceil(usd / rate);
    }
  }
}

export const pricingCalculator = PricingCalculator.getInstance();
