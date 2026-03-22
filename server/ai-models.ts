import OpenAI from "openai";
import Replicate from "replicate";
import { fal } from "@fal-ai/client";
import { storage as dbStorage } from "./storage";
import { getConfig } from "./site-config";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

// Configure fal.ai client
const falApiKey = process.env.FAL_KEY || "";
if (falApiKey) {
  fal.config({
    credentials: falApiKey,
  });
  console.log("fal.ai client configured successfully");
} else {
  console.warn("FAL_KEY environment variable not found - fal.ai provider will not be available");
}

// Helper function to convert local paths to full URLs for external APIs
export function convertToFullUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  
  // If it's already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it's a local path (starts with /), convert to full URL
  if (path.startsWith('/')) {
    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      // Get the first domain from the comma-separated list
      const domain = replitDomains.split(',')[0];
      return `https://${domain}${path}`;
    }
    console.warn(`Local path "${path}" cannot be converted to full URL: REPLIT_DOMAINS not set`);
  }
  
  return path;
}

// Helper function to upload local/internal style images to fal.ai storage
// This ensures fal.ai can access the images during generation
async function uploadToFalStorage(imageUrl: string): Promise<string> {
  try {
    // Check if this is a local URL that fal.ai may not be able to access
    const isLocalUrl = imageUrl.includes('/uploads/') || imageUrl.includes('/objects/');
    const isReplitUrl = imageUrl.includes('.replit.') || imageUrl.includes('.janeway.') || imageUrl.includes('.picard.');
    
    if (!isLocalUrl && !isReplitUrl) {
      // External URL, return as-is
      return imageUrl;
    }
    
    console.log(`Uploading local image to fal.ai storage: ${imageUrl}`);
    
    // Fetch the image from our server
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Get the image data as a blob
    const blob = await response.blob();
    
    // Determine file extension from URL or content type
    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = contentType.split('/')[1] || 'png';
    const filename = `style-image-${Date.now()}.${extension}`;
    
    // Create a File object for fal.ai upload
    const file = new File([blob], filename, { type: contentType });
    
    // Upload to fal.ai storage
    const falUrl = await fal.storage.upload(file);
    console.log(`Uploaded to fal.ai storage: ${falUrl}`);
    
    return falUrl;
  } catch (error) {
    console.error(`Failed to upload image to fal.ai storage: ${error}`);
    // Return original URL as fallback (may still fail, but let fal.ai try)
    return imageUrl;
  }
}

// Upload multiple style images to fal.ai storage
async function uploadStyleImagesToFalStorage(imageUrls: string[]): Promise<string[]> {
  const uploadedUrls = await Promise.all(
    imageUrls.map(url => uploadToFalStorage(url))
  );
  return uploadedUrls;
}

// API Key management functions
export function hasRequiredApiKeys(): { openai: boolean; replicate: boolean; fal: boolean } {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    replicate: Boolean(process.env.REPLICATE_API_TOKEN),
    fal: Boolean(process.env.FAL_KEY)
  };
}

export function getProviderHealthStatus(): { replicate: string; fal: string; openai: string } {
  const apiKeys = hasRequiredApiKeys();
  const replicateStatus = getConfig('replicate_api_status', 'active');
  const falStatus = getConfig('fal_api_status', 'active');
  
  return {
    openai: apiKeys.openai ? 'active' : 'error',
    replicate: apiKeys.replicate ? replicateStatus : 'error',
    fal: apiKeys.fal ? falStatus : 'error'
  };
}

export async function testProviderConnection(provider: string): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'openai':
        if (!process.env.OPENAI_API_KEY) {
          return { success: false, error: 'OpenAI API key not configured' };
        }
        try {
          // Test with actual API call to list models
          const testOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          await testOpenAI.models.list();
          return { success: true };
        } catch (apiError) {
          return { 
            success: false, 
            error: `OpenAI API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}` 
          };
        }

      case 'replicate':
        if (!process.env.REPLICATE_API_TOKEN) {
          return { success: false, error: 'Replicate API token not configured' };
        }
        try {
          // Test with actual API call to get account info
          const testReplicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
          await testReplicate.accounts.current();
          return { success: true };
        } catch (apiError) {
          return { 
            success: false, 
            error: `Replicate API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}` 
          };
        }

      case 'fal':
        if (!process.env.FAL_KEY) {
          return { success: false, error: 'fal.ai API key not configured' };
        }
        try {
          // Test with actual API call using fal client
          const testResult = await fal.run("fal-ai/fast-sdxl", {
            input: { prompt: "test", image_size: "square_hd" }
          });
          return { success: true };
        } catch (apiError) {
          return { 
            success: false, 
            error: `fal.ai API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}` 
          };
        }

      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export interface GenerationParams {
  prompt: string;
  width?: number;
  height?: number;
  style?: string;
  quality?: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  aspectRatio?: string;
  styleImageUrl?: string;
  styleImageUrls?: string[];
  imageStrength?: number;
  imageSize?: string;
  resolution?: string; // For nano-banana-pro and saudi-model-pro: "1K", "2K", "4K"
}

export interface VideoGenerationParams {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  startFrame?: string; // URL to start frame image
  endFrame?: string; // URL to end frame image
  videoReference?: string; // URL to video reference (for Motion Control models)
  loop?: boolean;
  frameRate?: number;
  resolution?: "480p" | "720p" | "1080p"; // For WAN models - maps to specific dimensions
  frames?: number; // For WAN models - calculated from duration
  audioEnabled?: boolean; // For models that support native audio generation (e.g., Kling 2.6)
  characterOrientation?: "video" | "image"; // For Motion Control - which orientation to follow
  audioFileUrl?: string; // URL to audio file for background music (e.g., WAN 2.6)
  promptExpansion?: boolean; // Whether to enable LLM prompt expansion (e.g., WAN 2.6)
  multiShot?: boolean; // Whether to enable multi-shot video generation (e.g., WAN 2.6)
  negativePrompt?: string; // Negative prompt to avoid certain content
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "replicate" | "fal";
  category: "general" | "artistic" | "photorealistic" | "fast";
  description: string;
  maxWidth: number;
  maxHeight: number;
  supportedRatios: string[];
  replicateModel?: string;
  falModel?: string;
  supportsStyleUpload?: boolean; // Whether this model supports image style upload
}

export interface VideoModelConfig {
  id: string;
  name: string;
  provider: "replicate" | "fal";
  category: "general" | "artistic" | "fast";
  description: string;
  maxDuration: number; // Maximum duration in seconds
  supportedRatios: string[];
  supportedDurations: number[];
  supportedSizes: string[]; // e.g., ["480p", "720p"] or ["540p"]
  replicateModel?: string;
  falModel?: string;
  supportsStartFrame?: boolean;
  supportsEndFrame?: boolean;
  supportsLoop?: boolean;
  supportsFrameRate?: boolean;
  fpsFixed?: number; // Fixed FPS for this model
  framesByDuration?: Record<number, number>; // Maps duration to frame count, e.g., {5: 81, 7: 112}
  supportsAudio?: boolean; // Whether this model supports native audio generation
  supportsVideoReference?: boolean; // Whether this model supports video reference input (Motion Control)
  modelGroup?: string; // Group ID for organizing related models (e.g., "kling-2.6")
  modelVariant?: "text-to-video" | "image-to-video" | "motion-control" | "video-to-video"; // Type of video generation
  supportsAudioFile?: boolean; // Whether this model supports background audio file upload (e.g., WAN 2.6)
  supportsPromptExpansion?: boolean; // Whether this model supports LLM prompt expansion
  supportsMultiShot?: boolean; // Whether this model supports multi-shot video generation
}

