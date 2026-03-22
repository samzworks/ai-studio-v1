import { db } from "./db";
import { pricingSettings, pricingOperations, users } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed script for pricing system
 * 
 * Initializes:
 * 1. Global pricing settings (credit rate, general margin, etc.)
 * 2. Complete operations catalog with base costs from all providers
 */

// Get or create system user for seeding
async function getSystemUserId(): Promise<string> {
  const [systemUser] = await db.select().from(users).where(eq(users.id, "system")).limit(1);
  
  if (systemUser) {
    return systemUser.id;
  }
  
  // Create system user if it doesn't exist
  const [newSystemUser] = await db.insert(users).values({
    id: "system",
    email: "system@internal",
    firstName: "System",
    lastName: "Admin",
    role: "admin",
    isActive: true
  }).returning();
  
  return newSystemUser.id;
}

let ADMIN_ID = "system"; // Will be set dynamically

async function seedPricingSettings() {
  console.log("Seeding pricing settings...");
  
  const settings = [
    {
      key: "credit_usd_rate",
      value: 0.01, // 1 credit = $0.01 USD (LOCKED)
      description: "Fixed exchange rate: 1 credit = $0.01 USD (1,000 credits = $10)",
      isLocked: true,
      updatedBy: ADMIN_ID
    },
    {
      key: "general_margin_percent",
      value: 35, // 35% default margin
      description: "General Added Margin (%) - applies to all operations unless overridden",
      isLocked: false,
      updatedBy: ADMIN_ID
    },
    {
      key: "rounding_mode",
      value: "ceil", // Always round up
      description: "Rounding mode for credit calculation (ceil = round up to nearest credit)",
      isLocked: false,
      updatedBy: ADMIN_ID
    },
    {
      key: "min_charge_credits",
      value: 0, // No minimum by default
      description: "Minimum per-operation charge in credits (0 = no minimum)",
      isLocked: false,
      updatedBy: ADMIN_ID
    },
    {
      key: "max_charge_credits",
      value: 0, // No maximum by default
      description: "Maximum per-operation charge in credits (0 = no limit)",
      isLocked: false,
      updatedBy: ADMIN_ID
    }
  ];

  for (const setting of settings) {
    await db.insert(pricingSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: pricingSettings.key,
        set: { 
          value: setting.value,
          description: setting.description,
          updatedAt: new Date()
        }
      });
  }

  console.log(`✓ Seeded ${settings.length} pricing settings`);
}

