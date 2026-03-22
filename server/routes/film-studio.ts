import { Router } from "express";
import { storage } from "../storage";
import { insertFilmProjectSchema, insertStoryboardSceneSchema, insertSceneVersionSchema } from "@shared/schema";
import { generateStoryboard, regenerateSceneText, regenerateImagePrompt, regenerateVideoPrompt } from "../storyboard-generator";
import { isAuthenticated } from "../auth";
import { z } from "zod";
import { referenceImageUpload, uploadRefImageToStorage, buildRefImagePublicUrl } from "../ref-image-upload";
import { creditService } from "../services/credit-service";
import { requireFilmStudio } from "../security-middleware";
import { moderatePrompt, buildModerationErrorResponse } from "../prompt-moderation";

const router = Router();

const regeneratePromptSchema = z.object({
  model: z.enum(["gpt-5-nano", "gpt-5"]).optional().default("gpt-5-nano")
});

router.get("/api/film-studio/projects", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const userId = (req.user as any).claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const projects = await storage.getFilmProjects(userId);
    res.json(projects);
  } catch (error) {
    console.error("Error fetching film projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/api/film-studio/projects/:id", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await storage.getFilmProject(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (project.ownerId !== (req.user as any).claims?.sub) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching film project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/api/film-studio/projects", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const userId = (req.user as any).claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const validatedData = insertFilmProjectSchema.parse({
      ...req.body,
      ownerId: userId
    });
    
    const project = await storage.createFilmProject({
      ...validatedData,
      ownerId: userId
    });
    
    res.json(project);
  } catch (error) {
    console.error("Error creating film project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/api/film-studio/projects/:id", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = (req.user as any).claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { title, idea, style, mood, cutsStyle, targetDuration, aspectRatio, cameraLanguage, pacing, visualEra, finalFilmUrl } = req.body;
    const updates: any = {};
    
    if (title !== undefined) updates.title = title;
    if (idea !== undefined) updates.idea = idea;
    if (style !== undefined) updates.style = style;
    if (mood !== undefined) updates.mood = mood;
    if (cutsStyle !== undefined) updates.cutsStyle = cutsStyle;
    if (targetDuration !== undefined) updates.targetDuration = targetDuration;
    if (aspectRatio !== undefined) updates.aspectRatio = aspectRatio;
    if (cameraLanguage !== undefined) updates.cameraLanguage = cameraLanguage;
    if (pacing !== undefined) updates.pacing = pacing;
    if (visualEra !== undefined) updates.visualEra = visualEra;
    if (finalFilmUrl !== undefined) updates.finalFilmUrl = finalFilmUrl;
    
    const project = await storage.updateFilmProject(projectId, updates, userId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found or access denied" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error updating film project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/api/film-studio/projects/:id", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = (req.user as any).claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const deleted = await storage.deleteFilmProject(projectId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Project not found or access denied" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting film project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/api/film-studio/projects/:id/generate-storyboard", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await storage.getFilmProject(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const userId = (req.user as any).claims?.sub;
    if (project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const existingScenes = await storage.getScenesByProject(projectId);
    for (const scene of existingScenes) {
      await storage.deleteScene(scene.id);
    }
    
    const model = "gpt-5"; // Always use GPT-5 for Film Studio
    
    // Calculate storyboard generation cost
    const operationId = "text.gpt5.storyboard";
    
    let creditCost = 6; // Default Film Studio pricing
    
    try {
      const costResult = await creditService.calculateOperationCost(operationId, { units: 1 });
      creditCost = costResult.credits;
    } catch (error) {
      console.warn(`[Storyboard] Operation ${operationId} not found in catalog, using legacy pricing: ${creditCost} credits`);
    }
    
    // Check and deduct credits
    const hasEnough = await creditService.hasEnoughCredits(userId, creditCost);
    if (!hasEnough) {
      const balance = await creditService.getUserBalance(userId);
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditCost,
        available: balance
      });
    }
    
    const generatedScenes = await generateStoryboard({
      idea: project.idea,
      style: project.style,
      mood: project.mood,
      cutsStyle: project.cutsStyle,
      targetDuration: project.targetDuration,
      aspectRatio: project.aspectRatio,
      cameraLanguage: project.cameraLanguage,
      pacing: project.pacing,
      visualEra: project.visualEra,
      scriptLanguage: project.scriptLanguage,
      model
    });
    
    const scenes = await Promise.all(
      generatedScenes.map(async (sceneData, index) => {
        const scene = await storage.createScene({
          projectId,
          sceneNumber: sceneData.sceneNumber,
          title: sceneData.title,
          description: sceneData.description,
          notes: sceneData.notes,
          suggestedDuration: sceneData.suggestedDuration,
          sortOrder: index,
          selectedForFinal: false
        });
        
        await storage.createSceneVersion({
          sceneId: scene.id,
          versionType: 'text',
          versionNumber: 1,
          title: sceneData.title,
          description: sceneData.description,
          notes: sceneData.notes,
          isActive: true
        });
        
        await storage.createSceneVersion({
          sceneId: scene.id,
          versionType: 'image',
          versionNumber: 1,
          imagePrompt: sceneData.imagePrompt,
          isActive: true
        });
        
        // Ensure video prompt is never empty - use description as fallback
        const videoPrompt = sceneData.videoPrompt?.trim() || 
          sceneData.description || 
          `${sceneData.title}: Camera movement and visual transition for this scene.`;
        
        await storage.createSceneVersion({
          sceneId: scene.id,
          versionType: 'video',
          versionNumber: 1,
          videoPrompt,
          isActive: true
        });
        
        return scene;
      })
    );
    
    // Deduct credits after successful generation
    const deductionResult = await creditService.deductCredits(
      userId,
      creditCost,
      `Storyboard generation: ${model}`,
      {
        projectId,
        model,
        sceneCount: generatedScenes.length
      }
    );
    
    if (!deductionResult) {
      console.error("[Storyboard] Failed to deduct credits after successful generation");
    }
    
    res.json({ 
      scenes,
      creditCost,
      remainingCredits: deductionResult?.balance
    });
  } catch (error) {
    console.error("Error generating storyboard:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate storyboard" });
  }
});

