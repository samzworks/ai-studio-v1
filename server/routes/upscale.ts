import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { upscaleService } from "../services/upscale-service";
import { creditService } from "../services/credit-service";
import { storage } from "../storage";

const router = Router();

const startUpscaleSchema = z.object({
  sourceImageId: z.number().optional(),
  sourceImageUrl: z.string().url(),
  sourceWidth: z.number().positive(),
  sourceHeight: z.number().positive(),
  scaleFactor: z.number().refine(val => [2, 4, 8, 10].includes(val), {
    message: "Scale factor must be 2, 4, 8, or 10",
  }),
  modelId: z.string().optional(),
  outputFormat: z.enum(["png", "jpg", "webp"]).optional(),
  isPublic: z.boolean().optional(),
});

router.get("/models", async (req, res) => {
  try {
    const models = await upscaleService.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error("Error fetching upscale models:", error);
    res.status(500).json({ error: "Failed to fetch upscale models" });
  }
});

router.post("/calculate-cost", isAuthenticated, async (req, res) => {
  try {
    const { sourceWidth, sourceHeight, scaleFactor, modelId } = req.body;
    
    if (!sourceWidth || !sourceHeight || !scaleFactor) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const model = await upscaleService.getModelConfig(modelId || "seedvr-upscale");
    if (!model) {
      return res.status(400).json({ error: "Invalid model" });
    }

    const outputWidth = sourceWidth * scaleFactor;
    const outputHeight = sourceHeight * scaleFactor;
    const outputMegapixels = upscaleService.calculateMegapixels(outputWidth, outputHeight);
    const creditCost = await upscaleService.calculateCreditCost(
      sourceWidth,
      sourceHeight,
      scaleFactor,
      model.costPerMegapixel
    );

    res.json({
      sourceWidth,
      sourceHeight,
      outputWidth,
      outputHeight,
      outputMegapixels: outputMegapixels.toFixed(2),
      creditCost,
      model: model.name,
    });
  } catch (error) {
    console.error("Error calculating upscale cost:", error);
    res.status(500).json({ error: "Failed to calculate cost" });
  }
});

router.post("/start", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const validatedData = startUpscaleSchema.parse(req.body);

    const model = await upscaleService.getModelConfig(validatedData.modelId || "seedvr-upscale");
    if (!model) {
      return res.status(400).json({ error: "Invalid upscale model" });
    }

    const creditCost = await upscaleService.calculateCreditCost(
      validatedData.sourceWidth,
      validatedData.sourceHeight,
      validatedData.scaleFactor,
      model.costPerMegapixel
    );

    const balance = await creditService.getUserBalance(userId);
    if (balance < creditCost) {
      return res.status(402).json({ 
        error: "Insufficient credits", 
        required: creditCost,
        available: balance,
        message: `You need ${creditCost} credits to upscale this image`
      });
    }

    await creditService.deductCredits(userId, creditCost, `Upscale ${validatedData.scaleFactor}x`);

    const { jobId } = await upscaleService.startUpscale({
      userId,
      sourceImageId: validatedData.sourceImageId,
      sourceImageUrl: validatedData.sourceImageUrl,
      sourceWidth: validatedData.sourceWidth,
      sourceHeight: validatedData.sourceHeight,
      scaleFactor: validatedData.scaleFactor,
      modelId: validatedData.modelId,
      outputFormat: validatedData.outputFormat,
      isPublic: validatedData.isPublic,
    });

    res.json({ 
      success: true, 
      jobId, 
      creditCost,
      message: `Upscale job started successfully` 
    });
  } catch (error) {
    console.error("Error starting upscale:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "Failed to start upscale" });
  }
});

router.get("/job/:jobId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { jobId } = req.params;

    const job = await upscaleService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json({ job });
  } catch (error) {
    console.error("Error fetching upscale job:", error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

router.get("/jobs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const jobs = await upscaleService.getUserJobs(userId);
    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching user upscale jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/active-jobs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const jobs = await upscaleService.getActiveJobs(userId);
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching active upscale jobs:", error);
    res.status(500).json({ error: "Failed to fetch active jobs" });
  }
});

router.post("/:jobId/dismiss", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { jobId } = req.params;

    const job = await upscaleService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.ownerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await storage.dismissUpscaleJob(jobId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error dismissing upscale job:", error);
    res.status(500).json({ error: "Failed to dismiss job" });
  }
});

export default router;
