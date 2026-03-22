import { db } from "../db";
import { pricingOperations, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AI_MODELS, VIDEO_MODELS } from "../ai-models";
import { mapModelToOperationId } from "../model-operation-mapping";

interface ModelPricingMapping {
  operationId: string;
  displayName: string;
  provider: string;
  model: string;
  category: "image" | "video" | "audio" | "text";
  unitType: string;
  baseCostUsd: number;
  defaultQuantity: number;
  metadata?: Record<string, any>;
  notes?: string;
  billingMode?: string;
  rates?: Record<string, number>;
}

const SYSTEM_USER_ID = "system";

const IMAGE_MODEL_PRICING: Record<string, { baseCostUsd: number; notes?: string; billingMode?: string; rates?: Record<string, number> }> = {
  "fal-z-image-turbo": { baseCostUsd: 0.0074, notes: "Super fast 6B parameter text-to-image model by Tongyi-MAI" },
  "fal-flux-schnell": { baseCostUsd: 0.003, notes: "Ultra-fast FLUX model optimized for speed" },
  "fal-flux-dev": { baseCostUsd: 0.025, notes: "High-quality FLUX Dev model for detailed image generation" },
  "fal-flux-pro": { baseCostUsd: 0.055, notes: "Premium FLUX Pro model for professional-grade images" },
  "fal-nano-banana-txt2img": { baseCostUsd: 0.039, notes: "Ultra-fast text-to-image with style upload support" },
  "fal-nano-banana-edit": { baseCostUsd: 0.039, notes: "Nano Banana Edit for image-to-image operations" },
  "fal-nano-banana-img2img": { baseCostUsd: 0.039, notes: "Nano Banana Image-to-Image transformation" },
  "fal-saudi-model": { baseCostUsd: 0.039, notes: "Saudi-localized image generation with context-aware reference images" },
  "fal-nano-banana-pro": { 
    baseCostUsd: 0.148, 
    billingMode: "per_image_by_resolution", 
    rates: { "1K": 0.148, "2K": 0.148, "4K": 0.296 }, 
    notes: "Nano Banana Pro with resolution-based pricing - 20 credits for 1K/2K, 40 credits for 4K" 
  },
  "fal-imagen-4-fast": { baseCostUsd: 0.04, notes: "Google's Imagen 4 Fast model for quick, high-quality generation" },
  "fal-imagen-4": { baseCostUsd: 0.05, notes: "Google's Imagen 4 Ultra model for premium image generation" },
  "fal-seedream-4.5-txt2img": { baseCostUsd: 0.04, notes: "ByteDance SeeDream 4.5 text-to-image model with enhanced quality" },
  "fal-seedream-4.5-img2img": { baseCostUsd: 0.04, notes: "ByteDance SeeDream 4.5 image editing model with enhanced precision" },
  "fal-sdxl": { baseCostUsd: 0.035, notes: "Stable Diffusion XL for versatile image generation" },
  "fal-gpt-image-1.5-txt2img-low": { baseCostUsd: 0.01, notes: "GPT Image 1.5 text-to-image low quality" },
  "fal-gpt-image-1.5-txt2img-high": { baseCostUsd: 0.06, notes: "GPT Image 1.5 text-to-image high quality" },
  "fal-gpt-image-1.5-edit-low": { baseCostUsd: 0.01, notes: "GPT Image 1.5 edit low quality" },
  "fal-gpt-image-1.5-edit-high": { baseCostUsd: 0.06, notes: "GPT Image 1.5 edit high quality" },
  "openai-dalle3": { baseCostUsd: 0.04, notes: "OpenAI DALL-E 3 standard quality" },
};