// fal.ai-only Video models configuration
export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "wan-2.2-t2v-fast",
    name: "WAN 2.2 Text-to-Video Fast",
    provider: "fal",
    category: "fast",
    description: "Fast text-to-video generation with cinematic quality, 16 FPS output via fal.ai",
    maxDuration: 7,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 7],
    supportedSizes: ["480p", "720p"],
    falModel: "fal-ai/wan/v2.2-a14b/text-to-video/turbo",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: true,
    fpsFixed: 16,
    framesByDuration: { 5: 81, 7: 112 },
  },
  {
    id: "wan-2.2-i2v-fast",
    name: "WAN 2.2 Image-to-Video Fast",
    provider: "fal",
    category: "fast",
    description: "Fast image-to-video generation with cinematic quality, 16 FPS output via fal.ai",
    maxDuration: 7,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 7],
    supportedSizes: ["480p", "720p"],
    falModel: "fal-ai/wan/v2.2-a14b/image-to-video/turbo",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: true,
    fpsFixed: 16,
    framesByDuration: { 5: 81, 7: 112 },
  },
  {
    id: "wan-2.5-preview-t2v",
    name: "WAN 2.5 Preview Text-to-Video",
    provider: "fal",
    category: "general",
    description: "Next-generation text-to-video with improved quality and motion coherence, supports up to 1080p via fal.ai",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["480p", "720p", "1080p"],
    falModel: "fal-ai/wan-25-preview/text-to-video",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "wan-2.5-preview-i2v",
    name: "WAN 2.5 Preview Image-to-Video",
    provider: "fal",
    category: "general",
    description: "Next-generation image-to-video with improved quality and motion coherence, supports up to 1080p via fal.ai",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["480p", "720p", "1080p"],
    falModel: "fal-ai/wan-25-preview/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  // WAN 2.6 Models - Multi-shot with audio and prompt expansion
  {
    id: "wan-2.6-t2v",
    name: "WAN 2.6 Text-to-Video",
    provider: "fal",
    category: "general",
    description: "Multi-shot video generation with audio support, prompt expansion, and intelligent scene segmentation",
    maxDuration: 15,
    supportedRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supportedDurations: [5, 10, 15],
    supportedSizes: ["720p", "1080p"],
    falModel: "wan/v2.6/text-to-video",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudioFile: true,
    supportsPromptExpansion: true,
    supportsMultiShot: true,
    modelGroup: "wan-2.6",
    modelVariant: "text-to-video",
  },
  {
    id: "wan-2.6-i2v",
    name: "WAN 2.6 Image-to-Video",
    provider: "fal",
    category: "general",
    description: "Multi-shot image-to-video with audio support, prompt expansion, and intelligent scene segmentation",
    maxDuration: 15,
    supportedRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supportedDurations: [5, 10, 15],
    supportedSizes: ["720p", "1080p"],
    falModel: "wan/v2.6/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudioFile: true,
    supportsPromptExpansion: true,
    supportsMultiShot: true,
    modelGroup: "wan-2.6",
    modelVariant: "image-to-video",
  },
  {
    id: "fal-veo3-t2v",
    name: "VEO 3.1 (Text to Video)",
    provider: "fal",
    category: "general",
    description: "Google's VEO 3.1 text-to-video model with natural sound generation via fal.ai",
    maxDuration: 8,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [4, 6, 8],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/veo3.1",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "fal-veo3-i2v",
    name: "VEO 3.1 (Image to Video)",
    provider: "fal",
    category: "general",
    description: "Google's VEO 3.1 image-to-video model with natural animations via fal.ai",
    maxDuration: 8,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 6, 8],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/veo3.1/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "fal-veo3-fast-t2v",
    name: "VEO 3.1 Fast (Text to Video)",
    provider: "fal",
    category: "fast",
    description: "Faster and more cost-effective version of Google's VEO 3.1 text-to-video model via fal.ai",
    maxDuration: 8,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [4, 6, 8],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/veo3.1/fast",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "fal-veo3-fast-i2v",
    name: "VEO 3.1 Fast (Image to Video)",
    provider: "fal",
    category: "fast",
    description: "Faster and more cost-effective version of Google's VEO 3.1 image-to-video model via fal.ai",
    maxDuration: 8,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 6, 8],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/veo3.1/fast/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "fal-luma-dream-machine",
    name: "Luma Dream Machine (fal.ai)",
    provider: "fal",
    category: "general",
    description: "High-quality text-to-video generation via fal.ai infrastructure",
    maxDuration: 5,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [3, 5],
    supportedSizes: ["720p"],
    falModel: "fal-ai/luma-dream-machine",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "sora-2-text-to-video",
    name: "Sora 2 Text-to-Video",
    provider: "fal",
    category: "general",
    description: "OpenAI's Sora 2 text-to-video model with natural language prompts, 720p quality",
    maxDuration: 12,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 8, 12],
    supportedSizes: ["720p"],
    falModel: "fal-ai/sora-2/text-to-video",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "sora-2-image-to-video",
    name: "Sora 2 Image-to-Video",
    provider: "fal",
    category: "general",
    description: "OpenAI's Sora 2 image-to-video model, animate images with text prompts, 720p quality",
    maxDuration: 12,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 8, 12],
    supportedSizes: ["720p"],
    falModel: "fal-ai/sora-2/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "sora-2-pro-text-to-video",
    name: "Sora 2 Pro Text-to-Video",
    provider: "fal",
    category: "general",
    description: "OpenAI's Sora 2 Pro text-to-video model with enhanced quality, up to 1080p",
    maxDuration: 12,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 8, 12],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/sora-2/text-to-video/pro",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  {
    id: "sora-2-pro-image-to-video",
    name: "Sora 2 Pro Image-to-Video",
    provider: "fal",
    category: "general",
    description: "OpenAI's Sora 2 Pro image-to-video model with enhanced quality, up to 1080p",
    maxDuration: 12,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 8, 12],
    supportedSizes: ["720p", "1080p"],
    falModel: "fal-ai/sora-2/image-to-video/pro",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
  },
  // Kling 2.6 Models (text-to-video and image-to-video)
  {
    id: "kling-2.6-pro-t2v",
    name: "Kling 2.6 Pro Text-to-Video",
    provider: "fal",
    category: "general",
    description: "Kling 2.6 Pro: Top-tier text-to-video with cinematic visuals, fluid motion, and native audio generation",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    falModel: "fal-ai/kling-video/v2.6/pro/text-to-video",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: true,
    supportsVideoReference: false,
    modelGroup: "kling-2.6",
    modelVariant: "text-to-video",
  },
  {
    id: "kling-2.6-pro-i2v",
    name: "Kling 2.6 Pro Image-to-Video",
    provider: "fal",
    category: "general",
    description: "Kling 2.6 Pro: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    falModel: "fal-ai/kling-video/v2.6/pro/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: true,
    supportsVideoReference: false,
    modelGroup: "kling-2.6",
    modelVariant: "image-to-video",
  },
  // Kling 2.6 Motion Control Models (separate base model)
  {
    id: "kling-2.6-pro-motion",
    name: "Kling 2.6 Pro Motion Control",
    provider: "fal",
    category: "general",
    description: "Kling 2.6 Pro Motion Control: Transfer movements from a reference video to any character image with high-quality output",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    falModel: "fal-ai/kling-video/v2.6/pro/motion-control",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: false,
    supportsVideoReference: true,
    modelGroup: "kling-2.6-motion",
    modelVariant: "motion-control",
  },
  {
    id: "kling-2.6-standard-motion",
    name: "Kling 2.6 Standard Motion Control",
    provider: "fal",
    category: "fast",
    description: "Kling 2.6 Standard Motion Control: Cost-effective motion transfer for portraits and simple animations",
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    falModel: "fal-ai/kling-video/v2.6/standard/motion-control",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: false,
    supportsVideoReference: true,
    modelGroup: "kling-2.6-motion",
    modelVariant: "motion-control",
  },
  {
    id: "grok-imagine-t2v",
    name: "Grok Imagine Video (Text)",
    provider: "fal",
    category: "general",
    description: "xAI's Grok Imagine Video: Generate videos with audio from text descriptions",
    maxDuration: 15,
    supportedRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    supportedDurations: [6, 8, 10, 12, 15],
    supportedSizes: ["480p", "720p"],
    falModel: "xai/grok-imagine-video/text-to-video",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: true,
    modelGroup: "grok-imagine-video",
    modelVariant: "text-to-video",
  },
  {
    id: "grok-imagine-i2v",
    name: "Grok Imagine Video (Image)",
    provider: "fal",
    category: "general",
    description: "xAI's Grok Imagine Video: Generate videos with audio from images",
    maxDuration: 15,
    supportedRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    supportedDurations: [6, 8, 10, 12, 15],
    supportedSizes: ["480p", "720p"],
    falModel: "xai/grok-imagine-video/image-to-video",
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: true,
    modelGroup: "grok-imagine-video",
    modelVariant: "image-to-video",
  },
  {
    id: "grok-imagine-edit",
    name: "Grok Imagine Video (Edit)",
    provider: "fal",
    category: "general",
    description: "xAI's Grok Imagine Video: Edit and transform existing videos",
    maxDuration: 15,
    supportedRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    supportedDurations: [6, 8, 10, 12, 15],
    supportedSizes: ["480p", "720p"],
    falModel: "xai/grok-imagine-video/edit",
    supportsStartFrame: false,
    supportsEndFrame: false,
    supportsLoop: false,
    supportsFrameRate: false,
    supportsAudio: true,
    supportsVideoReference: true,
    modelGroup: "grok-imagine-video",
    modelVariant: "video-to-video",
  },
];

export const AI_MODELS: ModelConfig[] = [
  {
    id: "fal-z-image-turbo",
    name: "Z-Image Turbo",
    provider: "fal",
    category: "fast",
    description: "Super fast 6B parameter text-to-image model by Tongyi-MAI via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/z-image/turbo",
  },
  {
    id: "fal-flux-schnell",
    name: "Fast",
    provider: "fal",
    category: "fast",
    description: "Ultra-fast FLUX model optimized for speed via fal.ai",
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/flux/schnell",
  },
  {
    id: "fal-nano-banana-txt2img",
    name: "Pro",
    provider: "fal",
    category: "fast",
    description: "Ultra-fast text-to-image generation with Nano Banana model via fal.ai",
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/nano-banana",
    supportsStyleUpload: true,
  },
  {
    id: "fal-nano-banana-edit",
    name: "Pro Edit",
    provider: "fal",
    category: "fast",
    description: "Ultra-fast image-to-image generation with Nano Banana edit model via fal.ai (internal use)",
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/nano-banana/edit",
    supportsStyleUpload: true,
  },
  {
    id: "fal-saudi-model",
    name: "Saudi Model",
    provider: "fal",
    category: "fast",
    description: "Saudi-localized image generation with context-aware reference images via Nano Banana",
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/nano-banana/edit",
    supportsStyleUpload: false, // TEMPORARY: Disabled - set to true to re-enable reference image upload
  },
  {
    id: "fal-saudi-model-pro",
    name: "Saudi Model Pro",
    provider: "fal",
    category: "fast",
    description: "Premium Saudi-localized image generation with context-aware reference images via Nano Banana Pro (4K)",
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    falModel: "fal-ai/nano-banana-pro/edit",
    supportsStyleUpload: false, // TEMPORARY: Disabled - set to true to re-enable reference image upload
  },
  {
    id: "fal-nano-banana-img2img",
    name: "Nano Banana Image-to-Image",
    provider: "fal",
    category: "fast",
    description: "Ultra-fast image-to-image generation with Nano Banana edit model via fal.ai",
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/nano-banana/edit",
    supportsStyleUpload: true,
  },
  {
    id: "fal-nano-banana-pro-txt2img",
    name: "Nano Banana Pro",
    provider: "fal",
    category: "fast",
    description: "Google's state-of-the-art Nano Banana Pro text-to-image model via fal.ai",
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    falModel: "fal-ai/nano-banana-pro",
  },
  {
    id: "fal-nano-banana-pro-edit",
    name: "Nano Banana Pro Edit",
    provider: "fal",
    category: "fast",
    description: "Google's state-of-the-art Nano Banana Pro image editing model via fal.ai",
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    falModel: "fal-ai/nano-banana-pro/edit",
    supportsStyleUpload: true,
  },
  {
    id: "fal-flux-dev",
    name: "FLUX Dev",
    provider: "fal",
    category: "general",
    description: "High-quality FLUX Dev model for detailed image generation via fal.ai",
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/flux/dev",
  },
  {
    id: "fal-flux-pro",
    name: "FLUX Pro",
    provider: "fal",
    category: "general",
    description: "Premium FLUX Pro model for professional-grade images via fal.ai",
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/flux/pro",
  },
  {
    id: "fal-imagen-4-fast",
    name: "Imagen 4 Fast",
    provider: "fal",
    category: "fast",
    description: "Google's Imagen 4 Fast model for quick, high-quality generation via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/imagen4/preview",
  },
  {
    id: "fal-imagen-4",
    name: "Imagen 4 Ultra",
    provider: "fal",
    category: "general",
    description: "Google's Imagen 4 Ultra model for premium image generation via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/imagen4/preview/ultra",
  },
  {
    id: "fal-seedream-4.5-txt2img",
    name: "SeeDream 4.5 Text-to-Image",
    provider: "fal",
    category: "fast",
    description: "SeeDream 4.5 text-to-image model with enhanced quality and text rendering via fal.ai",
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  },
  {
    id: "fal-seedream-4.5-img2img",
    name: "SeeDream 4.5 Image-to-Image",
    provider: "fal",
    category: "fast",
    description: "SeeDream 4.5 image editing model with enhanced quality and precision via fal.ai",
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/bytedance/seedream/v4.5/edit",
    supportsStyleUpload: true,
  },
  {
    id: "fal-sdxl",
    name: "Stable Diffusion XL",
    provider: "fal",
    category: "general",
    description: "Stable Diffusion XL model for versatile image generation via fal.ai",
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    falModel: "fal-ai/stable-diffusion-xl",
  },
  {
    id: "fal-gpt-image-1.5-txt2img-low",
    name: "GPT Image 1.5 Text-to-Image (Low)",
    provider: "fal",
    category: "fast",
    description: "OpenAI GPT Image 1.5 text-to-image with low quality for fast generation via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "3:2", "2:3"],
    falModel: "fal-ai/gpt-image-1.5",
  },
  {
    id: "fal-gpt-image-1.5-txt2img-high",
    name: "GPT Image 1.5 Text-to-Image (High)",
    provider: "fal",
    category: "general",
    description: "OpenAI GPT Image 1.5 text-to-image with high quality for detailed images via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "3:2", "2:3"],
    falModel: "fal-ai/gpt-image-1.5",
  },
  {
    id: "fal-gpt-image-1.5-edit-low",
    name: "GPT Image 1.5 Edit (Low)",
    provider: "fal",
    category: "fast",
    description: "OpenAI GPT Image 1.5 image editing with low quality for fast edits via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "3:2", "2:3"],
    falModel: "fal-ai/gpt-image-1.5/edit",
    supportsStyleUpload: true,
  },
  {
    id: "fal-gpt-image-1.5-edit-high",
    name: "GPT Image 1.5 Edit (High)",
    provider: "fal",
    category: "general",
    description: "OpenAI GPT Image 1.5 image editing with high quality for detailed edits via fal.ai",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "3:2", "2:3"],
    falModel: "fal-ai/gpt-image-1.5/edit",
    supportsStyleUpload: true,
  },
];

