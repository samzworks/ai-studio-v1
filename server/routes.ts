import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage as dbStorage } from "./storage";
import { insertImageSchema, insertVideoSchema, insertVideoJobSchema, insertImageReportSchema, insertAiStyleSchema, insertVideoStyleSchema, insertVideoModelConfigSchema, insertHeroSlideSchema, insertCreditRequestSchema, updateCreditRequestSchema, insertContactSubmissionSchema, insertTeaserGalleryItemSchema } from "@shared/schema";
import { generateImage, generateImageWithProvider, AI_MODELS, getModelsByCategory, getModelById, VIDEO_MODELS, getVideoModelsByCategory, getVideoModelById, generateVideo, generateVideoWithProvider, getVideoPredictionStatus, hasRequiredApiKeys, getProviderHealthStatus, testProviderConnection } from "./ai-models";
import { downloadAndStoreImage, deleteStoredImage } from "./image-storage";
import { downloadAndStoreVideo, deleteVideo } from "./video-storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { createStorageService, isOnReplit } from "./storageProvider";
import { ObjectNotFoundError } from "./objectStorage";
import { getConfig, updateConfigCache, getAllConfig, ensureDefaultSettings, generateThemeCSS, DEFAULT_CONFIG } from "./site-config";
import { pricingService } from "./services/pricing-service";
import { creditService } from "./services/credit-service";
import { emailService } from "./services/email-service";
import { registerPerformanceRoutes } from "./routes-performance";
import promptTemplatesRoutes from "./routes/prompt-templates";
import imageReferencesRoutes from "./routes/image-references";
import filmStudioRoutes from "./routes/film-studio";
import pricingPageRoutes from "./routes/pricing-page";
import upscaleRoutes from "./routes/upscale";
import { substituteVariables } from "./prompt-utils";
import { preprocessSaudiModelPrompt, autoEnhanceSaudiPrompt } from "./saudi-model-processor";
import { moderatePrompt, buildModerationErrorResponse, addModerationMetadata, isModerationEnabled, type ModerationResponse } from "./prompt-moderation";
import fetch from "node-fetch";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { styleImageUpload, getStyleImageUrl } from "./upload-handler";
import { audioUpload } from "./audio-upload-handler";
import { fal } from "@fal-ai/client";
import crypto from "crypto";
import { 
  imageGenerationRateLimit, 
  videoGenerationRateLimit, 
  promptEnhanceRateLimit,
  uploadRateLimit,
  validatePromptInput,
  sanitizeConfig,
  logSuspiciousActivity,
  globalLoadGuard,
  requireImageGeneration,
  requireVideoGeneration,
  requirePrivateContent
} from "./security-middleware";
import { generationQueue } from "./services/generation-queue";
import { z } from "zod";

const enqueueJobSchema = z.object({
  prompt: z.string().min(1).max(10000),
  width: z.number().optional(),
  height: z.number().optional(),
  aspectRatio: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  style: z.string().optional(),
  quality: z.string().optional(),
  negativePrompt: z.string().optional(),
  seed: z.number().optional(),
  steps: z.number().optional(),
  cfgScale: z.number().optional(),
  styleImageUrl: z.string().optional(),
  styleImageUrls: z.array(z.string()).optional(),
  imageStrength: z.number().min(0).max(1).optional(),
  enhancePrompt: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  jobId: z.string().optional(), // Client-side job ID for progress tracking
  imageSize: z.string().optional(), // GPT Image 1.5 specific size (1024x1024, 1536x1024, 1024x1536)
});

// Import mapping from shared module to avoid circular dependencies
import { mapModelToOperationId, MODEL_TO_OPERATION_MAP } from './model-operation-mapping';
export { mapModelToOperationId } from './model-operation-mapping';