const VIDEO_MODEL_PRICING: Record<string, { baseCostUsd: number; billingMode?: string; rates?: Record<string, number>; unitType?: string; defaultQuantity?: number; notes?: string }> = {
  // WAN 2.2 Turbo (fixed 5s clips)
  "wan-2.2-t2v-fast": { baseCostUsd: 0.05, billingMode: "per_job_flat_by_resolution", rates: { "480p": 0.05, "580p": 0.075, "720p": 0.10 }, unitType: "job", defaultQuantity: 1, notes: "WAN 2.2 Turbo (fixed 5s clips)" },
  "wan-2.2-i2v-fast": { baseCostUsd: 0.05, billingMode: "per_job_flat_by_resolution", rates: { "480p": 0.05, "580p": 0.075, "720p": 0.10 }, unitType: "job", defaultQuantity: 1, notes: "WAN 2.2 Image-to-Video Turbo (fixed 5s clips)" },
  
  // WAN 2.5 Preview
  "wan-2.5-preview-t2v": { baseCostUsd: 0.05, billingMode: "per_second_with_resolution", rates: { "480p": 0.05, "720p": 0.10, "1080p": 0.15 }, unitType: "seconds", defaultQuantity: 5, notes: "WAN 2.5 Preview text-to-video" },
  "wan-2.5-preview-i2v": { baseCostUsd: 0.05, billingMode: "per_second_with_resolution", rates: { "480p": 0.05, "720p": 0.10, "1080p": 0.15 }, unitType: "seconds", defaultQuantity: 5, notes: "WAN 2.5 Preview image-to-video" },
  
  // WAN 2.6 (text-to-video and image-to-video)
  "wan-2.6-t2v": { baseCostUsd: 0.10, billingMode: "per_second_with_resolution", rates: { "720p": 0.10, "1080p": 0.15 }, unitType: "seconds", defaultQuantity: 5, notes: "WAN 2.6 text-to-video with multi-shot and audio file support" },
  "wan-2.6-i2v": { baseCostUsd: 0.10, billingMode: "per_second_with_resolution", rates: { "720p": 0.10, "1080p": 0.15 }, unitType: "seconds", defaultQuantity: 5, notes: "WAN 2.6 image-to-video with multi-shot and audio file support" },
  
  // VEO 3.1 (text-to-video and image-to-video)
  "fal-veo3-t2v": { baseCostUsd: 0.20, billingMode: "per_second", rates: { "audio_on": 0.40, "audio_off": 0.20 }, unitType: "seconds", defaultQuantity: 5, notes: "Veo 3.1 text-to-video: $0.20/sec (audio off), $0.40/sec (audio on)" },
  "fal-veo3-i2v": { baseCostUsd: 0.20, billingMode: "per_second", rates: { "audio_on": 0.40, "audio_off": 0.20 }, unitType: "seconds", defaultQuantity: 5, notes: "Veo 3.1 image-to-video: $0.20/sec (audio off), $0.40/sec (audio on)" },
  
  // VEO 3.1 Fast
  "fal-veo3-fast-t2v": { baseCostUsd: 0.10, billingMode: "per_second", rates: { "audio_on": 0.15, "audio_off": 0.10 }, unitType: "seconds", defaultQuantity: 5, notes: "Veo 3.1 Fast text-to-video: $0.10/sec (audio off), $0.15/sec (audio on)" },
  "fal-veo3-fast-i2v": { baseCostUsd: 0.10, billingMode: "per_second", rates: { "audio_on": 0.15, "audio_off": 0.10 }, unitType: "seconds", defaultQuantity: 5, notes: "Veo 3.1 Fast image-to-video: $0.10/sec (audio off), $0.15/sec (audio on)" },
  
  // Sora 2 Standard (matches ai-models.ts IDs: sora-2-text-to-video, sora-2-image-to-video)
  "sora-2-text-to-video": { baseCostUsd: 0.10, billingMode: "per_second", rates: { "default": 0.10 }, unitType: "seconds", defaultQuantity: 5, notes: "Sora 2 Standard: $0.10/sec (auto resolution)" },
  "sora-2-image-to-video": { baseCostUsd: 0.10, billingMode: "per_second", rates: { "default": 0.10 }, unitType: "seconds", defaultQuantity: 5, notes: "Sora 2 Standard: $0.10/sec (auto resolution)" },
  
  // Sora 2 Pro (matches ai-models.ts IDs: sora-2-pro-text-to-video, sora-2-pro-image-to-video)
  "sora-2-pro-text-to-video": { baseCostUsd: 0.30, billingMode: "per_second_with_resolution", rates: { "720p": 0.30, "1080p": 0.50 }, unitType: "seconds", defaultQuantity: 5, notes: "Sora 2 Pro: $0.30/sec (720p), $0.50/sec (1080p)" },
  "sora-2-pro-image-to-video": { baseCostUsd: 0.30, billingMode: "per_second_with_resolution", rates: { "720p": 0.30, "1080p": 0.50 }, unitType: "seconds", defaultQuantity: 5, notes: "Sora 2 Pro: $0.30/sec (720p), $0.50/sec (1080p)" },
  
  // Kling 2.6 Pro (text-to-video and image-to-video)
  "kling-2.6-pro-t2v": { baseCostUsd: 0.07, billingMode: "per_second", rates: { "audio_on": 0.14, "audio_off": 0.07 }, unitType: "seconds", defaultQuantity: 5, notes: "Kling 2.6 Pro: $0.07/sec (audio off), $0.14/sec (audio on)" },
  "kling-2.6-pro-i2v": { baseCostUsd: 0.07, billingMode: "per_second", rates: { "audio_on": 0.14, "audio_off": 0.07 }, unitType: "seconds", defaultQuantity: 5, notes: "Kling 2.6 Pro: $0.07/sec (audio off), $0.14/sec (audio on)" },
  
  // Kling 2.6 Motion Control
  "kling-2.6-pro-motion": { baseCostUsd: 0.112, billingMode: "per_second", rates: { "default": 0.112 }, unitType: "seconds", defaultQuantity: 5, notes: "Kling 2.6 Pro Motion Control: $0.112/sec" },
  "kling-2.6-standard-motion": { baseCostUsd: 0.07, billingMode: "per_second", rates: { "default": 0.07 }, unitType: "seconds", defaultQuantity: 5, notes: "Kling 2.6 Standard Motion Control: $0.07/sec" },
  
  // Luma Dream Machine
  "fal-luma-dream-machine": { baseCostUsd: 0.03, unitType: "job", defaultQuantity: 1, notes: "Luma Ray Flash 2 (fast, 540p, up to 5s)" },
};