export async function generateWithOpenAI(model: string, params: GenerationParams): Promise<{ url: string }> {
  const { prompt, width = 1024, height = 1024, quality = "standard", style, aspectRatio } = params;
  
  let size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
  
  // Use aspect ratio if provided to determine the correct OpenAI size
  if (aspectRatio) {
    switch (aspectRatio) {
      case "1:1":
        size = "1024x1024";
        break;
      case "16:9":
        size = "1792x1024";
        break;
      case "9:16":
        size = "1024x1792";
        break;
      default:
        // For unsupported aspect ratios, fallback to square
        size = "1024x1024";
    }
  } else {
    // Fallback to original width/height logic if no aspect ratio provided
    if (width === 1792 && height === 1024) size = "1792x1024";
    else if (width === 1024 && height === 1792) size = "1024x1792";
  }

  const response = await openai.images.generate({
    model: model as "dall-e-2" | "dall-e-3",
    prompt: prompt,
    n: 1,
    size,
    quality: quality as "standard" | "hd",
  });

  if (!response.data || !response.data[0]?.url) {
    throw new Error("No image URL returned from OpenAI");
  }

  return { url: response.data[0].url };
}

export async function generateWithReplicate(modelId: string, params: GenerationParams): Promise<{ url: string }> {
  const modelConfig = AI_MODELS.find(m => m.id === modelId);
  if (!modelConfig?.replicateModel) {
    throw new Error(`Model ${modelId} not found or missing Replicate configuration`);
  }

  const { prompt, width = 1024, height = 1024, negativePrompt, seed, steps, cfgScale, style, aspectRatio, styleImageUrl, styleImageUrls, imageStrength } = params;

  // Build input based on model type
  let input: any = {
    prompt: prompt,
    width,
    height,
  };

  // Add model-specific parameters
  if (negativePrompt) input.negative_prompt = negativePrompt;
  if (seed) input.seed = seed;
  if (steps) input.num_inference_steps = steps;
  if (cfgScale) input.guidance_scale = cfgScale;
  
  // Add style image parameters for supported models
  // Use multiple images if available, otherwise fall back to single image
  const imagesToUse = styleImageUrls && styleImageUrls.length > 0 ? styleImageUrls : (styleImageUrl ? [styleImageUrl] : []);
  
  if (imagesToUse.length > 0 && imageStrength !== undefined) {
    const primaryImage = imagesToUse[0]; // Use first image for Replicate models
    
    if (imagesToUse.length > 1) {
      console.log(`Multiple images provided (${imagesToUse.length}), using first image for Replicate model ${modelId}: ${primaryImage}`);
    }
    
    if (modelId === 'flux-1.1-pro-ultra') {
      // Flux 1.1 Pro Ultra uses image_prompt and image_prompt_strength
      input.image_prompt = primaryImage;
      input.image_prompt_strength = imageStrength;
    } else {
      // Other models use image and strength
      input.image = primaryImage;
      input.strength = imageStrength;
    }
  }

  // Model-specific adjustments
  if (modelId.startsWith('flux')) {
    input.num_outputs = 1;
    if (modelId === 'flux-schnell') {
      input.num_inference_steps = 4; // Schnell is optimized for 4 steps
    } else {
      input.num_inference_steps = steps || 50;
    }
    
    // Use aspect ratio directly from form instead of calculating from dimensions
    input.aspect_ratio = aspectRatio || "1:1";
    delete input.width;
    delete input.height;
  } else if (modelId.startsWith('imagen-4')) {
    // Imagen-4 specific parameters - use aspect ratio directly from form
    input.aspect_ratio = aspectRatio || "1:1";
    input.safety_filter_level = "block_medium_and_above";
    input.output_format = "jpg";
    
    // Remove width/height as Imagen-4 uses aspect_ratio
    delete input.width;
    delete input.height;
  } else if (modelId === 'recraft-v3') {
    // Recraft V3 specific parameters
    input.aspect_ratio = aspectRatio || "1:1";  // Use aspect ratio from form
    
    // Set style from form parameter, fallback to "any" to let model decide
    if (style) {
      // Map common style names to Recraft's style options
      const styleMapping: {[key: string]: string} = {
        'photorealistic': 'realistic_image',
        'realistic': 'realistic_image', 
        'digital art': 'digital_illustration',
        'illustration': 'digital_illustration',
        'pixel art': 'digital_illustration/pixel_art',
        'hand drawn': 'digital_illustration/hand_drawn'
      };
      input.style = styleMapping[style.toLowerCase()] || "any";
    } else {
      input.style = "any";  // Let the model decide the best style
    }
    
    input.output_format = "png";
    
    // Remove width/height as Recraft uses aspect_ratio (size is ignored when aspect_ratio is set)
    delete input.width;
    delete input.height;
  } else if (modelId === 'flux-1.1-pro-ultra') {
    // Flux Ultra specific parameters - use aspect ratio directly from form
    input.num_outputs = 1;
    input.num_inference_steps = steps || 50;
    
    input.aspect_ratio = aspectRatio || "1:1";
    input.output_format = "png";
    delete input.width;
    delete input.height;
  } else if (modelId === 'seedream-3') {
    // SeeDream 3 specific parameters
    input.aspect_ratio = aspectRatio || "16:9";  // SeeDream's default is 16:9
    input.size = "regular";  // Options: "small", "regular", "big"
    input.guidance_scale = cfgScale || 2.5;  // Default guidance scale
    
    // Remove width/height as SeeDream uses aspect_ratio
    // (width/height only used when aspect_ratio is "custom")
    delete input.width;
    delete input.height;
  } else if (modelId.startsWith('sd')) {
    input.scheduler = "K_EULER";
    input.num_inference_steps = steps || 50;
    input.guidance_scale = cfgScale || 7.5;
  }

  try {
    console.log(`Generating with Replicate model: ${modelConfig.replicateModel}`);
    console.log("Input parameters:", input);
    
    // Create prediction
    const prediction = await replicate.predictions.create({
      version: modelConfig.replicateModel as `${string}/${string}:${string}`,
      input,
    });

    console.log("Created prediction:", prediction.id);

    // Poll for completion
    let completedPrediction = prediction;
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (completedPrediction.status !== "succeeded" && completedPrediction.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      completedPrediction = await replicate.predictions.get(prediction.id);
      attempts++;
      console.log(`Prediction status: ${completedPrediction.status} (attempt ${attempts})`);
    }

    if (completedPrediction.status === "failed") {
      throw new Error(`Prediction failed: ${completedPrediction.error || 'Unknown error'}`);
    }

    if (completedPrediction.status !== "succeeded") {
      throw new Error(`Prediction timed out after ${maxAttempts} attempts`);
    }

    const output = completedPrediction.output;
    console.log("Final output:", output);
    
    // Handle different output formats
    let imageUrl: string;
    if (Array.isArray(output)) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    } else if (output && typeof output === 'object' && 'url' in output) {
      imageUrl = (output as any).url;
    } else {
      console.error("Unexpected output format:", output);
      throw new Error(`Unexpected output format from Replicate: ${JSON.stringify(output)}`);
    }

    if (!imageUrl) {
      throw new Error("No image URL returned from Replicate");
    }

    return { url: imageUrl };
  } catch (error) {
    console.error("Replicate generation error:", error);
    throw new Error(`Failed to generate with ${modelConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Model Capability Registry for fal.ai models
interface FalModelCapabilities {
  supportsImage: boolean;
  imageField: 'image_url' | 'image_urls' | 'input_image';
  supportsStrength: boolean;
  strengthRange?: [number, number];
  sizing: {
    mode: 'aspect_ratio' | 'pixels';
    maxWidth?: number;
    maxHeight?: number;
  };
  supportedParams: string[]; // Whitelist of supported parameters
}

const FAL_MODEL_REGISTRY: Record<string, FalModelCapabilities> = {
  'fal-ai/z-image/turbo': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'num_inference_steps', 'seed', 'num_images', 'enable_safety_checker', 'output_format']
  },
  'fal-ai/flux/schnell': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'negative_prompt', 'seed', 'num_inference_steps', 'guidance_scale']
  },
  'fal-ai/flux/dev': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'negative_prompt', 'seed', 'num_inference_steps', 'guidance_scale']
  },
  'fal-ai/flux-pro/v1.1': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'negative_prompt', 'seed', 'num_inference_steps', 'guidance_scale']
  },
  'fal-ai/imagen4/preview/fast': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size']
  },
  'fal-ai/imagen4/preview': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size']
  },
  'fal-ai/imagen4/preview/ultra': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size']
  },
  'fal-ai/nano-banana': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'aspect_ratio', 'limit_generations']
  },
  'fal-ai/nano-banana/edit': {
    supportsImage: true,
    imageField: 'image_urls',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_urls', 'aspect_ratio', 'limit_generations']
  },
  'fal-ai/nano-banana-pro': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'aspect_ratio', 'num_images', 'output_format', 'resolution', 'limit_generations']
  },
  'fal-ai/nano-banana-pro/edit': {
    supportsImage: true,
    imageField: 'image_urls',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_urls', 'aspect_ratio', 'num_images', 'output_format', 'resolution', 'limit_generations']
  },
  'fal-ai/bytedance/seedream/v4.5/text-to-image': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'num_images', 'seed', 'enable_safety_checker']
  },
  'fal-ai/bytedance/seedream/v4.5/edit': {
    supportsImage: true,
    imageField: 'image_urls',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_urls', 'num_images', 'seed', 'enable_safety_checker']
  },
  'fal-ai/gpt-image-1.5': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'pixels' },
    supportedParams: ['prompt', 'image_size', 'quality', 'num_images', 'background', 'output_format']
  },
  'fal-ai/gpt-image-1.5/edit': {
    supportsImage: true,
    imageField: 'image_urls',
    supportsStrength: false,
    sizing: { mode: 'pixels' },
    supportedParams: ['prompt', 'image_urls', 'image_size', 'quality', 'num_images', 'background', 'output_format', 'mask_image_url', 'input_fidelity']
  },
  'fal-ai/stable-diffusion-xl': {
    supportsImage: false,
    imageField: 'image_url',
    supportsStrength: false,
    sizing: { mode: 'aspect_ratio' },
    supportedParams: ['prompt', 'image_size', 'negative_prompt', 'seed', 'num_inference_steps', 'guidance_scale']
  }
};

export async function generateWithFal(modelId: string, params: GenerationParams): Promise<{ url: string }> {
  const modelConfig = AI_MODELS.find(m => m.id === modelId);
  if (!modelConfig?.falModel) {
    throw new Error(`Model ${modelId} not found or missing fal.ai configuration`);
  }

  let { prompt, width = 1024, height = 1024, negativePrompt, seed, steps, cfgScale, aspectRatio, styleImageUrl, styleImageUrls, imageStrength, style, imageSize, resolution } = params;

  // Upload local style images to fal.ai storage for accessibility
  // fal.ai servers cannot access Replit development URLs directly
  if (styleImageUrl) {
    styleImageUrl = await uploadToFalStorage(styleImageUrl);
  }
  if (styleImageUrls && styleImageUrls.length > 0) {
    styleImageUrls = await uploadStyleImagesToFalStorage(styleImageUrls);
  }

  // Get model capabilities from registry
  const capabilities = FAL_MODEL_REGISTRY[modelConfig.falModel];
  if (!capabilities) {
    console.warn(`No capabilities found for model ${modelConfig.falModel}, using fallback`);
  }

  // Start with basic input - prompt is always required
  let input: any = {
    prompt: prompt,
  };

  // Handle sizing based on model capabilities
  console.log(`Sizing logic - Model: ${modelConfig.falModel}, capabilities:`, capabilities?.supportedParams);
  console.log(`Sizing logic - aspectRatio parameter: ${aspectRatio}, imageSize: ${imageSize}`);
  
  // Special handling for GPT Image 1.5 models - use direct pixel sizes
  if (modelConfig.falModel.includes('gpt-image-1.5')) {
    // GPT Image 1.5 uses specific size format: "1024x1024", "1536x1024", "1024x1536"
    const validSizes = ["1024x1024", "1536x1024", "1024x1536"];
    // Check imageSize first, then resolution (Film Studio sends resolution)
    const sizeToUse = imageSize || resolution;
    if (sizeToUse && validSizes.includes(sizeToUse)) {
      input.image_size = sizeToUse;
    } else {
      // Default to 1024x1024 if no valid size provided
      input.image_size = "1024x1024";
    }
    // Set quality based on model variant (low or high)
    if (modelId.includes('-low')) {
      input.quality = "low";
    } else if (modelId.includes('-high')) {
      input.quality = "high";
    }
    console.log(`GPT Image 1.5 settings: image_size=${input.image_size}, quality=${input.quality}`);
  } else if (capabilities && capabilities.supportedParams.includes('aspect_ratio')) {
    // Use aspect_ratio parameter directly for models that support it (e.g., nano-banana)
    console.log(`Using direct aspect_ratio parameter for ${modelConfig.falModel}`);
    if (aspectRatio) {
      input.aspect_ratio = aspectRatio;
    } else {
      // Default to 1:1 if no aspect ratio provided
      input.aspect_ratio = "1:1";
    }
  } else if (!capabilities || capabilities.supportedParams.includes('image_size')) {
    console.log(`Using image_size parameter mapping for ${modelConfig.falModel}`);
    // Map aspect ratio to fal.ai image_size format (for older models)
    if (aspectRatio) {
      switch (aspectRatio) {
        case "1:1":
          input.image_size = "square_hd";
          break;
        case "16:9":
          input.image_size = "landscape_16_9";
          break;
        case "9:16":
          input.image_size = "portrait_16_9";
          break;
        case "4:3":
          input.image_size = "landscape_4_3";
          break;
        case "3:4":
          input.image_size = "portrait_4_3";
          break;
        case "21:9":
          input.image_size = "landscape_16_9"; // Fallback to 16:9 as closest wide format
          break;
        case "9:21":
          input.image_size = "portrait_16_9"; // Fallback to 9:16 as closest tall format
          break;
        case "3:2":
          input.image_size = "landscape_4_3"; // Closest standard landscape ratio
          break;
        case "2:3":
          input.image_size = "portrait_4_3"; // Closest standard portrait ratio
          break;
        case "4:5":
          input.image_size = "portrait_4_3"; // Closest supported portrait ratio
          break;
        case "5:4":
          input.image_size = "landscape_4_3"; // Closest supported landscape ratio
          break;
        default:
          input.image_size = "square_hd";
      }
    } else {
      // Fallback to safe default for fal.ai
      input.image_size = "square_hd";
    }
  }

  // Handle image-to-image parameters based on model capabilities
  // Use multiple images if available, otherwise fall back to single image
  const imagesToUse = styleImageUrls && styleImageUrls.length > 0 ? styleImageUrls : (styleImageUrl ? [styleImageUrl] : []);
  
  if (capabilities && capabilities.supportsImage && imagesToUse.length > 0) {
    if (capabilities.imageField === 'image_urls') {
      // Models like nano-banana/edit and seedream/edit expect array format - can use all images
      input.image_urls = imagesToUse;
      console.log(`Adding image-to-image parameters for ${modelId}: image_urls=[${imagesToUse.join(', ')}]`);
    } else {
      // Standard image-to-image models expect single image_url - use first image
      const primaryImage = imagesToUse[0];
      input[capabilities.imageField] = primaryImage;
      console.log(`Adding image-to-image parameters for ${modelId}: ${capabilities.imageField}=${primaryImage}`);
      
      if (imagesToUse.length > 1) {
        console.log(`Multiple images provided (${imagesToUse.length}), but ${modelId} only supports single image. Using first image.`);
      }
    }

    // Only add strength if the model supports it and value is provided
    if (capabilities.supportsStrength && imageStrength !== undefined) {
      input.strength = imageStrength;
      console.log(`Adding strength parameter: ${imageStrength}`);
    }
  } else if (!capabilities && modelConfig.supportsStyleUpload && imagesToUse.length > 0) {
    // Fallback for models not in registry - use first image
    const primaryImage = imagesToUse[0];
    input.image_url = primaryImage;
    if (imageStrength !== undefined) {
      input.strength = imageStrength;
    }
    console.log(`Fallback image-to-image parameters for ${modelId}: image_url=${primaryImage}, strength=${imageStrength || 'not provided'}`);
    
    if (imagesToUse.length > 1) {
      console.log(`Multiple images provided (${imagesToUse.length}), but fallback mode only supports single image. Using first image.`);
    }
  }

  // Only add optional parameters if they're supported by this model
  if (capabilities) {
    if (capabilities.supportedParams.includes('negative_prompt') && negativePrompt) {
      input.negative_prompt = negativePrompt;
    }
    if (capabilities.supportedParams.includes('seed') && seed) {
      input.seed = seed;
    }
    if (capabilities.supportedParams.includes('num_inference_steps') && steps) {
      input.num_inference_steps = steps;
    }
    if (capabilities.supportedParams.includes('guidance_scale') && cfgScale) {
      input.guidance_scale = cfgScale;
    }
    
    // Nano Banana Pro specific parameters
    if (capabilities.supportedParams.includes('num_images')) {
      input.num_images = 1; // Default to 1 image
    }
    if (capabilities.supportedParams.includes('output_format')) {
      input.output_format = 'png'; // Default to PNG
    }
    if (capabilities.supportedParams.includes('resolution')) {
      // Use resolution from params, or default to 1K
      input.resolution = resolution || '1K';
    }
    // Nano Banana models: limit generations to 1 to avoid multiple images per run
    if (capabilities.supportedParams.includes('limit_generations')) {
      input.limit_generations = true;
    }
  } else {
    // Fallback for models not in registry - add all optional parameters
    if (negativePrompt) input.negative_prompt = negativePrompt;
    if (seed) input.seed = seed;
    if (steps) input.num_inference_steps = steps;
    if (cfgScale) input.guidance_scale = cfgScale;
  }

  // CRITICAL: Enforce strict parameter whitelist before sending to fal.ai
  if (capabilities && capabilities.supportedParams.length > 0) {
    // Create a clean input with only supported parameters
    const whitelistedInput: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (capabilities.supportedParams.includes(key)) {
        whitelistedInput[key] = value;
      } else {
        console.log(`Filtering out unsupported parameter '${key}' for model ${modelConfig.falModel}`);
      }
    }
    input = whitelistedInput;
  }

  try {
    console.log(`Generating with fal.ai model: ${modelConfig.falModel}`);
    console.log("Final input parameters (after whitelist filtering):", input);

    // Check if this is a queue-based model (nano-banana, saudi models, etc.) that needs polling
    const isQueueBasedModel = modelConfig.falModel.includes('nano-banana') || 
                              modelId.includes('saudi') ||
                              modelConfig.falModel.includes('nano-banana-pro');
    
    let result: any;
    
    if (isQueueBasedModel) {
      // Use queue.submit + polling for models that don't complete immediately
      // This is CRITICAL: fal.subscribe() returns when job is ACCEPTED, not COMPLETED
      console.log(`[Queue-Based] Using queue.submit for ${modelConfig.name} (${modelConfig.falModel})`);
      
      // Submit the job to the queue
      const { request_id } = await fal.queue.submit(modelConfig.falModel, {
        input: input,
      });
      
      console.log(`[Queue-Based] Job submitted with request_id: ${request_id}`);
      
      // Poll for completion with exponential backoff
      // Nano Banana Pro Edit models can take several minutes to complete
      const maxPollingTime = 600000; // 10 minutes max for queue-based models
      const startTime = Date.now();
      let pollInterval = 1000; // Start with 1 second
      const maxPollInterval = 5000; // Max 5 seconds between polls
      
      while (Date.now() - startTime < maxPollingTime) {
        // Check job status
        const statusResponse = await fal.queue.status(modelConfig.falModel, { 
          requestId: request_id,
          logs: true 
        });
        
        // Cast to string since fal.ai returns various status strings
        const currentStatus = String(statusResponse.status);
        console.log(`[Queue-Based] Status for ${request_id}: ${currentStatus}`);
        
        // Handle all terminal statuses
        if (currentStatus === 'COMPLETED') {
          // Job is complete - get the result
          console.log(`[Queue-Based] Job ${request_id} COMPLETED - retrieving result`);
          const queueResult = await fal.queue.result(modelConfig.falModel, { requestId: request_id });
          
          // Validate result is present and not an error
          if (!queueResult) {
            // Empty result from completed job - treat as provider error
            const providerError = new Error(`fal.ai returned empty result for completed job ${request_id}`) as any;
            providerError.status = 502; // Bad Gateway - upstream error
            providerError.detail = 'Provider returned empty result';
            throw providerError;
          }
          
          if (typeof queueResult === 'object' && (queueResult as any).error) {
            const errorDetail = (queueResult as any).error;
            console.error(`[Queue-Based] Job ${request_id} returned error in result:`, errorDetail);
            const providerError = new Error(`fal.ai generation failed: ${typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail)}`) as any;
            providerError.status = 502; // Bad Gateway - provider returned an error
            providerError.detail = errorDetail;
            throw providerError;
          }
          
          // Validate result has images - check all possible output formats from fal.ai
          // fal.ai can return: { images: [...] }, { data: { images: [...] } }, { output: { images: [...] } }, 
          // { output: [{ url }] }, { url }, { image: { url } }, etc.
          const resultObj = queueResult as any;
          const dataObj = resultObj.data || resultObj.output || resultObj;
          
          const hasImages = 
            // Check nested data/output.images array
            (dataObj?.images?.length > 0) ||
            // Check top-level images array
            (resultObj.images?.length > 0) ||
            // Check direct url property
            ('url' in resultObj) ||
            // Check nested image.url
            (resultObj.image?.url) ||
            // Check output as array with url items (e.g., { output: [{ url }] })
            (Array.isArray(resultObj.output) && resultObj.output.length > 0 && resultObj.output[0]?.url) ||
            // Check data.url or output.url direct
            (dataObj?.url);
          
          if (!hasImages) {
            console.error(`[Queue-Based] Job ${request_id} completed but no images in result:`, JSON.stringify(queueResult, null, 2));
            const providerError = new Error(`fal.ai returned no images for completed job ${request_id}`) as any;
            providerError.status = 502;
            providerError.detail = 'No images in result';
            throw providerError;
          }
          
          console.log(`[Queue-Based] Job ${request_id} result validated - images found`);
          
          result = queueResult;
          console.log(`[Queue-Based] Successfully retrieved result for job ${request_id}`);
          break;
        } else if (currentStatus === 'FAILED' || currentStatus === 'REJECTED' || currentStatus === 'CANCELLED') {
          // Job failed, rejected, or cancelled - these are all terminal failure states
          const statusData = statusResponse as any;
          const errorMsg = statusData.error || statusData.message || statusData.detail || `Job ${currentStatus.toLowerCase()}`;
          console.error(`[Queue-Based] Job ${request_id} terminal failure (${currentStatus}):`, errorMsg);
          
          // Create structured error with appropriate HTTP status code
          const structuredError = new Error(`fal.ai job ${currentStatus.toLowerCase()}: ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}`) as any;
          // CANCELLED/REJECTED are client-side issues (4xx), FAILED is server-side (5xx)
          structuredError.status = currentStatus === 'CANCELLED' ? 499 : currentStatus === 'REJECTED' ? 400 : 500;
          structuredError.detail = errorMsg;
          structuredError.falStatus = currentStatus;
          throw structuredError;
        } else if (currentStatus === 'IN_QUEUE' || currentStatus === 'IN_PROGRESS') {
          // Still in queue or processing - log progress and wait
          if ((statusResponse as any).logs && (statusResponse as any).logs.length > 0) {
            (statusResponse as any).logs.forEach((log: any) => {
              if (log.message) {
                console.log(`  [fal.ai log] ${log.message}`);
              }
            });
          }
          
          // Wait before next poll with exponential backoff
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
        } else {
          // Unknown status - log and continue polling (may be a transient state)
          console.warn(`[Queue-Based] Unknown status '${currentStatus}' for job ${request_id}, continuing to poll`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
        }
      }
      
      if (!result) {
        throw new Error(`Generation is taking longer than expected. Please try again in a moment.`);
      }
    } else {
      // Use subscribe for fast models that complete quickly (flux-schnell, etc.)
      console.log(`[Subscribe] Using fal.subscribe for ${modelConfig.name}`);
      result = await fal.subscribe(modelConfig.falModel, {
        input: input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_QUEUE") {
            console.log(`fal.ai job queued for ${modelConfig.name}`);
          } else if (update.status === "IN_PROGRESS") {
            console.log(`fal.ai job in progress for ${modelConfig.name}`);
            if (update.logs && update.logs.length > 0) {
              update.logs.forEach((log: any) => {
                if (log.message) {
                  console.log(`  [fal.ai log] ${log.message}`);
                }
              });
            }
          }
        }
      });
    }

    console.log("fal.ai response (after completion):", result);

    // Handle different output formats from fal.ai
    let imageUrl: string;
    
    console.log("Parsing fal.ai result:", JSON.stringify(result, null, 2));
    
    if (result && typeof result === 'object') {
      // Check for nested data/output structure from fal.ai
      // fal.ai can return: { data: {...} }, { output: {...} }, or direct result
      const resultObj = result as any;
      const dataObj = resultObj.data || resultObj.output || resultObj;
      
      console.log("DataObj:", JSON.stringify(dataObj, null, 2));
      
      // Try to extract image URL from various possible formats
      if (dataObj && typeof dataObj === 'object' && 'images' in dataObj && Array.isArray(dataObj.images) && dataObj.images.length > 0) {
        // Format: { data/output: { images: [{ url: "..." }] } } or { images: [{ url: "..." }] }
        const imageData = dataObj.images[0];
        if (imageData && typeof imageData === 'object' && 'url' in imageData) {
          imageUrl = imageData.url as string;
        } else {
          throw new Error(`No URL found in image data: ${JSON.stringify(imageData)}`);
        }
      } else if ('images' in resultObj && Array.isArray(resultObj.images) && resultObj.images.length > 0) {
        // Direct images format: { images: [{ url: "..." }] }
        const imageData = resultObj.images[0];
        if (imageData && typeof imageData === 'object' && 'url' in imageData) {
          imageUrl = imageData.url as string;
        } else {
          throw new Error(`No URL found in image data: ${JSON.stringify(imageData)}`);
        }
      } else if (Array.isArray(resultObj.output) && resultObj.output.length > 0 && resultObj.output[0]?.url) {
        // Output as array format: { output: [{ url: "..." }] }
        imageUrl = resultObj.output[0].url as string;
      } else if ('url' in resultObj) {
        // Direct URL format: { url: "..." }
        imageUrl = resultObj.url as string;
      } else if (dataObj && 'url' in dataObj) {
        // Nested data/output URL: { data/output: { url: "..." } }
        imageUrl = dataObj.url as string;
      } else if ('image' in resultObj && typeof resultObj.image === 'object' && resultObj.image && 'url' in resultObj.image) {
        // Nested format: { image: { url: "..." } }
        imageUrl = resultObj.image.url as string;
      } else {
        console.error("Unexpected fal.ai output format:", result);
        throw new Error(`Unexpected output format from fal.ai: ${JSON.stringify(result)}`);
      }
    } else {
      console.error("Unexpected fal.ai result type:", typeof result, result);
      throw new Error(`Unexpected result type from fal.ai: ${typeof result}`);
    }

    if (!imageUrl) {
      throw new Error("No image URL returned from fal.ai");
    }

    return { url: imageUrl };
  } catch (error) {
    console.error("fal.ai generation error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    // Enhanced error handling to extract nested error structures from fal.ai
    let status = 500;
    let errorMessage = 'Unknown error';
    let errorDetail = '';
    
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      
      // Extract status from various nested locations
      status = errorObj.status || errorObj.response?.status || errorObj.statusCode || 500;
      
      // Extract error details from various nested locations
      let detailSource = null;
      if (errorObj.body?.detail) {
        detailSource = errorObj.body.detail;
      } else if (errorObj.response?.data?.detail) {
        detailSource = errorObj.response.data.detail;
      } else if (errorObj.data?.detail) {
        detailSource = errorObj.data.detail;
      } else if (errorObj.detail) {
        detailSource = errorObj.detail;
      }
      
      // Process detail into a readable format
      if (detailSource) {
        if (Array.isArray(detailSource)) {
          errorDetail = detailSource.map((d: any) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              // Handle validation error objects like {loc: ['field'], msg: 'error', type: 'value_error'}
              if (d.loc && d.msg) {
                return `Field '${Array.isArray(d.loc) ? d.loc.join('.') : d.loc}': ${d.msg}`;
              }
              return JSON.stringify(d);
            }
            return String(d);
          }).join('; ');
        } else if (typeof detailSource === 'string') {
          errorDetail = detailSource;
        } else {
          errorDetail = JSON.stringify(detailSource);
        }
      }
      
      // Extract error message
      errorMessage = errorObj.message || errorObj.response?.data?.message || errorObj.data?.message || errorDetail || 'Unknown error';
    }
    
    // Create a comprehensive error message
    const fullMessage = errorDetail 
      ? `Failed to generate with ${modelConfig.name}: ${errorMessage} - ${errorDetail}`
      : `Failed to generate with ${modelConfig.name}: ${errorMessage}`;
    
    // Create a detailed error that preserves all information
    const detailedError = new Error(fullMessage) as any;
    detailedError.status = status;
    detailedError.detail = errorDetail;
    detailedError.originalError = error;
    
    throw detailedError;
  }
}

export async function generateImage(modelId: string, params: GenerationParams): Promise<{ url: string }> {
  const modelConfig = AI_MODELS.find(m => m.id === modelId);
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found`);
  }

  try {
    if (modelConfig.provider === "openai") {
      return await generateWithOpenAI(modelId, params);
    } else if (modelConfig.provider === "replicate") {
      return await generateWithReplicate(modelId, params);
    } else if (modelConfig.provider === "fal") {
      return await generateWithFal(modelId, params);
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
  } catch (error) {
    console.error(`Error generating with ${modelId}:`, error);
    throw error;
  }
}