async function seedPricingOperations() {
  console.log("Seeding pricing operations catalog...");
  
  const operations = [
    // ===== IMAGE GENERATION OPERATIONS =====
    
    // fal.ai Image Models
    {
      operationId: "image.z_image.turbo",
      displayName: "Z-Image Turbo",
      provider: "fal.ai",
      model: "Z-Image Turbo",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.0074,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1536x1536", speed: "ultra-fast" },
      notes: "Super fast 6B parameter text-to-image model by Tongyi-MAI - costs 1 credit ($0.0074 * 1.35 margin = $0.01 = 1 credit)",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.flux.schnell",
      displayName: "FLUX Schnell (Fast)",
      provider: "fal.ai",
      model: "FLUX Schnell",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.003,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1440x1440", speed: "ultra-fast" },
      notes: "Ultra-fast FLUX model optimized for speed",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.flux.dev",
      displayName: "FLUX Dev",
      provider: "fal.ai",
      model: "FLUX Dev",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.025,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1440x1440", quality: "high" },
      notes: "High-quality FLUX Dev model for detailed image generation",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.flux.pro",
      displayName: "FLUX Pro",
      provider: "fal.ai",
      model: "FLUX Pro",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.055,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1440x1440", quality: "premium" },
      notes: "Premium FLUX Pro model for professional-grade images",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.nano_banana.txt2img",
      displayName: "Nano Banana Text-to-Image",
      provider: "fal.ai",
      model: "Nano Banana",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.039,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1024x1024", supportsStyleUpload: true },
      notes: "Ultra-fast text-to-image with style upload support",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.nano_banana.edit",
      displayName: "Nano Banana Edit (Image-to-Image)",
      provider: "fal.ai",
      model: "Nano Banana Edit",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.039,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1024x1024", supportsStyleUpload: true },
      notes: "Used for image editing and Saudi Model operations",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.nano_banana_pro.txt2img",
      displayName: "Nano Banana Pro Text-to-Image",
      provider: "fal.ai",
      model: "Nano Banana Pro",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_resolution",
      rates: { "1K": 0.04, "2K": 0.08, "4K": 0.148 },
      metadata: { maxResolution: "4096x4096", supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], resolution: ["1K", "2K", "4K"] },
      notes: "Google's Nano Banana Pro (v2) text-to-image - 1K: 6 credits, 2K: 11 credits, 4K: 20 credits",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.nano_banana_pro.edit",
      displayName: "Nano Banana Pro Edit (Image-to-Image)",
      provider: "fal.ai",
      model: "Nano Banana Pro Edit",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_resolution",
      rates: { "1K": 0.04, "2K": 0.08, "4K": 0.148 },
      metadata: { maxResolution: "4096x4096", supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], resolution: ["1K", "2K", "4K"] },
      notes: "Google's Nano Banana Pro (v2) image editing - 1K: 6 credits, 2K: 11 credits, 4K: 20 credits",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.saudi_model_pro",
      displayName: "Saudi Model Pro",
      provider: "fal.ai",
      model: "Saudi Model Pro",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_resolution",
      rates: { "1K": 0.04, "2K": 0.08, "4K": 0.148 },
      metadata: { maxResolution: "4096x4096", supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], resolution: ["1K", "2K", "4K"], culturalContext: "saudi" },
      notes: "Premium Saudi-localized image generation via Nano Banana Pro - 1K: 6 credits, 2K: 11 credits, 4K: 20 credits",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.imagen4.fast",
      displayName: "Imagen 4 Fast",
      provider: "fal.ai",
      model: "Imagen 4 Fast",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1536x1536", speed: "fast" },
      notes: "Google's Imagen 4 Fast model for quick, high-quality generation",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.imagen4.standard",
      displayName: "Imagen 4",
      provider: "fal.ai",
      model: "Imagen 4",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.05,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1536x1536", quality: "balanced" },
      notes: "Google's Imagen 4 standard model for premium image generation",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.seedream45.txt2img",
      displayName: "SeeDream 4.5 Text-to-Image",
      provider: "fal.ai",
      model: "SeeDream 4.5",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "4096x4096" },
      notes: "ByteDance SeeDream 4.5 text-to-image model with enhanced quality and text rendering",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.seedream45.edit",
      displayName: "SeeDream 4.5 Edit (Image-to-Image)",
      provider: "fal.ai",
      model: "SeeDream 4.5 Edit",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "4096x4096", supportsMultipleImages: true },
      notes: "ByteDance SeeDream 4.5 editing model with enhanced precision",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.sdxl.fast",
      displayName: "Stable Diffusion XL",
      provider: "fal.ai",
      model: "SDXL",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.035,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { maxResolution: "1024x1024" },
      notes: "Stable Diffusion XL for versatile image generation",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.gpt_image_1_5.txt2img_low",
      displayName: "GPT Image 1.5 Text-to-Image (Low)",
      provider: "fal.ai",
      model: "GPT Image 1.5",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.009,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_size",
      rates: { "1024x1024": 0.009, "1536x1024": 0.013, "1024x1536": 0.013 },
      metadata: { maxResolution: "1536x1536", quality: "low", supportedSizes: ["1024x1024", "1536x1024", "1024x1536"] },
      notes: "OpenAI GPT Image 1.5 text-to-image with low quality for fast generation",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.gpt_image_1_5.txt2img_high",
      displayName: "GPT Image 1.5 Text-to-Image (High)",
      provider: "fal.ai",
      model: "GPT Image 1.5",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.133,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_size",
      rates: { "1024x1024": 0.133, "1536x1024": 0.199, "1024x1536": 0.200 },
      metadata: { maxResolution: "1536x1536", quality: "high", supportedSizes: ["1024x1024", "1536x1024", "1024x1536"] },
      notes: "OpenAI GPT Image 1.5 text-to-image with high quality for detailed images",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.gpt_image_1_5.edit_low",
      displayName: "GPT Image 1.5 Edit (Low)",
      provider: "fal.ai",
      model: "GPT Image 1.5 Edit",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.009,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_size",
      rates: { "1024x1024": 0.009, "1536x1024": 0.013, "1024x1536": 0.013 },
      metadata: { maxResolution: "1536x1536", quality: "low", supportedSizes: ["auto", "1024x1024", "1536x1024", "1024x1536"] },
      notes: "OpenAI GPT Image 1.5 image editing with low quality for fast edits",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.gpt_image_1_5.edit_high",
      displayName: "GPT Image 1.5 Edit (High)",
      provider: "fal.ai",
      model: "GPT Image 1.5 Edit",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.133,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_image_by_size",
      rates: { "1024x1024": 0.133, "1536x1024": 0.199, "1024x1536": 0.200 },
      metadata: { maxResolution: "1536x1536", quality: "high", supportedSizes: ["auto", "1024x1024", "1536x1024", "1024x1536"] },
      notes: "OpenAI GPT Image 1.5 image editing with high quality for detailed edits",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.wan25.txt2img",
      displayName: "WAN 2.5 Text-to-Image",
      provider: "fal.ai",
      model: "WAN 2.5",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.05,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: {},
      notes: "WAN 2.5 text-to-image model",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.wan25.img2img",
      displayName: "WAN 2.5 Image-to-Image",
      provider: "fal.ai",
      model: "WAN 2.5",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.05,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: {},
      notes: "WAN 2.5 image-to-image transformation",
      updatedBy: ADMIN_ID
    },

    // OpenAI Image Models
    {
      operationId: "image.dalle3.standard",
      displayName: "DALL-E 3 (Standard 1024x1024)",
      provider: "openai",
      model: "DALL-E 3",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.04,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { resolution: "1024x1024", quality: "standard" },
      notes: "OpenAI DALL-E 3 standard quality",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.dalle3.hd",
      displayName: "DALL-E 3 (HD 1024x1024)",
      provider: "openai",
      model: "DALL-E 3",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.08,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { resolution: "1024x1024", quality: "hd" },
      notes: "OpenAI DALL-E 3 HD quality",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "image.dalle3.hd_1792",
      displayName: "DALL-E 3 (HD 1792x1024)",
      provider: "openai",
      model: "DALL-E 3",
      category: "image",
      unitType: "image",
      baseCostUsd: 0.12,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { resolution: "1792x1024", quality: "hd" },
      notes: "OpenAI DALL-E 3 HD quality (wide format)",
      updatedBy: ADMIN_ID
    },

    // ===== VIDEO GENERATION OPERATIONS =====
    // Using new billing modes: per_second, per_second_with_resolution, per_job_flat_by_resolution
    
    // VEO 3.1 (normal quality) - per_second with audio tiers
    {
      operationId: "video.fal.veo3_1",
      displayName: "Veo 3.1 Video Generation",
      provider: "fal.ai",
      model: "Veo 3.1",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.20, // Fallback for audio_off
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "audio_on": 0.40, "audio_off": 0.20 },
      metadata: { supportsAudio: true, maxDuration: 10 },
      notes: "Veo 3.1: $0.20/sec (audio off), $0.40/sec (audio on). Example: 5s with audio on = $2.00",
      updatedBy: ADMIN_ID
    },
    
    // VEO 3.1 Fast - per_second with audio tiers
    {
      operationId: "video.fal.veo3_1_fast",
      displayName: "Veo 3.1 Fast Video Generation",
      provider: "fal.ai",
      model: "Veo 3.1 Fast",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.10, // Fallback for audio_off
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "audio_on": 0.15, "audio_off": 0.10 },
      metadata: { supportsAudio: true, maxDuration: 10 },
      notes: "Veo 3.1 Fast: $0.10/sec (audio off), $0.15/sec (audio on). Example: 5s with audio on = $0.75",
      updatedBy: ADMIN_ID
    },
    
    // Sora 2 (standard) - per_second with auto resolution
    {
      operationId: "video.fal.sora2_standard",
      displayName: "Sora 2 Standard",
      provider: "fal.ai",
      model: "Sora 2",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.10, // $0.10 per second
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "default": 0.10 },
      metadata: { resolution: "auto", maxDuration: 12 },
      notes: "Sora 2 Standard: $0.10/sec (auto resolution)",
      updatedBy: ADMIN_ID
    },
    
    // Sora 2 Pro - per_second_with_resolution
    {
      operationId: "video.fal.sora2_pro",
      displayName: "Sora 2 Pro",
      provider: "fal.ai",
      model: "Sora 2 Pro",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.30, // Fallback for 720p
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second_with_resolution",
      rates: { "720p": 0.30, "1080p": 0.50 },
      metadata: { resolutions: ["720p", "1080p"], maxDuration: 12 },
      notes: "Sora 2 Pro: $0.30/sec (720p), $0.50/sec (1080p)",
      updatedBy: ADMIN_ID
    },
    
    // WAN 2.6 - per_second_with_resolution (multi-shot with audio file support)
    {
      operationId: "video.fal.wan2_6",
      displayName: "WAN 2.6",
      provider: "fal.ai",
      model: "WAN 2.6",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.10, // Fallback for 720p
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second_with_resolution",
      rates: { "720p": 0.10, "1080p": 0.15 },
      metadata: { resolutions: ["720p", "1080p"], maxDuration: 15, supportsAudioFile: true, supportsPromptExpansion: true, supportsMultiShot: true },
      notes: "WAN 2.6: $0.10/sec (720p), $0.15/sec (1080p). Multi-shot with audio file support and prompt expansion.",
      updatedBy: ADMIN_ID
    },
    
    // WAN 2.5 Preview - per_second_with_resolution
    {
      operationId: "video.fal.wan2_5_preview",
      displayName: "WAN 2.5 Preview",
      provider: "fal.ai",
      model: "WAN 2.5 Preview",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.05, // Fallback for 480p
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second_with_resolution",
      rates: { "480p": 0.05, "720p": 0.10, "1080p": 0.15 },
      metadata: { resolutions: ["480p", "720p", "1080p"], maxDuration: 10 },
      notes: "WAN 2.5 Preview: $0.05/sec (480p), $0.10/sec (720p), $0.15/sec (1080p)",
      updatedBy: ADMIN_ID
    },
    
    // WAN 2.2 Turbo - per_job_flat_by_resolution (fixed 5s clips)
    {
      operationId: "video.fal.wan2_2_turbo",
      displayName: "WAN 2.2 Turbo",
      provider: "fal.ai",
      model: "WAN 2.2 Turbo",
      category: "video",
      unitType: "job",
      baseCostUsd: 0.05, // Fallback for 480p
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_job_flat_by_resolution",
      rates: { "480p": 0.05, "580p": 0.075, "720p": 0.10 },
      metadata: { resolutions: ["480p", "580p", "720p"], fixedDuration: 5 },
      notes: "WAN 2.2 Turbo (fixed 5s clips): $0.05 (480p), $0.075 (580p), $0.10 (720p) per video",
      updatedBy: ADMIN_ID
    },

    // fal.ai Luma Video Models
    {
      operationId: "video.luma.flash2",
      displayName: "Luma Ray Flash 2",
      provider: "fal.ai",
      model: "Luma Ray Flash 2",
      category: "video",
      unitType: "job",
      baseCostUsd: 0.03,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { resolutions: ["540p"], maxDuration: 5 },
      notes: "Luma Ray Flash 2 (fast, 540p, up to 5s)",
      updatedBy: ADMIN_ID
    },

    // Kling 2.6 Pro (text-to-video and image-to-video) - per_second with audio tiers
    {
      operationId: "video.fal.kling2_6_pro",
      displayName: "Kling 2.6 Pro",
      provider: "fal.ai",
      model: "Kling 2.6 Pro",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.07, // Fallback for audio_off
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "audio_on": 0.14, "audio_off": 0.07 },
      metadata: { supportsAudio: true, maxDuration: 10, variants: ["text-to-video", "image-to-video"] },
      notes: "Kling 2.6 Pro: $0.07/sec (audio off), $0.14/sec (audio on). Example: 5s with audio on = $0.70",
      updatedBy: ADMIN_ID
    },

    // Kling 2.6 Pro Motion Control - per_second (no audio tiers)
    {
      operationId: "video.fal.kling2_6_pro_motion",
      displayName: "Kling 2.6 Pro Motion Control",
      provider: "fal.ai",
      model: "Kling 2.6 Pro Motion Control",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.112,
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "default": 0.112 },
      metadata: { supportsVideoReference: true, maxDuration: 10 },
      notes: "Kling 2.6 Pro Motion Control: $0.112/sec. Transfers movements from reference video to character image.",
      updatedBy: ADMIN_ID
    },

    // Kling 2.6 Standard Motion Control - per_second (no audio tiers)
    {
      operationId: "video.fal.kling2_6_standard_motion",
      displayName: "Kling 2.6 Standard Motion Control",
      provider: "fal.ai",
      model: "Kling 2.6 Standard Motion Control",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.07,
      defaultQuantity: 5,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "default": 0.07 },
      metadata: { supportsVideoReference: true, maxDuration: 10 },
      notes: "Kling 2.6 Standard Motion Control: $0.07/sec. Cost-effective motion transfer for portraits.",
      updatedBy: ADMIN_ID
    },

    // Grok Imagine Video Text-to-Video - per_second
    // Rate: $0.049/sec produces exactly 40 credits for 6s with 35% margin
    {
      operationId: "video.fal.grok_imagine_t2v",
      displayName: "Grok Imagine Video (Text)",
      provider: "fal.ai",
      model: "Grok Imagine Video",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.049,
      defaultQuantity: 6,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second",
      rates: { "default": 0.049 },
      metadata: { supportsAudio: true, maxDuration: 15, defaultDuration: 6 },
      notes: "Grok Imagine Video Text-to-Video: $0.049/sec. Example: 6s = 40 credits",
      updatedBy: ADMIN_ID
    },

    // Grok Imagine Video Image-to-Video - per_second + image input fee
    {
      operationId: "video.fal.grok_imagine_i2v",
      displayName: "Grok Imagine Video (Image)",
      provider: "fal.ai",
      model: "Grok Imagine Video",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.049,
      defaultQuantity: 6,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second_with_image_input",
      rates: { "default": 0.049, "image_input_fee": 0.002 },
      metadata: { supportsAudio: true, maxDuration: 15, defaultDuration: 6, requiresImage: true },
      notes: "Grok Imagine Video Image-to-Video: $0.049/sec + $0.002 image input. Example: 6s = 40 credits",
      updatedBy: ADMIN_ID
    },

    // Grok Imagine Video Edit (Video-to-Video) - per_second + video input fee
    {
      operationId: "video.fal.grok_imagine_edit",
      displayName: "Grok Imagine Video (Edit)",
      provider: "fal.ai",
      model: "Grok Imagine Video",
      category: "video",
      unitType: "seconds",
      baseCostUsd: 0.049,
      defaultQuantity: 6,
      perOperationMarginPercent: null,
      isActive: true,
      billingMode: "per_second_with_image_input",
      rates: { "default": 0.049, "image_input_fee": 0.002 },
      metadata: { supportsAudio: true, maxDuration: 15, defaultDuration: 6, requiresVideo: true },
      notes: "Grok Imagine Video Edit: $0.049/sec + $0.002 video input. For video-to-video generation.",
      updatedBy: ADMIN_ID
    },

    // ===== TEXT/AUDIO OPERATIONS =====
    
    // OpenAI Text Models
    {
      operationId: "text.gpt5nano.prompt_enhancement",
      displayName: "GPT-5-nano Prompt Enhancement",
      provider: "openai",
      model: "GPT-5-nano",
      category: "text",
      unitType: "job",
      baseCostUsd: 0.002, // Estimate for small text operations
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { operation: "prompt_enhancement" },
      notes: "Used for prompt enhancement with style integration",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "text.gpt5nano.storyboard",
      displayName: "GPT-5-nano Storyboard Generation",
      provider: "openai",
      model: "GPT-5-nano",
      category: "text",
      unitType: "job",
      baseCostUsd: 0.005,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { operation: "storyboard_generation" },
      notes: "Fast storyboard generation using GPT-5-nano",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "text.gpt5.storyboard",
      displayName: "GPT-5 Storyboard Generation (Pro)",
      provider: "openai",
      model: "GPT-5",
      category: "text",
      unitType: "job",
      baseCostUsd: 0.015,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { operation: "storyboard_generation", tier: "pro" },
      notes: "Premium storyboard generation using GPT-5",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "text.gpt5nano.translation",
      displayName: "GPT-5-nano Translation",
      provider: "openai",
      model: "GPT-5-nano",
      category: "text",
      unitType: "job",
      baseCostUsd: 0.001,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { operation: "translation" },
      notes: "Translation operations using GPT-5-nano",
      updatedBy: ADMIN_ID
    },
    {
      operationId: "text.gpt5nano.saudi_classification",
      displayName: "GPT-5-nano Saudi Cultural Classification",
      provider: "openai",
      model: "GPT-5-nano",
      category: "text",
      unitType: "job",
      baseCostUsd: 0.001,
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { operation: "classification" },
      notes: "Saudi cultural prompt classification",
      updatedBy: ADMIN_ID
    },

    // fal.ai Audio/STT Model
    {
      operationId: "audio.whisper.transcribe",
      displayName: "Whisper Speech-to-Text",
      provider: "fal.ai",
      model: "Whisper",
      category: "audio",
      unitType: "job",
      baseCostUsd: 0.006, // $0.006 per minute (OpenAI Whisper pricing)
      defaultQuantity: 1,
      perOperationMarginPercent: null,
      isActive: true,
      metadata: { unit: "per_minute", supportsAutoDetection: true },
      notes: "Whisper STT with auto language detection ($0.006/minute)",
      updatedBy: ADMIN_ID
    }
  ];

  let insertCount = 0;
  for (const operation of operations) {
    try {
      await db.insert(pricingOperations)
        .values(operation)
        .onConflictDoUpdate({
          target: pricingOperations.operationId,
          set: {
            displayName: operation.displayName,
            baseCostUsd: operation.baseCostUsd,
            defaultQuantity: operation.defaultQuantity,
            billingMode: operation.billingMode || null,
            rates: operation.rates || null,
            metadata: operation.metadata,
            notes: operation.notes,
            updatedAt: new Date()
          }
        });
      insertCount++;
    } catch (error) {
      console.error(`Error inserting operation ${operation.operationId}:`, error);
    }
  }

  console.log(`✓ Seeded ${insertCount} pricing operations`);
}

async function main() {
  console.log("Starting pricing system seed...\n");
  
  try {
    // Ensure system user exists
    ADMIN_ID = await getSystemUserId();
    console.log(`Using admin ID: ${ADMIN_ID}\n`);
    
    await seedPricingSettings();
    await seedPricingOperations();
    
    console.log("\n✅ Pricing system seed completed successfully!");
  } catch (error) {
    console.error("\n❌ Pricing seed failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
main().then(() => process.exit(0)).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { seedPricingSettings, seedPricingOperations };