// Background video job processing function
export async function processVideoJob(
  jobId: string,
  model: string,
  params: {
    prompt: string;
    aspectRatio: string;
    duration: number;
    startFrame?: string;
    endFrame?: string;
    videoReference?: string;
    characterOrientation?: "video" | "image";
    resolution?: "480p" | "720p" | "1080p";
    audioEnabled?: boolean;
    // WAN 2.6 specific parameters
    audioFileUrl?: string;
    promptExpansion?: boolean;
    multiShot?: boolean;
    negativePrompt?: string;
  },
  userId: string,
  creditCost: number
) {
  try {
    console.log(`Starting background processing for job ${jobId}`);
    
    // Update job state to 'starting'
    await dbStorage.updateVideoJobStatus(jobId, 'starting', 0, 'Starting...');
    
    // Apply prompt template system for video generation
    let enhancedPrompt = params.prompt;
    try {
      // Get the best prompt template for video generation and this model
      const template = await dbStorage.getBestPromptTemplate('video_generation', model);
      
      if (template && template.promptText) {
        console.log(`Using video prompt template: ${template.name} for job ${jobId}`);
        
        // Get style text if available
        let styleText = '';
        const videoJob = await dbStorage.getVideoJob(jobId);
        if (videoJob && videoJob.style) {
          const videoStyles = await dbStorage.getVideoStyles();
          const selectedStyle = videoStyles.find(s => s.name.toLowerCase() === videoJob.style!.toLowerCase());
          if (selectedStyle && selectedStyle.promptText) {
            styleText = selectedStyle.promptText;
          }
        }
        
        // Prepare variables for substitution
        const variables = {
          user_prompt: params.prompt,
          style: styleText || videoJob?.style || 'cinematic'
        };
        
        // Apply the template with variable substitution
        enhancedPrompt = substituteVariables(template.promptText, variables);
        console.log(`Enhanced prompt for job ${jobId}: ${enhancedPrompt}`);
      }
    } catch (error) {
      console.error(`Error applying video prompt template for job ${jobId}:`, error);
      // Continue with original prompt if template fails
    }

    // Update job state to 'processing'
    await dbStorage.updateVideoJobStatus(jobId, 'processing', 10, 'Processing...');

    // Start video generation with provider
    let result;
    try {
      result = await generateVideoWithProvider(model, {
        prompt: enhancedPrompt,
        aspectRatio: params.aspectRatio,
        duration: params.duration,
        startFrame: params.startFrame,
        endFrame: params.endFrame,
        videoReference: params.videoReference,
        characterOrientation: params.characterOrientation,
        resolution: params.resolution,
        audioEnabled: params.audioEnabled,
        // WAN 2.6 specific parameters
        audioFileUrl: params.audioFileUrl,
        promptExpansion: params.promptExpansion,
        multiShot: params.multiShot,
        negativePrompt: params.negativePrompt
      });
      
      console.log(`Generated video prediction ${result.predictionId} for job ${jobId}`);
    } catch (generationError) {
      console.error(`Failed to start video generation for job ${jobId}:`, generationError);
      const errorMessage = generationError instanceof Error ? generationError.message : 'Failed to start video generation';
      await dbStorage.failVideoJob(jobId, errorMessage);
      return; // Exit early on generation failure
    }
    
    // Store provider prediction ID
    await dbStorage.updateVideoJobProvider(jobId, result.predictionId);
    
    // Check if this is a fal.ai direct result that's already complete
    if (result.predictionId.startsWith('fal-direct-')) {
      console.log(`fal.ai returned direct result for job ${jobId}, checking for immediate completion`);
      
      // Give fal.ai a moment to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if the video is already complete
      try {
        const statusData = await getVideoPredictionStatus(result.predictionId);
        if (statusData.status === 'succeeded' && statusData.output) {
          console.log(`fal.ai video already complete for job ${jobId}: ${statusData.output}`);
          
          // ✅ GUARD: Check if video already exists for this job to prevent duplicates
          const existingVideos = await dbStorage.getVideosByJobId(jobId);
          if (existingVideos && existingVideos.length > 0) {
            console.log(`Video already exists for job ${jobId} (video ID: ${existingVideos[0].id}), skipping duplicate creation`);
            await dbStorage.completeVideoJob(jobId, statusData.output);
            const settled = await creditService.settleHold(jobId, params.duration, { model: model, operationType: 'Video Generation' });
            if (!settled) {
              console.warn(`[Video Gen] Failed to settle hold for job ${jobId} - hold may have already been settled`);
            }
            return; // Exit - video already exists
          }
          
          // Create the video record first (with external URL temporarily)
          const videoJob = await dbStorage.getVideoJob(jobId);
          if (videoJob) {
            const user = await dbStorage.getUser(userId);
            const entitlements = await creditService.getUserEntitlements(userId);
            // Set visibility based on plan type: Free=public, Paid=private by default
            const canMakePrivate = entitlements.featureFlags.can_make_private;
            const isPaidUser = canMakePrivate;
            const videoIsPublic = isPaidUser ? (user?.publicByDefault || false) : true;
            
            const video = await dbStorage.createVideo({
              ownerId: userId,
              prompt: enhancedPrompt,
              url: statusData.output, // Temporarily use the external URL
              width: videoJob.width,
              height: videoJob.height,
              duration: videoJob.duration,
              aspectRatio: videoJob.aspectRatio,
              model: videoJob.model,
              provider: videoJob.provider,
              isPublic: videoIsPublic,
              tags: videoJob.tags || [],
              startFrameUrl: videoJob.startFrameUrl,
              endFrameUrl: videoJob.endFrameUrl,
              frameRate: videoJob.frameRate,
              loop: videoJob.loop,
              replicateId: result.predictionId,
              jobId: jobId // ✅ FIX: Store jobId so progress cards can be matched
            });
            
            console.log(`Created video record ${video.id} for fal.ai direct job ${jobId}, downloading...`);
            
            // Download and store the video locally
            try {
              const { videoUrl: localVideoUrl, thumbnailUrl, width, height } = await downloadAndStoreVideo(statusData.output, video.id);
              
              // Update the video with local URL and mark as completed
              const updateData: any = {
                url: localVideoUrl,
                status: "completed",
                thumbnailUrl: thumbnailUrl
              };
              
              if (width && height) {
                updateData.width = width;
                updateData.height = height;
              }
              
              // Set frame rate for WAN models
              if (videoJob.model && videoJob.model.startsWith('wan-2.2')) {
                updateData.frameRate = 16;
              }
              
              await dbStorage.updateVideoByReplicateId(result.predictionId, updateData);
              console.log(`Successfully downloaded and stored video ${video.id} locally at ${localVideoUrl}`);
              
            } catch (downloadError) {
              console.error(`Failed to download video ${video.id} for job ${jobId}:`, downloadError);
              // Mark video as failed if download fails
              await dbStorage.updateVideoByReplicateId(result.predictionId, { status: "failed" });
            }
            
            // Complete the job after video is created and downloaded
            await dbStorage.completeVideoJob(jobId, statusData.output);
          }
          
          // Settle the credit hold after successful generation
          const settled = await creditService.settleHold(jobId, params.duration, { model: model, operationType: 'Video Generation' });
          if (!settled) {
            console.warn(`[Video Gen] Failed to settle hold for job ${jobId} - hold may have already been settled`);
          } else {
            console.log(`[Video Gen] Successfully settled ${creditCost} credits for job ${jobId}`);
          }
          
          return; // Exit early - job is already complete
        }
      } catch (statusError) {
        console.log(`Could not check immediate status for fal.ai direct result:`, statusError);
        // Continue with normal polling if status check fails
      }
    }
    
    // Poll for completion with progress updates
    let maxPollingAttempts = 200; // 10 minutes max (200 * 3s intervals)
    let pollingAttempts = 0;
    
    while (pollingAttempts < maxPollingAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      pollingAttempts++;
      
      try {
        const statusData = await getVideoPredictionStatus(result.predictionId);
        
        // Progress is already in 0-100 range from getVideoPredictionStatus
        const normalizedProgress = Math.round(statusData.progress || 0);
        
        // Update job with current progress
        await dbStorage.updateVideoJobStatus(
          jobId, 
          'processing', 
          Math.max(10, normalizedProgress), // Ensure progress is at least 10%
          statusData.stage || 'Processing...'
        );
        
        if (statusData.status === 'succeeded' && statusData.output) {
          console.log(`Video generation succeeded for job ${jobId}: ${statusData.output}`);
          
          // ✅ GUARD: Check if video already exists for this job to prevent duplicates
          const existingVideos = await dbStorage.getVideosByJobId(jobId);
          if (existingVideos && existingVideos.length > 0) {
            console.log(`Video already exists for job ${jobId} (video ID: ${existingVideos[0].id}), skipping duplicate creation`);
            // Just complete the job and exit
            await dbStorage.completeVideoJob(jobId, statusData.output);
            const settled = await creditService.settleHold(jobId, params.duration, { model: model, operationType: 'Video Generation' });
            if (!settled) {
              console.warn(`[Video Gen] Failed to settle hold for job ${jobId} - hold may have already been settled`);
            }
            return; // Exit polling - video already exists
          }
          
          // Create the final video record in the videos table  
          const videoJob = await dbStorage.getVideoJob(jobId);
          if (videoJob) {
            const user = await dbStorage.getUser(userId);
            const entitlements = await creditService.getUserEntitlements(userId);
            // Set visibility based on plan type: Free=public, Paid=private by default
            const canMakePrivate = entitlements.featureFlags.can_make_private;
            const isPaidUser = canMakePrivate;
            const videoIsPublic = isPaidUser ? (user?.publicByDefault || false) : true;
            
            const video = await dbStorage.createVideo({
              ownerId: userId,
              prompt: enhancedPrompt,
              url: statusData.output, // Temporarily use the external URL
              width: videoJob.width,
              height: videoJob.height,
              duration: videoJob.duration,
              aspectRatio: videoJob.aspectRatio,
              model: videoJob.model,
              provider: videoJob.provider,
              isPublic: videoIsPublic,
              tags: videoJob.tags || [],
              startFrameUrl: videoJob.startFrameUrl,
              endFrameUrl: videoJob.endFrameUrl,
              frameRate: videoJob.frameRate,
              loop: videoJob.loop,
              replicateId: result.predictionId,
              jobId: jobId // ✅ FIX: Store jobId so progress cards can be matched (background processing)
            });
            
            console.log(`Created video record ${video.id} for job ${jobId}, downloading...`);
            
            // Download and store the video locally
            try {
              const { videoUrl: localVideoUrl, thumbnailUrl, width, height } = await downloadAndStoreVideo(statusData.output, video.id);
              
              // Update the video with local URL and mark as completed
              const updateData: any = {
                url: localVideoUrl,
                status: "completed",
                thumbnailUrl: thumbnailUrl
              };
              
              if (width && height) {
                updateData.width = width;
                updateData.height = height;
              }
              
              // Set frame rate for WAN models
              if (videoJob.model && videoJob.model.startsWith('wan-2.2')) {
                updateData.frameRate = 16;
              }
              
              await dbStorage.updateVideoByReplicateId(result.predictionId, updateData);
              console.log(`Successfully downloaded and stored video ${video.id} locally at ${localVideoUrl}`);
              
            } catch (downloadError) {
              console.error(`Failed to download video ${video.id} for job ${jobId}:`, downloadError);
              // Mark video as failed if download fails
              await dbStorage.updateVideoByReplicateId(result.predictionId, { status: "failed" });
            }
            
            // Complete the job after video is created and downloaded
            await dbStorage.completeVideoJob(jobId, statusData.output);
            
            console.log(`Created final video record ${video.id} for job ${jobId}`);
          }
          
          // Settle the credit hold after successful generation
          const settled = await creditService.settleHold(jobId, params.duration, { model: model, operationType: 'Video Generation' });
          if (!settled) {
            console.warn(`[Video Gen] Failed to settle hold for job ${jobId} - hold may have already been settled`);
          } else {
            console.log(`[Video Gen] Successfully settled ${creditCost} credits for job ${jobId}`);
          }
          
          return; // Success - exit polling loop
        }
        
        if (statusData.status === 'failed') {
          const errorMessage = statusData.error || 'Video generation failed';
          console.error(`Video generation failed for job ${jobId}: ${errorMessage}`);
          await dbStorage.failVideoJob(jobId, errorMessage);
          return; // Failed - exit polling loop
        }
        
        // Continue polling if still processing
        if (statusData.status === 'processing' || statusData.status === 'queued') {
          console.log(`Job ${jobId} still processing: ${normalizedProgress}% (${statusData.stage})`);
          continue;
        }
        
      } catch (pollingError) {
        console.error(`Error polling status for job ${jobId}:`, pollingError);
        // Continue polling unless we've hit max attempts
      }
    }
    
    // If we reach here, polling timed out
    const timeoutMessage = `Video generation timed out after ${maxPollingAttempts * 3} seconds`;
    console.error(`Job ${jobId}: ${timeoutMessage}`);
    await dbStorage.failVideoJob(jobId, timeoutMessage);
    
  } catch (error) {
    console.error(`Error processing video job ${jobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during video generation';
    await dbStorage.failVideoJob(jobId, errorMessage);
  }
}

// Single point of prompt assembly with duplicate protection
function buildPromptWithStyle(userPrompt: string, styleText: string): string {
  const cleanPrompt = userPrompt.trim();
  const cleanStyle = styleText.trim();
  
  if (!cleanStyle) return cleanPrompt;
  
  // Check if style is already present (case-insensitive, flexible matching)
  const promptLower = cleanPrompt.toLowerCase();
  const styleLower = cleanStyle.toLowerCase();
  
  // Split style into key phrases to check for partial matches
  const styleWords = styleLower.split(/[,.]/).map(s => s.trim()).filter(s => s.length > 3);
  
  // If any significant style phrase is already in prompt, don't add again
  const hasStyleContent = styleWords.some(word => 
    promptLower.includes(word) && word.length > 5 // Only check longer phrases
  );
  
  if (hasStyleContent) {
    return cleanPrompt;
  }
  
  // Add style with proper punctuation
  const separator = cleanPrompt.endsWith('.') || cleanPrompt.endsWith(',') ? ' ' : ', ';
  return `${cleanPrompt}${separator}${cleanStyle}`;
}

// Configure multer for file uploads using memory storage for cloud uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit - matches styleImageUpload
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|ico/; // Removed svg for security
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    // Additional security check to explicitly exclude SVG
    if (file.mimetype === 'image/svg+xml' || path.extname(file.originalname).toLowerCase() === '.svg') {
      return cb(new Error('SVG files are not allowed for security reasons'));
    }
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, ICO)'));
    }
  }
});

// Configure multer for video uploads
const videoUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|webm|mov|avi|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimeTypes = /video\/(mp4|webm|quicktime|x-msvideo|x-matroska)/;
    const mimetype = allowedMimeTypes.test(file.mimetype);
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (MP4, WebM, MOV, AVI, MKV)'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Database health check and monitoring endpoints
  app.get("/api/health/db", async (req, res) => {
    try {
      const { healthCheck, getPoolStats } = await import('./db');
      const isHealthy = await healthCheck();
      const poolStats = await getPoolStats();
      
      res.json({
        status: isHealthy ? "healthy" : "unhealthy",
        pool: poolStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database health check error:", error);
      res.status(503).json({
        status: "error",
        error: "Database health check failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Cache statistics endpoint (admin only)
  app.get("/api/admin/cache-stats", isAdmin, async (req, res) => {
    try {
      const { cacheManager } = await import('./cache/cache-manager');
      const stats = cacheManager.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Cache stats error:", error);
      res.status(500).json({ message: "Failed to fetch cache stats" });
    }
  });

  // Serve generated images from object storage (public access)
  // Reference: blueprint javascript_object_storage - public file serving pattern
  // Note: When running locally (not on Replit), files are served via express.static in index.ts
  if (isOnReplit) {
    app.get("/objects/:objectPath(*)", async (req, res) => {
      const objectStorageService = createStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error serving object:", error);
        if (error instanceof ObjectNotFoundError) {
          return res.sendStatus(404);
        }
        return res.sendStatus(500);
      }
    });
  }

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await dbStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile (name)
  const updateProfileSchema = z.object({
    firstName: z.string().max(100).optional().transform(v => v?.trim() || undefined),
    lastName: z.string().max(100).optional().transform(v => v?.trim() || undefined),
  });

  app.patch('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = updateProfileSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid profile data", errors: parsed.error.issues });
      }
      
      const { firstName, lastName } = parsed.data;
      const user = await dbStorage.updateUserProfile(userId, { firstName, lastName });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload profile image
  app.post('/api/profile/image', isAuthenticated, uploadRateLimit, styleImageUpload.single('image'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      const objectStorage = createStorageService();
      const imageUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'profile-images'
      );
      
      const user = await dbStorage.updateUserProfile(userId, { profileImageUrl: imageUrl });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ imageUrl, user });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });

  // Get user credit ledger with expiration dates
  app.get('/api/credits/ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await dbStorage.getUnexpiredCreditLedgerEntries(userId);
      const totalBalance = await dbStorage.getAvailableCreditsFromLedger(userId);
      res.json({ entries, totalBalance });
    } catch (error) {
      console.error("Error fetching credit ledger:", error);
      res.status(500).json({ message: "Failed to fetch credit ledger" });
    }
  });

  // Get paginated credit usage history
  app.get('/api/credits/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10));
      
      const { entries, total, totalPointsConsumed } = await dbStorage.getCreditUsageHistory(userId, page, pageSize);
      const totalPages = Math.ceil(total / pageSize);
      
      res.json({ 
        entries, 
        total, 
        page, 
        pageSize, 
        totalPages,
        totalPointsConsumed
      });
    } catch (error) {
      console.error("Error fetching credit usage:", error);
      res.status(500).json({ message: "Failed to fetch credit usage" });
    }
  });

  // Get credits that will expire
  app.get('/api/credits/expiring', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await dbStorage.getExpiringCredits(userId);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching expiring credits:", error);
      res.status(500).json({ message: "Failed to fetch expiring credits" });
    }
  });

  // Check and fix expired image URLs
  async function checkAndFixImageUrl(image: any): Promise<any> {
    // Images stored in object storage are persistent and don't need checking
    if (image.url.startsWith('/objects/')) {
      return image;
    }
    
    // Legacy: Check if URL is external (not locally stored) and might be expired
    if (!image.url.startsWith('/images/') && 
        (image.url.includes('blob.core.windows.net') || image.url.includes('replicate.delivery'))) {
      try {
        const response = await fetch(image.url, { method: 'HEAD' });
        if (!response.ok) {
          // Mark URL as empty so the UI shows "Image unavailable"
          return { ...image, url: '' };
        }
      } catch (error: any) {
        // Mark URL as empty so the UI shows "Image unavailable"
        return { ...image, url: '' };
      }
    }
    return image;
  }

  // Get public images (no authentication required)
  app.get("/api/images/public", async (req, res) => {
    try {
      const images = await dbStorage.getPublicImages();
      
      // Check for expired URLs and fix them
      const checkedImages = await Promise.all(
        images.map(image => checkAndFixImageUrl(image))
      );
      
      // Fetch owner names for each image
      const imagesWithOwners = await Promise.all(
        checkedImages.map(async (image) => {
          try {
            const owner = await dbStorage.getUser(image.ownerId);
            return {
              ...image,
              ownerName: owner?.firstName || owner?.email?.split('@')[0] || "Anonymous"
            };
          } catch {
            return {
              ...image,
              ownerName: "Anonymous"
            };
          }
        })
      );
      
      res.json(imagesWithOwners);
    } catch (error) {
      console.error("Error fetching public images:", error);
      res.status(500).json({ message: "Failed to fetch public images" });
    }
  });

  // Get user's images (requires authentication)
  app.get("/api/images", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const images = await dbStorage.getUserImages(userId);
      
      // Check for expired URLs and fix them
      const checkedImages = await Promise.all(
        images.map(image => checkAndFixImageUrl(image))
      );
      
      res.json(checkedImages);
    } catch (error) {
      console.error("Error fetching user images:", error);
      res.status(500).json({ message: "Failed to fetch user images" });
    }
  });

  // Get single image
  app.get("/api/images/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const image = await dbStorage.getImage(id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      res.json(image);
    } catch (error) {
      console.error("Error fetching image:", error);
      res.status(500).json({ message: "Failed to fetch image" });
    }
  });

  // Get available AI models (filtered by primary provider, admin settings and API key availability)
  app.get("/api/models", async (req, res) => {
    try {
      const apiKeys = hasRequiredApiKeys();
      const primaryProvider = getConfig('primary_ai_provider', 'replicate');
      
      const filteredModels = AI_MODELS.filter(model => {
        // Hide internal-only models (like fal-nano-banana-edit)
        if (model.description && model.description.includes('(internal use)')) {
          return false;
        }
        
        // Hide deprecated models - flux-schnell replaced by z-image-turbo
        if (model.id === 'fal-flux-schnell') {
          return false;
        }
        
        // Only show models from the primary provider
        if (model.provider !== primaryProvider) {
          return false;
        }
        
        // Check admin visibility setting
        const showKey = `show_${model.id.replace(/[-\.]/g, '_')}`;
        const isVisible = getConfig(showKey, true);
        
        // Check if provider has required API key
        const providerHasKey = 
          (model.provider === 'openai' && apiKeys.openai) ||
          (model.provider === 'replicate' && apiKeys.replicate) ||
          (model.provider === 'fal' && apiKeys.fal);
        
        return isVisible && providerHasKey;
      }).map(model => {
        const displayNameKey = `${model.id.replace(/[-\.]/g, '_')}_display_name`;
        const customName = getConfig(displayNameKey, model.name);
        return {
          ...model,
          displayName: customName,
          name: customName
        };
      });
      
      res.json(filteredModels);
    } catch (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  // Get specific model info
  app.get("/api/models/:id", async (req, res) => {
    try {
      const model = getModelById(req.params.id);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error fetching model:", error);
      res.status(500).json({ message: "Failed to fetch model" });
    }
  });

  // Get available video models (filtered by primary provider, admin settings and API key availability)
  app.get("/api/video-models", async (req, res) => {
    try {
      const apiKeys = hasRequiredApiKeys();
      const primaryVideoProvider = getConfig('primary_video_provider', 'replicate'); // Use video-specific setting
      
      const filteredModels = VIDEO_MODELS.filter(model => {
        // Only show models from the primary video provider
        if (model.provider !== primaryVideoProvider) {
          return false;
        }
        
        // Check admin visibility setting
        const showKey = `show_${model.id.replace(/[-\.]/g, '_')}`;
        const isVisible = getConfig(showKey, true);
        
        // Check if provider has required API key
        const providerHasKey = 
          (model.provider === 'replicate' && apiKeys.replicate) ||
          (model.provider === 'fal' && apiKeys.fal);
        
        return isVisible && providerHasKey;
      }).map(model => {
        const displayNameKey = `${model.id.replace(/[-\.]/g, '_')}_display_name`;
        const customName = getConfig(displayNameKey, model.name);
        return {
          ...model,
          displayName: customName,
          name: customName
        };
      });
      
      res.json(filteredModels);
    } catch (error) {
      console.error("Error fetching video models:", error);
      res.status(500).json({ message: "Failed to fetch video models" });
    }
  });

  // Get specific video model info
  app.get("/api/video-models/:id", async (req, res) => {
    try {
      const model = getVideoModelById(req.params.id);
      if (!model) {
        return res.status(404).json({ message: "Video model not found" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error fetching video model:", error);
      res.status(500).json({ message: "Failed to fetch video model" });
    }
  });

  // Get base models for unified model selection (image)
  app.get("/api/base-models/image", async (req, res) => {
    try {
      const { IMAGE_BASE_MODELS } = await import("@shared/model-routing");
      const apiKeys = hasRequiredApiKeys();
      const primaryProvider = getConfig('primary_ai_provider', 'fal');
      
      const filteredModels = IMAGE_BASE_MODELS.filter(model => {
        // Only show models from the primary provider
        if (model.provider !== primaryProvider) {
          return false;
        }
        
        // Check admin visibility setting - check both base model key and variant keys
        // Base model key: show_nano_banana
        const baseShowKey = `show_${model.id.replace(/[-\.]/g, '_')}`;
        const baseVisible = getConfig(baseShowKey, true);
        
        // Also check if all variants are disabled (admin saves variant keys like show_fal_nano_banana_txt2img)
        let anyVariantVisible = true;
        if (model.variants && model.variants.length > 0) {
          // Check if at least one variant is enabled
          anyVariantVisible = model.variants.some(variant => {
            const variantShowKey = `show_${variant.id.replace(/[-\.]/g, '_')}`;
            return getConfig(variantShowKey, true);
          });
        }
        
        // Model is visible if base is visible AND at least one variant is visible
        const isVisible = baseVisible && anyVariantVisible;
        
        // Check if provider has required API key
        const providerHasKey = 
          (model.provider === 'replicate' && apiKeys.replicate) ||
          (model.provider === 'fal' && apiKeys.fal) ||
          (model.provider === 'openai' && apiKeys.openai);
        
        return isVisible && providerHasKey;
      });
      
      res.json(filteredModels);
    } catch (error) {
      console.error("Error fetching base image models:", error);
      res.status(500).json({ message: "Failed to fetch base image models" });
    }
  });

  // Get base models for unified model selection (video)
  app.get("/api/base-models/video", async (req, res) => {
    try {
      const { VIDEO_BASE_MODELS } = await import("@shared/model-routing");
      const apiKeys = hasRequiredApiKeys();
      const primaryVideoProvider = getConfig('primary_video_provider', 'fal');
      
      const filteredModels = VIDEO_BASE_MODELS.filter(model => {
        // Only show models from the primary video provider
        if (model.provider !== primaryVideoProvider) {
          return false;
        }
        
        // Check admin visibility setting - check both base model key and variant keys
        const baseShowKey = `show_${model.id.replace(/[-\.]/g, '_')}`;
        const baseVisible = getConfig(baseShowKey, true);
        
        // Also check if all variants are disabled
        let anyVariantVisible = true;
        if (model.variants && model.variants.length > 0) {
          anyVariantVisible = model.variants.some(variant => {
            const variantShowKey = `show_${variant.id.replace(/[-\.]/g, '_')}`;
            return getConfig(variantShowKey, true);
          });
        }
        
        const isVisible = baseVisible && anyVariantVisible;
        
        // Check if provider has required API key
        const providerHasKey = 
          (model.provider === 'replicate' && apiKeys.replicate) ||
          (model.provider === 'fal' && apiKeys.fal);
        
        return isVisible && providerHasKey;
      });
      
      res.json(filteredModels);
    } catch (error) {
      console.error("Error fetching base video models:", error);
      res.status(500).json({ message: "Failed to fetch base video models" });
    }
  });

  // Resolve variant based on base model, inputs, and mode
  app.post("/api/resolve-variant", async (req, res) => {
    try {
      const { resolveVariant } = await import("@shared/model-routing");
      const { baseModelId, mediaType, hasInputImage, mode } = req.body;
      
      if (!baseModelId || !mediaType) {
        return res.status(400).json({ message: "baseModelId and mediaType are required" });
      }
      
      const result = resolveVariant({
        baseModelId,
        mediaType,
        hasInputImage: Boolean(hasInputImage),
        mode
      });
      
      if (!result) {
        return res.status(404).json({ message: "No matching variant found for this configuration" });
      }
      
      // Still return error results with 200 - let frontend decide how to handle
      // The error flag and fallbackMessage provide context for UI decisions
      res.json(result);
    } catch (error) {
      console.error("Error resolving variant:", error);
      res.status(500).json({ message: "Failed to resolve variant" });
    }
  });

  // Get public videos (no authentication required)
  app.get("/api/videos/public", async (req, res) => {
    try {
      const videos = await dbStorage.getPublicVideos();
      
      // Fetch owner names for each video
      const videosWithOwners = await Promise.all(
        videos.map(async (video) => {
          try {
            const owner = await dbStorage.getUser(video.ownerId);
            return {
              ...video,
              ownerName: owner?.firstName || owner?.email?.split('@')[0] || "Anonymous"
            };
          } catch {
            return {
              ...video,
              ownerName: "Anonymous"
            };
          }
        })
      );
      
      res.json(videosWithOwners);
    } catch (error) {
      console.error("Error fetching public videos:", error);
      res.status(500).json({ message: "Failed to fetch public videos" });
    }
  });

  // Get user's videos (requires authentication)
  app.get("/api/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videos = await dbStorage.getUserVideos(userId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching user videos:", error);
      res.status(500).json({ message: "Failed to fetch user videos" });
    }
  });

  // VIDEO FAVORITES ENDPOINTS (must come before :id routes)

  // Get user video favorites (requires authentication)
  app.get("/api/videos/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await dbStorage.getUserVideoFavorites(userId);
      
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching video favorites:", error);
      res.status(500).json({ message: "Failed to fetch video favorites" });
    }
  });

  // Bulk video favorite status check (requires authentication)
  app.post("/api/videos/bulk-favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds)) {
        return res.status(400).json({ message: "videoIds must be an array" });
      }

      const userId = req.user.claims.sub;
      const favoriteStatuses = await dbStorage.getBulkVideoFavoriteStatus(userId, videoIds);
      
      res.json(favoriteStatuses);
    } catch (error) {
      console.error("Error checking bulk video favorite status:", error);
      res.status(500).json({ message: "Failed to check video favorite status" });
    }
  });

  // Get single video
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const video = await dbStorage.getVideo(id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // ==================== GENERATION JOBS QUEUE API ====================

  // Get queue status and limits
  app.get("/api/generation-jobs/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Auto-cleanup stale running jobs (older than 30 minutes)
      await dbStorage.cleanupStaleRunningJobs(30);
      
      const status = await generationQueue.getQueueStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching queue status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  // Get user's active jobs (running and queued)
  app.get("/api/generation-jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const includeCompleted = req.query.includeCompleted === 'true';
      
      // Auto-cleanup stale running jobs (older than 30 minutes)
      // This runs on every fetch to ensure zombie jobs are detected
      await dbStorage.cleanupStaleRunningJobs(30);
      
      if (includeCompleted) {
        const jobs = await dbStorage.getUserImageGenerationJobs(userId, true);
        return res.json(jobs);
      }
      
      const jobs = await generationQueue.getUserActiveJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching generation jobs:", error);
      res.status(500).json({ message: "Failed to fetch generation jobs" });
    }
  });

  // Get a specific job
  app.get("/api/generation-jobs/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user.claims.sub;
      
      const job = await generationQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Cancel a job
  app.post("/api/generation-jobs/:jobId/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user.claims.sub;
      
      const result = await generationQueue.cancelJob(jobId, userId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ success: true, message: "Job cancelled" });
    } catch (error) {
      console.error("Error cancelling job:", error);
      res.status(500).json({ message: "Failed to cancel job" });
    }
  });

  // Dismiss a failed/cancelled/stale job (remove from queue UI)
  app.delete("/api/generation-jobs/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user.claims.sub;
      
      const job = await generationQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Allow dismissing failed, cancelled, or stale running jobs
      const isStale = await dbStorage.isJobStale(jobId, 30);
      const canDismiss = job.status === 'failed' || job.status === 'cancelled' || isStale;
      
      if (!canDismiss) {
        return res.status(400).json({ message: "Can only dismiss failed, cancelled, or stale jobs" });
      }
      
      // Delete the job from the database
      await dbStorage.deleteImageGenerationJob(jobId);
      
      res.json({ success: true, message: "Job dismissed" });
    } catch (error) {
      console.error("Error dismissing job:", error);
      res.status(500).json({ message: "Failed to dismiss job" });
    }
  });

  // Enqueue a new generation job (requires feature access)
  app.post("/api/generation-jobs/enqueue", isAuthenticated, requireImageGeneration, globalLoadGuard, imageGenerationRateLimit, validatePromptInput, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = enqueueJobSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }

      const { 
        prompt, 
        width = 1024, 
        height = 1024, 
        style = "Realistic", 
        model = "flux-pro", 
        quality = "standard", 
        tags = [],
        negativePrompt,
        seed,
        steps,
        cfgScale,
        aspectRatio,
        provider = "replicate",
        enhancePrompt = false,
        styleImageUrl,
        styleImageUrls,
        imageStrength,
      } = validation.data;

      // Check if model exists
      const modelConfig = getModelById(model);
      if (!modelConfig) {
        return res.status(400).json({ message: `Model ${model} not found` });
      }

      // Moderation check - must pass before any credits are checked
      const moderationResult = await moderatePrompt(prompt, negativePrompt, style, userId);
      if (!moderationResult.allowed) {
        const errorResponse = buildModerationErrorResponse(moderationResult);
        return res.status(errorResponse.status).json(errorResponse.body);
      }
      
      // Use moderated prompt (may be rewritten)
      const moderatedPrompt = moderationResult.finalPrompt;

      // Calculate cost for credit check
      const operationId = mapModelToOperationId(model, 'image');
      let creditsRequired = 0;
      let costSnapshot: any = null;
      
      try {
        const costCalc = await creditService.calculateOperationCost(operationId, {
          quantity: 1,
          units: 1
        });
        creditsRequired = costCalc.credits;
        costSnapshot = costCalc.snapshot;
      } catch (error) {
        console.error(`[Pricing] Failed to calculate cost for ${operationId}:`, error);
        creditsRequired = 10; // Fallback
      }

      // Check user credits
      const userCredits = await dbStorage.getUserCredits(userId);
      if (!userCredits || userCredits.balance < creditsRequired) {
        return res.status(402).json({ 
          message: "Insufficient credits",
          required: creditsRequired,
          balance: userCredits?.balance || 0
        });
      }

      // Create prompt preview (first 100 chars) using moderated prompt
      const promptPreview = moderatedPrompt.length > 100 ? moderatedPrompt.substring(0, 100) + '...' : moderatedPrompt;

      // Enqueue the job with moderated prompt
      const result = await generationQueue.enqueueJob(userId, {
        prompt: moderatedPrompt,
        promptPreview,
        width,
        height,
        aspectRatio,
        model,
        provider,
        style,
        quality,
        negativePrompt,
        seed,
        steps,
        cfgScale,
        styleImageUrl,
        styleImageUrls: styleImageUrls || (styleImageUrl ? [styleImageUrl] : undefined),
        imageStrength,
        enhancePrompt,
        tags,
        creditsUsed: creditsRequired,
        costSnapshot,
      });

      if (!result.success) {
        const statusCode = result.errorCode === 'RATE_LIMITED' ? 429 : 
                          result.errorCode === 'QUEUE_FULL' ? 429 :
                          result.errorCode === 'GLOBAL_LIMIT' ? 503 : 400;
        return res.status(statusCode).json({ 
          message: result.error,
          errorCode: result.errorCode
        });
      }

      // Respond immediately to client with job info
      // The frontend will then call /api/images/generate with the job ID
      res.status(201).json({
        success: true,
        job: result.job,
        position: result.position,
        message: result.position && result.position > 0 
          ? `Job queued at position ${result.position}` 
          : 'Job started'
      });
    } catch (error) {
      console.error("Error enqueueing generation job:", error);
      res.status(500).json({ message: "Failed to enqueue generation job" });
    }
  });

  // ==================== END GENERATION JOBS QUEUE API ====================

  // Generate new image (requires authentication + feature access)
  app.post("/api/images/generate", isAuthenticated, requireImageGeneration, imageGenerationRateLimit, validatePromptInput, async (req: any, res) => {
    // Declare jobId in outer scope so it's accessible in catch block
    let jobId: string | undefined;
    
    try {
      console.log("Received request body:", JSON.stringify(req.body, null, 2));
      
      const validation = insertImageSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("Validation errors:", validation.error.errors);
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { 
        prompt, 
        width = 1024, 
        height = 1024, 
        style = "photorealistic", 
        model = "dall-e-3", 
        quality = "standard", 
        tags = [],
        negativePrompt,
        seed,
        steps,
        cfgScale,
        aspectRatio,
        provider = "openai",
        enhancePrompt = false,
        imageCount = 1,
        styleImageUrl,
        styleImageUrls,
        imageStrength,
        jobId: clientJobId,
        imageSize
      } = validation.data;
      
      // Get resolution from request body (for nano-banana-pro and saudi-model-pro)
      const resolution = (req.body as any).resolution as string | undefined;
      
      // Queue job ID for notification panel tracking (sent from frontend)
      const queueJobId = (req.body as any).queueJobId;

      // Check if model exists
      const modelConfig = getModelById(model);
      if (!modelConfig) {
        return res.status(400).json({ message: `Model ${model} not found` });
      }

      // Get user ID for credit operations
      const userId = req.user.claims.sub;
      
      // Moderation check - must pass before any credits are held
      const moderationResult = await moderatePrompt(prompt, negativePrompt, style, userId);
      if (!moderationResult.allowed) {
        const errorResponse = buildModerationErrorResponse(moderationResult);
        return res.status(errorResponse.status).json(errorResponse.body);
      }
      
      // Use moderated prompt (may be rewritten)
      const moderatedPrompt = moderationResult.finalPrompt;
      
      // Use client-provided jobId if available (for progress card matching), otherwise generate one
      jobId = clientJobId || `img_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Map model to operation ID for pricing catalog
      const operationId = mapModelToOperationId(model, 'image');
      
      // Calculate cost using the new pricing calculator
      let creditsRequired: number;
      let costSnapshot: any;
      try {
        const costCalc = await creditService.calculateOperationCost(operationId, {
          quantity: imageCount || 1,
          units: imageCount || 1,
          resolution: resolution || '1K' // Include resolution for nano-banana-pro pricing
        });
        creditsRequired = costCalc.credits;
        costSnapshot = costCalc.snapshot;
        
        console.log(`[Image Gen] Cost calculation for ${model}: ${creditsRequired} credits for ${imageCount || 1} image(s) at resolution ${resolution || '1K'}`);
      } catch (error) {
        console.error(`[Pricing] Failed to calculate cost for operation ${operationId}:`, error);
        // Fallback to legacy pricing if operation not found in catalog
        console.log('[Pricing] Falling back to legacy pricing service');
        const costDetails = await pricingService.calculateGenerationCost({
          model,
          enhancePrompt,
          imageCount: imageCount || 1,
          aspectRatio: aspectRatio || undefined,
          quality,
          styleImageUrl
        });
        creditsRequired = costDetails.totalCost;
        costSnapshot = { legacy: true, costDetails };
      }
      
      // Hold credits upfront (auth-hold pattern)
      let holdResult;
      try {
        holdResult = await creditService.holdCreditsForOperation(
          userId,
          operationId,
          `Image generation: ${model}`,
          jobId,
          { quantity: imageCount || 1, units: imageCount || 1 },
          creditsRequired // Pass as fallback in case operation not in catalog
        );
        
        if (holdResult.status === 'already_processed') {
          // Job already processed (idempotency check)
          return res.status(409).json({ 
            message: "This generation request was already processed",
            jobId
          });
        }
        // status is either 'success' or 'admin_exempt' - both allow proceeding
        
        if (holdResult.status === 'success') {
          console.log(`[Image Gen] Held ${creditsRequired} credits for job ${jobId}`);
        }
      } catch (error: any) {
        if (error.message?.includes('Insufficient credits')) {
          const userBalance = await creditService.getUserBalance(userId);
          return res.status(402).json({ 
            message: "Insufficient credits",
            required: creditsRequired,
            balance: userBalance
          });
        }
        throw error;
      }

      // Apply prompt template system for image generation (use moderated prompt)
      let enhancedPrompt = moderatedPrompt;
      try {
        // Get the best prompt template for image generation and this model
        const template = await dbStorage.getBestPromptTemplate('image_generation', model);
        
        if (template && template.promptText) {
          console.log(`Using prompt template: ${template.name} for model: ${model}`);
          console.log(`Template: ${template.promptText}`);
          
          // Get style text if style is specified
          let styleText = '';
          if (style) {
            const aiStyles = await dbStorage.getAiStyles();
            const selectedStyle = aiStyles.find(s => s.name.toLowerCase() === style.toLowerCase());
            if (selectedStyle && selectedStyle.promptText) {
              styleText = selectedStyle.promptText;
            }
          }
          
          // Prepare variables for substitution (use moderated prompt)
          const variables = {
            user_prompt: moderatedPrompt,
            style: styleText || style || 'photorealistic'
          };
          
          // Apply the template with variable substitution
          enhancedPrompt = substituteVariables(template.promptText, variables);
          console.log(`Final enhanced prompt: ${enhancedPrompt}`);
        } else {
          console.log('No prompt template found, using legacy style system');
          // Fallback to legacy style system if no template found
          if (style) {
            const aiStyles = await dbStorage.getAiStyles();
            const selectedStyle = aiStyles.find(s => s.name.toLowerCase() === style.toLowerCase());
            if (selectedStyle && selectedStyle.promptText) {
              enhancedPrompt = buildPromptWithStyle(moderatedPrompt, selectedStyle.promptText);
            }
          }
        }
      } catch (error) {
        console.error('Error applying prompt template:', error);
        // Fallback to legacy style system if template fails
        if (style) {
          try {
            const aiStyles = await dbStorage.getAiStyles();
            const selectedStyle = aiStyles.find(s => s.name.toLowerCase() === style.toLowerCase());
            if (selectedStyle && selectedStyle.promptText) {
              enhancedPrompt = buildPromptWithStyle(moderatedPrompt, selectedStyle.promptText);
            }
          } catch (styleError) {
            console.error('Error with legacy style system:', styleError);
          }
        }
      }

      // Check API keys based on provider
      if (modelConfig.provider === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          return res.status(500).json({ 
            message: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable." 
          });
        }
      } else if (modelConfig.provider === "replicate") {
        if (!process.env.REPLICATE_API_TOKEN) {
          return res.status(500).json({ 
            message: "Replicate API token not configured. Please set REPLICATE_API_TOKEN environment variable." 
          });
        }
      }

      // Helper function to convert relative object storage paths to full URLs for fal.ai API
      // Also handles URLs from previous hosts/environments by extracting the path and rebuilding
      const convertToFullUrl = (urlOrPath: string | undefined): string | undefined => {
        if (!urlOrPath) return undefined;
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        
        // If it's a full URL, extract the path and rebuild with current host
        // This ensures URLs work after deployment even if the host changed
        if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
          try {
            const url = new URL(urlOrPath);
            const pathname = url.pathname;
            // If the path is for objects or uploads, rebuild with current host
            if (pathname.startsWith('/objects/') || pathname.startsWith('/uploads/')) {
              return `${protocol}://${host}${pathname}`;
            }
            // For external URLs (like fal.media), return as-is
            return urlOrPath;
          } catch {
            return urlOrPath;
          }
        }
        
        // Convert relative object storage path to full URL
        if (urlOrPath.startsWith('/objects/') || urlOrPath.startsWith('/uploads/')) {
          return `${protocol}://${host}${urlOrPath}`;
        }
        
        return urlOrPath;
      };

      // Convert style image URLs to full URLs for the fal.ai API
      // The database stores relative paths (/objects/...) which need to be converted at request time
      let finalStyleImageUrls = styleImageUrls?.map(convertToFullUrl).filter(Boolean) as string[] | undefined;
      let finalStyleImageUrl = convertToFullUrl(styleImageUrl);
      let finalImageStrength = imageStrength;
      let actualModel = model; // Track the actual model to use
      let actualModelConfig = modelConfig; // Track the actual model config
      if (model === 'fal-saudi-model' || model === 'fal-saudi-model-pro') {
        const isSaudiModelPro = model === 'fal-saudi-model-pro';
        console.log(`${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} detected - starting classification and auto-enhancement`);
        try {
          // Step 1: Use classifier to select the best category (based on current prompt)
          const { selectReferenceCategoryForPrompt, getReferenceImagesForCategory, autoEnhanceSaudiPrompt } = await import('./saudi-model-processor');
          const categorySlug = await selectReferenceCategoryForPrompt(enhancedPrompt);
          
          // Step 2: Auto-enhance the prompt for Saudi cultural context (transparent to user)
          const saudiEnhancedPrompt = await autoEnhanceSaudiPrompt(enhancedPrompt);
          console.log(`Saudi auto-enhancement: "${enhancedPrompt}" -> "${saudiEnhancedPrompt}"`);
          
          // Update the enhancedPrompt with the auto-enhanced version
          enhancedPrompt = saudiEnhancedPrompt;
          
          // Step 3: Get reference images for the selected category
          if (categorySlug) {
            const referenceImages = await getReferenceImagesForCategory(categorySlug, 10);
            if (referenceImages.length > 0) {
              console.log(`${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: selected ${referenceImages.length} reference images for category: ${categorySlug}`);
              finalStyleImageUrls = referenceImages;
              // Keep using the selected Saudi model (image-to-image)
              actualModel = model;
              actualModelConfig = getModelById(model) || modelConfig;
            } else {
              console.log(`${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: no reference images found for category, switching to text-to-image model`);
              // Switch to appropriate text-to-image model when no reference images available
              actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
              actualModelConfig = getModelById(actualModel) || modelConfig;
              // Clear style image parameters for text-to-image model
              finalStyleImageUrls = undefined;
              finalStyleImageUrl = undefined;
              finalImageStrength = undefined;
            }
          } else {
            console.log(`${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: no category selected, switching to text-to-image model`);
            // Switch to appropriate text-to-image model when no category matches
            actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
            actualModelConfig = getModelById(actualModel) || modelConfig;
            // Clear style image parameters for text-to-image model
            finalStyleImageUrls = undefined;
            finalStyleImageUrl = undefined;
            finalImageStrength = undefined;
          }
        } catch (error) {
          console.error(`${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing error:`, error);
          // On error, fall back to appropriate text-to-image model for safety
          actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
          actualModelConfig = getModelById(actualModel) || modelConfig;
          // Clear style image parameters for text-to-image model
          finalStyleImageUrls = undefined;
          finalStyleImageUrl = undefined;
          finalImageStrength = undefined;
        }
      } else if (model === 'fal-nano-banana-txt2img') {
        // Pro model - if user provided style/reference images, switch to edit model
        const hasStyleImages = (finalStyleImageUrls && finalStyleImageUrls.length > 0) || finalStyleImageUrl;
        if (hasStyleImages) {
          console.log('Pro model: User provided reference images, switching to edit model');
          actualModel = 'fal-nano-banana-edit';
          actualModelConfig = getModelById('fal-nano-banana-edit') || modelConfig;
        } else {
          console.log('Pro model: Using text-to-image (no reference images)');
        }
      }

      // Generate image using the selected model with enhanced prompt and provider-aware routing
      const result = await generateImageWithProvider(actualModel, {
        prompt: enhancedPrompt,
        width,
        height,
        style,
        quality,
        negativePrompt: negativePrompt ?? undefined,
        seed: seed ?? undefined,
        steps: steps ?? undefined,
        cfgScale: cfgScale ?? undefined,
        aspectRatio: aspectRatio ?? undefined,
        styleImageUrl: finalStyleImageUrl ?? undefined,
        styleImageUrls: finalStyleImageUrls ?? undefined,
        imageStrength: finalImageStrength ?? undefined,
        imageSize: imageSize ?? undefined,
        resolution: resolution ?? undefined, // For nano-banana-pro and saudi-model-pro
      });

      // Create initial image record with user ownership
      const user = await dbStorage.getUser(userId);
      const entitlements = (req as any).userEntitlements || await creditService.getUserEntitlements(userId);
      
      // Server-side enforcement: Set visibility based on plan type
      // Free plan users: generations are PUBLIC by default
      // Paid plan users: generations are PRIVATE by default
      const canMakePrivate = entitlements.featureFlags.can_make_private;
      const isPaidUser = canMakePrivate; // can_make_private flag indicates paid plan
      
      // Paid users get private by default (unless they override with publicByDefault)
      // Free users always get public (cannot make private)
      const imageIsPublic = isPaidUser ? (user?.publicByDefault || false) : true;
      
      // Normalize styleImageUrl for storage - extract just the path so it works after deployment
      const normalizeStyleImageUrlForStorage = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        // If it's a full URL, extract just the path for storage
        if (url.startsWith('http://') || url.startsWith('https://')) {
          try {
            const parsedUrl = new URL(url);
            const pathname = parsedUrl.pathname;
            // Store only object storage or upload paths
            if (pathname.startsWith('/objects/') || pathname.startsWith('/uploads/')) {
              return pathname;
            }
          } catch {
            // If URL parsing fails, return as-is
          }
        }
        return url;
      };
      
      const image = await dbStorage.createImage({
        ownerId: userId,
        prompt,
        url: result.url,
        width,
        height,
        style,
        model,
        quality,
        isPublic: imageIsPublic,
        tags,
        negativePrompt,
        seed,
        steps,
        cfgScale,
        aspectRatio,
        provider: actualModelConfig.provider,
        styleImageUrl: normalizeStyleImageUrlForStorage(styleImageUrl),
        imageStrength,
        jobId, // Add jobId for progress card matching
      });

      // Download and store ALL images locally since both OpenAI and Replicate URLs expire
      let finalImageUrl = result.url;
      let thumbnailUrl: string | null = null;
      try {
        const storageResult = await downloadAndStoreImage(result.url, image.id);
        finalImageUrl = storageResult.imageUrl;
        thumbnailUrl = storageResult.thumbnailUrl;
        // Update the image record with the local URL and thumbnail
        await dbStorage.updateImageUrl(image.id, finalImageUrl, thumbnailUrl);
      } catch (error) {
        console.error(`Failed to download and store image ${image.id}:`, error);
        // Continue with original URL if download fails (will expire later)
      }

      // Settle the credit hold after successful generation
      const settled = await creditService.settleHold(jobId, imageCount || 1, { model, operationType: 'Image Generation' });
      if (!settled) {
        console.warn(`[Image Gen] Failed to settle hold for job ${jobId} - hold may have already been settled`);
      } else {
        console.log(`[Image Gen] Successfully settled ${creditsRequired} credits for job ${jobId}`);
      }

      // Get updated balance
      const updatedBalance = await creditService.getUserBalance(userId);

      // Mark queue job as completed if present
      if (queueJobId) {
        try {
          await generationQueue.completeJob(queueJobId, image.id, finalImageUrl);
          console.log(`[Queue] Marked job ${queueJobId} as completed`);
        } catch (queueError) {
          console.error(`[Queue] Failed to mark job ${queueJobId} as completed:`, queueError);
        }
      }

      res.json({
        ...image,
        creditCost: creditsRequired,
        remainingCredits: updatedBalance,
        jobId
      });
    } catch (error) {
      console.error("Error generating image:", error);
      
      // Mark queue job as failed if present
      const queueJobIdOnError = (req.body as any).queueJobId;
      if (queueJobIdOnError) {
        try {
          await generationQueue.failJob(
            queueJobIdOnError, 
            error instanceof Error ? error.message : 'Image generation failed'
          );
          console.log(`[Queue] Marked job ${queueJobIdOnError} as failed`);
        } catch (queueError) {
          console.error(`[Queue] Failed to mark job ${queueJobIdOnError} as failed:`, queueError);
        }
      }
      
      // Release credit hold on failure (auto-refund)
      const userId = (req as any).user?.claims?.sub;
      if (userId && typeof jobId !== 'undefined') {
        try {
          const released = await creditService.releaseHold(
            jobId,
            error instanceof Error ? error.message : 'Image generation failed'
          );
          if (released) {
            console.log(`[Image Gen] Auto-refunded credits for failed job ${jobId}`);
          }
        } catch (refundError) {
          console.error('[Image Gen] Failed to release credit hold:', refundError);
        }
      }
      
      // Handle enhanced errors with detailed API information
      if (error && typeof error === 'object' && 'status' in error && 'detail' in error) {
        // Enhanced error from fal.ai with detailed information
        const enhancedError = error as any;
        res.status(enhancedError.status || 500).json({
          message: enhancedError.message,
          detail: enhancedError.detail,
          status: enhancedError.status
        });
      } else if (error instanceof Error) {
        // Standard error handling
        res.status(500).json({ message: `Failed to generate image: ${error.message}` });
      } else {
        // Unknown error
        res.status(500).json({ message: "Failed to generate image" });
      }
    }
  });

  // Toggle favorite status (requires authentication)
  app.patch("/api/images/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const userId = req.user.claims.sub;
      const isFavorited = await dbStorage.toggleFavorite(userId, id);

      res.json({ isFavorited });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  // Update image visibility (requires authentication)
  app.patch("/api/images/:id/visibility", isAuthenticated, async (req: any, res) => {
    try {
      console.log("Visibility route hit. User:", req.user);
      console.log("Request body:", req.body);
      
      const id = parseInt(req.params.id);
      let { isPublic } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const userId = req.user.claims.sub;
      
      // Server-side enforcement: Check if user can make content private
      if (isPublic === false) {
        const entitlements = await creditService.getUserEntitlements(userId);
        if (!entitlements.featureFlags.can_make_private) {
          console.log(`[FeatureGating] User ${userId} cannot make content private - forcing public`);
          return res.status(403).json({ 
            message: "Your current plan does not allow private content. Please upgrade to make items private.",
            errorCode: "FEATURE_NOT_AVAILABLE",
            feature: "can_make_private"
          });
        }
      }
      
      console.log("Updating visibility for image", id, "isPublic:", isPublic, "userId:", userId);
      
      const image = await dbStorage.updateImageVisibility(id, isPublic, userId);
      
      if (!image) {
        console.log("No image returned from updateImageVisibility - either not found or unauthorized");
        return res.status(404).json({ message: "Image not found or unauthorized" });
      }

      console.log("Successfully updated image visibility:", image);
      res.json(image);
    } catch (error) {
      console.error("Error updating image visibility:", error);
      res.status(500).json({ message: "Failed to update image visibility" });
    }
  });

  // Get user favorites (requires authentication)
  app.get("/api/images/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await dbStorage.getUserFavorites(userId);
      
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Check if image is favorited (requires authentication)
  app.get("/api/images/:id/favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const userId = req.user.claims.sub;
      const isFavorited = await dbStorage.isImageFavorited(userId, id);
      
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Bulk favorite status check (requires authentication) - OPTIMIZATION
  app.post("/api/images/bulk-favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const { imageIds } = req.body;
      if (!Array.isArray(imageIds)) {
        return res.status(400).json({ message: "imageIds must be an array" });
      }

      const userId = req.user.claims.sub;
      const favoriteStatuses = await dbStorage.getBulkFavoriteStatus(userId, imageIds);
      
      res.json(favoriteStatuses);
    } catch (error) {
      console.error("Error checking bulk favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Toggle video favorite status (requires authentication)
  app.patch("/api/videos/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const userId = req.user.claims.sub;
      const isFavorited = await dbStorage.toggleVideoFavorite(userId, id);

      res.json({ isFavorited });
    } catch (error) {
      console.error("Error toggling video favorite:", error);
      res.status(500).json({ message: "Failed to toggle video favorite" });
    }
  });

  // Check if video is favorited (requires authentication)
  app.get("/api/videos/:id/favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const userId = req.user.claims.sub;
      const isFavorited = await dbStorage.isVideoFavorited(userId, id);
      
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error checking video favorite status:", error);
      res.status(500).json({ message: "Failed to check video favorite status" });
    }
  });

  // Update user public default setting (requires authentication)
  app.patch("/api/user/public-default", isAuthenticated, async (req: any, res) => {
    try {
      const { publicByDefault } = req.body;
      const userId = req.user.claims.sub;
      
      const user = await dbStorage.updateUserPublicDefault(userId, publicByDefault);
      
      if (!publicByDefault) {
        // If turning off public default, make all existing images private
        await dbStorage.setAllUserImagesPrivate(userId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user public default:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Record user consent for free plan public generations (requires authentication)
  app.post("/api/user/free-generation-consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const user = await dbStorage.updateUserFreeGenerationConsent(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        success: true, 
        consentedAt: user.freeGenerationConsentAt 
      });
    } catch (error) {
      console.error("Error recording free generation consent:", error);
      res.status(500).json({ message: "Failed to record consent" });
    }
  });

  // Delete image (requires authentication)
  app.delete("/api/images/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const userId = req.user.claims.sub;
      const success = await dbStorage.deleteImage(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Image not found or unauthorized" });
      }

      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  // Generate video (requires authentication + feature access)
  app.post("/api/videos/generate", isAuthenticated, requireVideoGeneration, videoGenerationRateLimit, validatePromptInput, async (req: any, res) => {
    try {
      console.log("Received video generation request:", JSON.stringify(req.body, null, 2));
      
      const validation = insertVideoSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("Video validation errors:", validation.error.errors);
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { 
        prompt, 
        model, 
        aspectRatio = "9:16",
        duration = 5,
        startFrameUrl,
        endFrameUrl,
        tags = [],
        resolution = "720p"
      } = validation.data;

      // Ensure model is provided
      if (!model) {
        return res.status(400).json({ message: "Model is required for video generation" });
      }

      // Use the exact model selected by the user
      const selectedModel = model;
      console.log(`Using user-selected model: ${selectedModel}`);

      // Check if model exists
      const modelConfig = getVideoModelById(selectedModel);
      if (!modelConfig) {
        return res.status(400).json({ message: `Video model ${selectedModel} not found` });
      }

      // Get user ID for credit operations
      const userId = req.user.claims.sub;
      
      // Moderation check - must pass before any credits are used
      const moderationResult = await moderatePrompt(prompt, undefined, validation.data.style, userId);
      if (!moderationResult.allowed) {
        const errorResponse = buildModerationErrorResponse(moderationResult);
        return res.status(errorResponse.status).json(errorResponse.body);
      }
      
      // Use moderated prompt (may be rewritten)
      const moderatedPrompt = moderationResult.finalPrompt;
      
      // Calculate the cost for video generation (videos cost more than images)
      const videoCost = 25; // Base cost for video generation
      
      // Check if user has enough credits
      const hasEnoughCredits = await creditService.hasEnoughCredits(userId, videoCost);
      if (!hasEnoughCredits) {
        const userBalance = await creditService.getUserBalance(userId);
        return res.status(402).json({ 
          message: "Insufficient credits",
          required: videoCost,
          balance: userBalance
        });
      }

      // Check API keys for Replicate
      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ 
          message: "Replicate API token not configured. Please set REPLICATE_API_TOKEN environment variable." 
        });
      }

      // Apply prompt template system for video generation (use moderated prompt)
      let enhancedPrompt = moderatedPrompt;
      try {
        // Get the best prompt template for video generation and this model
        const template = await dbStorage.getBestPromptTemplate('video_generation', model);
        
        if (template && template.promptText) {
          console.log(`Using video prompt template: ${template.name} for model: ${model}`);
          console.log(`Template: ${template.promptText}`);
          
          // Get style text if available in the request body
          let styleText = '';
          if (validation.data.style) {
            const videoStyles = await dbStorage.getVideoStyles();
            const selectedStyle = videoStyles.find(s => s.name.toLowerCase() === validation.data.style!.toLowerCase());
            if (selectedStyle && selectedStyle.promptText) {
              styleText = selectedStyle.promptText;
            }
          }
          
          // Prepare variables for substitution (use moderated prompt)
          const variables = {
            user_prompt: moderatedPrompt,
            style: styleText || validation.data.style || 'cinematic'
          };
          
          // Apply the template with variable substitution
          enhancedPrompt = substituteVariables(template.promptText, variables);
          console.log(`Final enhanced video prompt: ${enhancedPrompt}`);
        } else {
          console.log('No video prompt template found, using moderated prompt');
        }
      } catch (error) {
        console.error('Error applying video prompt template:', error);
        // Continue with moderated prompt if template fails
      }

      // Calculate width/height based on resolution for WAN models, or aspect ratio for others
      let width: number, height: number;
      if (selectedModel.startsWith('wan-2.2')) {
        // WAN models use resolution presets
        const resolutionMap = {
          "480p": { width: 854, height: 480 },
          "540p": { width: 960, height: 540 },
          "720p": { width: 1280, height: 720 }
        };
        const res = resolutionMap[resolution as keyof typeof resolutionMap] || resolutionMap["720p"];
        width = res.width;
        height = res.height;
      } else {
        // Luma and other models use aspect ratio - calculate based on 540p resolution
        if (aspectRatio === "9:16") {
          width = 540;
          height = 960;
        } else if (aspectRatio === "16:9") {
          width = 960;
          height = 540;
        } else { // 1:1
          width = 540;
          height = 540;
        }
      }

      // Start video generation with provider-aware routing (returns prediction ID for polling)
      const result = await generateVideoWithProvider(selectedModel, {
        prompt: enhancedPrompt,
        aspectRatio,
        duration,
        startFrame: startFrameUrl || undefined,
        endFrame: endFrameUrl || undefined,
        resolution: (resolution === "540p") ? undefined : resolution as "480p" | "720p"
      });

      // Create video record with pending status
      const user = await dbStorage.getUser(userId);
      const entitlements = (req as any).userEntitlements || await creditService.getUserEntitlements(userId);
      
      // Server-side enforcement: Force public if user cannot make content private
      const canMakePrivate = entitlements.featureFlags.can_make_private;
      const videoIsPublic = canMakePrivate ? (user?.publicByDefault || false) : true;
      
      const video = await dbStorage.createVideo({
        ownerId: userId,
        prompt: enhancedPrompt, // Store the enhanced prompt, not the original
        url: "", // Will be updated when generation completes
        width, // Store calculated width from resolution/aspect ratio
        height, // Store calculated height from resolution/aspect ratio
        duration,
        aspectRatio,
        model: selectedModel, // Use the auto-selected model
        provider: modelConfig.provider,
        isPublic: videoIsPublic,
        tags,
        startFrameUrl,
        endFrameUrl,
        replicateId: result.predictionId
      });

      // NOTE: This is the old /api/videos/generate endpoint - still uses direct deduction
      // The new /api/video/jobs endpoint uses the hold/settle pattern
      // For consistency, keeping this as-is for now but marking as DEPRECATED
      // TODO: Remove this endpoint once all clients migrate to /api/video/jobs
      
      const deductionResult = await creditService.deductCredits(
        userId,
        videoCost,
        `Video generation: ${selectedModel}`,
        {
          videoId: video.id,
          model: selectedModel,
          predictionId: result.predictionId,
          aspectRatio,
          duration,
          resolution
        }
      );

      if (!deductionResult) {
        console.error("Failed to deduct credits after video generation start");
        // Video is still created but no credits charged - this is safer than the reverse
      }

      res.json({
        ...video,
        predictionId: result.predictionId,
        creditCost: videoCost,
        remainingCredits: deductionResult?.balance
      });
    } catch (error) {
      console.error("Error generating video:", error);
      if (error instanceof Error) {
        res.status(500).json({ message: `Failed to generate video: ${error.message}` });
      } else {
        res.status(500).json({ message: "Failed to generate video" });
      }
    }
  });

  // Create video generation job (new job-based system)
  app.post("/api/video/jobs", isAuthenticated, requireVideoGeneration, videoGenerationRateLimit, validatePromptInput, async (req: any, res) => {
    try {
      console.log("Received video job creation request:", JSON.stringify(req.body, null, 2));
      
      const validation = insertVideoJobSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("Video job validation errors:", validation.error.errors);
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { 
        prompt, 
        model, 
        aspectRatio = "9:16",
        duration = 5,
        startFrameUrl,
        endFrameUrl,
        videoReferenceUrl,
        characterOrientation = "video",
        tags = [],
        resolution = "720p",
        style = "cinematic",
        audioEnabled = false,
        // WAN 2.6 specific parameters
        audioFileUrl,
        promptExpansion = true,
        multiShot = true,
        negativePrompt
      } = validation.data;

      // Ensure model is provided
      if (!model) {
        return res.status(400).json({ message: "Model is required for video generation" });
      }

      // Use the exact model selected by the user
      const selectedModel = model;
      console.log(`Creating job for user-selected model: ${selectedModel}`);

      // Check if model exists
      const modelConfig = getVideoModelById(selectedModel);
      if (!modelConfig) {
        return res.status(400).json({ message: `Video model ${selectedModel} not found` });
      }

      // Get user ID for credit operations
      const userId = req.user.claims.sub;
      
      // Moderation check - must pass before any credits are used
      const moderationResult = await moderatePrompt(prompt, negativePrompt, style, userId);
      if (!moderationResult.allowed) {
        const errorResponse = buildModerationErrorResponse(moderationResult);
        return res.status(errorResponse.status).json(errorResponse.body);
      }
      
      // Use moderated prompt (may be rewritten)
      const moderatedPrompt = moderationResult.finalPrompt;
      
      // Map model to operation ID for pricing catalog
      const operationId = mapModelToOperationId(selectedModel, 'video');
      
      // Calculate cost using the new pricing calculator (based on duration, resolution, and audio)
      let creditsRequired: number;
      let costSnapshot: any;
      try {
        const costCalc = await creditService.calculateOperationCost(operationId, {
          units: duration, // Duration in seconds is the unit for video
          duration: duration,
          resolution: resolution, // Pass resolution for per-resolution pricing
          audio_on: audioEnabled // Use the audio setting from the request
        });
        creditsRequired = costCalc.credits;
        costSnapshot = costCalc.snapshot;
        
        console.log(`[Video Gen] Cost calculation for ${selectedModel}: ${creditsRequired} credits for ${duration}s at ${resolution}`);
        console.log(`[Video Gen] Cost breakdown: ${costCalc.snapshot.baseCostUsd} USD base cost, ${costCalc.snapshot.marginPercent}% margin, ${costCalc.snapshot.effectiveUsd} USD effective`);
      } catch (error) {
        console.error(`[Pricing] Failed to calculate cost for operation ${operationId}:`, error);
        // Fallback to legacy hardcoded pricing if operation not found in catalog
        console.log('[Pricing] Falling back to legacy hardcoded pricing (25 credits)');
        creditsRequired = 25;
        costSnapshot = { legacy: true, hardcoded: 25 };
      }
      
      // Check if user has enough credits
      const hasEnoughCredits = await creditService.hasEnoughCredits(userId, creditsRequired);
      if (!hasEnoughCredits) {
        const userBalance = await creditService.getUserBalance(userId);
        return res.status(402).json({ 
          message: "Insufficient credits",
          required: creditsRequired,
          balance: userBalance
        });
      }

      // Calculate width/height based on resolution for WAN models, or aspect ratio for others
      let width: number, height: number;
      if (selectedModel.startsWith('wan-2.2')) {
        // WAN models use resolution presets
        const resolutionMap = {
          "480p": { width: 854, height: 480 },
          "540p": { width: 960, height: 540 },
          "720p": { width: 1280, height: 720 }
        };
        const res = resolutionMap[resolution as keyof typeof resolutionMap] || resolutionMap["720p"];
        width = res.width;
        height = res.height;
      } else {
        // Luma and other models use aspect ratio - calculate based on 540p resolution
        if (aspectRatio === "9:16") {
          width = 540;
          height = 960;
        } else if (aspectRatio === "16:9") {
          width = 960;
          height = 540;
        } else { // 1:1
          width = 540;
          height = 540;
        }
      }

      // Generate unique job ID
      const jobId = crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4();
      
      // Hold credits upfront (auth-hold pattern)
      let holdResult;
      try {
        holdResult = await creditService.holdCreditsForOperation(
          userId,
          operationId,
          `Video generation: ${selectedModel}`,
          jobId,
          { units: duration, duration: duration, resolution: resolution, audio_on: audioEnabled },
          creditsRequired // Pass as fallback in case operation not in catalog
        );
        
        if (holdResult.status === 'already_processed') {
          // Job already processed (idempotency check)
          return res.status(409).json({ 
            message: "This generation request was already processed",
            jobId
          });
        }
        // status is either 'success' or 'admin_exempt' - both allow proceeding
        
        if (holdResult.status === 'success') {
          console.log(`[Video Gen] Held ${creditsRequired} credits for job ${jobId}`);
        }
      } catch (error: any) {
        if (error.message?.includes('Insufficient credits')) {
          const userBalance = await creditService.getUserBalance(userId);
          return res.status(402).json({ 
            message: "Insufficient credits",
            required: creditsRequired,
            balance: userBalance
          });
        }
        throw error;
      }

      // Create video job with queued state immediately (use moderated prompt)
      const videoJob = await dbStorage.createVideoJob({
        id: jobId,
        ownerId: userId,
        prompt: moderatedPrompt,
        duration,
        width,
        height,
        aspectRatio,
        model: selectedModel,
        provider: modelConfig.provider,
        style,
        startFrameUrl,
        endFrameUrl,
        videoReferenceUrl,
        characterOrientation,
        tags,
        audioEnabled,
        isPublic: false, // Default to private, will be set based on user preference later
        state: 'queued',
        progress: 0,
        stage: 'Queued'
      });

      // Return immediately with jobId and queued state
      res.json({
        jobId: videoJob.id,
        state: videoJob.state,
        progress: videoJob.progress,
        stage: videoJob.stage,
        creditCost: creditsRequired
      });

      // Start background processing asynchronously (don't wait for it) using moderated prompt
      setImmediate(async () => {
        try {
          await processVideoJob(jobId, selectedModel, {
            prompt: moderatedPrompt,
            aspectRatio,
            duration,
            startFrame: startFrameUrl || undefined,
            endFrame: endFrameUrl || undefined,
            videoReference: videoReferenceUrl || undefined,
            characterOrientation: characterOrientation as "video" | "image" || undefined,
            resolution: (resolution === "540p") ? undefined : resolution as "480p" | "720p",
            audioEnabled,
            // WAN 2.6 specific parameters
            audioFileUrl: audioFileUrl || undefined,
            promptExpansion,
            multiShot,
            negativePrompt: negativePrompt || undefined
          }, userId, creditsRequired);
        } catch (error) {
          console.error(`Background processing failed for job ${jobId}:`, error);
          
          // Release credit hold on failure (auto-refund)
          try {
            await creditService.releaseHold(jobId, error instanceof Error ? error.message : 'Unknown error');
            console.log(`[Video Gen] Auto-refunded credits for failed job ${jobId}`);
          } catch (refundError) {
            console.error(`[Video Gen] Failed to release credit hold for job ${jobId}:`, refundError);
          }
          
          await dbStorage.failVideoJob(jobId, error instanceof Error ? error.message : 'Unknown error');
        }
      });

    } catch (error) {
      console.error("Error creating video job:", error);
      if (error instanceof Error) {
        res.status(500).json({ message: `Failed to create video job: ${error.message}` });
      } else {
        res.status(500).json({ message: "Failed to create video job" });
      }
    }
  });

  // Get video job status (new job-based polling)
  app.get("/api/video/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      const videoJob = await dbStorage.getVideoJob(jobId);
      if (!videoJob) {
        return res.status(404).json({ message: "Video job not found" });
      }

      // Return unified job status
      res.json({
        jobId: videoJob.id,
        state: videoJob.state,
        progress: videoJob.progress,
        stage: videoJob.stage,
        assetUrl: videoJob.assetUrl,
        thumbnailUrl: videoJob.thumbnailUrl,
        error: videoJob.error,
        createdAt: videoJob.createdAt,
        updatedAt: videoJob.updatedAt
      });

    } catch (error) {
      console.error("Error getting video job status:", error);
      res.status(500).json({ message: "Failed to get video job status" });
    }
  });

  // Check video generation status
  app.get("/api/video-status/:predictionId", async (req, res) => {
    try {
      const { predictionId } = req.params;
      
      if (!predictionId) {
        return res.status(400).json({ message: "Prediction ID is required" });
      }

      console.log(`Checking video status for prediction: ${predictionId}`);
      const statusData = await getVideoPredictionStatus(predictionId);
      console.log(`Progress for ${predictionId}: ${statusData.progress}% (${statusData.stage}) - ETA: ${statusData.etaSeconds}s - Status: ${statusData.status}`);
      
      // Update progress in database
      try {
        const video = await dbStorage.getVideoByReplicateId(predictionId);
        if (video && video.id) {
          // Don't mark as completed here for succeeded videos - let the completion handler do it after download
          const newStatus = statusData.status === 'succeeded' ? 'processing' : 
                           (statusData.status === 'failed' ? 'failed' : 'processing');
          
          await dbStorage.updateVideoProgress(video.id, {
            status: newStatus,
            progress: Math.round(statusData.progress || 0),
            stage: statusData.stage,
            etaSeconds: statusData.etaSeconds
          });
        }
      } catch (progressError) {
        console.log("Could not update progress in database:", progressError);
      }
      
      // If video is completed successfully, download and store it locally
      if (statusData.status === "succeeded" && statusData.output) {
        console.log(`Video ${predictionId} succeeded with output: ${statusData.output}`);
        
        // Validate that we have a proper HTTP(S) URL before attempting download
        const isValidVideoUrl = statusData.output && 
          typeof statusData.output === 'string' && 
          statusData.output.trim() !== '' &&
          statusData.output !== 'completed' &&
          (statusData.output.startsWith('http://') || statusData.output.startsWith('https://'));
        
        if (!isValidVideoUrl) {
          console.error(`Invalid video URL for ${predictionId}: "${statusData.output}". Skipping download.`);
          // Don't attempt to download with invalid URL - leave video in processing status
          res.json(statusData);
          return;
        }
        
        try {
          // First get the video record to get the ID
          const video = await dbStorage.getVideoByReplicateId(predictionId);
          if (video && video.status !== "completed") {
            console.log(`Video generation completed for ${predictionId} (video ID: ${video.id}), downloading and storing locally...`);
            
            // Download and store the video locally
            const { videoUrl: localVideoUrl, thumbnailUrl, width, height } = await downloadAndStoreVideo(statusData.output, video.id);
            
            // For WAN models, ensure frameRate is set to 16 FPS
            const updateData: any = {
              url: localVideoUrl,
              status: "completed",
              thumbnailUrl: thumbnailUrl // Use generated thumbnail
            };
            
            // Update with actual video dimensions if extracted
            if (width && height) {
              updateData.width = width;
              updateData.height = height;
              console.log(`Updating video ${video.id} with actual dimensions: ${width}x${height} (was: ${video.width}x${video.height})`);
            }
            
            // Set frame rate to 16 for WAN models
            if (video.model && video.model.startsWith('wan-2.2')) {
              updateData.frameRate = 16;
            }
            
            // Update the database with the local URL and metadata
            const updatedVideo = await dbStorage.updateVideoByReplicateId(predictionId, updateData);
            console.log(`Successfully updated video ${video.id} with replicateId ${predictionId} - Status: completed, Local URL: ${localVideoUrl}`);
          } else if (video && video.status === "completed") {
            console.log(`Video ${predictionId} already marked as completed in database`);
          } else {
            console.error(`Video not found in database for replicateId ${predictionId}`);
          }
        } catch (error) {
          console.error(`Failed to download and store video ${predictionId}:`, error);
          // Fall back to using the original URL if download fails
          try {
            const video = await dbStorage.getVideoByReplicateId(predictionId);
            const updateData: any = {
              url: statusData.output,
              status: "completed",
              thumbnailUrl: statusData.output
            };
            
            // Set frame rate to 16 for WAN models
            if (video && video.model && video.model.startsWith('wan-2.2')) {
              updateData.frameRate = 16;
            }
            
            const updatedVideo = await dbStorage.updateVideoByReplicateId(predictionId, updateData);
            console.log(`Fallback: Updated video with replicateId ${predictionId} - Original URL: ${statusData.output}`);
          } catch (fallbackError) {
            console.error(`Failed to update video ${predictionId} with fallback URL:`, fallbackError);
          }
        }
      } else if (statusData.status === "failed") {
        console.log(`Video ${predictionId} failed: ${statusData.error || 'Unknown error'}`);
        try {
          const video = await dbStorage.getVideoByReplicateId(predictionId);
          if (video && video.status !== "failed") {
            await dbStorage.updateVideoByReplicateId(predictionId, {
              status: "failed"
            });
            
            // Refund credits for failed video
            const refunded = await dbStorage.refundCreditsForFailedVideo(video.id);
            if (refunded) {
              console.log(`Successfully refunded credits for failed video ${video.id} (predictionId: ${predictionId})`);
            } else {
              console.log(`No credits to refund for failed video ${video.id} (predictionId: ${predictionId})`);
            }
            
            console.log(`Updated video ${video.id} status to failed for replicateId ${predictionId}`);
          }
        } catch (error) {
          console.error(`Failed to update failed status for video ${predictionId}:`, error);
        }
      } else if (statusData.status === "processing") {
        console.log(`Video ${predictionId} is processing (${statusData.progress}%)`);
      }

      res.json(statusData);
    } catch (error) {
      console.error("Error checking video status:", error);
      res.status(500).json({ message: "Failed to check video status" });
    }
  });

  // Repair all videos - check and update status for all pending videos
  app.post("/api/videos/repair", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.claims.sub;
      
      // Get all videos that are still pending but might be completed
      const userVideos = await dbStorage.getUserVideos(userId);
      const pendingVideos = userVideos.filter(v => v.status === "pending" && v.replicateId);
      
      console.log(`Found ${pendingVideos.length} pending videos to check for user ${userId}`);
      
      const repairs = [];
      
      for (const video of pendingVideos) {
        try {
          console.log(`Checking status for video ${video.id} with replicateId ${video.replicateId}`);
          const status = await getVideoPredictionStatus(video.replicateId!);
          
          if (status.status === "succeeded" && status.output) {
            console.log(`Video ${video.id} is completed, updating...`);
            
            // Try to download and store locally
            try {
              const { videoUrl, thumbnailUrl, width, height } = await downloadAndStoreVideo(status.output, video.id);
              const updateData: any = {
                url: videoUrl,
                status: "completed",
                thumbnailUrl: thumbnailUrl
              };
              
              // Update with actual video dimensions if extracted
              if (width && height) {
                updateData.width = width;
                updateData.height = height;
                console.log(`Repair: Updating video ${video.id} with actual dimensions: ${width}x${height}`);
              }
              
              const updatedVideo = await dbStorage.updateVideoByReplicateId(video.replicateId!, updateData);
              repairs.push({ videoId: video.id, status: "completed", url: videoUrl });
              console.log(`Successfully repaired video ${video.id} with local storage`);
            } catch (downloadError) {
              console.error(`Failed to download video ${video.id}, using original URL:`, downloadError);
              // Fallback to original URL
              const updatedVideo = await dbStorage.updateVideoByReplicateId(video.replicateId!, {
                url: status.output,
                status: "completed",
                thumbnailUrl: status.output
              });
              repairs.push({ videoId: video.id, status: "completed", url: status.output });
              console.log(`Repaired video ${video.id} with original URL`);
            }
          } else if (status.status === "failed") {
            console.log(`Video ${video.id} failed, updating status and refunding credits...`);
            await dbStorage.updateVideoByReplicateId(video.replicateId!, { status: "failed" });
            
            // Refund credits for failed video
            const refunded = await dbStorage.refundCreditsForFailedVideo(video.id);
            if (refunded) {
              console.log(`Successfully refunded credits for failed video ${video.id}`);
            }
            
            repairs.push({ videoId: video.id, status: "failed", refunded });
          } else {
            console.log(`Video ${video.id} still processing: ${status.status}`);
          }
        } catch (error) {
          console.error(`Error checking video ${video.id}:`, error);
        }
      }
      
      res.json({ 
        message: `Checked ${pendingVideos.length} videos, repaired ${repairs.length}`,
        repairs 
      });
    } catch (error) {
      console.error("Error repairing videos:", error);
      res.status(500).json({ message: "Failed to repair videos" });
    }
  });

  // Update video status and URL (internal use - requires authentication)
  app.patch("/api/videos/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, url, thumbnailUrl } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      if (url && status === "completed") {
        try {
          // If the URL is from Replicate (external), download and store locally
          if (url.includes('replicate.delivery') || url.includes('replicate.com') || url.startsWith('https://')) {
            console.log(`Downloading and storing video ${id} locally from: ${url}`);
            const { videoUrl: localVideoUrl, thumbnailUrl, width, height } = await downloadAndStoreVideo(url, id);
            
            // Update video URL - dimensions will be handled via updateVideoUrl method if needed
            await dbStorage.updateVideoUrl(id, localVideoUrl, thumbnailUrl);
            console.log(`Video ${id} stored locally at: ${localVideoUrl}`);
          } else {
            // URL is already local, just update it
            await dbStorage.updateVideoUrl(id, url, thumbnailUrl);
          }
        } catch (error) {
          console.error(`Failed to download video ${id}, using original URL:`, error);
          // Fallback to original URL if download fails
          await dbStorage.updateVideoUrl(id, url, thumbnailUrl);
        }
      } else if (url) {
        // For non-completed status, just update the URL
        await dbStorage.updateVideoUrl(id, url, thumbnailUrl);
      }
      
      const video = await dbStorage.updateVideoStatus(id, status);
      console.log(`Video ${id} status updated to: ${status}${url ? ` with URL: ${url}` : ''}`);
      res.json(video);
    } catch (error) {
      console.error("Error updating video status:", error);
      res.status(500).json({ message: "Failed to update video status" });
    }
  });

  // Update video visibility (requires authentication)
  app.patch("/api/videos/:id/visibility", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isPublic } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const userId = req.user.claims.sub;
      
      // Server-side enforcement: Check if user can make content private
      if (isPublic === false) {
        const entitlements = await creditService.getUserEntitlements(userId);
        if (!entitlements.featureFlags.can_make_private) {
          console.log(`[FeatureGating] User ${userId} cannot make content private - forcing public`);
          return res.status(403).json({ 
            message: "Your current plan does not allow private content. Please upgrade to make items private.",
            errorCode: "FEATURE_NOT_AVAILABLE",
            feature: "can_make_private"
          });
        }
      }
      
      const video = await dbStorage.updateVideoVisibility(id, isPublic, userId);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found or unauthorized" });
      }

      res.json(video);
    } catch (error) {
      console.error("Error updating video visibility:", error);
      res.status(500).json({ message: "Failed to update video visibility" });
    }
  });

  // Delete video (requires authentication)
  app.delete("/api/videos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const userId = req.user.claims.sub;
      
      // Get video details before deletion to clean up local file
      const video = await dbStorage.getVideo(id);
      if (!video || video.ownerId !== userId) {
        return res.status(404).json({ message: "Video not found or unauthorized" });
      }

      // Delete the video record from database
      const success = await dbStorage.deleteVideo(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Video not found or unauthorized" });
      }

      // Clean up local video file if it exists
      if (video.url && video.url.startsWith('/videos/')) {
        try {
          await deleteVideo(video.url);
          console.log(`Local video file deleted: ${video.url}`);
        } catch (error) {
          console.error(`Failed to delete local video file ${video.url}:`, error);
          // Don't fail the request if file cleanup fails
        }
      }

      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Repair expired images - download and store locally (admin only)
  app.post("/api/images/repair", isAdmin, async (req, res) => {
    try {
      const images = await dbStorage.getPublicImages();
      let repaired = 0;
      let failed = 0;

      for (const image of images) {
        // Skip already locally stored images
        if (image.url.startsWith('/images/')) {
          continue;
        }

        // Try to access the external URL
        try {
          const response = await fetch(image.url, { method: 'HEAD' });
          if (response.ok) {
            // URL is still valid, download and store it locally
            try {
              const storageResult = await downloadAndStoreImage(image.url, image.id);
              await dbStorage.updateImageUrl(image.id, storageResult.imageUrl, storageResult.thumbnailUrl);
              repaired++;
            } catch (downloadError) {
              console.error(`Failed to download image ${image.id}:`, downloadError);
              failed++;
            }
          } else {
            failed++;
          }
        } catch (fetchError) {
          failed++;
        }
      }

      res.json({ 
        message: `Repair completed: ${repaired} images stored locally, ${failed} images unavailable`,
        repaired,
        failed 
      });
    } catch (error) {
      console.error("Error repairing images:", error);
      res.status(500).json({ message: "Failed to repair images" });
    }
  });

  // Generate thumbnails for existing images that don't have them (admin only)
  app.post("/api/images/generate-thumbnails", isAdmin, async (req, res) => {
    try {
      const { generateImageThumbnail } = await import('./image-thumbnail-generator');
      const images = await dbStorage.getPublicImages();
      const userImages = req.body.userId ? await dbStorage.getUserImages(req.body.userId) : [];
      const allImages = [...images, ...userImages];
      
      let generated = 0;
      let skipped = 0;
      let failed = 0;

      for (const image of allImages) {
        // Skip images that already have thumbnails
        if (image.thumbnailUrl) {
          skipped++;
          continue;
        }

        // Only process locally stored images (object storage or local path)
        if (!image.url.startsWith('/images/') && !image.url.startsWith('/objects/')) {
          console.log(`Skipping image ${image.id}: not locally stored (${image.url})`);
          skipped++;
          continue;
        }

        try {
          console.log(`Generating thumbnail for image ${image.id} from ${image.url}`);
          // Pass the URL directly - the thumbnail generator handles both /objects/ and /images/ paths
          const thumbnailUrl = await generateImageThumbnail(image.url, image.id);
          
          if (thumbnailUrl) {
            await dbStorage.updateImageUrl(image.id, image.url, thumbnailUrl);
            generated++;
            console.log(`Generated thumbnail for image ${image.id}: ${thumbnailUrl}`);
          } else {
            failed++;
            console.log(`Failed to generate thumbnail for image ${image.id}`);
          }
        } catch (error) {
          console.error(`Error generating thumbnail for image ${image.id}:`, error);
          failed++;
        }
      }

      res.json({ 
        message: `Thumbnail generation completed: ${generated} generated, ${skipped} skipped, ${failed} failed`,
        generated,
        skipped,
        failed 
      });
    } catch (error) {
      console.error("Error generating thumbnails:", error);
      res.status(500).json({ message: "Failed to generate thumbnails" });
    }
  });

  // Repair expired videos - download and store locally (admin only)
  app.post("/api/videos/repair", isAdmin, async (req, res) => {
    try {
      const videos = await dbStorage.getPublicVideos();
      let repaired = 0;
      let failed = 0;

      for (const video of videos) {
        // Skip already locally stored videos
        if (video.url.startsWith('/videos/')) {
          continue;
        }

        // Try to access the external URL
        try {
          const response = await fetch(video.url, { method: 'HEAD' });
          if (response.ok) {
            // URL is still valid, download and store it locally
            try {
              const { videoUrl: localUrl, thumbnailUrl } = await downloadAndStoreVideo(video.url, video.id);
              await dbStorage.updateVideoUrl(video.id, localUrl, thumbnailUrl);
              repaired++;
            } catch (downloadError) {
              console.error(`Failed to download video ${video.id}:`, downloadError);
              failed++;
            }
          } else {
            failed++;
          }
        } catch (fetchError) {
          failed++;
        }
      }

      res.json({ 
        message: `Repair completed: ${repaired} videos stored locally, ${failed} videos unavailable`,
        repaired,
        failed 
      });
    } catch (error) {
      console.error("Error repairing videos:", error);
      res.status(500).json({ message: "Failed to repair videos" });
    }
  });

  // Video upload endpoint for motion control reference videos
  app.post("/api/upload-video", isAuthenticated, uploadRateLimit, async (req: any, res) => {
    try {
      const { videoUpload, uploadVideoToStorage } = await import('./video-upload');
      
      videoUpload.single('video')(req, res, async (err: any) => {
        if (err) {
          console.error('Video upload error:', err);
          return res.status(400).json({ message: err.message || 'Failed to upload video' });
        }
        
        if (!req.file) {
          return res.status(400).json({ message: 'No video file provided' });
        }
        
        try {
          const storagePath = await uploadVideoToStorage(req.file.buffer, req.file.mimetype);
          const protocol = req.protocol;
          const host = req.get('host');
          const fullUrl = `${protocol}://${host}${storagePath}`;
          
          console.log(`Uploaded motion video: ${fullUrl}`);
          
          res.json({ url: fullUrl, path: storagePath });
        } catch (uploadError) {
          console.error('Error uploading video to storage:', uploadError);
          res.status(500).json({ message: 'Failed to store video' });
        }
      });
    } catch (error) {
      console.error('Error in video upload endpoint:', error);
      res.status(500).json({ message: 'Failed to process video upload' });
    }
  });

  // Audio file upload endpoint for WAN 2.6 background audio
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max for audio files
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only WAV and MP3 audio files are allowed'));
      }
    }
  });

  app.post("/api/video/upload-audio", isAuthenticated, uploadRateLimit, audioUpload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file provided' });
      }

      // Upload audio to fal.ai storage for direct access during video generation
      const fal = (await import('@fal-ai/client')).fal;
      const audioUrl = await fal.storage.upload(new Blob([req.file.buffer], { type: req.file.mimetype }));
      
      console.log(`Uploaded audio file to fal storage: ${audioUrl}`);
      res.json({ audioUrl });
    } catch (error) {
      console.error('Error in audio upload endpoint:', error);
      res.status(500).json({ message: 'Failed to upload audio file' });
    }
  });

  // Motion reference video upload endpoint (for Kling 2.6 Motion Control)
  app.post("/api/upload-motion-reference", isAuthenticated, uploadRateLimit, videoUpload.single('motionReference'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      // Validate file size (100MB limit for videos)
      const maxFileSize = 100 * 1024 * 1024;
      if (req.file.size > maxFileSize) {
        return res.status(400).json({ 
          error: `Video file exceeds maximum size of 100MB`,
          fileSize: req.file.size,
          maxSize: maxFileSize
        });
      }

      // Upload to fal storage for the motion control model
      const videoUrl = await fal.storage.upload(new Blob([req.file.buffer], { type: req.file.mimetype }));
      
      console.log(`Uploaded motion reference video to fal storage: ${videoUrl}`);
      res.json({ url: videoUrl });
    } catch (error) {
      console.error('Error in motion reference upload endpoint:', error);
      res.status(500).json({ error: 'Failed to upload motion reference video' });
    }
  });

  // Style image upload endpoint (supports multiple files)
  // Images are uploaded to permanent object storage for persistence across deployments
  app.post("/api/upload-style-image", isAuthenticated, uploadRateLimit, styleImageUpload.array('styleImages', 10), async (req: any, res) => {
    try {
      // Robust server-side validation
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No image files provided" });
      }

      // Explicit validation for max 10 files (defense in depth)
      if (req.files.length > 10) {
        return res.status(400).json({ 
          message: "Too many files uploaded. Maximum 10 files allowed per request.",
          uploaded: req.files.length,
          maximum: 10
        });
      }

      // Validate each file size and type
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      for (const file of req.files) {
        if (file.size > maxFileSize) {
          return res.status(400).json({ 
            message: `File "${file.originalname}" exceeds maximum size of 10MB`,
            fileSize: file.size,
            maxSize: maxFileSize
          });
        }
        
        // Additional security check - ensure no SVG files slipped through
        if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
          return res.status(400).json({ 
            message: `File "${file.originalname}" is an SVG file, which is not allowed for security reasons`
          });
        }
      }

      // Upload each file to permanent object storage
      const { uploadStyleImageToStorage, buildStyleImageFullUrl } = await import('./upload-handler');
      
      const uploadedImages = await Promise.all(
        req.files.map(async (file: Express.Multer.File & { buffer: Buffer }) => {
          // Upload to object storage and get permanent path like /objects/style-images/uuid.png
          const objectPath = await uploadStyleImageToStorage(file.buffer, file.mimetype);
          
          // Build full URL for immediate use with fal.ai API
          const fullUrl = buildStyleImageFullUrl(objectPath, req);
          
          return {
            url: fullUrl,
            objectPath: objectPath, // Store the permanent path for database storage
            size: file.size,
            mimetype: file.mimetype
          };
        })
      );
      
      console.log(`Successfully uploaded ${uploadedImages.length} style images to object storage for user ${req.user.claims.sub}`);
      
      res.json({ 
        images: uploadedImages,
        count: uploadedImages.length,
        message: `Successfully uploaded ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error("Error uploading style images:", error);
      
      // Handle multer-specific errors
      if (error instanceof Error) {
        if (error.message.includes('File too large')) {
          return res.status(400).json({ 
            message: "File too large. Maximum size is 10MB per file." 
          });
        }
        if (error.message.includes('Too many files')) {
          return res.status(400).json({ 
            message: "Too many files uploaded. Maximum 10 files allowed per request." 
          });
        }
        if (error.message.includes('SVG files are not allowed')) {
          return res.status(400).json({ 
            message: error.message 
          });
        }
      }
      
      res.status(500).json({ message: "Failed to upload style images" });
    }
  });

  // ========== ADMIN ROUTES ==========
  
  // Admin stats dashboard
  app.get("/api/admin/stats", isAdmin, async (req: any, res) => {
    try {
      const stats = await dbStorage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin moderation logs
  app.get("/api/admin/moderation-logs", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const verdict = req.query.verdict as string | undefined;
      const userId = req.query.userId as string | undefined;
      
      const filters = { verdict, userId, limit, offset };
      
      const [logs, totalCount] = await Promise.all([
        dbStorage.getModerationLogs(filters),
        dbStorage.getModerationLogsCount({ verdict, userId })
      ]);
      
      res.json({ logs, total: totalCount, limit, offset });
    } catch (error) {
      console.error("Error fetching moderation logs:", error);
      res.status(500).json({ message: "Failed to fetch moderation logs" });
    }
  });

  // Get single moderation log
  app.get("/api/admin/moderation-logs/:id", isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const log = await dbStorage.getModerationLog(id);
      
      if (!log) {
        return res.status(404).json({ message: "Moderation log not found" });
      }
      
      res.json(log);
    } catch (error) {
      console.error("Error fetching moderation log:", error);
      res.status(500).json({ message: "Failed to fetch moderation log" });
    }
  });

  // Get moderation status (whether it's enabled)
  app.get("/api/admin/moderation-status", isAdmin, async (req: any, res) => {
    try {
      const { isModerationEnabled } = await import('./prompt-moderation');
      res.json({ enabled: isModerationEnabled() });
    } catch (error) {
      console.error("Error fetching moderation status:", error);
      res.status(500).json({ message: "Failed to fetch moderation status" });
    }
  });

  // Get moderation system prompt
  app.get("/api/admin/moderation-prompt", isAdmin, async (req: any, res) => {
    try {
      const { getModerationSystemPrompt, DEFAULT_MODERATION_SYSTEM_PROMPT } = await import('./prompt-moderation');
      const currentPrompt = getModerationSystemPrompt();
      const isUsingDefault = currentPrompt === DEFAULT_MODERATION_SYSTEM_PROMPT;
      
      res.json({ 
        prompt: currentPrompt,
        defaultPrompt: DEFAULT_MODERATION_SYSTEM_PROMPT,
        isUsingDefault
      });
    } catch (error) {
      console.error("Error fetching moderation prompt:", error);
      res.status(500).json({ message: "Failed to fetch moderation prompt" });
    }
  });

  // Update moderation system prompt
  app.put("/api/admin/moderation-prompt", isAdmin, async (req: any, res) => {
    try {
      const { prompt } = req.body;
      const adminId = req.adminUser.id;
      
      if (typeof prompt !== "string") {
        return res.status(400).json({ message: "Prompt must be a string" });
      }
      
      // Store in site settings
      await dbStorage.setSiteSetting({
        key: "moderation_system_prompt",
        value: prompt.trim(),
        category: "moderation",
        description: "Custom system prompt for AI content moderation",
        updatedBy: adminId,
      });
      
      // Update the cache
      updateConfigCache("moderation_system_prompt", prompt.trim());
      
      // Log the action
      await dbStorage.createAdminLog({
        adminId,
        action: "update_moderation_prompt",
        targetType: "site_settings",
        targetId: "moderation_system_prompt",
        details: { promptLength: prompt.trim().length }
      });
      
      res.json({ success: true, message: "Moderation prompt updated" });
    } catch (error) {
      console.error("Error updating moderation prompt:", error);
      res.status(500).json({ message: "Failed to update moderation prompt" });
    }
  });

  // Reset moderation prompt to default
  app.delete("/api/admin/moderation-prompt", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminUser.id;
      
      // Clear the custom prompt from site settings
      await dbStorage.setSiteSetting({
        key: "moderation_system_prompt",
        value: "",
        category: "moderation",
        description: "Custom system prompt for AI content moderation",
        updatedBy: adminId,
      });
      
      // Update the cache to clear custom prompt
      updateConfigCache("moderation_system_prompt", "");
      
      // Log the action
      await dbStorage.createAdminLog({
        adminId,
        action: "reset_moderation_prompt",
        targetType: "site_settings",
        targetId: "moderation_system_prompt",
        details: { reset: true }
      });
      
      const { DEFAULT_MODERATION_SYSTEM_PROMPT } = await import('./prompt-moderation');
      res.json({ success: true, message: "Moderation prompt reset to default", defaultPrompt: DEFAULT_MODERATION_SYSTEM_PROMPT });
    } catch (error) {
      console.error("Error resetting moderation prompt:", error);
      res.status(500).json({ message: "Failed to reset moderation prompt" });
    }
  });

  // Admin users management
  app.get("/api/admin/users", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const [users, totalCount] = await Promise.all([
        dbStorage.getAllUsers(limit, offset),
        dbStorage.getUsersCount()
      ]);
      
      res.json({ users, total: totalCount, limit, offset });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin update user role
  app.patch("/api/admin/users/:id/role", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;
      const adminId = req.adminUser.id;
      
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      const updatedUser = await dbStorage.updateUserRole(userId, role, adminId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Admin suspend/reactivate user
  app.patch("/api/admin/users/:id/status", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { isActive } = req.body;
      const adminId = req.adminUser.id;
      
      const updatedUser = await dbStorage.updateUserActiveStatus(userId, isActive, adminId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Admin delete user
  app.delete("/api/admin/users/:id", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.adminUser.id;
      
      const success = await dbStorage.adminDeleteUser(userId, adminId);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin reset user cache and session
  app.post("/api/admin/users/:id/reset-cache", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.adminUser.id;
      
      // Check if user exists
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Clear user sessions from database using parameterized SQL
      let sessionsCleared = 0;
      try {
        // Build the pattern for matching user sessions (parameterized to prevent SQL injection)
        const pattern = `%"sub":"${userId}"%`;
        
        // First, get all sessions containing this user ID to count them
        const sessionCheckQuery = `
          SELECT sid FROM sessions 
          WHERE sess::text LIKE $1
        `;
        const sessionRows = await dbStorage.rawQuery(sessionCheckQuery, [pattern]);
        sessionsCleared = sessionRows.length;
        
        // Delete all sessions for this user
        const deleteQuery = `
          DELETE FROM sessions 
          WHERE sess::text LIKE $1
        `;
        await dbStorage.rawQuery(deleteQuery, [pattern]);
        
        console.log(`Cleared ${sessionsCleared} sessions for user ${userId} (${user.email})`);
      } catch (sessionError) {
        console.error("Error clearing user sessions:", sessionError);
        // Continue with cache reset even if session clearing fails
      }
      
      // Log the admin action
      await dbStorage.createAdminLog({
        adminId,
        action: "reset_user_cache",
        targetType: "user",
        targetId: userId,
        details: { 
          userEmail: user.email,
          resetType: "cache_and_session",
          sessionsCleared,
          reason: "Admin requested cache and session reset to fix user display problems"
        }
      });
      
      res.json({ 
        message: `User cache and sessions have been reset successfully. Cleared ${sessionsCleared} active sessions.`,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        actions: {
          sessionsCleared,
          cacheReset: true
        }
      });
    } catch (error) {
      console.error("Error resetting user cache:", error);
      res.status(500).json({ message: "Failed to reset user cache and session" });
    }
  });

  // Admin get user's images
  app.get("/api/admin/users/:id/images", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const images = await dbStorage.getImagesByOwner(userId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching user images:", error);
      res.status(500).json({ message: "Failed to fetch user images" });
    }
  });

  // Admin images management
  app.get("/api/admin/images", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';
      
      const [images, totalCount] = await Promise.all([
        dbStorage.getAllImages(limit, offset, search),
        dbStorage.getImagesCount(search)
      ]);
      
      res.json({ images, total: totalCount, limit, offset });
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Admin delete image
  app.delete("/api/admin/images/:id", isAdmin, async (req: any, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const adminId = req.adminUser.id;
      
      if (isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }
      
      const success = await dbStorage.adminDeleteImage(imageId, adminId);
      if (!success) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  // Admin toggle image visibility
  app.patch("/api/admin/images/:id/visibility", isAdmin, async (req: any, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const { isPublic } = req.body;
      const adminId = req.adminUser.id;
      
      if (isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }
      
      const updatedImage = await dbStorage.adminUpdateImageVisibility(imageId, isPublic, adminId);
      if (!updatedImage) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json(updatedImage);
    } catch (error) {
      console.error("Error updating image visibility:", error);
      res.status(500).json({ message: "Failed to update image visibility" });
    }
  });

  // Admin transfer image ownership
  app.patch("/api/admin/images/:id/transfer", isAdmin, async (req: any, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const { newOwnerId } = req.body;
      const adminId = req.adminUser.id;
      
      if (isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }
      
      const updatedImage = await dbStorage.transferImageOwnership(imageId, newOwnerId, adminId);
      if (!updatedImage) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json(updatedImage);
    } catch (error) {
      console.error("Error transferring image ownership:", error);
      res.status(500).json({ message: "Failed to transfer image ownership" });
    }
  });

  // Admin videos management
  app.get("/api/admin/videos", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';
      
      const [videos, totalCount] = await Promise.all([
        dbStorage.getAllVideos(limit, offset, search),
        dbStorage.getVideosCount(search)
      ]);
      
      res.json({ videos, total: totalCount, limit, offset });
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Admin delete video
  app.delete("/api/admin/videos/:id", isAdmin, async (req: any, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const adminId = req.adminUser.id;
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }
      
      const success = await dbStorage.adminDeleteVideo(videoId, adminId);
      if (!success) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Admin toggle video visibility
  app.patch("/api/admin/videos/:id/visibility", isAdmin, async (req: any, res) => {
    try {
      const videoId = parseInt(req.params.id);
      const { isPublic } = req.body;
      const adminId = req.adminUser.id;
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }
      
      const updatedVideo = await dbStorage.adminUpdateVideoVisibility(videoId, isPublic, adminId);
      if (!updatedVideo) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json(updatedVideo);
    } catch (error) {
      console.error("Error updating video visibility:", error);
      res.status(500).json({ message: "Failed to update video visibility" });
    }
  });

  // Admin logs
  app.get("/api/admin/logs", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const logs = await dbStorage.getAdminLogs(limit, offset);
      res.json({ logs, limit, offset });
    } catch (error) {
      console.error("Error fetching admin logs:", error);
      res.status(500).json({ message: "Failed to fetch admin logs" });
    }
  });

  // ========== SITE SETTINGS ROUTES ==========

  // Get all site settings
  app.get("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminUser.id;
      await ensureDefaultSettings(adminId);
      const settings = await dbStorage.getSiteSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  // Get current site configuration (public endpoint - sanitized)
  app.get("/api/config", async (req, res) => {
    try {
      // Always include defaults so the frontend has stable values even if DB is unavailable.
      const config = { ...DEFAULT_CONFIG, ...getAllConfig() };
      const sanitized = sanitizeConfig(config);
      // Disable caching to ensure immediate updates when admin changes settings
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching site config:", error);
      res.json(sanitizeConfig(DEFAULT_CONFIG));
    }
  });

  // Get dynamic theme CSS (public endpoint)
  app.get("/api/theme.css", async (req, res) => {
    try {
      const css = generateThemeCSS();
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
      res.send(css);
    } catch (error) {
      console.error("Error generating theme CSS:", error);
      res.status(500).send('/* Error generating theme CSS */');
    }
  });

  // Get all available models for admin configuration
  app.get("/api/admin/models", isAdmin, async (req: any, res) => {
    try {
      // Map image models
      const imageModels = AI_MODELS.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        category: model.category,
        description: model.description,
        type: "image" as const,
        showKey: `show_${model.id.replace(/[-\.]/g, '_')}`,
        displayNameKey: `${model.id.replace(/[-\.]/g, '_')}_display_name`,
        isVisible: getConfig(`show_${model.id.replace(/[-\.]/g, '_')}`, true),
        displayName: getConfig(`${model.id.replace(/[-\.]/g, '_')}_display_name`, model.name)
      }));

      // Map video models
      const videoModels = VIDEO_MODELS.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        category: model.category,
        description: model.description,
        type: "video" as const,
        showKey: `show_${model.id.replace(/[-\.]/g, '_')}`,
        displayNameKey: `${model.id.replace(/[-\.]/g, '_')}_display_name`,
        isVisible: getConfig(`show_${model.id.replace(/[-\.]/g, '_')}`, true),
        displayName: getConfig(`${model.id.replace(/[-\.]/g, '_')}_display_name`, model.name)
      }));

      // Combine both image and video models
      const allModels = [...imageModels, ...videoModels];
      res.json(allModels);
    } catch (error) {
      console.error("Error fetching admin models:", error);
      res.status(500).json({ message: "Failed to fetch admin models" });
    }
  });

  // Get site settings by category
  app.get("/api/admin/settings/:category", isAdmin, async (req: any, res) => {
    try {
      const category = req.params.category;
      const settings = await dbStorage.getSiteSettingsByCategory(category);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching site settings by category:", error);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  // Get provider health status and API key availability  
  app.get("/api/admin/providers/health", isAdmin, async (req: any, res) => {
    try {
      const apiKeysStatus = hasRequiredApiKeys();
      const healthStatus = getProviderHealthStatus();
      
      res.json({
        apiKeys: apiKeysStatus,
        health: healthStatus,
        providers: {
          openai: {
            configured: apiKeysStatus.openai,
            status: healthStatus.openai,
            name: "OpenAI"
          },
          replicate: {
            configured: apiKeysStatus.replicate,
            status: healthStatus.replicate,
            name: "Replicate"
          },
          fal: {
            configured: apiKeysStatus.fal,
            status: healthStatus.fal,
            name: "fal.ai"
          }
        }
      });
    } catch (error) {
      console.error("Error getting provider health:", error);
      res.status(500).json({ message: "Failed to get provider health status" });
    }
  });

  // Test provider connection
  app.post("/api/admin/providers/test", isAdmin, async (req: any, res) => {
    try {
      const { provider } = req.body;
      
      if (!provider || !['openai', 'replicate', 'fal'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider specified" });
      }

      const result = await testProviderConnection(provider);
      res.json({
        provider,
        ...result
      });
    } catch (error) {
      console.error("Error testing provider connection:", error);
      res.status(500).json({ message: "Failed to test provider connection" });
    }
  });

  // Update or create site setting
  app.post("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      const { key, value, category, description } = req.body;
      const adminId = req.adminUser.id;

      if (!key || value === undefined || !category) {
        return res.status(400).json({ message: "Key, value, and category are required" });
      }

      const setting = await dbStorage.setSiteSetting({
        key,
        value,
        category,
        description,
        updatedBy: adminId,
      });

      // Update cache immediately
      updateConfigCache(key, value);

      res.json(setting);
    } catch (error) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  // Update specific site setting
  app.patch("/api/admin/settings/:key", isAdmin, async (req: any, res) => {
    try {
      const key = req.params.key;
      const { value } = req.body;
      const adminId = req.adminUser.id;

      if (value === undefined) {
        return res.status(400).json({ message: "Value is required" });
      }

      const setting = await dbStorage.updateSiteSetting(key, value, adminId);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      // Update cache immediately
      updateConfigCache(key, value);

      res.json(setting);
    } catch (error) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  // Upload logo or favicon
  app.post("/api/admin/upload/:type", isAdmin, upload.single('file'), async (req: any, res) => {
    try {
      const { type } = req.params; // 'logo', 'favicon', or 'model-icon'
      const adminId = req.adminUser.id;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Upload to object storage
      const objectStorage = createStorageService();
      let folder: string;
      let settingKey: string;
      let category: string;
      let description: string;

      if (type === 'logo') {
        folder = 'branding/logos';
        settingKey = 'site_logo';
        category = 'branding';
        description = 'Website logo URL';
      } else if (type === 'favicon') {
        folder = 'branding/favicons';
        settingKey = 'favicon_url';
        category = 'branding';
        description = 'Favicon URL';
      } else if (type.startsWith('model-icon-')) {
        // model-icon-{iconKey} format, e.g., model-icon-image_family_icon_flux
        const iconKey = type.replace('model-icon-', '');
        folder = 'branding/model-icons';
        settingKey = iconKey;
        category = 'model_groups';
        description = `Model group icon: ${iconKey}`;
      } else if (type.startsWith('service-card-')) {
        // service-card-{settingKey} format, e.g., service-card-service_card_image_alfia_saudi
        const cardKey = type.replace('service-card-', '');
        folder = 'branding/service-cards';
        settingKey = cardKey;
        category = 'service_cards';
        description = `Service card image: ${cardKey}`;
      } else {
        return res.status(400).json({ message: "Invalid upload type" });
      }

      const fileUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        folder
      );
      
      // Save to database
      const setting = await dbStorage.setSiteSetting({
        key: settingKey,
        value: fileUrl,
        category,
        description,
        updatedBy: adminId,
      });

      // Update cache immediately
      updateConfigCache(settingKey, fileUrl);

      res.json({
        url: fileUrl,
        setting
      });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: error.message || "Failed to upload file" });
    }
  });

  // Delete site setting
  app.delete("/api/admin/settings/:key", isAdmin, async (req: any, res) => {
    try {
      const key = req.params.key;
      const adminId = req.adminUser.id;

      const success = await dbStorage.deleteSiteSetting(key, adminId);
      if (!success) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting site setting:", error);
      res.status(500).json({ message: "Failed to delete site setting" });
    }
  });

  // ========== CREDITS & PRICING ROUTES ==========

  // Get user's credit balance
  app.get("/api/credits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credits = await creditService.getUserCreditsInfo(userId);
      
      if (!credits) {
        // This should not happen as credits are initialized on signup
        return res.status(404).json({ message: "Credits not found" });
      }
      
      // No caching - always return fresh credit balance for instant updates after generation
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json(credits);
    } catch (error) {
      console.error("Error fetching user credits:", error);
      res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  // Admin: Get any user's credit balance by userId
  app.get("/api/admin/credits/:userId", isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const credits = await creditService.getUserCreditsInfo(userId);
      
      if (!credits) {
        return res.status(404).json({ message: "Credits not found for user" });
      }
      
      res.json(credits);
    } catch (error) {
      console.error("Error fetching user credits for admin:", error);
      res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  // Calculate generation cost
  app.post("/api/pricing/estimate", async (req, res) => {
    try {
      const { 
        model, 
        enhancePrompt, 
        imageCount, 
        aspectRatio, 
        quality, 
        styleImageUrl, 
        styleImageUrls,
        duration, 
        resolution,
        audioEnabled,
        imageSize,
        mode,
        hasImageInput,
        startFrameImage,
      } = req.body;
      
      if (!model) {
        return res.status(400).json({ message: "Model is required" });
      }
      
      // Determine category based on model type
      const isVideoModel = model.includes('wan-') || model.includes('veo') || model.includes('sora') || model.includes('luma') || model.includes('kling') || model.includes('grok-imagine');
      const isTextModel = model.includes('gpt-');
      const category = isVideoModel ? 'video' : (isTextModel ? 'text' : 'image');
      
      // Normalize model ID (base model or variant ID) to consistent variant resolution
      // This ensures both base model IDs and legacy variant IDs are handled consistently
      let resolvedModelId = model;
      let resolutionError: string | null = null;
      try {
        const { normalizeModelRequest } = await import("@shared/model-routing");
        const hasInput = Boolean(hasImageInput || styleImageUrl || styleImageUrls?.length || startFrameImage);
        const mediaType = category === 'video' ? 'video' : 'image';
        
        const normalized = normalizeModelRequest(model, mediaType as any, hasInput, mode as any);
        
        if (normalized) {
          if (normalized.error) {
            // Model requires image input but none provided - return error
            resolutionError = normalized.fallbackMessage || `${normalized.baseModel.displayName} requires an image input to work.`;
            console.log(`[Pricing] Error resolving model "${model}": ${resolutionError}`);
          } else if (normalized.resolvedVariant) {
            resolvedModelId = normalized.resolvedVariant.id;
            const sourceType = normalized.wasVariantId ? 'variant ID' : 'base model';
            console.log(`[Pricing] Normalized ${sourceType} "${model}" to variant "${resolvedModelId}" (hasImage: ${hasInput}, mode: ${mode || 'default'})`);
          }
        } else {
          // Model not found in our catalog - use as-is for backward compatibility
          console.log(`[Pricing] Model "${model}" not found in catalog, using as-is`);
        }
      } catch (e) {
        // Fallback to original model if resolution fails
        console.log(`[Pricing] Could not normalize model "${model}", using as-is:`, e);
      }
      
      // If there's a resolution error, return it to the client
      if (resolutionError) {
        return res.status(400).json({ 
          message: resolutionError,
          errorCode: 'IMAGE_REQUIRED',
          baseCost: 0,
          totalCost: 0,
          calculatedFromCatalog: false
        });
      }
      
      // Map model to operation ID
      const operationId = mapModelToOperationId(resolvedModelId, category);
      
      let totalCost = 0;
      let calculatedFromCatalog = false;
      
      // Try to use operations catalog
      try {
        // Build params based on category
        const params: any = {};
        
        if (category === 'video') {
          // Video parameters
          params.duration = duration || 5; // Default 5 seconds
          params.units = duration || 5;
          params.resolution = resolution || '720p'; // Default 720p
          params.audio_on = audioEnabled || false; // Use provided audio setting
        } else {
          // Image parameters
          params.units = imageCount || 1;
          params.quantity = imageCount || 1;
          params.imageSize = imageSize || '1024x1024';
          // Include resolution for nano-banana-pro and saudi-model-pro models
          if (resolution) {
            params.resolution = resolution;
          }
        }
        
        const result = await creditService.calculateOperationCost(operationId, params);
        totalCost = result.credits;
        calculatedFromCatalog = true;
        console.log(`[Pricing Estimate] Using catalog pricing for ${resolvedModelId}: ${totalCost} credits (category: ${category})`);
      } catch (error) {
        // Fallback to legacy pricing
        console.log(`[Pricing Estimate] Catalog pricing failed for ${resolvedModelId}, falling back to legacy`);
        
        if (category === 'image') {
          const costDetails = await pricingService.calculateGenerationCost({
            model: resolvedModelId,
            enhancePrompt: enhancePrompt || false,
            imageCount: imageCount || 1,
            aspectRatio,
            quality,
            styleImageUrl
          });
          totalCost = costDetails.totalCost;
        } else {
          // Video fallback - use simple estimate
          totalCost = 25; // Fallback default for video
        }
        
        calculatedFromCatalog = false;
      }
      
      // Return in the format expected by frontend
      const response = {
        baseCost: totalCost,
        additionalCosts: [],
        totalCost: totalCost,
        calculatedFromCatalog
      };
      
      // Cache pricing estimates for 5 minutes since pricing rules don't change often
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(response);
    } catch (error) {
      console.error("Error calculating generation cost:", error);
      res.status(500).json({ message: "Failed to calculate cost" });
    }
  });

  // Get user's credit transaction history
  app.get("/api/credits/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const transactions = await creditService.getTransactionHistory(userId, limit, offset);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching credit transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Credit Requests API

  // Create a new credit request
  app.post("/api/credit-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await dbStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Validate request data
      const validatedData = insertCreditRequestSchema.parse(req.body);
      
      // Create the credit request
      const request = await dbStorage.createCreditRequest({
        ...validatedData,
        userId,
      });
      
      // Send email notification to admin
      try {
        await emailService.sendCreditRequestNotificationToAdmin(
          user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown User',
          user.email || '',
          request.requestedAmount,
          request.message,
          request.id
        );
      } catch (emailError) {
        console.error("Failed to send admin notification email:", emailError);
        // Continue even if email fails
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error creating credit request:", error);
      res.status(500).json({ message: "Failed to create credit request" });
    }
  });

  // Get credit requests (admin gets all, user gets their own)
  app.get("/api/credit-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await dbStorage.getUser(userId);
      const isAdminUser = user?.role === "admin";
      const status = req.query.status as string | undefined;
      
      let requests;
      if (isAdminUser) {
        // Admin gets all requests (optionally filtered by status)
        requests = await dbStorage.getAllCreditRequests(status);
      } else {
        // Regular user gets only their own requests
        requests = await dbStorage.getUserCreditRequests(userId);
        // Filter by status if provided
        if (status) {
          requests = requests.filter(r => r.status === status);
        }
      }
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching credit requests:", error);
      res.status(500).json({ message: "Failed to fetch credit requests" });
    }
  });

  // Get a specific credit request
  app.get("/api/credit-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await dbStorage.getUser(userId);
      const isAdminUser = user?.role === "admin";
      const requestId = parseInt(req.params.id);
      
      const request = await dbStorage.getCreditRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Credit request not found" });
      }
      
      // Users can only view their own requests, admins can view all
      if (!isAdminUser && request.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error fetching credit request:", error);
      res.status(500).json({ message: "Failed to fetch credit request" });
    }
  });

  // Process a credit request (admin only - approve/reject)
  app.patch("/api/credit-requests/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const requestId = parseInt(req.params.id);
      
      // Validate update data
      const validatedData = updateCreditRequestSchema.parse(req.body);
      
      if (!validatedData.status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      // Get the request with user info before processing
      const existingRequest = await dbStorage.getCreditRequest(requestId);
      
      if (!existingRequest) {
        return res.status(404).json({ message: "Credit request not found" });
      }
      
      if (existingRequest.status !== 'pending') {
        return res.status(400).json({ message: "This request has already been processed" });
      }
      
      // Process the request
      const updatedRequest = await dbStorage.processCreditRequest(
        requestId,
        adminId,
        validatedData.status,
        validatedData.approvedAmount,
        validatedData.adminNote
      );
      
      if (!updatedRequest) {
        return res.status(500).json({ message: "Failed to process request" });
      }
      
      // Send email notification to user
      if (existingRequest.user?.email) {
        try {
          const userName = existingRequest.user.firstName && existingRequest.user.lastName
            ? `${existingRequest.user.firstName} ${existingRequest.user.lastName}`
            : existingRequest.user.email;
          
          if (validatedData.status === 'approved' && validatedData.approvedAmount) {
            await emailService.sendCreditRequestApprovedToUser(
              existingRequest.user.email,
              userName,
              existingRequest.requestedAmount,
              validatedData.approvedAmount,
              validatedData.adminNote
            );
          } else if (validatedData.status === 'rejected') {
            await emailService.sendCreditRequestRejectedToUser(
              existingRequest.user.email,
              userName,
              existingRequest.requestedAmount,
              validatedData.adminNote
            );
          }
        } catch (emailError) {
          console.error("Failed to send user notification email:", emailError);
          // Continue even if email fails
        }
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error processing credit request:", error);
      res.status(500).json({ message: "Failed to process credit request" });
    }
  });

  // Get available subscription plans
  app.get("/api/subscription/plans", async (req, res) => {
    try {
      const plans = await dbStorage.getActiveSubscriptionPlans();
      // Cache subscription plans for 30 minutes since they rarely change
      res.set('Cache-Control', 'public, max-age=1800, s-maxage=1800');
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Get user's current subscription
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await dbStorage.getUserSubscription(userId);
      
      if (!subscription) {
        // User is on free plan
        const freePlan = await dbStorage.getSubscriptionPlanByName("free");
        res.json({ plan: freePlan, status: "free" });
      } else {
        res.json(subscription);
      }
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Cancel user's own subscription (at period end)
  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await dbStorage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      
      if (subscription.status === "canceled") {
        return res.status(400).json({ message: "Subscription is already canceled" });
      }
      
      if (subscription.cancelAtPeriodEnd) {
        return res.status(400).json({ message: "Subscription is already set to cancel" });
      }
      
      // If using Stripe, update the subscription in Stripe first
      let stripeUpdated = false;
      if (subscription.stripeSubscriptionId) {
        try {
          const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
          if (isStripeConfigured) {
            const stripe = stripeService.getStripeClient();
            await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              cancel_at_period_end: true
            });
            stripeUpdated = true;
          }
        } catch (stripeError: any) {
          console.error("Error updating Stripe subscription:", stripeError);
          return res.status(500).json({ 
            message: "Failed to cancel subscription with payment provider. Please try again or contact support.",
            error: stripeError.message
          });
        }
      }
      
      // Update subscription in database
      await dbStorage.updateUserSubscription(subscription.id, {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      });
      
      res.json({ 
        message: "Subscription will be canceled at the end of the billing period",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
        stripeUpdated
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Reactivate user's own subscription (undo cancel at period end)
  app.post("/api/subscription/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await dbStorage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }
      
      if (!subscription.cancelAtPeriodEnd) {
        return res.status(400).json({ message: "Subscription is not set to cancel" });
      }
      
      if (subscription.status === "canceled") {
        return res.status(400).json({ message: "Subscription is already canceled and cannot be reactivated" });
      }
      
      // If using Stripe, update the subscription in Stripe first
      let stripeUpdated = false;
      if (subscription.stripeSubscriptionId) {
        try {
          const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
          if (isStripeConfigured) {
            const stripe = stripeService.getStripeClient();
            await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              cancel_at_period_end: false
            });
            stripeUpdated = true;
          }
        } catch (stripeError: any) {
          console.error("Error updating Stripe subscription:", stripeError);
          return res.status(500).json({ 
            message: "Failed to reactivate subscription with payment provider. Please try again or contact support.",
            error: stripeError.message
          });
        }
      }
      
      // Update subscription in database
      await dbStorage.updateUserSubscription(subscription.id, {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      
      res.json({ 
        message: "Subscription reactivated successfully",
        cancelAtPeriodEnd: false,
        stripeUpdated
      });
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Failed to reactivate subscription" });
    }
  });

  // Speech-to-Text with FAL Turbo endpoint
  const sttRateLimitMap = new Map<string, number[]>();
  const STT_RATE_LIMIT = 10; // Max 10 requests per minute per user
  const STT_RATE_WINDOW = 60000; // 1 minute in milliseconds

  app.post("/api/stt/fal-turbo-single", isAuthenticated, audioUpload.single('audio'), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      
      // Rate limiting check
      const now = Date.now();
      const userRequests = sttRateLimitMap.get(userId) || [];
      const recentRequests = userRequests.filter(time => now - time < STT_RATE_WINDOW);
      
      if (recentRequests.length >= STT_RATE_LIMIT) {
        return res.status(429).json({ 
          error: "Too many transcription requests. Please wait a moment and try again." 
        });
      }
      
      // Update rate limit tracking
      recentRequests.push(now);
      sttRateLimitMap.set(userId, recentRequests);
      
      // Cleanup old entries periodically
      if (Math.random() < 0.1) { // 10% chance to cleanup
        const entriesToClean = Array.from(sttRateLimitMap.entries());
        for (const [key, times] of entriesToClean) {
          const validTimes = times.filter((time: number) => now - time < STT_RATE_WINDOW);
          if (validTimes.length === 0) {
            sttRateLimitMap.delete(key);
          } else {
            sttRateLimitMap.set(key, validTimes);
          }
        }
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Validate file size (30MB max)
      const MAX_FILE_SIZE = 30 * 1024 * 1024;
      if (req.file.size > MAX_FILE_SIZE) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ 
          error: `File too large. Maximum size is 30MB, received ${(req.file.size / 1024 / 1024).toFixed(1)}MB` 
        });
      }

      console.log(`Processing STT request for user ${userId}, file: ${req.file.filename}, size: ${(req.file.size / 1024).toFixed(1)}KB`);

      // Upload audio file to FAL storage
      const audioFile = new File(
        [await fs.readFile(req.file.path)],
        req.file.filename,
        { type: req.file.mimetype }
      );

      const audioUrl = await fal.storage.upload(audioFile);
      console.log(`Uploaded audio to FAL storage: ${audioUrl}`);

      // Call FAL Whisper STT API (with auto language detection)
      const result = await fal.subscribe("fal-ai/whisper", {
        input: {
          audio_url: audioUrl,
          task: "transcribe",
          // language omitted for auto-detection
          chunk_level: "none", // Return full transcription without timestamps for better quality
          diarize: false // Don't annotate speakers
        },
        logs: false
      });

      // Clean up local file
      await fs.unlink(req.file.path).catch(console.error);

      // Extract transcript from result
      const transcript = result.data?.text || '';
      
      console.log(`STT completed for user ${userId}: ${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}`);

      res.json({ text: transcript });

    } catch (error: any) {
      console.error("STT transcription error:", error);
      
      // Clean up uploaded file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      res.status(500).json({ 
        error: error.message || "Transcription failed. Please try again." 
      });
    }
  });

  // Image reporting endpoints
  app.post("/api/images/report", isAuthenticated, async (req, res) => {
    try {
      const reportData = insertImageReportSchema.parse({
        ...req.body,
        reporterId: (req.user as any).id,
      });

      const report = await dbStorage.createImageReport(reportData);
      res.json(report);
    } catch (error: any) {
      console.error("Error creating image report:", error);
      res.status(400).json({ message: error.message || "Failed to create report" });
    }
  });

  // Admin routes for reports
  app.get("/api/admin/reports", isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const reports = await dbStorage.getImageReports(limit, offset);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id/status", isAdmin, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["dismissed", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const report = await dbStorage.updateReportStatus(reportId, status, (req.user as any).id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error: any) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  app.delete("/api/admin/reports/:id", isAdmin, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const deleted = await dbStorage.deleteReport(reportId, (req.user as any).id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Pricing Rules management endpoints
  app.get("/api/admin/pricing-rules", isAdmin, async (req, res) => {
    try {
      const rules = await dbStorage.getAllPricingRules();
      res.json(rules);
    } catch (error: any) {
      console.error("Error fetching pricing rules:", error);
      res.status(500).json({ message: "Failed to fetch pricing rules" });
    }
  });

  // Admin user search endpoint
  app.get("/api/admin/users/search", isAdmin, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const users = await dbStorage.searchUsers(query);
      res.json(users);
    } catch (error: any) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Admin credit grant endpoint
  app.post("/api/admin/credits/grant", isAdmin, async (req, res) => {
    try {
      const { userId, amount, reason } = req.body;
      
      if (!userId || !amount || amount <= 0 || !reason) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      const transaction = await creditService.grantCredits(userId, amount, reason, {
        grantedBy: (req as any).adminUser.id,
        type: "admin_grant"
      });

      res.json(transaction);
    } catch (error: any) {
      console.error("Error granting credits:", error);
      res.status(500).json({ message: "Failed to grant credits" });
    }
  });

  // Admin credit revoke endpoint
  app.post("/api/admin/credits/revoke", isAdmin, async (req, res) => {
    try {
      const { userId, amount, reason } = req.body;
      
      if (!userId || !amount || amount <= 0 || !reason) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      const transaction = await creditService.deductCredits(userId, amount, reason, {
        revokedBy: (req as any).adminUser.id,
        type: "admin_revoke"
      });

      if (!transaction) {
        return res.status(400).json({ message: "Insufficient credits to revoke" });
      }

      res.json(transaction);
    } catch (error: any) {
      console.error("Error revoking credits:", error);
      res.status(500).json({ message: "Failed to revoke credits" });
    }
  });

  app.post("/api/admin/pricing-rules", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const ruleData = {
        ...req.body,
        updatedBy: adminUser.id,
        isActive: true
      };

      const rule = await dbStorage.createPricingRule(ruleData);
      
      // Clear pricing cache
      pricingService.clearCache();
      
      res.json(rule);
    } catch (error: any) {
      console.error("Error creating pricing rule:", error);
      res.status(400).json({ message: error.message || "Failed to create pricing rule" });
    }
  });

  app.patch("/api/admin/pricing-rules/:id", isAdmin, async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      const updates = req.body;

      const rule = await dbStorage.updatePricingRule(ruleId, updates);
      if (!rule) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      
      // Clear pricing cache when rules change
      pricingService.clearCache();
      
      res.json(rule);
    } catch (error: any) {
      console.error("Error updating pricing rule:", error);
      res.status(400).json({ message: error.message || "Failed to update pricing rule" });
    }
  });

  app.delete("/api/admin/pricing-rules/:id", isAdmin, async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      const deleted = await dbStorage.deletePricingRule(ruleId, (req as any).adminUser.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      
      // Clear pricing cache
      pricingService.clearCache();
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting pricing rule:", error);
      res.status(500).json({ message: "Failed to delete pricing rule" });
    }
  });

  // New Pricing System API Routes
  app.get("/api/admin/pricing/settings", isAdmin, async (req, res) => {
    try {
      const settings = await dbStorage.getAllPricingSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching pricing settings:", error);
      res.status(500).json({ message: "Failed to fetch pricing settings" });
    }
  });

  app.patch("/api/admin/pricing/settings/:key", isAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const adminUser = (req as any).adminUser;

      const setting = await dbStorage.upsertPricingSetting({ key, value, updatedBy: adminUser.id });
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      // Clear pricing calculator cache after settings update
      const { pricingCalculator } = await import("./services/pricing-calculator");
      pricingCalculator.clearCache();

      res.json(setting);
    } catch (error: any) {
      console.error("Error updating pricing setting:", error);
      res.status(400).json({ message: error.message || "Failed to update setting" });
    }
  });

  app.get("/api/admin/pricing/operations", isAdmin, async (req, res) => {
    try {
      const operations = await dbStorage.getAllPricingOperations();
      res.json(operations);
    } catch (error: any) {
      console.error("Error fetching pricing operations:", error);
      res.status(500).json({ message: "Failed to fetch pricing operations" });
    }
  });

  app.get("/api/admin/pricing/operations/:operationId", isAdmin, async (req, res) => {
    try {
      const { operationId } = req.params;
      const operation = await dbStorage.getPricingOperation(operationId);
      
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      res.json(operation);
    } catch (error: any) {
      console.error("Error fetching pricing operation:", error);
      res.status(500).json({ message: "Failed to fetch operation" });
    }
  });

  app.patch("/api/admin/pricing/operations/:operationId", isAdmin, async (req, res) => {
    try {
      const { operationId } = req.params;
      const updates = req.body;
      const adminUser = (req as any).adminUser;

      const operation = await dbStorage.updatePricingOperationByOperationId(operationId, {
        ...updates,
        updatedBy: adminUser.id
      });

      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }

      // Clear pricing calculator cache after operation update
      const { pricingCalculator } = await import("./services/pricing-calculator");
      pricingCalculator.clearCache();

      res.json(operation);
    } catch (error: any) {
      console.error("Error updating pricing operation:", error);
      res.status(400).json({ message: error.message || "Failed to update operation" });
    }
  });

  app.post("/api/admin/pricing/operations", isAdmin, async (req, res) => {
    try {
      const operationData = req.body;
      const adminUser = (req as any).adminUser;

      const operation = await dbStorage.createPricingOperation({
        ...operationData,
        updatedBy: adminUser.id
      });

      // Clear pricing calculator cache
      const { pricingCalculator } = await import("./services/pricing-calculator");
      pricingCalculator.clearCache();

      res.json(operation);
    } catch (error: any) {
      console.error("Error creating pricing operation:", error);
      res.status(400).json({ message: error.message || "Failed to create operation" });
    }
  });

  // Check for missing pricing operations (models without pricing entries)
  app.get("/api/admin/pricing/sync-status", isAdmin, async (req, res) => {
    try {
      const { PricingSyncService } = await import("./services/pricing-sync-service");
      const syncService = PricingSyncService.getInstance();
      const status = await syncService.getSyncStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ message: error.message || "Failed to get sync status" });
    }
  });

  // Sync missing pricing operations (add pricing entries for new models)
  app.post("/api/admin/pricing/sync", isAdmin, async (req, res) => {
    try {
      const { PricingSyncService } = await import("./services/pricing-sync-service");
      const syncService = PricingSyncService.getInstance();
      const result = await syncService.syncMissingOperations();
      
      // Clear pricing calculator cache after sync
      const { pricingCalculator } = await import("./services/pricing-calculator");
      pricingCalculator.clearCache();
      
      res.json({
        success: true,
        added: result.added,
        addedCount: result.added.length,
        errors: result.errors,
        errorCount: result.errors.length
      });
    } catch (error: any) {
      console.error("Error syncing pricing operations:", error);
      res.status(500).json({ message: error.message || "Failed to sync pricing operations" });
    }
  });

  // Public pricing estimation endpoint (for authenticated users)
  app.get("/api/pricing/estimate/:operationId", isAuthenticated, async (req, res) => {
    try {
      const { operationId } = req.params;
      const { units, quantity, duration } = req.query;
      
      // Extract numeric units from query params
      // Support different param names: units, quantity, duration (for video)
      let numericUnits = 1;
      if (units) {
        numericUnits = parseFloat(units as string) || 1;
      } else if (quantity) {
        numericUnits = parseFloat(quantity as string) || 1;
      } else if (duration) {
        numericUnits = parseFloat(duration as string) || 1;
      }

      const { pricingCalculator } = await import("./services/pricing-calculator");
      const result = await pricingCalculator.calculateCost(operationId, numericUnits);

      res.json(result);
    } catch (error: any) {
      console.error("Error estimating cost:", error);
      res.status(400).json({ message: error.message || "Failed to estimate cost" });
    }
  });

  // Credit Management endpoints
  app.post("/api/admin/credits/grant", isAdmin, async (req, res) => {
    try {
      const { userId, amount, reason } = req.body;
      const adminUser = (req as any).adminUser;
      
      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Valid userId and positive amount required" });
      }

      const result = await creditService.grantCredits(
        userId,
        amount,
        reason || "Admin credit grant",
        {
          adminId: adminUser.id,
          adminName: adminUser.name || adminUser.email
        }
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error granting credits:", error);
      res.status(500).json({ message: "Failed to grant credits" });
    }
  });

  app.post("/api/admin/credits/revoke", isAdmin, async (req, res) => {
    try {
      const { userId, amount, reason } = req.body;
      const adminUser = (req as any).adminUser;
      
      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Valid userId and positive amount required" });
      }

      const result = await creditService.deductCredits(
        userId,
        amount,
        reason || "Admin credit revocation",
        {
          adminId: adminUser.id,
          adminName: adminUser.name || adminUser.email
        }
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error revoking credits:", error);
      res.status(500).json({ message: "Failed to revoke credits" });
    }
  });

  // Manual refund endpoint for admin troubleshooting
  app.post("/api/admin/credits/refund", isAdmin, async (req, res) => {
    try {
      const { userId, jobType, identifier, reason } = req.body;
      const adminUser = (req as any).adminUser;
      
      if (!userId || !jobType || !identifier) {
        return res.status(400).json({ 
          message: "userId, jobType, and identifier are required" 
        });
      }

      const { autoRefundService } = await import("./services/auto-refund-service");
      let refunded = false;
      
      // Route to appropriate refund method based on job type
      switch (jobType) {
        case 'video_job':
          refunded = await autoRefundService.refundVideoJob(identifier, 'failed');
          break;
        case 'image':
          refunded = await autoRefundService.refundImage(
            parseInt(identifier), 
            userId, 
            reason || 'Admin manual refund'
          );
          break;
        case 'audio':
          refunded = await autoRefundService.refundAudioTranscription(
            userId, 
            identifier, 
            reason || 'Admin manual refund'
          );
          break;
        default:
          return res.status(400).json({ 
            message: "Invalid jobType. Must be: video_job, image, or audio" 
          });
      }
      
      if (refunded) {
        res.json({ 
          success: true, 
          message: "Refund processed successfully",
          jobType,
          identifier
        });
      } else {
        res.json({ 
          success: false, 
          message: "No transaction found to refund (credits may not have been deducted)",
          jobType,
          identifier
        });
      }
    } catch (error: any) {
      console.error("Error processing manual refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  app.get("/api/admin/users/search", isAdmin, async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const users = await dbStorage.searchUsers(query.trim());
      res.json(users);
    } catch (error: any) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // AI Styles management endpoints
  app.get("/api/admin/ai-styles", isAdmin, async (req, res) => {
    try {
      const styles = await dbStorage.getAiStyles();
      res.json(styles);
    } catch (error: any) {
      console.error("Error fetching AI styles:", error);
      res.status(500).json({ message: "Failed to fetch AI styles" });
    }
  });

  app.get("/api/ai-styles", async (req, res) => {
    try {
      const styles = await dbStorage.getVisibleAiStyles();
      // Cache AI styles for 15 minutes since they rarely change
      res.set('Cache-Control', 'public, max-age=900, s-maxage=900');
      res.json(styles);
    } catch (error: any) {
      console.error("Error fetching visible AI styles:", error);
      res.status(500).json({ message: "Failed to fetch AI styles" });
    }
  });

  app.post("/api/admin/ai-styles", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const styleData = insertAiStyleSchema.parse({
        ...req.body,
        updatedBy: adminUser.id,
      });

      const style = await dbStorage.createAiStyle(styleData);
      res.json(style);
    } catch (error: any) {
      console.error("Error creating AI style:", error);
      res.status(400).json({ message: error.message || "Failed to create style" });
    }
  });

  app.put("/api/admin/ai-styles/:id", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const updates = insertAiStyleSchema.partial().parse(req.body);

      const style = await dbStorage.updateAiStyle(styleId, updates, (req as any).adminUser.id);
      if (!style) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json(style);
    } catch (error: any) {
      console.error("Error updating AI style:", error);
      res.status(400).json({ message: error.message || "Failed to update style" });
    }
  });

  app.patch("/api/admin/ai-styles/:id/visibility", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const { isVisible } = req.body;

      const style = await dbStorage.toggleAiStyleVisibility(styleId, isVisible, (req as any).adminUser.id);
      if (!style) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json(style);
    } catch (error: any) {
      console.error("Error updating style visibility:", error);
      res.status(500).json({ message: "Failed to update visibility" });
    }
  });

  app.delete("/api/admin/ai-styles/:id", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const deleted = await dbStorage.deleteAiStyle(styleId, (req as any).adminUser.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting AI style:", error);
      res.status(500).json({ message: "Failed to delete style" });
    }
  });

  // Initialize default AI styles
  app.post("/api/admin/ai-styles/init-defaults", isAdmin, async (req, res) => {
    try {
      const { ensureDefaultAiStyles } = await import("./ai-styles-utils");
      const result = await ensureDefaultAiStyles((req as any).adminUser.id);
      
      res.json({
        message: "Default AI styles initialized successfully",
        created: result.created,
        skipped: result.skipped,
      });
    } catch (error: any) {
      console.error("Error initializing default AI styles:", error);
      res.status(500).json({ message: "Failed to initialize default AI styles" });
    }
  });

  // Video Styles management endpoints
  app.get("/api/admin/video-styles", isAdmin, async (req, res) => {
    try {
      const styles = await dbStorage.getVideoStyles();
      res.json(styles);
    } catch (error: any) {
      console.error("Error fetching video styles:", error);
      res.status(500).json({ message: "Failed to fetch video styles" });
    }
  });

  app.get("/api/video-styles", async (req, res) => {
    try {
      const styles = await dbStorage.getVisibleVideoStyles();
      // Cache video styles for 5 minutes (shorter than before to prevent stale data)
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(styles);
    } catch (error: any) {
      console.error("Error fetching visible video styles:", error);
      res.status(500).json({ message: "Failed to fetch video styles" });
    }
  });

  app.post("/api/admin/video-styles", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const styleData = insertVideoStyleSchema.parse({
        ...req.body,
        updatedBy: adminUser.id,
      });

      const style = await dbStorage.createVideoStyle(styleData);
      res.json(style);
    } catch (error: any) {
      console.error("Error creating video style:", error);
      res.status(400).json({ message: error.message || "Failed to create style" });
    }
  });

  app.put("/api/admin/video-styles/:id", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const updates = insertVideoStyleSchema.partial().parse(req.body);

      const style = await dbStorage.updateVideoStyle(styleId, updates, (req as any).adminUser.id);
      if (!style) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json(style);
    } catch (error: any) {
      console.error("Error updating video style:", error);
      res.status(400).json({ message: error.message || "Failed to update style" });
    }
  });

  app.patch("/api/admin/video-styles/:id/visibility", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const { isVisible } = req.body;

      const style = await dbStorage.toggleVideoStyleVisibility(styleId, isVisible, (req as any).adminUser.id);
      if (!style) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json(style);
    } catch (error: any) {
      console.error("Error updating video style visibility:", error);
      res.status(500).json({ message: "Failed to update visibility" });
    }
  });

  app.delete("/api/admin/video-styles/:id", isAdmin, async (req, res) => {
    try {
      const styleId = parseInt(req.params.id);
      const deleted = await dbStorage.deleteVideoStyle(styleId, (req as any).adminUser.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Style not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting video style:", error);
      res.status(500).json({ message: "Failed to delete style" });
    }
  });

  // Video model configurations endpoints
  app.get("/api/video-models", async (req, res) => {
    try {
      // Return simplified video models data for admin interface
      const models = VIDEO_MODELS.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        category: model.category,
        provider: model.provider,
      }));
      res.json(models);
    } catch (error: any) {
      console.error("Error fetching video models:", error);
      res.status(500).json({ message: "Failed to fetch video models" });
    }
  });

  app.get("/api/admin/video-model-configs", isAdmin, async (req, res) => {
    try {
      const configs = await dbStorage.getVideoModelConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Error fetching video model configs:", error);
      res.status(500).json({ message: "Failed to fetch video model configurations" });
    }
  });

  app.get("/api/admin/video-model-configs/:modelId", async (req, res) => {
    try {
      const modelId = req.params.modelId;
      const config = await dbStorage.getVideoModelConfig(modelId);
      
      if (!config) {
        // Return default configuration if none exists
        const defaultConfig = {
          modelId,
          estimatedTimeSeconds: 60,
          customStageLabels: null,
          isActive: true,
        };
        return res.json(defaultConfig);
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching video model config:", error);
      res.status(500).json({ message: "Failed to fetch video model configuration" });
    }
  });

  app.post("/api/admin/video-model-configs", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const configData = insertVideoModelConfigSchema.parse({
        ...req.body,
        updatedBy: adminUser.id,
      });

      const config = await dbStorage.createVideoModelConfig(configData);
      res.json(config);
    } catch (error: any) {
      console.error("Error creating video model config:", error);
      res.status(400).json({ message: error.message || "Failed to create configuration" });
    }
  });

  app.put("/api/admin/video-model-configs/:modelId", isAdmin, async (req, res) => {
    try {
      const modelId = req.params.modelId;
      const updates = insertVideoModelConfigSchema.partial().parse(req.body);

      const config = await dbStorage.updateVideoModelConfig(modelId, updates, (req as any).adminUser.id);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("Error updating video model config:", error);
      res.status(400).json({ message: error.message || "Failed to update configuration" });
    }
  });

  app.delete("/api/admin/video-model-configs/:modelId", isAdmin, async (req, res) => {
    try {
      const modelId = req.params.modelId;
      const deleted = await dbStorage.deleteVideoModelConfig(modelId, (req as any).adminUser.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting video model config:", error);
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // History endpoint - combined images and videos
  app.get("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const search = req.query.search as string | undefined;
      const type = (req.query.type as 'all' | 'image' | 'video' | 'upscaled') || 'all';
      const favoritesOnly = req.query.favoritesOnly === 'true';
      const sort = (req.query.sort as 'newest' | 'oldest') || 'newest';

      const history = await dbStorage.getUserHistory(userId, {
        search,
        type,
        favoritesOnly,
        sort
      });

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Favorites endpoint
  app.get("/api/favorites", isAuthenticated, async (req, res) => {
    try {
      const favorites = await dbStorage.getUserFavorites((req.user as any).claims.sub);
      res.json(favorites);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Alternative favorites endpoint (for backward compatibility)
  app.get("/api/favorites/images", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await dbStorage.getUserFavorites(userId);
      
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Video favorites endpoints
  app.get("/api/favorites/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoFavorites = await dbStorage.getUserVideoFavorites(userId);
      res.json(videoFavorites);
    } catch (error) {
      console.error("Error fetching video favorites:", error);
      res.status(500).json({ message: "Failed to fetch video favorites" });
    }
  });

  // Toggle video favorite status
  app.post("/api/videos/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const isFavorited = await dbStorage.toggleVideoFavorite(userId, id);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error toggling video favorite:", error);
      res.status(500).json({ message: "Failed to toggle video favorite" });
    }
  });

  // Get video favorite status
  app.get("/api/videos/:id/favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      const isFavorited = await dbStorage.isVideoFavorited(userId, id);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error checking video favorite status:", error);
      res.status(500).json({ message: "Failed to check video favorite status" });
    }
  });

  // Bulk video favorite status
  app.post("/api/videos/bulk-favorite-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { videoIds } = req.body;
      
      if (!Array.isArray(videoIds)) {
        return res.status(400).json({ message: "videoIds must be an array" });
      }

      const favoriteStatus = await dbStorage.getBulkVideoFavoriteStatus(userId, videoIds);
      res.json(favoriteStatus);
    } catch (error) {
      console.error("Error fetching bulk video favorite status:", error);
      res.status(500).json({ message: "Failed to fetch bulk video favorite status" });
    }
  });

  // Hero slides endpoints (public)
  const normalizeOptionalText = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  app.get("/api/hero-slides", async (req, res) => {
    try {
      const slides = await dbStorage.getHeroSlides();
      // Admin updates should appear immediately on homepage.
      res.set("Cache-Control", "no-store");
      res.json(slides);
    } catch (error: any) {
      console.error("Error fetching hero slides:", error);
      res.set("Cache-Control", "no-store");
      res.json([]);
    }
  });

  // Admin hero slides management
  app.get("/api/admin/hero-slides", isAdmin, async (req, res) => {
    try {
      const slides = await dbStorage.getAllHeroSlides();
      res.json(slides);
    } catch (error: any) {
      console.error("Error fetching all hero slides:", error);
      res.status(500).json({ message: "Failed to fetch hero slides" });
    }
  });

  app.post("/api/admin/hero-slides", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const body = { ...req.body };
      if ("titleAr" in body) body.titleAr = normalizeOptionalText(body.titleAr);
      if ("subtitleAr" in body) body.subtitleAr = normalizeOptionalText(body.subtitleAr);

      const slideData = insertHeroSlideSchema.parse({
        ...body,
        updatedBy: adminUser.id,
      });

      const slide = await dbStorage.createHeroSlide(slideData);
      res.json(slide);
    } catch (error: any) {
      console.error("Error creating hero slide:", error);
      res.status(400).json({ message: error.message || "Failed to create slide" });
    }
  });

  // Create hero slide with file upload
  app.post("/api/admin/hero-slides/upload", isAdmin, upload.single('image'), async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      // Upload to object storage instead of local filesystem
      const objectStorage = createStorageService();
      const imageUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'hero-slides'
      );
      
      const slideData = insertHeroSlideSchema.parse({
        title: req.body.title,
        titleAr: normalizeOptionalText(req.body.titleAr),
        subtitle: req.body.subtitle,
        subtitleAr: normalizeOptionalText(req.body.subtitleAr),
        imageUrl,
        sortOrder: parseInt(req.body.sortOrder) || 0,
        isActive: req.body.isActive === 'true',
        updatedBy: adminUser.id,
      });
      
      const slide = await dbStorage.createHeroSlide(slideData);
      res.json(slide);
    } catch (error: any) {
      console.error("Error creating hero slide with upload:", error);
      res.status(400).json({ message: error.message || "Failed to create slide" });
    }
  });

  app.put("/api/admin/hero-slides/:id", isAdmin, async (req, res) => {
    try {
      const slideId = parseInt(req.params.id);
      const adminId = (req as any).adminUser.id;
      const body = { ...req.body };
      if ("titleAr" in body) body.titleAr = normalizeOptionalText(body.titleAr);
      if ("subtitleAr" in body) body.subtitleAr = normalizeOptionalText(body.subtitleAr);
      const updates = insertHeroSlideSchema.partial().parse(body);

      const slide = await dbStorage.updateHeroSlide(slideId, { ...updates, updatedBy: adminId });
      if (!slide) {
        return res.status(404).json({ message: "Slide not found" });
      }
      
      res.json(slide);
    } catch (error: any) {
      console.error("Error updating hero slide:", error);
      res.status(400).json({ message: error.message || "Failed to update slide" });
    }
  });

  app.patch("/api/admin/hero-slides/:id/status", isAdmin, async (req, res) => {
    try {
      const slideId = parseInt(req.params.id);
      const { isActive } = req.body;

      const slide = await dbStorage.toggleHeroSlideStatus(slideId, isActive, (req as any).adminUser.id);
      if (!slide) {
        return res.status(404).json({ message: "Slide not found" });
      }
      
      res.json(slide);
    } catch (error: any) {
      console.error("Error updating slide status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  app.delete("/api/admin/hero-slides/:id", isAdmin, async (req, res) => {
    try {
      const slideId = parseInt(req.params.id);
      const deleted = await dbStorage.deleteHeroSlide(slideId, (req as any).adminUser.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Slide not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting hero slide:", error);
      res.status(500).json({ message: "Failed to delete slide" });
    }
  });

  // Random prompt endpoint (public)
  app.get("/api/random-prompt", async (req, res) => {
    try {
      const randomPrompt = await dbStorage.getRandomPrompt();
      
      if (!randomPrompt) {
        // Return a default prompt if database is empty
        return res.json({ 
          prompt: "A beautiful sunset over a calm ocean with vibrant colors"
        });
      }
      
      res.json({ prompt: randomPrompt.prompt });
    } catch (error: any) {
      console.error("Error fetching random prompt:", error);
      res.status(500).json({ message: "Failed to fetch random prompt" });
    }
  });

  // Translation endpoint using OpenAI GPT-4.1-nano
  app.post("/api/translate", isAuthenticated, async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      // Check if already in English (simple heuristic)
      const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'];
      const words = text.toLowerCase().split(/\s+/);
      const englishWordCount = words.filter(word => englishWords.includes(word)).length;
      const englishRatio = englishWordCount / words.length;
      
      // If likely already English, return as-is
      if (englishRatio > 0.3) {
        return res.json({ translatedText: text, wasTranslated: false });
      }

      // Use OpenAI to translate
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Apply prompt template system for translation
      let systemPrompt = "You are a professional translator. Translate the given text to English. If the text is already in English, return it unchanged. Only return the translated text, no explanations.";
      try {
        const template = await dbStorage.getBestPromptTemplate('translation', undefined);
        if (template && template.promptText) {
          console.log(`Using translation template: ${template.name}`);
          console.log(`Template: ${template.promptText}`);
          
          // For translation, we need to detect the source language or assume it's unknown
          const variables = {
            text: text,
            source_language: 'unknown',
            target_language: 'English'
          };
          
          systemPrompt = substituteVariables(template.promptText, variables);
          console.log(`Final translation prompt: ${systemPrompt}`);
        }
      } catch (error) {
        console.error('Error applying translation template:', error);
      }

      console.log("Using model: gpt-5-nano for translation");
      const response = await openai.chat.completions.create({
        model: "gpt-5-nano", // Using gpt-5-nano for translation tasks
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: text
          }
        ],
        reasoning_effort: "minimal",
        verbosity: "low"
      });
      console.log("Translation completed with gpt-5-nano");

      const translatedText = response.choices[0].message.content?.trim() || text;
      
      res.json({ 
        translatedText, 
        wasTranslated: translatedText !== text,
        originalText: text 
      });

    } catch (error: any) {
      console.error("Error translating text:", error);
      // Return original text if translation fails
      res.json({ 
        translatedText: req.body.text, 
        wasTranslated: false, 
        error: "Translation service unavailable" 
      });
    }
  });

  // Prompt enhancement endpoint using OpenAI GPT-4o
  app.post("/api/enhance-prompt", isAuthenticated, promptEnhanceRateLimit, validatePromptInput, async (req, res) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      if (prompt.trim().length < 3) {
        return res.json({ enhancedPrompt: prompt });
      }

      // Use OpenAI to enhance the prompt
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Apply prompt template system for image enhancement
      let systemPrompt = "You are an expert at creating detailed, creative, and highly descriptive prompts for AI image generators. Rewrite the given prompt to be more clear, creative, and descriptive while maintaining the original intent. Focus on visual details, artistic style, composition, lighting, and atmosphere. Avoid repeating or adding irrelevant information. Only return the enhanced prompt, no explanations.";
      let userPrompt = `Rewrite this as a clear, creative, and highly descriptive prompt suitable for an AI image generator. Avoid repeating or adding irrelevant information. Original prompt: ${prompt}`;
      
      try {
        const template = await dbStorage.getBestPromptTemplate('image_enhancement', undefined);
        if (template && template.promptText) {
          console.log(`Using image enhancement template: ${template.name}`);
          console.log(`Template: ${template.promptText}`);
          
          const variables = {
            user_prompt: prompt
          };
          
          systemPrompt = substituteVariables(template.promptText, variables);
          userPrompt = prompt; // Use original prompt as user input when using template
          console.log(`Final image enhancement prompt: ${systemPrompt}`);
        }
      } catch (error) {
        console.error('Error applying image enhancement template:', error);
      }

      console.log("Using model: gpt-5-nano for prompt enhancement");
      const response = await openai.chat.completions.create({
        model: "gpt-5-nano", // Using gpt-5-nano for prompt enhancement
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        reasoning_effort: "low",
        verbosity: "medium"
      });
      console.log("Prompt enhancement completed with gpt-5-nano");

      const enhancedPrompt = response.choices[0].message.content?.trim() || prompt;
      
      res.json({ 
        enhancedPrompt,
        originalPrompt: prompt 
      });

    } catch (error: any) {
      console.error("Error enhancing prompt:", error);
      // Return original prompt if enhancement fails
      res.json({ 
        enhancedPrompt: req.body.prompt, 
        error: "Enhancement service unavailable" 
      });
    }
  });

  // Video prompt enhancement endpoint
  app.post("/api/enhance-video-prompt", isAuthenticated, promptEnhanceRateLimit, validatePromptInput, async (req, res) => {
    try {
      const { prompt, style } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ 
          message: "A valid prompt is required for enhancement",
          error: "INVALID_PROMPT"
        });
      }

      if (prompt.trim().length < 3) {
        return res.json({ 
          enhancedPrompt: prompt,
          message: "Prompt too short to enhance, using original"
        });
      }

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key not configured for prompt enhancement");
        return res.status(503).json({ 
          message: "Prompt enhancement service is temporarily unavailable",
          error: "SERVICE_UNAVAILABLE"
        });
      }

      // Use OpenAI to enhance the video prompt
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Apply prompt template system for video enhancement
      let systemContent = "Rewrite the user video description as a clear, creative, and highly descriptive prompt suitable for an AI video generation model. Make sure the result includes details about the scene, key visual elements, action or movement, camera perspective, lighting, atmosphere, and style or mood. Use complete sentences, and avoid repetition or irrelevant information. Only return the enhanced prompt, no explanations.";
      let userContent = `Rewrite this as a clear, creative, and highly descriptive prompt suitable for an AI video generator: ${prompt}`;
      
      try {
        const template = await dbStorage.getBestPromptTemplate('video_enhancement', undefined);
        if (template && template.promptText) {
          console.log(`Using video enhancement template: ${template.name}`);
          console.log(`Template: ${template.promptText}`);
          
          const variables = {
            user_prompt: prompt
          };
          
          systemContent = substituteVariables(template.promptText, variables);
          userContent = prompt; // Use original prompt as user input when using template
          console.log(`Final video enhancement prompt: ${systemContent}`);
        } else {
          // Include style information if provided and no template found
          if (style && style.trim() && style !== "none") {
            userContent += `. Apply this style: ${style}`;
          }
        }
      } catch (error) {
        console.error('Error applying video enhancement template:', error);
        // Include style information if provided and template fails
        if (style && style.trim() && style !== "none") {
          userContent += `. Apply this style: ${style}`;
        }
      }

      console.log("Using model: gpt-5-nano for video prompt enhancement");
      const response = await openai.chat.completions.create({
        model: "gpt-5-nano", // Using gpt-5-nano for video prompt enhancement
        messages: [
          {
            role: "system",
            content: systemContent
          },
          {
            role: "user",
            content: userContent
          }
        ],
        reasoning_effort: "low",
        verbosity: "medium"
      });
      console.log("Video prompt enhancement completed with gpt-5-nano");

      const enhancedPrompt = response.choices[0].message.content?.trim() || prompt;
      
      res.json({ 
        enhancedPrompt,
        originalPrompt: prompt 
      });

    } catch (error: any) {
      console.error("Error enhancing video prompt:", error);
      
      // Provide specific error messages based on error type
      let statusCode = 500;
      let errorMessage = "Enhancement service temporarily unavailable";
      let errorCode = "ENHANCEMENT_FAILED";
      
      // Handle OpenAI API specific errors
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        statusCode = 429;
        errorMessage = "Rate limit reached for prompt enhancement. Please try again in a moment.";
        errorCode = "RATE_LIMIT";
      } else if (error.status === 401 || error.code === 'invalid_api_key') {
        statusCode = 503;
        errorMessage = "Enhancement service configuration error";
        errorCode = "CONFIG_ERROR";
      } else if (error.status === 400 || error.code === 'invalid_request_error') {
        statusCode = 400;
        errorMessage = "Invalid prompt format for enhancement";
        errorCode = "INVALID_REQUEST";
      } else if (error.message && error.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = "Enhancement request timed out. Please try again.";
        errorCode = "TIMEOUT";
      } else if (error.message && error.message.includes('network')) {
        statusCode = 503;
        errorMessage = "Network error during enhancement. Please check your connection.";
        errorCode = "NETWORK_ERROR";
      }
      
      // Return error with fallback to original prompt
      res.status(statusCode).json({ 
        enhancedPrompt: req.body.prompt, 
        message: errorMessage,
        error: errorCode,
        fallbackUsed: true
      });
    }
  });

  // Register performance-optimized batch routes
  registerPerformanceRoutes(app);

  // Translation management routes
  app.get('/api/translations', async (req, res) => {
    try {
      const namespace = req.query.namespace as string;
      const translations = namespace 
        ? await dbStorage.getTranslationsByNamespace(namespace)
        : await dbStorage.getAllTranslations();
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  app.get('/api/translations/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const namespace = (req.query.namespace as string) || "common";
      const translation = await dbStorage.getTranslation(key, namespace);
      if (translation) {
        res.json(translation);
      } else {
        res.status(404).json({ message: "Translation not found" });
      }
    } catch (error) {
      console.error("Error fetching translation:", error);
      res.status(500).json({ message: "Failed to fetch translation" });
    }
  });

  app.put('/api/translations/:key', isAdmin, async (req: any, res) => {
    try {
      const { key } = req.params;
      const { arabic, namespace = "common" } = req.body;
      const adminId = req.user.claims.sub;
      
      const updatedTranslation = await dbStorage.updateTranslation(key, arabic, namespace, adminId);
      if (updatedTranslation) {
        res.json(updatedTranslation);
      } else {
        res.status(404).json({ message: "Translation not found" });
      }
    } catch (error) {
      console.error("Error updating translation:", error);
      res.status(500).json({ message: "Failed to update translation" });
    }
  });

  app.post('/api/translations', isAdmin, async (req: any, res) => {
    try {
      const { key, english, arabic, namespace = "common" } = req.body;
      const adminId = req.user.claims.sub;
      
      const newTranslation = await dbStorage.createTranslation({
        key,
        english,
        arabic,
        namespace,
        lastModifiedBy: adminId
      });
      
      res.json(newTranslation);
    } catch (error) {
      console.error("Error creating translation:", error);
      res.status(500).json({ message: "Failed to create translation" });
    }
  });

  app.post('/api/translations/bulk-update', isAdmin, async (req: any, res) => {
    try {
      const { translations } = req.body;
      const adminId = req.user.claims.sub;
      
      const updatedTranslations = await dbStorage.bulkUpdateTranslations(translations, adminId);
      res.json({ 
        message: `Successfully updated ${updatedTranslations.length} translations`,
        translations: updatedTranslations 
      });
    } catch (error) {
      console.error("Error bulk updating translations:", error);
      res.status(500).json({ message: "Failed to bulk update translations" });
    }
  });

  app.delete('/api/translations/:id', isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const adminId = req.user.claims.sub;
      
      const deleted = await dbStorage.deleteTranslation(id, adminId);
      if (deleted) {
        res.json({ message: "Translation deleted successfully" });
      } else {
        res.status(404).json({ message: "Translation not found" });
      }
    } catch (error) {
      console.error("Error deleting translation:", error);
      res.status(500).json({ message: "Failed to delete translation" });
    }
  });

  // Get translations for client-side use (combined English and Arabic)
  app.get('/api/i18n/:language', async (req, res) => {
    try {
      const { language } = req.params;
      const namespace = (req.query.namespace as string) || "common";
      
      // Get all translations for the namespace
      const translations = await dbStorage.getTranslationsByNamespace(namespace);
      
      // Build the translation object
      const translationObject: any = {};
      
      for (const translation of translations) {
        // Build nested object from dot notation key
        const keys = translation.key.split('.');
        let current = translationObject;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        // Set the value based on language (support ar, ar-SA, ar-EG, etc.)
        const isArabic = language === 'ar' || language.startsWith('ar-');
        current[keys[keys.length - 1]] = isArabic ? translation.arabic : translation.english;
      }
      
      res.json(translationObject);
    } catch (error) {
      console.error("Error fetching i18n translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  // Register prompt template routes
  app.use('/api/prompt-templates', promptTemplatesRoutes);
  
  // Register image reference routes
  app.use('/api/image-references', imageReferencesRoutes);
  
  // Register film studio routes
  app.use(filmStudioRoutes);

  // Register pricing page routes
  app.use('/api/pricing-page', pricingPageRoutes);

  // Register upscale routes
  app.use('/api/upscale', upscaleRoutes);

  // RANDOM PROMPTS MANAGEMENT ENDPOINTS (Admin only)
  
  // Get all random prompts
  app.get("/api/admin/random-prompts", isAdmin, async (req, res) => {
    try {
      const prompts = await dbStorage.getAllRandomPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching random prompts:", error);
      res.status(500).json({ message: "Failed to fetch random prompts" });
    }
  });

  // Get random prompts count
  app.get("/api/admin/random-prompts/count", isAdmin, async (req, res) => {
    try {
      const count = await dbStorage.getRandomPromptsCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching prompts count:", error);
      res.status(500).json({ message: "Failed to fetch prompts count" });
    }
  });

  // Save random prompts from textarea (replaces all existing prompts)
  app.post("/api/admin/random-prompts/save", isAdmin, async (req, res) => {
    try {
      const { prompts } = req.body;
      
      if (!prompts || typeof prompts !== 'string') {
        return res.status(400).json({ message: "Prompts text is required" });
      }

      // Split by newlines and filter out empty lines
      const promptLines = prompts
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      // Delete all existing prompts
      await dbStorage.deleteAllRandomPrompts();

      // Insert new prompts
      if (promptLines.length > 0) {
        await dbStorage.createRandomPrompts(promptLines);
      }

      await dbStorage.createAdminLog({
        adminId: (req as any).adminUser.id,
        action: "update_random_prompts",
        targetType: "random_prompts",
        targetId: "all",
        details: { count: promptLines.length, method: "textarea" }
      });

      res.json({ 
        success: true, 
        count: promptLines.length,
        message: `Successfully saved ${promptLines.length} prompts`
      });
    } catch (error) {
      console.error("Error saving random prompts:", error);
      res.status(500).json({ message: "Failed to save random prompts" });
    }
  });

  // Upload CSV file with random prompts (replaces all existing prompts)
  const csvUpload = multer({ storage: multer.memoryStorage() });
  
  app.post("/api/admin/random-prompts/upload", isAdmin, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      // Read CSV content from buffer
      const csvContent = req.file.buffer.toString('utf-8');
      
      // Split by newlines and filter out empty lines
      const promptLines = csvContent
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      if (promptLines.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      // Delete all existing prompts
      await dbStorage.deleteAllRandomPrompts();

      // Insert new prompts
      await dbStorage.createRandomPrompts(promptLines);

      await dbStorage.createAdminLog({
        adminId: (req as any).adminUser.id,
        action: "update_random_prompts",
        targetType: "random_prompts",
        targetId: "all",
        details: { count: promptLines.length, method: "csv_upload", filename: req.file.originalname }
      });

      res.json({ 
        success: true, 
        count: promptLines.length,
        message: `Successfully uploaded ${promptLines.length} prompts from ${req.file.originalname}`
      });
    } catch (error) {
      console.error("Error uploading random prompts CSV:", error);
      res.status(500).json({ message: "Failed to upload CSV file" });
    }
  });

  // FAILED GENERATION CLEANUP ENDPOINTS

  // Get failed videos (admin only)
  app.get("/api/admin/failed-videos", isAdmin, async (req, res) => {
    try {
      const failedVideos = await dbStorage.getFailedVideos();
      console.log(`Found ${failedVideos.length} failed videos`);
      res.json(failedVideos);
    } catch (error) {
      console.error("Error fetching failed videos:", error);
      res.status(500).json({ message: "Failed to fetch failed videos" });
    }
  });

  // Clean up failed videos (admin only)
  app.post("/api/admin/cleanup-failed-videos", isAdmin, async (req, res) => {
    try {
      console.log("Starting cleanup of failed videos...");
      
      // First get all failed videos to process refunds
      const failedVideos = await dbStorage.getFailedVideos();
      let refundsProcessed = 0;

      // Process refunds for each failed video
      for (const video of failedVideos) {
        const refunded = await dbStorage.refundCreditsForFailedVideo(video.id);
        if (refunded) {
          refundsProcessed++;
        }
      }

      // Now delete all failed videos
      const deletedCount = await dbStorage.deleteFailedVideos();
      
      console.log(`Cleanup complete: ${deletedCount} failed videos deleted, ${refundsProcessed} refunds processed`);
      
      res.json({
        message: `Cleanup complete: ${deletedCount} failed videos deleted, ${refundsProcessed} refunds processed`,
        deletedVideos: deletedCount,
        refundsProcessed
      });
    } catch (error) {
      console.error("Error during failed video cleanup:", error);
      res.status(500).json({ message: "Failed to cleanup failed videos" });
    }
  });

  // Clean up user's failed videos (authenticated user)
  app.post("/api/videos/cleanup-failed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Starting cleanup of failed videos for user ${userId}...`);
      
      // First get user's failed videos to process refunds
      const failedVideos = await dbStorage.getFailedVideos(userId);
      let refundsProcessed = 0;

      // Process refunds for each failed video
      for (const video of failedVideos) {
        const refunded = await dbStorage.refundCreditsForFailedVideo(video.id);
        if (refunded) {
          refundsProcessed++;
        }
      }

      // Now delete user's failed videos
      const deletedCount = await dbStorage.deleteFailedVideos(userId);
      
      console.log(`User ${userId} cleanup complete: ${deletedCount} failed videos deleted, ${refundsProcessed} refunds processed`);
      
      res.json({
        message: `Cleanup complete: ${deletedCount} failed videos deleted, ${refundsProcessed} refunds processed`,
        deletedVideos: deletedCount,
        refundsProcessed
      });
    } catch (error) {
      console.error("Error during user failed video cleanup:", error);
      res.status(500).json({ message: "Failed to cleanup failed videos" });
    }
  });

  // Contact form submission (public - no authentication required)
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSubmissionSchema.parse(req.body);
      
      const submission = await dbStorage.createContactSubmission(validatedData);
      
      // Optionally send email notification to admin
      try {
        await emailService.sendContactFormNotification(
          validatedData.name,
          validatedData.email,
          validatedData.subject,
          validatedData.message
        );
      } catch (emailError) {
        console.error("Failed to send contact form notification email:", emailError);
        // Continue even if email fails
      }
      
      res.json({ success: true, message: "Your message has been sent successfully" });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
    }
  });

  // Get all contact submissions (admin only)
  app.get("/api/admin/contact-submissions", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const submissions = await dbStorage.getAllContactSubmissions(status);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching contact submissions:", error);
      res.status(500).json({ message: "Failed to fetch contact submissions" });
    }
  });

  // Get unread contact submissions count (admin only)
  app.get("/api/admin/contact-submissions/unread-count", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const count = await dbStorage.getUnreadContactSubmissionsCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Update contact submission status (admin only)
  app.patch("/api/admin/contact-submissions/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, adminNote } = req.body;
      
      if (!status || !['unread', 'read', 'replied'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updated = await dbStorage.updateContactSubmissionStatus(id, status, adminNote);
      
      if (!updated) {
        return res.status(404).json({ message: "Contact submission not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating contact submission:", error);
      res.status(500).json({ message: "Failed to update contact submission" });
    }
  });

  // Delete contact submission (admin only)
  app.delete("/api/admin/contact-submissions/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await dbStorage.deleteContactSubmission(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Contact submission not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact submission:", error);
      res.status(500).json({ message: "Failed to delete contact submission" });
    }
  });

  // Teaser gallery endpoints (public)
  app.get("/api/teaser-gallery", async (req, res) => {
    try {
      const items = await dbStorage.getTeaserGalleryItems();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(items);
    } catch (error) {
      console.error("Error fetching teaser gallery items:", error);
      res.status(500).json({ message: "Failed to fetch teaser gallery items" });
    }
  });

  // Admin teaser gallery management
  app.get("/api/admin/teaser-gallery", isAdmin, async (req, res) => {
    try {
      const items = await dbStorage.getAllTeaserGalleryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching teaser gallery items:", error);
      res.status(500).json({ message: "Failed to fetch teaser gallery items" });
    }
  });

  app.post("/api/admin/teaser-gallery", isAdmin, async (req, res) => {
    try {
      const validatedData = insertTeaserGalleryItemSchema.parse(req.body);
      const item = await dbStorage.createTeaserGalleryItem(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Error creating teaser gallery item:", error);
      res.status(500).json({ message: "Failed to create teaser gallery item" });
    }
  });

  app.post("/api/admin/teaser-gallery/upload", isAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const objectStorage = createStorageService();
      const imageUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'teaser-gallery'
      );
      
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Error uploading teaser gallery image:", error);
      res.status(500).json({ message: error.message || "Failed to upload image" });
    }
  });

  app.patch("/api/admin/teaser-gallery/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await dbStorage.updateTeaserGalleryItem(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Teaser gallery item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating teaser gallery item:", error);
      res.status(500).json({ message: "Failed to update teaser gallery item" });
    }
  });

  app.delete("/api/admin/teaser-gallery/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await dbStorage.deleteTeaserGalleryItem(id);
      if (!deleted) {
        return res.status(404).json({ message: "Teaser gallery item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting teaser gallery item:", error);
      res.status(500).json({ message: "Failed to delete teaser gallery item" });
    }
  });

  app.patch("/api/admin/teaser-gallery/:id/sort", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sortOrder } = req.body;
      const item = await dbStorage.updateTeaserGalleryItemSortOrder(id, sortOrder);
      if (!item) {
        return res.status(404).json({ message: "Teaser gallery item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating teaser gallery item sort order:", error);
      res.status(500).json({ message: "Failed to update sort order" });
    }
  });

  // Teaser showcase video endpoints (public)
  app.get("/api/teaser-showcase-video", async (req, res) => {
    try {
      const video = await dbStorage.getTeaserShowcaseVideo();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(video || null);
    } catch (error) {
      console.error("Error fetching teaser showcase video:", error);
      res.status(500).json({ message: "Failed to fetch teaser showcase video" });
    }
  });

  // Admin teaser showcase video management
  app.get("/api/admin/teaser-showcase-video", isAdmin, async (req, res) => {
    try {
      const video = await dbStorage.getOrCreateTeaserShowcaseVideo();
      res.json(video);
    } catch (error) {
      console.error("Error fetching teaser showcase video:", error);
      res.status(500).json({ message: "Failed to fetch teaser showcase video" });
    }
  });

  app.patch("/api/admin/teaser-showcase-video", isAdmin, async (req, res) => {
    try {
      const video = await dbStorage.updateTeaserShowcaseVideo(req.body);
      res.json(video);
    } catch (error) {
      console.error("Error updating teaser showcase video:", error);
      res.status(500).json({ message: "Failed to update teaser showcase video" });
    }
  });

  app.post("/api/admin/teaser-showcase-video/upload", isAdmin, videoUpload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file uploaded" });
      }

      const objectStorage = createStorageService();
      const videoUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'teaser-showcase'
      );
      
      res.json({ videoUrl });
    } catch (error: any) {
      console.error("Error uploading teaser showcase video:", error);
      res.status(500).json({ message: error.message || "Failed to upload video" });
    }
  });

  // Hero videos endpoints (public)
  app.get("/api/hero-videos", async (req, res) => {
    try {
      const videos = await dbStorage.getHeroVideos();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(videos || null);
    } catch (error) {
      console.error("Error fetching hero videos:", error);
      res.status(500).json({ message: "Failed to fetch hero videos" });
    }
  });

  // Admin hero videos management
  app.get("/api/admin/hero-videos", isAdmin, async (req, res) => {
    try {
      const videos = await dbStorage.getOrCreateHeroVideos();
      res.json(videos);
    } catch (error) {
      console.error("Error fetching hero videos:", error);
      res.status(500).json({ message: "Failed to fetch hero videos" });
    }
  });

  app.patch("/api/admin/hero-videos", isAdmin, async (req, res) => {
    try {
      const videos = await dbStorage.updateHeroVideos(req.body);
      res.json(videos);
    } catch (error) {
      console.error("Error updating hero videos:", error);
      res.status(500).json({ message: "Failed to update hero videos" });
    }
  });

  app.post("/api/admin/hero-videos/upload", isAdmin, videoUpload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file uploaded" });
      }

      const objectStorage = createStorageService();
      const videoUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'hero-videos'
      );
      
      res.json({ videoUrl });
    } catch (error: any) {
      console.error("Error uploading hero video:", error);
      res.status(500).json({ message: error.message || "Failed to upload video" });
    }
  });

  // ==================== HOMEPAGE CONTENT ROUTES ====================

  // Homepage service cards (public)
  app.get("/api/homepage/service-cards", async (req, res) => {
    try {
      const cards = await dbStorage.getActiveHomepageServiceCards();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(cards);
    } catch (error) {
      console.error("Error fetching homepage service cards:", error);
      res.set('Cache-Control', 'no-store');
      res.json([]);
    }
  });

  // Admin homepage service cards management
  app.get("/api/admin/homepage/service-cards", isAdmin, async (req, res) => {
    try {
      const cards = await dbStorage.getHomepageServiceCards();
      res.json(cards);
    } catch (error) {
      console.error("Error fetching homepage service cards:", error);
      res.status(500).json({ message: "Failed to fetch service cards" });
    }
  });

  app.post("/api/admin/homepage/service-cards", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminUser.id;
      const card = await dbStorage.createHomepageServiceCard({
        ...req.body,
        updatedBy: adminId
      });
      res.json(card);
    } catch (error) {
      console.error("Error creating homepage service card:", error);
      res.status(500).json({ message: "Failed to create service card" });
    }
  });

  app.patch("/api/admin/homepage/service-cards/:id", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminUser.id;
      const card = await dbStorage.updateHomepageServiceCard(
        parseInt(req.params.id),
        req.body,
        adminId
      );
      if (!card) {
        return res.status(404).json({ message: "Service card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error updating homepage service card:", error);
      res.status(500).json({ message: "Failed to update service card" });
    }
  });

  app.delete("/api/admin/homepage/service-cards/:id", isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminUser.id;
      const success = await dbStorage.deleteHomepageServiceCard(
        parseInt(req.params.id),
        adminId
      );
      if (!success) {
        return res.status(404).json({ message: "Service card not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting homepage service card:", error);
      res.status(500).json({ message: "Failed to delete service card" });
    }
  });

  app.post("/api/admin/homepage/service-cards/upload", isAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const objectStorage = createStorageService();
      const imageUrl = await objectStorage.uploadBufferToStorage(
        req.file.buffer,
        req.file.mimetype,
        'homepage-service-cards'
      );
      
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Error uploading service card image:", error);
      res.status(500).json({ message: error.message || "Failed to upload image" });
    }
  });

  // Homepage promotion bar (public)
  app.get("/api/homepage/promotion-bar", async (req, res) => {
    try {
      const bar = await dbStorage.getHomepagePromotionBar();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(bar || null);
    } catch (error) {
      console.error("Error fetching homepage promotion bar:", error);
      res.status(500).json({ message: "Failed to fetch promotion bar" });
    }
  });

  // Admin homepage promotion bar management
  app.get("/api/admin/homepage/promotion-bar", isAdmin, async (req, res) => {
    try {
      const bar = await dbStorage.getHomepagePromotionBar();
      res.json(bar || null);
    } catch (error) {
      console.error("Error fetching homepage promotion bar:", error);
      res.status(500).json({ message: "Failed to fetch promotion bar" });
    }
  });

  app.put("/api/admin/homepage/promotion-bar", isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const bar = await dbStorage.upsertHomepagePromotionBar({
        ...req.body,
        updatedBy: user.id
      });
      res.json(bar);
    } catch (error) {
      console.error("Error updating homepage promotion bar:", error);
      res.status(500).json({ message: "Failed to update promotion bar" });
    }
  });

  // Homepage featured items (public)
  app.get("/api/homepage/featured-items", async (req, res) => {
    try {
      const items = await dbStorage.getHomepageFeaturedItems();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(items);
    } catch (error) {
      console.error("Error fetching homepage featured items:", error);
      res.set('Cache-Control', 'no-store');
      res.json([]);
    }
  });

  // Admin homepage featured items management
  app.get("/api/admin/homepage/featured-items", isAdmin, async (req, res) => {
    try {
      const items = await dbStorage.getHomepageFeaturedItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching homepage featured items:", error);
      res.status(500).json({ message: "Failed to fetch featured items" });
    }
  });

  app.post("/api/admin/homepage/featured-items", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { itemType, itemId, sortOrder } = req.body;
      const item = await dbStorage.addHomepageFeaturedItem({
        itemType,
        itemId,
        sortOrder: sortOrder || 0,
        isActive: true,
        updatedBy: adminUser.id
      });
      res.json(item);
    } catch (error) {
      console.error("Error adding homepage featured item:", error);
      res.status(500).json({ message: "Failed to add featured item" });
    }
  });

  app.delete("/api/admin/homepage/featured-items/:id", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const success = await dbStorage.removeHomepageFeaturedItem(
        parseInt(req.params.id),
        adminUser.id
      );
      if (!success) {
        return res.status(404).json({ message: "Featured item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing homepage featured item:", error);
      res.status(500).json({ message: "Failed to remove featured item" });
    }
  });

  app.patch("/api/admin/homepage/featured-items/:id/sort", isAdmin, async (req, res) => {
    try {
      const { sortOrder } = req.body;
      const item = await dbStorage.updateHomepageFeaturedItemOrder(
        parseInt(req.params.id),
        sortOrder
      );
      if (!item) {
        return res.status(404).json({ message: "Featured item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating featured item order:", error);
      res.status(500).json({ message: "Failed to update featured item order" });
    }
  });

  // Homepage CTA (public)
  app.get("/api/homepage/cta", async (req, res) => {
    try {
      const cta = await dbStorage.getHomepageCta();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.json(cta || null);
    } catch (error) {
      console.error("Error fetching homepage CTA:", error);
      res.status(500).json({ message: "Failed to fetch CTA" });
    }
  });

  // Admin homepage CTA management
  app.get("/api/admin/homepage/cta", isAdmin, async (req, res) => {
    try {
      const cta = await dbStorage.getHomepageCta();
      res.json(cta || null);
    } catch (error) {
      console.error("Error fetching homepage CTA:", error);
      res.status(500).json({ message: "Failed to fetch CTA" });
    }
  });

  app.put("/api/admin/homepage/cta", isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const cta = await dbStorage.upsertHomepageCta({
        ...req.body,
        updatedBy: user.id
      });
      res.json(cta);
    } catch (error) {
      console.error("Error updating homepage CTA:", error);
      res.status(500).json({ message: "Failed to update CTA" });
    }
  });

  // =============================================================================
  // PUBLIC GALLERY CURATED ITEMS ROUTES
  // =============================================================================

  // Public endpoint - get curated public gallery items for /gallery page
  app.get("/api/gallery/curated", async (req, res) => {
    try {
      const items = await dbStorage.getActivePublicGalleryItems();
      res.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
      res.json(items);
    } catch (error) {
      console.error("Error fetching curated gallery items:", error);
      res.status(500).json({ message: "Failed to fetch gallery items" });
    }
  });

  // Paginated endpoint for optimized gallery loading with cursor-based pagination
  app.get("/api/gallery/curated/paginated", async (req, res) => {
    try {
      const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 24, 50); // Max 50 items per page
      
      const result = await dbStorage.getActivePublicGalleryItemsPaginated(cursor, limit);
      
      // Aggressive caching for gallery pages
      res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated gallery items:", error);
      res.status(500).json({ message: "Failed to fetch gallery items" });
    }
  });

  // Admin - get all public gallery curated items
  app.get("/api/admin/gallery/items", isAdmin, async (req, res) => {
    try {
      const items = await dbStorage.getPublicGalleryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching public gallery items:", error);
      res.status(500).json({ message: "Failed to fetch gallery items" });
    }
  });

  // Admin - add item to public gallery
  app.post("/api/admin/gallery/items", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { itemType, itemId, isFeatured, isStickyTop, sortOrder } = req.body;
      const item = await dbStorage.addPublicGalleryItem({
        itemType,
        itemId,
        isFeatured: isFeatured || false,
        isStickyTop: isStickyTop || false,
        sortOrder: sortOrder || 0,
        isActive: true,
        updatedBy: adminUser.id
      });
      res.json(item);
    } catch (error) {
      console.error("Error adding public gallery item:", error);
      res.status(500).json({ message: "Failed to add gallery item" });
    }
  });

  // Admin - update public gallery item (featured/sticky status)
  app.patch("/api/admin/gallery/items/:id", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const id = parseInt(req.params.id);
      const updates = req.body;
      const item = await dbStorage.updatePublicGalleryItem(id, updates, adminUser.id);
      if (!item) {
        return res.status(404).json({ message: "Gallery item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating public gallery item:", error);
      res.status(500).json({ message: "Failed to update gallery item" });
    }
  });

  // Admin - remove item from public gallery
  app.delete("/api/admin/gallery/items/:id", isAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const success = await dbStorage.removePublicGalleryItem(
        parseInt(req.params.id),
        adminUser.id
      );
      if (!success) {
        return res.status(404).json({ message: "Gallery item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing public gallery item:", error);
      res.status(500).json({ message: "Failed to remove gallery item" });
    }
  });

  // =============================================================================
  // SUBSCRIPTION & CREDITS ADMIN ROUTES
  // =============================================================================

  // Get all subscription plans (admin)
  app.get("/api/admin/subscription-plans", isAdmin, async (req, res) => {
    try {
      const plans = await dbStorage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Get subscription plan by ID
  app.get("/api/admin/subscription-plans/:id", isAdmin, async (req, res) => {
    try {
      const plan = await dbStorage.getSubscriptionPlan(parseInt(req.params.id));
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching subscription plan:", error);
      res.status(500).json({ message: "Failed to fetch subscription plan" });
    }
  });

  // Create subscription plan
  app.post("/api/admin/subscription-plans", isAdmin, async (req: any, res) => {
    try {
      const plan = await dbStorage.createSubscriptionPlan(req.body);
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "create_subscription_plan",
        targetType: "subscription_plan",
        targetId: plan.id.toString(),
        details: { planName: plan.name }
      });
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating subscription plan:", error);
      res.status(500).json({ message: "Failed to create subscription plan" });
    }
  });

  // Update subscription plan
  app.patch("/api/admin/subscription-plans/:id", isAdmin, async (req: any, res) => {
    try {
      const plan = await dbStorage.updateSubscriptionPlan(parseInt(req.params.id), req.body);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "update_subscription_plan",
        targetType: "subscription_plan",
        targetId: plan.id.toString(),
        details: { updates: Object.keys(req.body) }
      });
      res.json(plan);
    } catch (error) {
      console.error("Error updating subscription plan:", error);
      res.status(500).json({ message: "Failed to update subscription plan" });
    }
  });

  // Get all topup packs (admin)
  app.get("/api/admin/topup-packs", isAdmin, async (req, res) => {
    try {
      const packs = await dbStorage.getTopupPacks();
      res.json(packs);
    } catch (error) {
      console.error("Error fetching topup packs:", error);
      res.status(500).json({ message: "Failed to fetch topup packs" });
    }
  });

  // Get topup pack by ID
  app.get("/api/admin/topup-packs/:id", isAdmin, async (req, res) => {
    try {
      const pack = await dbStorage.getTopupPack(parseInt(req.params.id));
      if (!pack) {
        return res.status(404).json({ message: "Topup pack not found" });
      }
      res.json(pack);
    } catch (error) {
      console.error("Error fetching topup pack:", error);
      res.status(500).json({ message: "Failed to fetch topup pack" });
    }
  });

  // Create topup pack
  app.post("/api/admin/topup-packs", isAdmin, async (req: any, res) => {
    try {
      const pack = await dbStorage.createTopupPack(req.body);
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "create_topup_pack",
        targetType: "topup_pack",
        targetId: pack.id.toString(),
        details: { packName: pack.name }
      });
      res.status(201).json(pack);
    } catch (error) {
      console.error("Error creating topup pack:", error);
      res.status(500).json({ message: "Failed to create topup pack" });
    }
  });

  // Update topup pack
  app.patch("/api/admin/topup-packs/:id", isAdmin, async (req: any, res) => {
    try {
      const pack = await dbStorage.updateTopupPack(parseInt(req.params.id), req.body);
      if (!pack) {
        return res.status(404).json({ message: "Topup pack not found" });
      }
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "update_topup_pack",
        targetType: "topup_pack",
        targetId: pack.id.toString(),
        details: { updates: Object.keys(req.body) }
      });
      res.json(pack);
    } catch (error) {
      console.error("Error updating topup pack:", error);
      res.status(500).json({ message: "Failed to update topup pack" });
    }
  });

  // Delete topup pack
  app.delete("/api/admin/topup-packs/:id", isAdmin, async (req: any, res) => {
    try {
      await dbStorage.deleteTopupPack(parseInt(req.params.id), req.adminUser.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting topup pack:", error);
      res.status(500).json({ message: "Failed to delete topup pack" });
    }
  });

  // Get all coupons (admin)
  app.get("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const coupons = await dbStorage.getCoupons();
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Get coupon by ID
  app.get("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const coupon = await dbStorage.getCoupon(parseInt(req.params.id));
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  // Create coupon
  app.post("/api/admin/coupons", isAdmin, async (req: any, res) => {
    try {
      const coupon = await dbStorage.createCoupon(req.body);
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "create_coupon",
        targetType: "coupon",
        targetId: coupon.id.toString(),
        details: { couponCode: coupon.code }
      });
      res.status(201).json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  // Update coupon
  app.patch("/api/admin/coupons/:id", isAdmin, async (req: any, res) => {
    try {
      const coupon = await dbStorage.updateCoupon(parseInt(req.params.id), req.body);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "update_coupon",
        targetType: "coupon",
        targetId: coupon.id.toString(),
        details: { updates: Object.keys(req.body) }
      });
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // Delete coupon
  app.delete("/api/admin/coupons/:id", isAdmin, async (req: any, res) => {
    try {
      await dbStorage.deleteCoupon(parseInt(req.params.id), req.adminUser.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // Get coupon redemptions for a coupon
  app.get("/api/admin/coupons/:id/redemptions", isAdmin, async (req, res) => {
    try {
      const redemptions = await dbStorage.getCouponRedemptionsForCoupon(parseInt(req.params.id));
      res.json(redemptions);
    } catch (error) {
      console.error("Error fetching coupon redemptions:", error);
      res.status(500).json({ message: "Failed to fetch coupon redemptions" });
    }
  });

  // Get user subscription
  app.get("/api/admin/users/:userId/subscription", isAdmin, async (req, res) => {
    try {
      const subscription = await dbStorage.getUserSubscription(req.params.userId);
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }
      const plan = await dbStorage.getSubscriptionPlan(subscription.planId);
      res.json({ ...subscription, planName: plan?.displayName });
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Failed to fetch user subscription" });
    }
  });

  // Manually assign a plan to a user
  app.post("/api/admin/users/:userId/assign-plan", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      
      const plan = await dbStorage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      
      // Create or update subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + plan.billingPeriodMonths);
      
      const existingSubscription = await dbStorage.getUserSubscription(userId);
      
      let subscription;
      if (existingSubscription) {
        subscription = await dbStorage.updateUserSubscription(existingSubscription.id, {
          planId,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        });
      } else {
        subscription = await dbStorage.createUserSubscription({
          userId,
          planId,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
      }
      
      // Grant plan credits if applicable
      if (plan.includedCredits > 0) {
        await creditService.grantAdminCredits(
          userId,
          plan.includedCredits,
          `Plan assignment: ${plan.displayName}`,
          periodEnd,
          req.adminUser.id
        );
      }
      
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "assign_plan",
        targetType: "user",
        targetId: userId,
        details: { planId, planName: plan.displayName }
      });
      
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error assigning plan:", error);
      res.status(500).json({ message: "Failed to assign plan" });
    }
  });

  // Cancel user subscription
  app.post("/api/admin/users/:userId/cancel-subscription", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { immediately } = req.body;
      
      const subscription = await dbStorage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ message: "No subscription found" });
      }
      
      if (immediately) {
        await dbStorage.updateUserSubscription(subscription.id, {
          status: "canceled",
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        });
      } else {
        await dbStorage.updateUserSubscription(subscription.id, {
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        });
      }
      
      await dbStorage.createAdminLog({
        adminId: req.adminUser.id,
        action: "cancel_subscription",
        targetType: "user",
        targetId: userId,
        details: { immediately, subscriptionId: subscription.id }
      });
      
      res.json({ message: "Subscription cancelled" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Grant or deduct admin credits to a user
  app.post("/api/admin/users/:userId/credits", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { amount, reason, expiresAt } = req.body;
      
      if (!amount || amount === 0) {
        return res.status(400).json({ message: "Amount must be a non-zero number" });
      }
      
      const isDeduction = amount < 0;
      const absAmount = Math.abs(amount);
      
      if (isDeduction) {
        // For deductions, use the deduct function
        const transaction = await creditService.deductCredits(
          userId,
          absAmount,
          reason || "Admin credit deduction",
          { type: "admin_deduction", adminId: req.adminUser.id }
        );
        if (!transaction) {
          return res.status(400).json({ message: "Insufficient credits for deduction" });
        }
        await dbStorage.createAdminLog({
          adminId: req.adminUser.id,
          action: "deduct_credits",
          targetType: "user",
          targetId: userId,
          details: { amount: absAmount, reason }
        });
        res.status(200).json({ success: true, amount: -absAmount });
      } else {
        // For grants, add credits
        const entry = await creditService.grantAdminCredits(
          userId,
          absAmount,
          reason || "Admin credit grant",
          expiresAt ? new Date(expiresAt) : null,
          req.adminUser.id
        );
        await dbStorage.createAdminLog({
          adminId: req.adminUser.id,
          action: "grant_credits",
          targetType: "user",
          targetId: userId,
          details: { amount: absAmount, reason, expiresAt }
        });
        res.status(201).json(entry);
      }
    } catch (error) {
      console.error("Error managing credits:", error);
      res.status(500).json({ message: "Failed to manage credits" });
    }
  });

  // Get user entitlements (credits, plan, features)
  app.get("/api/admin/users/:userId/entitlements", isAdmin, async (req, res) => {
    try {
      const entitlements = await creditService.getUserEntitlements(req.params.userId);
      res.json(entitlements);
    } catch (error) {
      console.error("Error fetching user entitlements:", error);
      res.status(500).json({ message: "Failed to fetch user entitlements" });
    }
  });

  // Get user credit ledger history
  app.get("/api/admin/users/:userId/credit-ledger", isAdmin, async (req, res) => {
    try {
      const ledger = await creditService.getCreditLedgerHistory(req.params.userId);
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching credit ledger:", error);
      res.status(500).json({ message: "Failed to fetch credit ledger" });
    }
  });

  // =============================================================================
  // PUBLIC SUBSCRIPTION ROUTES (for users)
  // =============================================================================

  // Get active subscription plans (public)
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await dbStorage.getActiveSubscriptionPlans();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Get active topup packs (public)
  app.get("/api/topup-packs", async (req, res) => {
    try {
      const packs = await dbStorage.getActiveTopupPacks();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(packs);
    } catch (error) {
      console.error("Error fetching topup packs:", error);
      res.status(500).json({ message: "Failed to fetch topup packs" });
    }
  });

  // Get current user's entitlements
  app.get("/api/me/entitlements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entitlements = await creditService.getUserEntitlements(userId);
      res.json(entitlements);
    } catch (error) {
      console.error("Error fetching user entitlements:", error);
      res.status(500).json({ message: "Failed to fetch entitlements" });
    }
  });

  // =============================================================================
  // STRIPE PAYMENT ROUTES
  // =============================================================================

  // Create Stripe checkout session for subscription
  app.post("/api/stripe/checkout/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planId, isAnnual, couponCode, successUrl, cancelUrl } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      
      const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }
      
      const session = await stripeService.createCheckoutSessionForSubscription(
        userId,
        parseInt(planId),
        couponCode,
        successUrl,
        cancelUrl,
        isAnnual === true
      );
      
      res.json(session);
    } catch (error: any) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Create Stripe checkout session for top-up
  app.post("/api/stripe/checkout/topup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packId, couponCode, successUrl, cancelUrl } = req.body;
      
      if (!packId) {
        return res.status(400).json({ message: "Pack ID is required" });
      }
      
      const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }
      
      const session = await stripeService.createCheckoutSessionForTopup(
        userId,
        parseInt(packId),
        couponCode,
        successUrl,
        cancelUrl
      );
      
      res.json(session);
    } catch (error: any) {
      console.error("Error creating topup checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Create Stripe billing portal session
  app.post("/api/stripe/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { returnUrl } = req.body;
      
      const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing is not configured" });
      }
      
      const session = await stripeService.createCustomerPortalSession(userId, returnUrl);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create billing portal session" });
    }
  });

  // Check Stripe configuration status
  app.get("/api/stripe/status", async (req, res) => {
    const { isStripeConfigured } = await import("./services/stripe-service");
    res.json({ configured: isStripeConfigured() });
  });

  // Stripe webhook endpoint (must use raw body)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      
      if (!signature) {
        return res.status(400).json({ message: "Missing stripe-signature header" });
      }
      
      const { stripeService, isStripeConfigured } = await import("./services/stripe-service");
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Stripe not configured" });
      }
      
      await stripeService.handleWebhook(req.body, signature);
      res.json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ message: error.message || "Webhook handling failed" });
    }
  });

  // Validate and apply a coupon code
  app.post("/api/coupons/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Coupon code is required" });
      }
      
      const coupon = await dbStorage.getCouponByCode(code);
      
      if (!coupon) {
        return res.status(404).json({ message: "Invalid coupon code" });
      }
      
      if (!coupon.isActive) {
        return res.status(400).json({ message: "This coupon is no longer active" });
      }
      
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This coupon has expired" });
      }
      
      if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
        return res.status(400).json({ message: "This coupon has reached its maximum usage limit" });
      }
      
      const hasRedeemed = await dbStorage.hasUserRedeemedCoupon(userId, coupon.id);
      if (hasRedeemed) {
        return res.status(400).json({ message: "You have already used this coupon" });
      }
      
      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          appliesTo: coupon.appliesTo
        }
      });
    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({ message: "Failed to validate coupon" });
    }
  });

  // User notifications endpoints
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await dbStorage.getUserNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await dbStorage.getUnreadNotificationsCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = parseInt(req.params.id);
      const notification = await dbStorage.markNotificationAsRead(notificationId, userId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await dbStorage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notificationId = parseInt(req.params.id);
      const success = await dbStorage.deleteNotification(notificationId, userId);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Scheduled job endpoint for renewal reminders (should be called by cron/scheduler)
  app.post("/api/internal/process-renewal-reminders", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const internalSecret = process.env.INTERNAL_API_SECRET || "default-internal-secret";
      
      if (authHeader !== `Bearer ${internalSecret}`) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { notificationService } = await import("./services/notification-service");
      await notificationService.processRenewalReminders();
      res.json({ success: true, message: "Renewal reminders processed" });
    } catch (error) {
      console.error("Error processing renewal reminders:", error);
      res.status(500).json({ message: "Failed to process renewal reminders" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