export function getModelsByCategory(category?: string): ModelConfig[] {
  if (!category) return AI_MODELS;
  return AI_MODELS.filter(model => model.category === category);
}

export function getModelById(id: string): ModelConfig | undefined {
  return AI_MODELS.find(model => model.id === id);
}

export function getVideoModelsByCategory(): Record<string, VideoModelConfig[]> {
  return VIDEO_MODELS.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = [];
    }
    acc[model.category].push(model);
    return acc;
  }, {} as Record<string, VideoModelConfig[]>);
}

export function getVideoModelById(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find(model => model.id === id);
}

export async function generateVideo(modelId: string, params: VideoGenerationParams): Promise<{ predictionId: string }> {
  const modelConfig = VIDEO_MODELS.find(m => m.id === modelId);
  if (!modelConfig) {
    throw new Error(`Video model ${modelId} not found`);
  }

  // Route to appropriate provider
  if (modelConfig.provider === "fal") {
    return await generateVideoWithFal(modelId, params);
  }

  // Replicate-specific logic below
  const { prompt, aspectRatio = "9:16", duration = 5, startFrame, endFrame, resolution = "720p" } = params;

  // Build input based on model requirements
  let input: any = {
    prompt: prompt,
  };

  // Model-specific parameter mapping
  if (modelId.startsWith('wan-2.2')) {
    // WAN 2.2 model parameters
    console.log(`Configuring WAN 2.2 model: ${modelId}`);
    
    // Fixed FPS for WAN models
    input.fps = 16;
    
    // Calculate frames based on duration (5s → 81 frames, 7s → 112 frames)
    const frames = duration === 5 ? 81 : duration === 7 ? 112 : Math.round(duration * 16.2); // 16.2 to get 81 for 5s
    input.frames = frames;
    
    // Resolution mapping for WAN models
    const resolutionMap: Record<"480p" | "720p" | "1080p", { width: number; height: number }> = {
      "480p": { width: 854, height: 480 },
      "720p": { width: 1280, height: 720 },
      "1080p": { width: 1920, height: 1080 }
    };
    
    const res = resolutionMap[resolution];
    input.width = res.width;
    input.height = res.height;
    
    // Handle image input for i2v model
    if (modelId === 'wan-2.2-i2v-fast' && startFrame && modelConfig.supportsStartFrame) {
      // Convert local paths to full URLs for Replicate to access
      const fullImageUrl = convertToFullUrl(startFrame);
      if (fullImageUrl) {
        input.image = fullImageUrl;
        console.log(`Adding image input for WAN i2v model: ${fullImageUrl}`);
      } else {
        console.warn(`Failed to convert startFrame to full URL: ${startFrame}`);
      }
    }
    
    // Note: End frame intentionally disabled for WAN i2v model as per specifications
    
  } else {
    // Luma Ray Flash 2 540p and other models
    console.log(`Configuring Luma model: ${modelId}`);
    
    // For Luma models, ensure aspect_ratio is correctly formatted
    if (aspectRatio) {
      input.aspect_ratio = aspectRatio;
    }
    
    // For Luma models, duration must be an integer (5 or 9 seconds)
    if (duration) {
      // Ensure duration is supported (5 or 9 seconds for Luma Ray Flash 2)
      const supportedDurations = modelConfig.supportedDurations || [5, 9];
      const validDuration = supportedDurations.includes(duration) ? duration : supportedDurations[0];
      input.duration = validDuration;
      
      if (validDuration !== duration) {
        console.log(`Duration ${duration} not supported for ${modelId}, using ${validDuration} instead`);
      }
    }
    
    // Add start/end frame images if provided
    if (startFrame && modelConfig.supportsStartFrame) {
      // Convert local paths to full URLs for Replicate to access
      const fullStartImageUrl = convertToFullUrl(startFrame);
      if (fullStartImageUrl) {
        input.start_image_url = fullStartImageUrl;
        console.log(`Adding start_image_url to video input: ${fullStartImageUrl}`);
      } else {
        console.warn(`Failed to convert startFrame to full URL: ${startFrame}`);
      }
    }
    if (endFrame && modelConfig.supportsEndFrame) {
      // Convert local paths to full URLs for Replicate to access
      const fullEndImageUrl = convertToFullUrl(endFrame);
      if (fullEndImageUrl) {
        input.end_image_url = fullEndImageUrl;
        console.log(`Adding end_image_url to video input: ${fullEndImageUrl}`);
      } else {
        console.warn(`Failed to convert endFrame to full URL: ${endFrame}`);
      }
    }
    
    // Set loop to false by default for Luma models
    input.loop = false;
  }

  try {
    console.log(`Generating video with Replicate model: ${modelConfig.replicateModel}`);
    console.log("Video input parameters:", input);
    console.log("Final input being sent to Replicate:", JSON.stringify(input, null, 2));
    
    // Validate that we have the required parameters for Luma models
    if (modelId.startsWith('luma') && !input.prompt) {
      throw new Error("Prompt is required for Luma models");
    }
    
    // Create prediction for video generation
    const prediction = await replicate.predictions.create({
      version: modelConfig.replicateModel as `${string}/${string}:${string}`,
      input,
    });

    console.log("Created video prediction:", prediction.id);
    
    // Return prediction ID for polling - video generation takes longer than images
    return { predictionId: prediction.id };
  } catch (error) {
    console.error("Replicate video generation error:", error);
    
    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Check for common error patterns
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('invalid request data')) {
      console.error("INVALID REQUEST DATA ERROR - Debug info:");
      console.error("- Model ID:", modelId);
      console.error("- Model config:", JSON.stringify(modelConfig, null, 2));
      console.error("- Input sent:", JSON.stringify(input, null, 2));
      console.error("- Replicate model version:", modelConfig.replicateModel);
      
      errorMessage = `Invalid request data for ${modelConfig.name}. Check that all parameters match the model's expected format.`;
    }
    
    throw new Error(`Failed to generate video with ${modelConfig.name}: ${errorMessage}`);
  }
}