router.get("/api/film-studio/scenes/:projectId", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const project = await storage.getFilmProject(projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (project.ownerId !== (req.user as any).claims?.sub) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const scenes = await storage.getScenesByProject(projectId);
    res.json(scenes);
  } catch (error) {
    console.error("Error fetching scenes:", error);
    res.status(500).json({ error: "Failed to fetch scenes" });
  }
});

router.patch("/api/film-studio/scenes/:id", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const userId = (req.user as any).claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const scene = await storage.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    if (!project || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Validate updates using partial schema
    const updateSchema = insertStoryboardSceneSchema.partial().pick({
      title: true,
      description: true,
      notes: true
    });
    
    const validatedUpdates = updateSchema.parse(req.body);
    
    const updatedScene = await storage.updateScene(sceneId, validatedUpdates);
    
    if (!updatedScene) {
      return res.status(404).json({ error: "Failed to update scene" });
    }
    
    res.json(updatedScene);
  } catch (error) {
    console.error("Error updating scene:", error);
    res.status(500).json({ error: "Failed to update scene" });
  }
});

router.patch("/api/film-studio/scenes/:id/select", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const { selectedForFinal } = req.body;
    
    const scene = await storage.updateSceneSelection(sceneId, selectedForFinal);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    res.json(scene);
  } catch (error) {
    console.error("Error updating scene selection:", error);
    res.status(500).json({ error: "Failed to update scene selection" });
  }
});

router.post("/api/film-studio/scenes/:id/regenerate-text", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const scene = await storage.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    const userId = (req.user as any).claims?.sub;
    if (!project || !userId || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const model = "gpt-5"; // Always use GPT-5 for Film Studio
    const operationId = "text.gpt5.scene_regenerate";
    
    let creditCost = 1; // Default Film Studio pricing
    
    try {
      const costResult = await creditService.calculateOperationCost(operationId, { units: 1 });
      creditCost = costResult.credits;
    } catch (error) {
      console.warn(`[Scene Regenerate] Operation ${operationId} not found in catalog, using legacy pricing: ${creditCost} credits`);
    }
    
    const balance = await creditService.getUserBalance(userId);
    if (balance < creditCost) {
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditCost,
        available: balance
      });
    }
    
    const currentVersion = await storage.getActiveSceneVersion(sceneId, 'text');
    
    const regenerated = await regenerateSceneText(
      {
        title: currentVersion?.title || scene.title,
        description: currentVersion?.description || scene.description,
        notes: currentVersion?.notes || scene.notes || ""
      },
      {
        idea: project.idea,
        style: project.style,
        mood: project.mood,
        cutsStyle: project.cutsStyle,
        targetDuration: project.targetDuration,
        aspectRatio: project.aspectRatio,
        cameraLanguage: project.cameraLanguage,
        pacing: project.pacing,
        visualEra: project.visualEra
      },
      model
    );
    
    const versions = await storage.getSceneVersions(sceneId, 'text');
    const nextVersionNumber = Math.max(...versions.map(v => v.versionNumber || 1)) + 1;
    
    const newVersion = await storage.createSceneVersion({
      sceneId,
      versionType: 'text',
      versionNumber: nextVersionNumber,
      title: regenerated.title,
      description: regenerated.description,
      notes: regenerated.notes,
      isActive: false
    });
    
    await storage.setActiveSceneVersion(newVersion.id, sceneId, 'text');
    
    await creditService.deductCredits(
      userId,
      creditCost,
      `Scene text regeneration (${model})`,
      { 
        sceneId,
        projectId: project.id,
        model,
        operationId
      }
    );
    
    res.json(newVersion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error regenerating scene text:", error);
    res.status(500).json({ error: "Failed to regenerate scene text" });
  }
});

