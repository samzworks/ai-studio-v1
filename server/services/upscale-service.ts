import { fal } from "@fal-ai/client";
import { storage } from "../storage";
import { createStorageService } from "../storageProvider";
import { pricingCalculator } from "./pricing-calculator";
import crypto from "crypto";
import type { UpscaleJob, UpscaleModel } from "@shared/schema";

export interface UpscaleModelConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  endpoint: string;
  costPerMegapixel: number;
  maxScaleFactor: number;
  supportedScaleFactors: number[];
}

const DEFAULT_UPSCALE_MODELS: UpscaleModelConfig[] = [
  {
    id: "seedvr-upscale",
    name: "SeedVR2 Upscale",
    description: "High-quality AI upscaling using SeedVR2 model",
    provider: "fal",
    endpoint: "fal-ai/seedvr/upscale/image",
    costPerMegapixel: 0.001,
    maxScaleFactor: 10,
    supportedScaleFactors: [2, 4, 8, 10],
  },
];

export class UpscaleService {
  private static instance: UpscaleService;

  private constructor() {}

  static getInstance(): UpscaleService {
    if (!UpscaleService.instance) {
      UpscaleService.instance = new UpscaleService();
    }
    return UpscaleService.instance;
  }

  async getAvailableModels(): Promise<UpscaleModelConfig[]> {
    try {
      const dbModels = await storage.getActiveUpscaleModels();
      if (dbModels.length > 0) {
        return dbModels.map(m => ({
          id: m.modelId,
          name: m.name,
          description: m.description || "",
          provider: m.provider,
          endpoint: m.endpoint,
          costPerMegapixel: m.costPerMegapixel,
          maxScaleFactor: m.maxScaleFactor,
          supportedScaleFactors: m.supportedScaleFactors?.map(s => parseInt(s)) || [2, 4, 8, 10],
        }));
      }
    } catch (error) {
      console.error("Error fetching upscale models from DB, using defaults:", error);
    }
    return DEFAULT_UPSCALE_MODELS;
  }

  async getModelConfig(modelId: string): Promise<UpscaleModelConfig | undefined> {
    const models = await this.getAvailableModels();
    return models.find(m => m.id === modelId);
  }

  calculateMegapixels(width: number, height: number): number {
    return (width * height) / 1_000_000;
  }

  /**
   * Calculate credit cost using admin settings:
   * - Get credit_usd_rate (default $0.01 per credit)
   * - Get general_margin_percent (default 35%)
   * - Formula: credits = ceil((outputMegapixels * costPerMegapixel) * (1 + margin/100) / creditUsdRate)
   */
  async calculateCreditCost(
    sourceWidth: number,
    sourceHeight: number,
    scaleFactor: number,
    costPerMegapixel: number
  ): Promise<number> {
    const outputWidth = sourceWidth * scaleFactor;
    const outputHeight = sourceHeight * scaleFactor;
    const outputMegapixels = this.calculateMegapixels(outputWidth, outputHeight);
    
    // Calculate base USD cost
    const baseCostUsd = outputMegapixels * costPerMegapixel;
    
    // Get admin settings
    const margin = await pricingCalculator.getGeneralMargin();
    const creditUsdRate = await pricingCalculator.getCreditUsdRate();
    
    // Apply margin
    const effectiveUsd = baseCostUsd * (1 + margin / 100);
    
    // Convert to credits (ceil to avoid under-charging)
    const credits = Math.ceil(effectiveUsd / creditUsdRate);
    
    console.log(`[Upscale Pricing] ${outputMegapixels.toFixed(2)}MP × $${costPerMegapixel}/MP = $${baseCostUsd.toFixed(4)} → +${margin}% margin = $${effectiveUsd.toFixed(4)} → ${credits} credits (at $${creditUsdRate}/credit)`);
    
    return Math.max(credits, 1);
  }