function getProviderFromModelId(modelId: string): string {
  if (modelId.startsWith("openai-") || modelId.includes("dalle")) return "openai";
  if (modelId.startsWith("replicate-")) return "replicate";
  return "fal.ai";
}

export class PricingSyncService {
  private static instance: PricingSyncService;

  private constructor() {}

  static getInstance(): PricingSyncService {
    if (!PricingSyncService.instance) {
      PricingSyncService.instance = new PricingSyncService();
    }
    return PricingSyncService.instance;
  }

  private async ensureSystemUser(): Promise<string> {
    try {
      const [systemUser] = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);
      
      if (systemUser) {
        return systemUser.id;
      }
      
      const [newSystemUser] = await db.insert(users).values({
        id: SYSTEM_USER_ID,
        email: "system@internal",
        firstName: "System",
        lastName: "Admin",
        role: "admin",
        isActive: true
      }).returning();
      
      return newSystemUser.id;
    } catch (error) {
      console.error("[PricingSync] Error ensuring system user, using 'system' as fallback:", error);
      return SYSTEM_USER_ID;
    }
  }

  buildImageModelMapping(model: typeof AI_MODELS[0]): ModelPricingMapping {
    const operationId = mapModelToOperationId(model.id, "image");
    
    // Look up pricing by model ID first, then by operation ID for consolidated operations
    let pricing = IMAGE_MODEL_PRICING[model.id];
    if (!pricing) {
      // Check if there's a consolidated pricing entry by operation ID
      const operationKey = Object.keys(IMAGE_MODEL_PRICING).find(key => 
        mapModelToOperationId(key, "image") === operationId || key === operationId.split('.').slice(1).join('_').replace(/\./g, '_')
      );
      if (operationKey) {
        pricing = IMAGE_MODEL_PRICING[operationKey];
      }
    }
    if (!pricing) {
      pricing = { baseCostUsd: 0.05 };
    }
    
    return {
      operationId,
      displayName: model.name,
      provider: getProviderFromModelId(model.id),
      model: model.name,
      category: "image",
      unitType: "image",
      baseCostUsd: pricing.baseCostUsd,
      defaultQuantity: 1,
      billingMode: pricing.billingMode,
      rates: pricing.rates,
      metadata: {
        maxWidth: model.maxWidth,
        maxHeight: model.maxHeight,
        supportedRatios: model.supportedRatios,
        supportsStyleUpload: model.supportsStyleUpload,
        falModel: model.falModel,
      },
      notes: pricing.notes || `Auto-synced from AI_MODELS: ${model.description}`,
    };
  }

  buildVideoModelMapping(model: typeof VIDEO_MODELS[0]): ModelPricingMapping {
    const pricing = VIDEO_MODEL_PRICING[model.id] || { baseCostUsd: 0.10, unitType: "job", defaultQuantity: 1 };
    const operationId = mapModelToOperationId(model.id, "video");
    
    return {
      operationId,
      displayName: model.name,
      provider: getProviderFromModelId(model.id),
      model: model.name,
      category: "video",
      unitType: pricing.unitType || "job",
      baseCostUsd: pricing.baseCostUsd,
      defaultQuantity: pricing.defaultQuantity || 1,
      billingMode: pricing.billingMode,
      rates: pricing.rates,
      metadata: {
        maxDuration: model.maxDuration,
        supportedRatios: model.supportedRatios,
        supportedDurations: model.supportedDurations,
        supportedSizes: model.supportedSizes,
        falModel: model.falModel,
      },
      notes: pricing.notes || `Auto-synced from VIDEO_MODELS: ${model.description}`,
    };
  }

  async getExistingOperationIds(): Promise<Set<string>> {
    const existing = await db.select({ operationId: pricingOperations.operationId }).from(pricingOperations);
    return new Set(existing.map(op => op.operationId));
  }

  async findMissingOperations(): Promise<{ imageModels: ModelPricingMapping[]; videoModels: ModelPricingMapping[] }> {
    const existingIds = await this.getExistingOperationIds();
    
    const missingImageModels: ModelPricingMapping[] = [];
    const missingVideoModels: ModelPricingMapping[] = [];
    
    for (const model of AI_MODELS) {
      const mapping = this.buildImageModelMapping(model);
      if (!existingIds.has(mapping.operationId)) {
        missingImageModels.push(mapping);
      }
    }
    
    for (const model of VIDEO_MODELS) {
      const mapping = this.buildVideoModelMapping(model);
      if (!existingIds.has(mapping.operationId)) {
        missingVideoModels.push(mapping);
      }
    }
    
    return { imageModels: missingImageModels, videoModels: missingVideoModels };
  }

  async syncMissingOperations(): Promise<{ added: string[]; errors: string[] }> {
    const adminId = await this.ensureSystemUser();
    const { imageModels, videoModels } = await this.findMissingOperations();
    
    const added: string[] = [];
    const errors: string[] = [];
    
    const allMappings = [...imageModels, ...videoModels];
    
    for (const mapping of allMappings) {
      try {
        await db.insert(pricingOperations).values({
          operationId: mapping.operationId,
          displayName: mapping.displayName,
          provider: mapping.provider,
          model: mapping.model,
          category: mapping.category,
          unitType: mapping.unitType,
          baseCostUsd: mapping.baseCostUsd,
          defaultQuantity: mapping.defaultQuantity,
          perOperationMarginPercent: null,
          isActive: true,
          billingMode: mapping.billingMode || null,
          rates: mapping.rates || null,
          metadata: mapping.metadata || {},
          notes: mapping.notes,
          updatedBy: adminId,
        }).onConflictDoNothing();
        
        added.push(mapping.operationId);
        console.log(`[PricingSync] Added pricing operation: ${mapping.operationId}`);
      } catch (error) {
        const errorMsg = `Failed to add ${mapping.operationId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[PricingSync] ${errorMsg}`);
      }
    }
    
    return { added, errors };
  }

  async getSyncStatus(): Promise<{
    totalImageModels: number;
    totalVideoModels: number;
    missingImageModels: number;
    missingVideoModels: number;
    missingOperationIds: string[];
  }> {
    const { imageModels, videoModels } = await this.findMissingOperations();
    
    return {
      totalImageModels: AI_MODELS.length,
      totalVideoModels: VIDEO_MODELS.length,
      missingImageModels: imageModels.length,
      missingVideoModels: videoModels.length,
      missingOperationIds: [...imageModels.map(m => m.operationId), ...videoModels.map(m => m.operationId)],
    };
  }
}

export async function syncPricingOnStartup(): Promise<void> {
  try {
    console.log("[PricingSync] Checking for missing pricing operations...");
    
    const syncService = PricingSyncService.getInstance();
    const status = await syncService.getSyncStatus();
    
    if (status.missingImageModels === 0 && status.missingVideoModels === 0) {
      console.log(`[PricingSync] All ${status.totalImageModels} image models and ${status.totalVideoModels} video models have pricing entries.`);
      return;
    }
    
    console.log(`[PricingSync] Found ${status.missingImageModels} image models and ${status.missingVideoModels} video models without pricing entries.`);
    console.log(`[PricingSync] Missing operations: ${status.missingOperationIds.join(", ")}`);
    
    const result = await syncService.syncMissingOperations();
    
    if (result.added.length > 0) {
      console.log(`[PricingSync] Successfully added ${result.added.length} pricing operations.`);
    }
    
    if (result.errors.length > 0) {
      console.error(`[PricingSync] Encountered ${result.errors.length} errors during sync.`);
      result.errors.forEach(err => console.error(`[PricingSync] ${err}`));
    }
  } catch (error) {
    console.error("[PricingSync] Failed to sync pricing operations:", error instanceof Error ? error.message : 'Unknown error');
  }
}