router.post("/api/film-studio/scenes/:id/regenerate-image-prompt", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const scene = await storage.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    const userId = (req.user as any).claims?.sub;
    if (!project || !userId || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const model = "gpt-5"; // Always use GPT-5 for Film Studio
    const operationId = "text.gpt5.image_prompt_regenerate";
    
    let creditCost = 1; // Default Film Studio pricing
    
    try {
      const costResult = await creditService.calculateOperationCost(operationId, { units: 1 });
      creditCost = costResult.credits;
    } catch (error) {
      console.warn(`[Image Prompt Regenerate] Operation ${operationId} not found in catalog, using legacy pricing: ${creditCost} credits`);
    }
    
    const balance = await creditService.getUserBalance(userId);
    if (balance < creditCost) {
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditCost,
        available: balance
      });
    }
    
    const currentImageVersion = await storage.getActiveSceneVersion(sceneId, 'image');
    
    if (!currentImageVersion || !currentImageVersion.imagePrompt) {
      return res.status(400).json({ error: "No image prompt found for this scene" });
    }
    
    const currentTextVersion = await storage.getActiveSceneVersion(sceneId, 'text');
    
    const regeneratedPrompt = await regenerateImagePrompt(
      currentImageVersion.imagePrompt,
      {
        title: currentTextVersion?.title || scene.title,
        description: currentTextVersion?.description || scene.description
      },
      {
        idea: project.idea,
        style: project.style,
        mood: project.mood,
        cutsStyle: project.cutsStyle,
        targetDuration: project.targetDuration,
        aspectRatio: project.aspectRatio,
        cameraLanguage: project.cameraLanguage,
        pacing: project.pacing,
        visualEra: project.visualEra
      },
      model
    );
    
    const versions = await storage.getSceneVersions(sceneId, 'image');
    const nextVersionNumber = Math.max(...versions.map(v => v.versionNumber || 1)) + 1;
    
    const newVersion = await storage.createSceneVersion({
      sceneId,
      versionType: 'image',
      versionNumber: nextVersionNumber,
      imagePrompt: regeneratedPrompt,
      imageModel: currentImageVersion.imageModel,
      imageStyle: currentImageVersion.imageStyle,
      isActive: false
    });
    
    await storage.setActiveSceneVersion(newVersion.id, sceneId, 'image');
    
    await creditService.deductCredits(
      userId,
      creditCost,
      `Image prompt regeneration (${model})`,
      { 
        sceneId,
        projectId: project.id,
        model,
        operationId
      }
    );
    
    res.json(newVersion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error regenerating image prompt:", error);
    res.status(500).json({ error: "Failed to regenerate image prompt" });
  }
});

router.post("/api/film-studio/scenes/:id/regenerate-video-prompt", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const scene = await storage.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    const userId = (req.user as any).claims?.sub;
    if (!project || !userId || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const model = "gpt-5"; // Always use GPT-5 for Film Studio
    const operationId = "text.gpt5.video_prompt_regenerate";
    
    let creditCost = 1; // Default Film Studio pricing
    
    try {
      const costResult = await creditService.calculateOperationCost(operationId, { units: 1 });
      creditCost = costResult.credits;
    } catch (error) {
      console.warn(`[Video Prompt Regenerate] Operation ${operationId} not found in catalog, using legacy pricing: ${creditCost} credits`);
    }
    
    const balance = await creditService.getUserBalance(userId);
    if (balance < creditCost) {
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditCost,
        available: balance
      });
    }
    
    const currentVideoVersion = await storage.getActiveSceneVersion(sceneId, 'video');
    
    if (!currentVideoVersion || !currentVideoVersion.videoPrompt) {
      return res.status(400).json({ error: "No video prompt found for this scene" });
    }
    
    const currentTextVersion = await storage.getActiveSceneVersion(sceneId, 'text');
    
    const regeneratedPrompt = await regenerateVideoPrompt(
      currentVideoVersion.videoPrompt,
      {
        title: currentTextVersion?.title || scene.title,
        description: currentTextVersion?.description || scene.description
      },
      {
        idea: project.idea,
        style: project.style,
        mood: project.mood,
        cutsStyle: project.cutsStyle,
        targetDuration: project.targetDuration,
        aspectRatio: project.aspectRatio,
        cameraLanguage: project.cameraLanguage,
        pacing: project.pacing,
        visualEra: project.visualEra
      },
      model
    );
    
    const versions = await storage.getSceneVersions(sceneId, 'video');
    const nextVersionNumber = Math.max(...versions.map(v => v.versionNumber || 1)) + 1;
    
    const newVersion = await storage.createSceneVersion({
      sceneId,
      versionType: 'video',
      versionNumber: nextVersionNumber,
      videoPrompt: regeneratedPrompt,
      isActive: false
    });
    
    await storage.setActiveSceneVersion(newVersion.id, sceneId, 'video');
    
    await creditService.deductCredits(
      userId,
      creditCost,
      `Video prompt regeneration (${model})`,
      { 
        sceneId,
        projectId: project.id,
        model,
        operationId
      }
    );
    
    res.json(newVersion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error regenerating video prompt:", error);
    res.status(500).json({ error: "Failed to regenerating video prompt" });
  }
});