  async startUpscale(params: {
    userId: string;
    sourceImageId?: number;
    sourceImageUrl: string;
    sourceWidth: number;
    sourceHeight: number;
    scaleFactor: number;
    modelId?: string;
    outputFormat?: "png" | "jpg" | "webp";
    isPublic?: boolean;
  }): Promise<{ jobId: string; creditCost: number }> {
    const modelId = params.modelId || "seedvr-upscale";
    const modelConfig = await this.getModelConfig(modelId);
    
    if (!modelConfig) {
      throw new Error(`Unknown upscale model: ${modelId}`);
    }

    if (!modelConfig.supportedScaleFactors.includes(params.scaleFactor)) {
      throw new Error(`Scale factor ${params.scaleFactor}x not supported by ${modelConfig.name}`);
    }

    const creditCost = await this.calculateCreditCost(
      params.sourceWidth,
      params.sourceHeight,
      params.scaleFactor,
      modelConfig.costPerMegapixel
    );

    const jobId = crypto.randomUUID();

    const job = await storage.createUpscaleJob({
      id: jobId,
      ownerId: params.userId,
      sourceImageId: params.sourceImageId,
      sourceImageUrl: params.sourceImageUrl,
      sourceWidth: params.sourceWidth,
      sourceHeight: params.sourceHeight,
      scaleFactor: params.scaleFactor,
      model: modelId,
      provider: modelConfig.provider,
      outputFormat: params.outputFormat || "jpg",
      state: "queued",
      progress: 0,
      stage: "Queued",
      creditCost,
    });

    this.processUpscaleJob(jobId, modelConfig, params.sourceImageUrl, params.scaleFactor, params.userId, params.isPublic ?? false, params.outputFormat || "jpg");

    return { jobId, creditCost };
  }

  private async processUpscaleJob(
    jobId: string,
    modelConfig: UpscaleModelConfig,
    imageUrl: string,
    scaleFactor: number,
    userId: string,
    isPublic: boolean,
    outputFormat: "png" | "jpg" | "webp"
  ): Promise<void> {
    try {
      console.log(`[Upscale] Starting job ${jobId} with model ${modelConfig.id}`);
      
      await storage.updateUpscaleJobStatus(jobId, "starting", 5, "Starting upscale...");

      const input: any = {
        image_url: imageUrl,
        upscale_mode: "factor",
        upscale_factor: scaleFactor,
        output_format: outputFormat,
      };

      console.log(`[Upscale] Calling fal.ai endpoint ${modelConfig.endpoint} with input:`, input);

      await storage.updateUpscaleJobStatus(jobId, "processing", 20, "Processing image...");

      const result = await fal.subscribe(modelConfig.endpoint, {
        input,
        logs: true,
        onQueueUpdate: async (update) => {
          if (update.status === "IN_QUEUE") {
            await storage.updateUpscaleJobStatus(jobId, "processing", 30, "Queued for processing...");
          } else if (update.status === "IN_PROGRESS") {
            await storage.updateUpscaleJobStatus(jobId, "processing", 50, "Upscaling image...");
          }
        },
      });

      console.log(`[Upscale] fal.ai result for job ${jobId}:`, result);

      if (!result || !result.data?.image?.url) {
        throw new Error("No image returned from upscale API");
      }

      const upscaledImageUrl = result.data.image.url;
      const resultWidth = result.data.image.width;
      const resultHeight = result.data.image.height;

      await storage.updateUpscaleJobStatus(jobId, "processing", 80, "Storing result...");

      const job = await storage.getUpscaleJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      let storedUrl = upscaledImageUrl;
      try {
        const objectStorage = createStorageService();
        const tempImageId = Date.now();
        storedUrl = await objectStorage.uploadImageToStorage(upscaledImageUrl, tempImageId);
      } catch (storageError) {
        console.error(`[Upscale] Failed to store image, using original URL:`, storageError);
      }

      const upscaledImage = await storage.createImage({
        ownerId: userId,
        prompt: `Upscaled ${scaleFactor}x`,
        url: storedUrl,
        width: resultWidth || job.sourceWidth * scaleFactor,
        height: resultHeight || job.sourceHeight * scaleFactor,
        style: "upscaled",
        model: modelConfig.id,
        quality: "standard",
        isPublic,
        tags: ["upscaled", `${scaleFactor}x`],
        provider: modelConfig.provider,
      });

      await storage.completeUpscaleJob(
        jobId,
        storedUrl,
        resultWidth || job.sourceWidth * scaleFactor,
        resultHeight || job.sourceHeight * scaleFactor,
        upscaledImage.id
      );

      console.log(`[Upscale] Job ${jobId} completed successfully, created image ${upscaledImage.id}`);

    } catch (error) {
      console.error(`[Upscale] Job ${jobId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during upscaling";
      await storage.failUpscaleJob(jobId, errorMessage);
    }
  }

  async getJobStatus(jobId: string): Promise<UpscaleJob | undefined> {
    return await storage.getUpscaleJob(jobId);
  }

  async getUserJobs(userId: string): Promise<UpscaleJob[]> {
    return await storage.getUserUpscaleJobs(userId);
  }

  async getActiveJobs(userId: string): Promise<UpscaleJob[]> {
    return await storage.getActiveUpscaleJobs(userId);
  }
}

export const upscaleService = UpscaleService.getInstance();