export async function generateVideoWithFal(modelId: string, params: VideoGenerationParams): Promise<{ predictionId: string }> {
  const modelConfig = VIDEO_MODELS.find(m => m.id === modelId);
  if (!modelConfig?.falModel) {
    throw new Error(`Video model ${modelId} not found or missing fal.ai configuration`);
  }

  const { prompt, aspectRatio = "9:16", duration = 5, startFrame, endFrame, videoReference, resolution = "720p", audioEnabled = false, characterOrientation = "video", audioFileUrl, promptExpansion = true, multiShot = true, negativePrompt } = params;

  // Build input for fal.ai video models
  let input: any = {
    prompt: prompt,
  };

  // Add duration with model-specific validation
  if (duration) {
    // ✅ VEO3 models require duration as string with "s" suffix (e.g., "8s")
    if (modelId.startsWith('fal-veo3')) {
      const supportedDurations = modelConfig.supportedDurations || [4, 6, 8];
      const validDuration = supportedDurations.includes(duration) ? duration : supportedDurations[0];
      input.duration = `${validDuration}s`; // VEO3 expects string format like "8s"
      if (validDuration !== duration) {
        console.log(`Duration ${duration}s not supported for ${modelId}, using ${validDuration}s instead`);
      }
    } else if (modelId.startsWith('kling-')) {
      // Kling models expect duration as string "5" or "10"
      const supportedDurations = modelConfig.supportedDurations || [5, 10];
      const validDuration = supportedDurations.includes(duration) ? duration : supportedDurations[0];
      input.duration = String(validDuration);
      if (validDuration !== duration) {
        console.log(`Duration ${duration}s not supported for ${modelId}, using ${validDuration}s instead`);
      }
    } else {
      input.duration = duration;
    }
  }

  // Add aspect ratio - fal.ai typically uses aspect_ratio parameter
  if (aspectRatio) {
    input.aspect_ratio = aspectRatio;
  }

  // Add resolution for VEO3, WAN 2.5, and WAN 2.6 models
  if ((modelId.startsWith('fal-veo3') || modelId.startsWith('wan-2.5') || modelId.startsWith('wan-2.6')) && resolution) {
    input.resolution = resolution;
  }

  // WAN 2.6 specific parameters
  if (modelId.startsWith('wan-2.6')) {
    // WAN 2.6 expects duration as string "5", "10", or "15"
    const supportedDurations = modelConfig.supportedDurations || [5, 10, 15];
    const validDuration = supportedDurations.includes(duration) ? duration : supportedDurations[0];
    input.duration = String(validDuration);
    
    // Audio file URL for background music (already uploaded to fal.storage)
    if (audioFileUrl && modelConfig.supportsAudioFile) {
      // fal.storage URLs are already complete HTTPS URLs, no conversion needed
      input.audio_url = audioFileUrl;
      console.log(`Using audio file URL for WAN 2.6: ${audioFileUrl}`);
    }
    
    // Prompt expansion (LLM rewriting)
    if (modelConfig.supportsPromptExpansion) {
      input.enable_prompt_expansion = promptExpansion;
      console.log(`WAN 2.6 prompt expansion: ${promptExpansion ? 'enabled' : 'disabled'}`);
    }
    
    // Multi-shot generation
    if (modelConfig.supportsMultiShot) {
      input.multi_shots = multiShot;
      console.log(`WAN 2.6 multi-shot: ${multiShot ? 'enabled' : 'disabled'}`);
    }
    
    // Negative prompt
    if (negativePrompt) {
      input.negative_prompt = negativePrompt;
    } else {
      input.negative_prompt = "low resolution, error, worst quality, low quality, defects";
    }
  }

  // Kling 2.6 specific parameters
  if (modelId.startsWith('kling-')) {
    // Add audio generation support for Kling text-to-video and image-to-video
    if (modelConfig.supportsAudio) {
      input.generate_audio = audioEnabled;
      console.log(`Kling model audio generation: ${audioEnabled ? 'enabled' : 'disabled'}`);
    }

    // Add negative prompt for Kling models
    input.negative_prompt = "blur, distort, and low quality";
    
    // Add CFG scale (default is 0.5)
    input.cfg_scale = 0.5;
  }

  // Grok Imagine Video specific parameters
  if (modelId.startsWith('grok-imagine')) {
    // Grok expects duration as integer (default 6, max 15)
    const supportedDurations = modelConfig.supportedDurations || [6, 8, 10, 12, 15];
    const validDuration = supportedDurations.includes(duration) ? duration : 6;
    input.duration = validDuration;
    
    // Resolution parameter
    if (resolution) {
      input.resolution = resolution;
    }
    
    // For image-to-video variant, use image_url parameter
    if (modelId === 'grok-imagine-i2v' && startFrame) {
      const fullImageUrl = convertToFullUrl(startFrame);
      if (fullImageUrl) {
        input.image_url = fullImageUrl;
        console.log(`Grok Imagine I2V: Using image_url=${fullImageUrl}`);
      }
    }
    
    // For edit/video-to-video variant, use video_url parameter
    if (modelId === 'grok-imagine-edit' && videoReference) {
      const fullVideoUrl = convertToFullUrl(videoReference);
      if (fullVideoUrl) {
        input.video_url = fullVideoUrl;
        console.log(`Grok Imagine Edit: Using video_url=${fullVideoUrl}`);
      }
    }
    
    console.log(`Grok Imagine Video: duration=${validDuration}s, resolution=${resolution || '720p'}, aspect_ratio=${aspectRatio}`);
  }

  // Add start frame if provided and supported
  if (startFrame && modelConfig.supportsStartFrame) {
    // Convert local paths to full URLs for fal.ai to access
    const fullImageUrl = convertToFullUrl(startFrame);
    if (fullImageUrl) {
      input.image_url = fullImageUrl;
      console.log(`Using start frame image URL for fal.ai: ${fullImageUrl}`);
    } else {
      console.warn(`Failed to convert startFrame to full URL: ${startFrame}`);
    }
  }

  // Add end frame if provided and supported (Kling I2V supports tail_image_url)
  if (endFrame && modelConfig.supportsEndFrame) {
    // Convert local paths to full URLs for fal.ai to access
    const fullEndImageUrl = convertToFullUrl(endFrame);
    if (fullEndImageUrl) {
      // Kling uses tail_image_url for end frame
      if (modelId.startsWith('kling-')) {
        input.tail_image_url = fullEndImageUrl;
        console.log(`Using tail image URL for Kling: ${fullEndImageUrl}`);
      } else {
        input.end_image_url = fullEndImageUrl;
        console.log(`Using end frame image URL for fal.ai: ${fullEndImageUrl}`);
      }
    } else {
      console.warn(`Failed to convert endFrame to full URL: ${endFrame}`);
    }
  }

  // Add video reference for Motion Control models (Kling only - not Grok)
  // Grok edit mode handles video_url in its own section above
  if (videoReference && modelConfig.supportsVideoReference && !modelId.startsWith('grok-imagine')) {
    const fullVideoUrl = convertToFullUrl(videoReference);
    if (fullVideoUrl) {
      input.video_url = fullVideoUrl;
      // character_orientation is only supported by Kling Motion Control models
      input.character_orientation = characterOrientation;
      console.log(`Using video reference URL for Motion Control: ${fullVideoUrl}, orientation: ${characterOrientation}`);
    } else {
      console.warn(`Failed to convert videoReference to full URL: ${videoReference}`);
    }
  }

  try {
    console.log(`Generating video with fal.ai model: ${modelConfig.falModel}`);
    console.log("Video input parameters:", input);

    // Use fal.subscribe for proper completion waiting (consistent with image generation)
    const result = await fal.subscribe(modelConfig.falModel, {
      input: input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_QUEUE") {
          console.log(`fal.ai video job queued for ${modelConfig.name}`);
        } else if (update.status === "IN_PROGRESS") {
          console.log(`fal.ai video job in progress for ${modelConfig.name}`);
          if (update.logs && update.logs.length > 0) {
            update.logs.forEach((log: any) => {
              if (log.message) {
                console.log(`  [fal.ai video log] ${log.message}`);
              }
            });
          }
        }
      }
    });

    console.log("fal.ai video response (after subscribe completion):", result);

    // fal.subscribe returns the result directly when complete
    let predictionId: string;
    let directVideoUrl: string | null = null;
    
    if (result && typeof result === 'object') {
      // Check various response formats from fal.ai
      if ('video' in result && result.video && typeof result.video === 'object' && 'url' in result.video) {
        // Direct video result - create a synthetic prediction ID and store the URL
        predictionId = `fal-direct-${Date.now()}`;
        directVideoUrl = result.video.url as string;
        console.log("fal.ai returned direct video result:", directVideoUrl);
        
        // Store in global cache for immediate retrieval
        if (!(global as any).falDirectResults) {
          (global as any).falDirectResults = new Map();
        }
        (global as any).falDirectResults.set(predictionId, {
          status: 'succeeded',
          output: directVideoUrl,
          completedAt: new Date().toISOString()
        });
      } else if ('data' in result && result.data && 'video' in result.data && result.data.video && typeof result.data.video === 'object' && 'url' in result.data.video) {
        // fal.ai wrapped video result format: { data: { video: { url: ... } } }
        predictionId = `fal-direct-${Date.now()}`;
        directVideoUrl = result.data.video.url as string;
        console.log("fal.ai returned wrapped video result:", directVideoUrl);
        
        // Store in global cache for immediate retrieval
        if (!(global as any).falDirectResults) {
          (global as any).falDirectResults = new Map();
        }
        (global as any).falDirectResults.set(predictionId, {
          status: 'succeeded',
          output: directVideoUrl,
          completedAt: new Date().toISOString()
        });
      } else if ('url' in result && typeof result.url === 'string') {
        // Direct URL in result
        predictionId = `fal-direct-${Date.now()}`;
        directVideoUrl = result.url as string;
        console.log("fal.ai returned direct URL:", directVideoUrl);
        
        // Store in global cache for immediate retrieval
        if (!(global as any).falDirectResults) {
          (global as any).falDirectResults = new Map();
        }
        (global as any).falDirectResults.set(predictionId, {
          status: 'succeeded',
          output: directVideoUrl,
          completedAt: new Date().toISOString()
        });
      } else if (Array.isArray(result) && result.length > 0 && result[0].url) {
        // Array format with URL
        predictionId = `fal-direct-${Date.now()}`;
        directVideoUrl = result[0].url as string;
        console.log("fal.ai returned array with URL:", directVideoUrl);
        
        // Store in global cache for immediate retrieval
        if (!(global as any).falDirectResults) {
          (global as any).falDirectResults = new Map();
        }
        (global as any).falDirectResults.set(predictionId, {
          status: 'succeeded',
          output: directVideoUrl,
          completedAt: new Date().toISOString()
        });
      } else {
        // For any other format, create a synthetic ID and store the result
        predictionId = `fal-direct-${Date.now()}`;
        console.log("fal.ai returned unknown format, storing as-is:", result);
        
        // Try to extract URL from result if possible
        const possibleUrl = (result as any)?.output || (result as any)?.video_url || (result as any)?.result || (result as any)?.video?.url;
        if (possibleUrl && typeof possibleUrl === 'string') {
          directVideoUrl = possibleUrl;
        }
        
        // Store in global cache
        if (!(global as any).falDirectResults) {
          (global as any).falDirectResults = new Map();
        }
        (global as any).falDirectResults.set(predictionId, {
          status: directVideoUrl ? 'succeeded' : 'processing',
          output: directVideoUrl,
          completedAt: new Date().toISOString()
        });
      }
    } else {
      console.error("Unexpected fal.ai video result type:", typeof result, result);
      throw new Error(`Unexpected result type from fal.ai: ${typeof result}`);
    }

    if (!predictionId) {
      throw new Error("No prediction ID returned from fal.ai");
    }

    console.log("fal.ai video prediction ID:", predictionId);
    if (directVideoUrl) {
      console.log("fal.ai direct video URL stored:", directVideoUrl);
    }
    return { predictionId: predictionId };

  } catch (error) {
    console.error("fal.ai video generation error:", error);
    throw new Error(`Failed to generate video with ${modelConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Provider selection and fallback logic
export function selectProviderForImage(category?: string): { provider: string; models: ModelConfig[] } {
  const primaryProvider = getConfig('primary_ai_provider', 'replicate');
  const fallbackProvider = getConfig('fallback_ai_provider', 'fal');
  const enableFallback = getConfig('enable_provider_fallback', true);
  const replicateStatus = getConfig('replicate_api_status', 'active');
  const falStatus = getConfig('fal_api_status', 'active');

  // Helper function to get available models for a provider
  const getModelsForProvider = (provider: string) => {
    let models = AI_MODELS.filter(model => model.provider === provider);
    if (category) {
      models = models.filter(model => model.category === category);
    }
    return models;
  };

  // Helper function to check if provider is available
  const isProviderAvailable = (provider: string) => {
    if (provider === 'replicate') return replicateStatus === 'active';
    if (provider === 'fal') return falStatus === 'active';
    if (provider === 'openai') return true; // OpenAI is always considered available
    return false;
  };

  // Try primary provider first
  if (isProviderAvailable(primaryProvider)) {
    const primaryModels = getModelsForProvider(primaryProvider);
    if (primaryModels.length > 0) {
      console.log(`Using primary provider: ${primaryProvider}`);
      return { provider: primaryProvider, models: primaryModels };
    }
  }

  // Try fallback provider if enabled and primary failed
  if (enableFallback && isProviderAvailable(fallbackProvider)) {
    const fallbackModels = getModelsForProvider(fallbackProvider);
    if (fallbackModels.length > 0) {
      console.log(`Using fallback provider: ${fallbackProvider} (primary ${primaryProvider} unavailable)`);
      return { provider: fallbackProvider, models: fallbackModels };
    }
  }

  // Last resort: try any available provider
  const availableProviders = ['openai', 'replicate', 'fal'].filter(isProviderAvailable);
  for (const provider of availableProviders) {
    const models = getModelsForProvider(provider);
    if (models.length > 0) {
      console.log(`Using last resort provider: ${provider}`);
      return { provider, models };
    }
  }

  throw new Error('No available providers or models found');
}

export function selectProviderForVideo(category?: string): { provider: string; models: VideoModelConfig[] } {
  const primaryProvider = getConfig('primary_ai_provider', 'replicate');
  const fallbackProvider = getConfig('fallback_ai_provider', 'fal');
  const enableFallback = getConfig('enable_provider_fallback', true);
  const replicateStatus = getConfig('replicate_api_status', 'active');
  const falStatus = getConfig('fal_api_status', 'active');

  console.log(`[DEBUG] Video provider selection: primary=${primaryProvider}, fallback=${fallbackProvider}, replicateStatus=${replicateStatus}, falStatus=${falStatus}`);

  // Helper function to get available models for a provider
  const getModelsForProvider = (provider: string) => {
    let models = VIDEO_MODELS.filter(model => model.provider === provider);
    if (category) {
      models = models.filter(model => model.category === category);
    }
    return models;
  };

  // Helper function to check if provider is available
  const isProviderAvailable = (provider: string) => {
    if (provider === 'replicate') return replicateStatus === 'active';
    if (provider === 'fal') return falStatus === 'active';
    return false;
  };

  // Try primary provider first
  if (isProviderAvailable(primaryProvider)) {
    const primaryModels = getModelsForProvider(primaryProvider);
    if (primaryModels.length > 0) {
      console.log(`Using primary video provider: ${primaryProvider}`);
      return { provider: primaryProvider, models: primaryModels };
    }
  }

  // Try fallback provider if enabled and primary failed
  if (enableFallback && isProviderAvailable(fallbackProvider)) {
    const fallbackModels = getModelsForProvider(fallbackProvider);
    if (fallbackModels.length > 0) {
      console.log(`Using fallback video provider: ${fallbackProvider} (primary ${primaryProvider} unavailable)`);
      return { provider: fallbackProvider, models: fallbackModels };
    }
  }

  // Last resort: try any available provider
  const availableProviders = ['replicate', 'fal'].filter(isProviderAvailable);
  for (const provider of availableProviders) {
    const models = getModelsForProvider(provider);
    if (models.length > 0) {
      console.log(`Using last resort video provider: ${provider}`);
      return { provider, models };
    }
  }

  throw new Error('No available video providers or models found');
}

export async function generateImageWithProvider(
  requestedModelId: string, 
  params: GenerationParams
): Promise<{ url: string }> {
  try {
    // Check API key availability first
    const apiKeys = hasRequiredApiKeys();
    
    // Try to use the specifically requested model first
    const requestedModel = getModelById(requestedModelId);
    if (requestedModel) {
      // Check if provider has required API key
      const providerHasKey = 
        (requestedModel.provider === 'openai' && apiKeys.openai) ||
        (requestedModel.provider === 'replicate' && apiKeys.replicate) ||
        (requestedModel.provider === 'fal' && apiKeys.fal);

      if (!providerHasKey) {
        const providerName = requestedModel.provider;
        const keyName = providerName === 'openai' ? 'OPENAI_API_KEY' : 
                       providerName === 'replicate' ? 'REPLICATE_API_TOKEN' : 'FAL_KEY';
        throw new Error(`${providerName} provider is not available. Please configure ${keyName} environment variable.`);
      }

      const providerStatus = requestedModel.provider === 'replicate' 
        ? getConfig('replicate_api_status', 'active')
        : requestedModel.provider === 'fal'
        ? getConfig('fal_api_status', 'standby')
        : 'active'; // OpenAI

      if (providerStatus === 'active') {
        console.log(`Using requested model: ${requestedModelId} with provider: ${requestedModel.provider}`);
        return await generateImage(requestedModelId, params);
      }
    }

    // If requested model is unavailable, fall back to provider selection
    console.log(`Requested model ${requestedModelId} unavailable, selecting alternative provider`);
    const { provider, models } = selectProviderForImage();
    
    if (models.length === 0) {
      throw new Error('No models available for selected provider');
    }

    // Select the first model from the available provider
    const selectedModel = models[0];
    console.log(`Falling back to model: ${selectedModel.id} with provider: ${provider}`);
    
    return await generateImage(selectedModel.id, params);
  } catch (error) {
    console.error('Error in generateImageWithProvider:', error);
    throw error;
  }
}

export async function generateVideoWithProvider(
  requestedModelId: string, 
  params: VideoGenerationParams
): Promise<{ predictionId: string }> {
  try {
    // Check API key availability first
    const apiKeys = hasRequiredApiKeys();
    
    // Try to use the specifically requested model first
    const requestedModel = getVideoModelById(requestedModelId);
    if (requestedModel) {
      // Check if provider has required API key
      const providerHasKey = 
        (requestedModel.provider === 'replicate' && apiKeys.replicate) ||
        (requestedModel.provider === 'fal' && apiKeys.fal);

      if (!providerHasKey) {
        const providerName = requestedModel.provider;
        const keyName = providerName === 'replicate' ? 'REPLICATE_API_TOKEN' : 'FAL_KEY';
        throw new Error(`${providerName} provider is not available. Please configure ${keyName} environment variable.`);
      }

      const providerStatus = requestedModel.provider === 'replicate' 
        ? getConfig('replicate_api_status', 'active')
        : requestedModel.provider === 'fal'
        ? getConfig('fal_api_status', 'standby')
        : 'active';

      if (providerStatus === 'active') {
        console.log(`Using requested video model: ${requestedModelId} with provider: ${requestedModel.provider}`);
        return await generateVideo(requestedModelId, params);
      }
    }

    // If requested model is unavailable, fall back to provider selection
    console.log(`Requested video model ${requestedModelId} unavailable, selecting alternative provider`);
    const { provider, models } = selectProviderForVideo();
    
    if (models.length === 0) {
      throw new Error('No video models available for selected provider');
    }

    // Select the first model from the available provider
    const selectedModel = models[0];
    console.log(`Falling back to video model: ${selectedModel.id} with provider: ${provider}`);
    
    return await generateVideo(selectedModel.id, params);
  } catch (error) {
    console.error('Error in generateVideoWithProvider:', error);
    throw error;
  }
}

// Progress stages with percentage thresholds
const PROGRESS_STAGES = [
  { threshold: 0, stage: "Starting…" },
  { threshold: 1, stage: "Analyzing prompt" },
  { threshold: 20, stage: "Setting scene" },
  { threshold: 40, stage: "Rendering frames" },
  { threshold: 95, stage: "Finalizing" },
  { threshold: 100, stage: "Completed!" }
];

// Map Replicate statuses to our normalized states
function normalizeProviderStatus(replicateStatus: string): 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed' {
  switch (replicateStatus) {
    case 'starting':
      return 'starting';
    case 'processing':
      return 'processing';
    case 'succeeded':
    case 'completed':
      return 'succeeded';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return 'queued';
  }
}

// Calculate progress percentage from provider data
function normalizeProgress(replicateProgress: number | null | undefined, status: string, elapsedSeconds: number, modelETA: number): number {
  // If we have actual progress from Replicate, use it (convert 0-1 to 0-100)
  if (replicateProgress != null && replicateProgress > 0) {
    return Math.min(replicateProgress * 100, 100);
  }
  
  // Status-based progress mapping
  switch (status) {
    case 'queued':
      return elapsedSeconds > 5 ? 1 : 0; // Force 1% after 5 seconds to show "Starting..."
    case 'starting':
      return Math.max(1, Math.min(elapsedSeconds / (modelETA * 0.1) * 20, 20)); // 0-20% for starting
    case 'processing':
      // Interpolate progress based on elapsed time vs model ETA
      const timeProgress = Math.min((elapsedSeconds / modelETA) * 95, 95);
      return Math.max(20, timeProgress); // Processing is at least 20%
    case 'succeeded':
      return 100;
    case 'failed':
      return 0;
    default:
      return Math.max(0, Math.min((elapsedSeconds / modelETA) * 95, 95));
  }
}

// Get current stage based on progress percentage
function getCurrentStage(progress: number): string {
  if (progress < 1) return "Starting…";
  
  for (let i = PROGRESS_STAGES.length - 1; i >= 0; i--) {
    if (progress >= PROGRESS_STAGES[i].threshold) {
      return PROGRESS_STAGES[i].stage;
    }
  }
  return "Starting…";
}

// Calculate ETA based on progress and model configuration
function calculateETA(progress: number, elapsedSeconds: number, modelETA: number): number {
  if (progress >= 100) return 0;
  if (progress <= 0) return modelETA;
  
  // Estimate remaining time based on current progress
  const estimatedTotal = (elapsedSeconds / progress) * 100;
  const remaining = Math.max(0, estimatedTotal - elapsedSeconds);
  
  // Cap at 2x model ETA to prevent unrealistic estimates
  return Math.min(remaining, modelETA * 2);
}

export async function getVideoPredictionStatus(predictionId: string): Promise<{
  status: string;
  progress: number;
  stage: string;
  etaSeconds: number;
  output?: string;
  error?: string;
}> {
  try {
    // Check if this is a fal.ai prediction ID
    if (predictionId.startsWith('fal-direct-')) {
      // Handle fal.ai direct results with progressive progress display
      console.log(`Checking fal.ai direct result for ${predictionId}`);
      
      // Retrieve the cached result and timing information
      let actualVideoUrl: string | undefined;
      let completedAt: string | undefined;
      if ((global as any).falDirectResults && (global as any).falDirectResults.has(predictionId)) {
        const directResult = (global as any).falDirectResults.get(predictionId);
        actualVideoUrl = directResult?.output;
        completedAt = directResult?.completedAt;
        console.log(`Retrieved fal.ai direct video URL from cache: ${actualVideoUrl}`);
      } else {
        console.warn(`fal.ai direct result not found in cache for ${predictionId}`);
      }
      
      // Calculate elapsed time since the generation was initiated
      const startTime = new Date(parseInt(predictionId.replace('fal-direct-', '')));
      const now = new Date();
      const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
      
      // Progressive display settings - show progress for at least 4 seconds
      const MIN_DISPLAY_TIME = 4;
      const COMPLETION_DELAY = 1; // Additional delay before showing as completed
      
      // Define progress stages with timing
      const progressStages = [
        { progress: 5, stage: 'Initializing...', minTime: 0.5 },
        { progress: 15, stage: 'Analyzing prompt...', minTime: 1.0 },
        { progress: 35, stage: 'Building scene...', minTime: 1.8 },
        { progress: 60, stage: 'Rendering frames...', minTime: 2.5 },
        { progress: 85, stage: 'Finalizing video...', minTime: 3.2 },
        { progress: 100, stage: 'Completed!', minTime: MIN_DISPLAY_TIME }
      ];
      
      // Find current progress stage based on elapsed time
      let currentProgress = 0;
      let currentStage = 'Queued...';
      let etaSeconds = MIN_DISPLAY_TIME;
      
      for (const stage of progressStages) {
        if (elapsedSeconds >= stage.minTime) {
          currentProgress = stage.progress;
          currentStage = stage.stage;
          etaSeconds = Math.max(0, MIN_DISPLAY_TIME + COMPLETION_DELAY - elapsedSeconds);
        } else {
          // Still in this stage, interpolate progress
          const prevStage = progressStages[progressStages.indexOf(stage) - 1];
          if (prevStage && elapsedSeconds > prevStage.minTime) {
            const stageProgress = (elapsedSeconds - prevStage.minTime) / (stage.minTime - prevStage.minTime);
            currentProgress = prevStage.progress + (stage.progress - prevStage.progress) * stageProgress;
            currentStage = stage.stage;
            etaSeconds = Math.max(0, MIN_DISPLAY_TIME + COMPLETION_DELAY - elapsedSeconds);
          }
          break;
        }
      }
      
      // Determine final status
      const isCompleted = elapsedSeconds >= (MIN_DISPLAY_TIME + COMPLETION_DELAY);
      const finalStatus = isCompleted ? 'succeeded' : 'processing';
      const finalProgress = isCompleted ? 100 : Math.max(1, Math.min(99, currentProgress));
      const finalStage = isCompleted ? 'Completed!' : currentStage;
      const finalOutput = isCompleted ? actualVideoUrl : undefined;
      
      console.log(`fal.ai direct progress: ${finalProgress}% (${finalStage}) - Status: ${finalStatus} - Elapsed: ${elapsedSeconds.toFixed(1)}s`);
      
      return {
        status: finalStatus,
        progress: Math.round(finalProgress * 10) / 10,
        stage: finalStage,
        etaSeconds: Math.round(etaSeconds),
        output: finalOutput,
        error: undefined
      };
    } else if (predictionId.includes('fal-') || predictionId.length > 20) {
      // Handle fal.ai jobs submitted via queue.submit
      console.log(`Checking fal.ai job status for ${predictionId}`);
      
      // Check actual fal.ai job status
      let falStatus: any;
      try {
        // Get the model information from the database to find the application ID
        const video = await dbStorage.getVideoByReplicateId(predictionId);
        if (!video?.model) {
          console.error(`Could not find video record for fal.ai job ${predictionId}`);
          throw new Error('Video record not found');
        }
        
        // Get the fal model endpoint from the model configuration
        const modelConfig = getVideoModelById(video.model);
        if (!modelConfig?.falModel) {
          console.error(`Could not find fal.ai model configuration for ${video.model}`);
          throw new Error('Model configuration not found');
        }
        
        const applicationId = modelConfig.falModel;
        console.log(`Checking fal.ai status for app ${applicationId}, request ${predictionId}`);
        
        // fal.queue.status expects (endpointId, { requestId }) format
        falStatus = await fal.queue.status(applicationId, { requestId: predictionId });
        console.log(`fal.ai job ${predictionId} status response:`, falStatus);
      } catch (statusError) {
        console.error(`Failed to get fal.ai job status for ${predictionId}:`, statusError);
        return {
          status: 'failed',
          progress: 0,
          stage: 'Failed',
          etaSeconds: 0,
          error: statusError instanceof Error ? statusError.message : 'Failed to get job status'
        };
      }
      
      // Parse fal.ai status response
      let normalizedStatus: 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed' = 'queued';
      let output: string | undefined;
      let error: string | undefined;
      
      // Map fal.ai status to our normalized status
      const statusMap: Record<string, 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed'> = {
        'IN_QUEUE': 'queued',
        'IN_PROGRESS': 'processing',
        'COMPLETED': 'succeeded',
        'FAILED': 'failed'
      };
      
      normalizedStatus = statusMap[falStatus.status] || 'processing';
      
      if (falStatus.status === 'COMPLETED') {
        // Extract video URL from various possible response formats
        if (falStatus.data?.video?.url) {
          output = falStatus.data.video.url;
        } else if (falStatus.data?.url) {
          output = falStatus.data.url;
        } else if (typeof falStatus.data === 'string') {
          output = falStatus.data;
        } else if (falStatus.output?.video) {
          // Sometimes fal.ai returns output.video directly
          output = falStatus.output.video;
        } else if (falStatus.output) {
          // Or just output as a string
          output = typeof falStatus.output === 'string' ? falStatus.output : falStatus.output.url;
        }
        console.log(`fal.ai job completed with output: ${output}`);
      } else if (falStatus.status === 'FAILED') {
        error = falStatus.error || falStatus.message || 'fal.ai generation failed';
        console.error(`fal.ai job failed: ${error}`);
      }
      
      // Get model ETA for fal.ai jobs
      let modelETA = 60;
      try {
        const video = await dbStorage.getVideoByReplicateId(predictionId);
        if (video?.model) {
          const falETAs: Record<string, number> = {
            'fal-luma-dream-machine': 90,
            'fal-stable-video-diffusion': 45,
            'fal-wan-2.2-t2v-turbo': 30,
            'fal-wan-2.2-i2v': 45,
            'fal-veo3-fast-t2v': 60,
            'fal-veo3-fast-i2v': 75,
          };
          modelETA = falETAs[video.model] || 60;
        }
      } catch (error) {
        console.log("Could not get fal.ai model ETA, using default:", error);
      }
      
      // Calculate elapsed time from fal.ai response
      let elapsedSeconds = 0;
      if (falStatus.requestedAt) {
        const requestedAt = new Date(falStatus.requestedAt).getTime();
        elapsedSeconds = Math.max(0, (Date.now() - requestedAt) / 1000);
      } else if (falStatus.createdAt) {
        const createdAt = new Date(falStatus.createdAt).getTime();
        elapsedSeconds = Math.max(0, (Date.now() - createdAt) / 1000);
      }
      
      // Calculate progress for fal.ai
      let progress = 0;
      
      // Use actual progress if provided by fal.ai
      if (falStatus.progress !== undefined) {
        progress = Math.min(99, Math.max(0, falStatus.progress * 100));
      } else if (falStatus.queue_position !== undefined) {
        // Use queue position if available
        const queuePosition = falStatus.queue_position;
        if (queuePosition === 0) {
          progress = normalizedStatus === 'succeeded' ? 100 : 75;
        } else {
          progress = Math.max(10, 50 - (queuePosition * 5));
        }
      } else {
        // Fall back to time-based progress estimation
        progress = normalizeProgress(null, normalizedStatus, elapsedSeconds, modelETA);
      }
      
      // Override progress for completed/failed states
      if (normalizedStatus === 'succeeded') {
        progress = 100;
      } else if (normalizedStatus === 'failed') {
        progress = 0;
      }
        const stage = getCurrentStage(progress);
        const etaSeconds = Math.round(calculateETA(progress, elapsedSeconds, modelETA));
        
        console.log(`fal.ai Progress for ${predictionId}: ${progress}% (${stage}) - ETA: ${etaSeconds}s - Status: ${normalizedStatus}`);
        
        return {
          status: normalizedStatus,
          progress: Math.round(progress * 10) / 10,
          stage,
          etaSeconds,
          output,
          error
        };
    }
    
    // Handle Replicate predictions (original logic)
    const prediction = await replicate.predictions.get(predictionId);
    const replicateProgress = (prediction as any).progress;
    const replicateStatus = prediction.status;
    
    // Normalize the status
    const normalizedStatus = normalizeProviderStatus(replicateStatus);
    
    // Get model ETA (fallback to 60 seconds if not available)
    let modelETA = 60;
    try {
      // Try to get video from database to find model info
      const video = await dbStorage.getVideoByReplicateId(predictionId);
      if (video?.model) {
        const modelConfig = getVideoModelById(video.model);
        // Default ETAs by model type
        const modelETAs: Record<string, number> = {
          'luma-ray-flash-2-540p': 45,
          'wan-2.2-i2v-fast': 60,
          'wan-2.2-t2v-fast': 90,
          'luma-lightning': 30,
        };
        modelETA = modelETAs[video.model] || 60;
      }
    } catch (error) {
      console.log("Could not get model ETA, using default:", error);
    }
    
    // Calculate elapsed time (assuming prediction.created_at exists)
    const createdAt = (prediction as any).created_at ? new Date((prediction as any).created_at) : new Date();
    const elapsedSeconds = Math.max(0, (Date.now() - createdAt.getTime()) / 1000);
    
    // Calculate normalized progress
    const progress = normalizeProgress(replicateProgress, normalizedStatus, elapsedSeconds, modelETA);
    
    // Get current stage
    const stage = getCurrentStage(progress);
    
    // Calculate ETA
    const etaSeconds = Math.round(calculateETA(progress, elapsedSeconds, modelETA));
    
    console.log(`Progress for ${predictionId}: ${progress}% (${stage}) - ETA: ${etaSeconds}s - Replicate: ${replicateStatus} (${replicateProgress})`);
    
    return {
      status: normalizedStatus,
      progress: Math.round(progress * 10) / 10, // Round to 1 decimal place
      stage,
      etaSeconds,
      output: typeof prediction.output === 'string' ? prediction.output : undefined,
      error: typeof prediction.error === 'string' ? prediction.error : undefined
    };
  } catch (error) {
    console.error("Error getting video prediction status:", error);
    throw new Error(`Failed to get prediction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}