router.get("/api/film-studio/scenes/:sceneId/versions/:versionType", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const versionType = req.params.versionType;
    
    const versions = await storage.getSceneVersions(sceneId, versionType);
    res.json(versions);
  } catch (error) {
    console.error("Error fetching scene versions:", error);
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

router.post("/api/film-studio/scenes/:sceneId/versions/:versionId/activate", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const versionId = parseInt(req.params.versionId);
    const { versionType } = req.body;
    
    const version = await storage.setActiveSceneVersion(versionId, sceneId, versionType);
    
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    
    res.json(version);
  } catch (error) {
    console.error("Error activating version:", error);
    res.status(500).json({ error: "Failed to activate version" });
  }
});

router.post("/api/film-studio/scenes/:sceneId/generate-image", isAuthenticated, requireFilmStudio, referenceImageUpload.array('referenceImages', 5), async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const { imagePrompt, imageModel = 'z-image-turbo', imageStyle = 'Realistic', resolution, aspectRatio } = req.body;
    const uploadedFiles = req.files as Express.Multer.File[] || [];
    
    const scene = await storage.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    const userId = (req.user as any).claims?.sub;
    if (!project || !userId || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Validate imagePrompt is provided
    if (!imagePrompt || !imagePrompt.trim()) {
      return res.status(400).json({ error: "Image prompt is required" });
    }

    // Import required functions
    const { generateImageWithProvider, getModelById } = await import('../ai-models');
    const { downloadAndStoreImage } = await import('../image-storage');
    const { mapModelToOperationId } = await import('../routes');
    
    // Map film studio model IDs to internal model IDs
    const modelMapping: Record<string, string> = {
      'z-image-turbo': 'fal-z-image-turbo',
      'nano-banana-pro': 'fal-nano-banana-pro-txt2img',
      'gpt-image-1.5-fast': 'fal-gpt-image-1.5-txt2img-low',
      'gpt-image-1.5-pro': 'fal-gpt-image-1.5-txt2img-high',
      'seedream-4.5': 'fal-seedream-4.5-txt2img',
      'saudi-model-pro': 'fal-saudi-model-pro',
      // Legacy mappings for backwards compatibility
      'flux-schnell': 'fal-flux-schnell',
      'fal-z-image-turbo': 'fal-z-image-turbo',
      'fal-nano-banana-txt2img': 'fal-nano-banana-txt2img',
      'fal-saudi-model': 'fal-saudi-model',
      'fal-saudi-model-pro': 'fal-saudi-model-pro',
    };
    
    let internalModel = modelMapping[imageModel] || imageModel;
    
    // Handle legacy fal.ai model IDs
    if (imageModel.startsWith('fal-ai/')) {
      if (imageModel.includes('z-image/turbo')) {
        internalModel = 'fal-z-image-turbo';
      } else if (imageModel.includes('flux-pro')) {
        internalModel = 'fal-flux-pro';
      } else if (imageModel.includes('flux/schnell')) {
        internalModel = 'fal-flux-schnell';
      }
    }
    
    const modelConfig = getModelById(internalModel);
    
    if (!modelConfig) {
      return res.status(500).json({ error: "Image generation model not available" });
    }
    
    // Moderation check - must pass before any credits are used
    const moderationResult = await moderatePrompt(imagePrompt, undefined, imageStyle, userId);
    if (!moderationResult.allowed) {
      const errorResponse = buildModerationErrorResponse(moderationResult);
      return res.status(errorResponse.status).json(errorResponse.body);
    }
    
    // Use moderated prompt (may be rewritten)
    const moderatedImagePrompt = moderationResult.finalPrompt;

    // Calculate cost using operations catalog
    const operationId = mapModelToOperationId(internalModel, 'image');
    let creditsRequired: number;
    
    try {
      const costCalc = await creditService.calculateOperationCost(operationId, {
        units: 1,
        quantity: 1,
        resolution: resolution || undefined
      });
      creditsRequired = costCalc.credits;
      console.log(`[Film Studio] Cost for ${internalModel}${resolution ? ` (${resolution})` : ''}: ${creditsRequired} credits (from catalog)`);
    } catch (error) {
      console.error(`[Film Studio] Failed to calculate cost from catalog for ${operationId}:`, error);
      // Fallback to legacy pricing
      const { pricingService } = await import('../services/pricing-service');
      const costDetails = await pricingService.calculateGenerationCost({
        model: internalModel,
        enhancePrompt: false,
        imageCount: 1,
        aspectRatio: project.aspectRatio,
        quality: 'standard'
      });
      creditsRequired = costDetails.totalCost;
      console.log(`[Film Studio] Using legacy pricing: ${creditsRequired} credits`);
    }

    // Check credits
    const hasEnoughCredits = await creditService.hasEnoughCredits(userId, creditsRequired);
    if (!hasEnoughCredits) {
      const userBalance = await creditService.getUserBalance(userId);
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditsRequired,
        balance: userBalance
      });
    }

    // Deduct credits
    await creditService.deductCredits(userId, creditsRequired, 'Film Studio Image Generation');

    try {
      // Enhance the moderated prompt with style using GPT-5-nano
      const { enhancePromptWithStyle } = await import('../prompt-enhancer');
      let enhancedPrompt = await enhancePromptWithStyle(moderatedImagePrompt, imageStyle);
      
      console.log(`Film Studio: Original prompt: "${imagePrompt}"`);
      console.log(`Film Studio: Moderated prompt: "${moderatedImagePrompt}"`);
      console.log(`Film Studio: Enhanced prompt: "${enhancedPrompt}"`);
      
      // Handle uploaded reference images
      let uploadedImageUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        // Upload files to object storage and get URLs
        for (const file of uploadedFiles) {
          const objectUrl = await uploadRefImageToStorage(file.buffer, file.mimetype);
          const absoluteUrl = buildRefImagePublicUrl(objectUrl, req);
          uploadedImageUrls.push(absoluteUrl);
        }
        console.log(`Film Studio: User uploaded ${uploadedFiles.length} reference images`);
      }

      // Determine reference images and model handling
      let actualModel = internalModel;
      let actualModelConfig = modelConfig;
      let styleImageUrls: string[] | undefined = undefined;
      
      if (internalModel === 'fal-saudi-model' || internalModel === 'fal-saudi-model-pro') {
        const isSaudiModelPro = internalModel === 'fal-saudi-model-pro';
        console.log(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} detected - starting classification and auto-enhancement`);
        try {
          // Step 1: Use classifier to select the best category (based on current prompt)
          const { selectReferenceCategoryForPrompt, getReferenceImagesForCategory, autoEnhanceSaudiPrompt } = await import('../saudi-model-processor');
          const categorySlug = await selectReferenceCategoryForPrompt(enhancedPrompt);
          
          // Step 2: Auto-enhance the prompt for Saudi cultural context (transparent to user)
          const saudiEnhancedPrompt = await autoEnhanceSaudiPrompt(enhancedPrompt);
          console.log(`Film Studio: Saudi auto-enhancement: "${enhancedPrompt}" -> "${saudiEnhancedPrompt}"`);
          
          // Update the enhancedPrompt with the auto-enhanced version
          enhancedPrompt = saudiEnhancedPrompt;
          
          // Step 3: Prioritize user-uploaded images, then category reference images
          if (uploadedImageUrls.length > 0) {
            console.log(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} using ${uploadedImageUrls.length} user-uploaded reference images`);
            styleImageUrls = uploadedImageUrls;
            actualModel = internalModel;
            actualModelConfig = getModelById(internalModel) || modelConfig;
          } else if (categorySlug) {
            const referenceImages = await getReferenceImagesForCategory(categorySlug, 10);
            if (referenceImages.length > 0) {
              console.log(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: selected ${referenceImages.length} reference images for category: ${categorySlug}`);
              styleImageUrls = referenceImages;
              actualModel = internalModel;
              actualModelConfig = getModelById(internalModel) || modelConfig;
            } else {
              console.log(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: no reference images found for category, switching to text-to-image model`);
              actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
              actualModelConfig = getModelById(actualModel) || modelConfig;
            }
          } else {
            console.log(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing: no category selected, switching to text-to-image model`);
            actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
            actualModelConfig = getModelById(actualModel) || modelConfig;
          }
        } catch (error) {
          console.error(`Film Studio: ${isSaudiModelPro ? 'Saudi Model Pro' : 'Saudi Model'} preprocessing error:`, error);
          // On error, fall back to appropriate text-to-image model for safety
          actualModel = isSaudiModelPro ? 'fal-nano-banana-pro-txt2img' : 'fal-nano-banana-txt2img';
          actualModelConfig = getModelById(actualModel) || modelConfig;
        }
      } else if (internalModel === 'fal-nano-banana-txt2img') {
        // Pro model (text-to-image) - if user uploaded images, switch to edit model
        if (uploadedImageUrls.length > 0) {
          console.log(`Film Studio: Pro model switching to edit model for ${uploadedImageUrls.length} user-uploaded reference images`);
          actualModel = 'fal-nano-banana-edit'; // Use the nano-banana edit model
          actualModelConfig = getModelById('fal-nano-banana-edit') || modelConfig;
          styleImageUrls = uploadedImageUrls;
        } else {
          console.log(`Film Studio: Pro model using text-to-image (no reference images)`);
        }
      }
      
      // General fallback: if we have uploaded images and the actual model supports style upload but styleImageUrls is still undefined
      if (!styleImageUrls && uploadedImageUrls.length > 0 && actualModelConfig.supportsStyleUpload) {
        console.log(`Film Studio: Using ${uploadedImageUrls.length} user-uploaded reference images for ${actualModel}`);
        styleImageUrls = uploadedImageUrls;
      }
      
      // Generate the image with the enhanced prompt
      // Use user-selected aspect ratio if provided, otherwise fall back to project aspect ratio
      const result = await generateImageWithProvider(actualModel, {
        prompt: enhancedPrompt,
        aspectRatio: aspectRatio || project.aspectRatio,
        width: 1024,
        height: 1024,
        styleImageUrls: styleImageUrls ?? undefined,
        resolution: resolution || undefined
      });

      // Download and store the image
      const storageResult = await downloadAndStoreImage(result.url, sceneId);
      const imageUrl = storageResult.imageUrl; // downloadAndStoreImage now returns an object
      const thumbnailUrl = storageResult.thumbnailUrl;

      // Create a new image record
      const imageRecord = await storage.createImage({
        ownerId: userId,
        prompt: imagePrompt,
        width: 1024,
        height: 1024,
        style: imageStyle,
        model: internalModel,
        url: imageUrl,
        isPublic: false
      });

      // Get all image versions
      const versions = await storage.getSceneVersions(sceneId, 'image');
      
      // Find the newest prompt-only version (highest versionNumber without imageUrl)
      const promptOnlyVersions = versions.filter(v => v.imagePrompt && !v.imageUrl);
      const newestPromptOnly = promptOnlyVersions.length > 0
        ? promptOnlyVersions.reduce((max, v) => 
            (v.versionNumber || 0) > (max.versionNumber || 0) ? v : max
          )
        : null;
      
      let newVersion;
      
      if (newestPromptOnly) {
        // Update the newest prompt-only version with the image
        const versionNumbers = versions.map(v => v.versionNumber || 0);
        const ensuredVersionNumber = newestPromptOnly.versionNumber || (Math.max(...versionNumbers, 0) + 1);
        
        newVersion = await storage.updateSceneVersion(newestPromptOnly.id, {
          imageId: imageRecord.id,
          imageUrl: imageUrl,
          imageModel,
          imageStyle,
          versionNumber: ensuredVersionNumber
        });
        
        // Make sure it's active
        await storage.setActiveSceneVersion(newestPromptOnly.id, sceneId, 'image');
      } else {
        // Create a new version to preserve history (non-destructive editing)
        const versionNumbers = versions.map(v => v.versionNumber || 1);
        const nextVersionNumber = versionNumbers.length > 0 ? Math.max(...versionNumbers) + 1 : 1;
        
        newVersion = await storage.createSceneVersion({
          sceneId,
          versionType: 'image',
          versionNumber: nextVersionNumber,
          imagePrompt,
          imageModel,
          imageStyle,
          imageId: imageRecord.id,
          imageUrl: imageUrl,
          isActive: false
        });
        
        // Set the new version as active
        await storage.setActiveSceneVersion(newVersion.id, sceneId, 'image');
      }

      res.json({
        success: true,
        imageUrl,
        imageId: imageRecord.id
      });
    } catch (generationError) {
      // Refund credits on failure
      await creditService.addCredits(userId, creditsRequired, 'Film Studio Image Generation Failed - Refund');
      throw generationError;
    }
  } catch (error) {
    console.error("Error generating image for scene:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

router.post("/api/film-studio/scenes/:sceneId/generate-video", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const { model, videoReference, audioEnabled = false } = req.body;
    const scene = await storage.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    const userId = (req.user as any).claims?.sub;
    if (!project || !userId || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Get active image version (we need the image URL for image-to-video)
    const activeImageVersion = await storage.getActiveSceneVersion(sceneId, 'image');
    if (!activeImageVersion || !activeImageVersion.imageUrl) {
      return res.status(400).json({ error: "No image found for this scene. Generate an image first." });
    }

    // Get active video version for the prompt
    const activeVideoVersion = await storage.getActiveSceneVersion(sceneId, 'video');
    if (!activeVideoVersion || !activeVideoVersion.videoPrompt) {
      return res.status(400).json({ error: "No video prompt found for this scene" });
    }

    // Import required services
    const { mapModelToOperationId } = await import('../routes');
    const { v4: uuidv4 } = await import('uuid');
    
    // Calculate cost using operations catalog
    const operationId = mapModelToOperationId(model!, 'video');
    const duration = 5; // Film studio videos are 5 seconds
    let creditsRequired: number;
    
    try {
      const costCalc = await creditService.calculateOperationCost(operationId, {
        units: duration,
        duration: duration,
        audio_on: audioEnabled
      });
      creditsRequired = costCalc.credits;
      console.log(`[Film Studio Video] Cost for ${model} (audio: ${audioEnabled}): ${creditsRequired} credits (from catalog)`);
    } catch (error) {
      console.error(`[Film Studio Video] Failed to calculate cost from catalog for ${operationId}:`, error);
      // Fallback to legacy pricing
      const { pricingService } = await import('../services/pricing-service');
      const costDetails = await pricingService.calculateGenerationCost({
        model: model!,
        enhancePrompt: false,
        imageCount: 1,
        aspectRatio: project.aspectRatio,
        quality: 'standard'
      });
      creditsRequired = costDetails.totalCost;
      console.log(`[Film Studio Video] Using legacy pricing: ${creditsRequired} credits`);
    }

    // Check credits
    const hasEnoughCredits = await creditService.hasEnoughCredits(userId, creditsRequired);
    if (!hasEnoughCredits) {
      const userBalance = await creditService.getUserBalance(userId);
      return res.status(402).json({ 
        error: "Insufficient credits",
        required: creditsRequired,
        balance: userBalance
      });
    }

    // Create a video job record (credits will be deducted by processVideoJob)
    const jobId = uuidv4();
    const videoJob = await storage.createVideoJob({
      id: jobId,
      ownerId: userId,
      prompt: activeVideoVersion.videoPrompt,
      duration: 5,
      aspectRatio: project.aspectRatio,
      model,
      startFrameUrl: activeImageVersion.imageUrl,
      state: 'queued',
      progress: 0,
      stage: 'Queued'
    });

    // Create a new video version (linked to job)
    const versions = await storage.getSceneVersions(sceneId, 'video');
    const versionNumbers = versions.map(v => v.versionNumber || 1);
    const nextVersionNumber = versionNumbers.length > 0 ? Math.max(...versionNumbers) + 1 : 1;
    
    const newVersion = await storage.createSceneVersion({
      sceneId,
      versionType: 'video',
      versionNumber: nextVersionNumber,
      videoPrompt: activeVideoVersion.videoPrompt,
      jobId: jobId,  // Link to job for polling
      videoUrl: '',  // Will be updated when job completes
      isActive: false
    });
    
    // Set the new version as active
    await storage.setActiveSceneVersion(newVersion.id, sceneId, 'video');

    // Start async processing in background
    (async () => {
      try {
        const { processVideoJob } = await import('../routes');
        await processVideoJob(
          jobId,
          model!,
          {
            prompt: activeVideoVersion.videoPrompt || '',
            aspectRatio: project.aspectRatio,
            duration: 5,
            startFrame: activeImageVersion.imageUrl || undefined,
            resolution: '720p' as const,
            videoReference: videoReference || undefined,
            audioEnabled: audioEnabled
          },
          userId,
          creditsRequired
        );
        
        // After job completes, update the scene version with the final video URL
        const completedJob = await storage.getVideoJob(jobId);
        if (completedJob?.state === 'completed' && completedJob?.assetUrl) {
          await storage.updateSceneVersion(newVersion.id, {
            videoUrl: completedJob.assetUrl
          });
        } else if (completedJob?.state === 'failed') {
          // If job failed, delete the scene version and reactivate previous if needed
          console.log(`Deleting failed scene version ${newVersion.id} for job ${jobId}`);
          await storage.deleteSceneVersion(newVersion.id);
          
          // Only reactivate if no version is currently active
          const remainingVersions = await storage.getSceneVersions(sceneId, 'video');
          const hasActiveVersion = remainingVersions.some(v => v.isActive);
          if (!hasActiveVersion && remainingVersions.length > 0) {
            // Reactivate the highest version number to preserve user intent
            const versionToActivate = remainingVersions.reduce((max, v) => 
              (v.versionNumber || 0) > (max.versionNumber || 0) ? v : max
            );
            await storage.setActiveSceneVersion(versionToActivate.id, sceneId, 'video');
            console.log(`Reactivated version ${versionToActivate.id} for scene ${sceneId}`);
          }
        }
      } catch (bgError) {
        console.error(`Background video processing failed for job ${jobId}:`, bgError);
        // Delete the scene version if processing fails
        try {
          await storage.deleteSceneVersion(newVersion.id);
          console.log(`Deleted scene version ${newVersion.id} after processing failure`);
          
          // Only reactivate if no version is currently active
          const remainingVersions = await storage.getSceneVersions(sceneId, 'video');
          const hasActiveVersion = remainingVersions.some(v => v.isActive);
          if (!hasActiveVersion && remainingVersions.length > 0) {
            // Reactivate the highest version number to preserve user intent
            const versionToActivate = remainingVersions.reduce((max, v) => 
              (v.versionNumber || 0) > (max.versionNumber || 0) ? v : max
            );
            await storage.setActiveSceneVersion(versionToActivate.id, sceneId, 'video');
            console.log(`Reactivated version ${versionToActivate.id} for scene ${sceneId}`);
          }
        } catch (deleteError) {
          console.error(`Failed to delete scene version ${newVersion.id}:`, deleteError);
        }
        // Refund credits if processing fails
        try {
          await creditService.addCredits(userId, creditsRequired, 'Film Studio Video Generation Failed - Refund');
        } catch (refundError) {
          console.error(`Failed to refund credits for failed job ${jobId}:`, refundError);
        }
      }
    })();

    res.json({
      success: true,
      jobId,
      status: 'queued'
    });
  } catch (error) {
    console.error("Error generating video for scene:", error);
    res.status(500).json({ error: "Failed to generate video" });
  }
});

router.patch("/api/film-studio/scenes/:sceneId/versions/:versionId/image", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const { imageId, imageUrl } = req.body;
    
    const version = await storage.updateSceneVersion(versionId, {
      imageId,
      imageUrl
    });
    
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    
    res.json(version);
  } catch (error) {
    console.error("Error updating scene version image:", error);
    res.status(500).json({ error: "Failed to update version" });
  }
});

router.patch("/api/film-studio/scenes/:sceneId/versions/:versionId", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const versionId = parseInt(req.params.versionId);
    const userId = (req.user as any).claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const scene = await storage.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    
    const project = await storage.getFilmProject(scene.projectId);
    if (!project || project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Check that the version belongs to the scene
    const existingVersion = await storage.getSceneVersions(sceneId);
    const versionBelongsToScene = existingVersion.some(v => v.id === versionId);
    
    if (!versionBelongsToScene) {
      return res.status(400).json({ error: "Version does not belong to this scene" });
    }
    
    // Validate updates using partial schema
    const updateSchema = insertSceneVersionSchema.partial().pick({
      title: true,
      description: true,
      notes: true,
      videoPrompt: true,
      imagePrompt: true,
      imageModel: true,
      imageStyle: true
    });
    
    const validatedUpdates = updateSchema.parse(req.body);
    
    const version = await storage.updateSceneVersion(versionId, validatedUpdates);
    
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    
    res.json(version);
  } catch (error) {
    console.error("Error updating scene version:", error);
    res.status(500).json({ error: "Failed to update version" });
  }
});

router.delete("/api/film-studio/scenes/:sceneId/versions/:versionId", isAuthenticated, requireFilmStudio, async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const sceneId = parseInt(req.params.sceneId);
    
    // Get all image versions for this scene
    const allImageVersions = await storage.getSceneVersions(sceneId, 'image');
    
    // Find the version to delete
    const version = allImageVersions.find(v => v.id === versionId);
    
    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }
    
    // If this version has an image, delete it and all prompt-only versions
    if (version.imageUrl) {
      // Delete the version with the image
      await storage.deleteSceneVersion(versionId);
      
      // Also delete all prompt-only versions (no imageUrl but has imagePrompt)
      for (const v of allImageVersions) {
        if (v.id !== versionId && v.imagePrompt && !v.imageUrl) {
          await storage.deleteSceneVersion(v.id);
        }
      }
    } else {
      // Just delete this prompt-only version
      await storage.deleteSceneVersion(versionId);
    }
    
    // After deletion, ensure there's an active version
    const remainingVersions = await storage.getSceneVersions(sceneId, 'image');
    const hasActiveVersion = remainingVersions.some(v => v.isActive);
    
    if (!hasActiveVersion && remainingVersions.length > 0) {
      // Activate the most recent version
      const versionToActivate = remainingVersions.reduce((max, v) => 
        (v.versionNumber || 0) > (max.versionNumber || 0) ? v : max
      );
      await storage.setActiveSceneVersion(versionToActivate.id, sceneId, 'image');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting version:", error);
    res.status(500).json({ error: "Failed to delete version" });
  }
});

export default router;
