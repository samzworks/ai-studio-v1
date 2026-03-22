import { z } from "zod";

export type MediaType = "image" | "video";
export type InputType = "text-only" | "text+image";
export type VideoMode = "fast" | "pro" | "standard";
export type ModelVariantKind = "text-to-image" | "image-to-image" | "text-to-video" | "image-to-video" | "motion-control" | "video-to-video";

export interface ModelVariant {
  id: string;
  kind: ModelVariantKind;
  mode?: VideoMode;
  providerModelId: string;
  operationId?: string;
}

export interface BaseModel {
  id: string;
  name: string;
  displayName: string;
  provider: "openai" | "replicate" | "fal";
  mediaType: MediaType;
  category: "general" | "artistic" | "photorealistic" | "fast";
  description: string;
  icon?: string;
  supportsImageInput: boolean;
  supportsModes: boolean;
  availableModes?: VideoMode[];
  defaultMode?: VideoMode;
  variants: ModelVariant[];
  maxWidth?: number;
  maxHeight?: number;
  maxDuration?: number;
  supportedRatios: string[];
  supportedDurations?: number[];
  supportedSizes?: string[];
  supportsAudio?: boolean;
  supportsStyleUpload?: boolean;
  tags?: string[];
  // Video-specific capabilities
  supportsStartFrame?: boolean;
  supportsEndFrame?: boolean;
  supportsVideoReference?: boolean;
  supportsAudioFile?: boolean;
  supportsPromptExpansion?: boolean;
  supportsMultiShot?: boolean;
  framesByDuration?: Record<number, number>;
  fpsFixed?: number;
}

export interface ResolveVariantParams {
  baseModelId: string;
  mediaType: MediaType;
  hasInputImage: boolean;
  hasInputVideo?: boolean;
  mode?: VideoMode;
}

export interface ResolvedVariant {
  variant: ModelVariant | null;
  baseModel: BaseModel;
  fallbackMessage?: string;
  error?: boolean;
}

export const IMAGE_BASE_MODELS: BaseModel[] = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    displayName: "Nano Banana",
    provider: "fal",
    mediaType: "image",
    category: "fast",
    description: "Ultra-fast generation with style support",
    supportsImageInput: true,
    supportsModes: false,
    supportsStyleUpload: true,
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    tags: ["Fast", "Style"],
    variants: [
      { id: "fal-nano-banana-txt2img", kind: "text-to-image", providerModelId: "fal-ai/nano-banana", operationId: "image.nano_banana.txt2img" },
      { id: "fal-nano-banana-edit", kind: "image-to-image", providerModelId: "fal-ai/nano-banana/edit", operationId: "image.nano_banana.edit" },
    ],
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    displayName: "Nano Banana Pro",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "Premium quality with 1K/2K/4K resolution options",
    supportsImageInput: true,
    supportsModes: false,
    supportsStyleUpload: true,
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedSizes: ["1K", "2K", "4K"],
    tags: ["Style", "4K"],
    variants: [
      { id: "fal-nano-banana-pro-txt2img", kind: "text-to-image", providerModelId: "fal-ai/nano-banana-pro", operationId: "image.nano_banana_pro" },
      { id: "fal-nano-banana-pro-edit", kind: "image-to-image", providerModelId: "fal-ai/nano-banana-pro/edit", operationId: "image.nano_banana_pro" },
    ],
  },
  {
    id: "flux-schnell",
    name: "FLUX Schnell",
    displayName: "Fast",
    provider: "fal",
    mediaType: "image",
    category: "fast",
    description: "Ultra-fast FLUX model optimized for speed",
    supportsImageInput: false,
    supportsModes: false,
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    tags: ["Fast"],
    variants: [
      { id: "fal-flux-schnell", kind: "text-to-image", providerModelId: "fal-ai/flux/schnell", operationId: "image.flux.schnell" },
    ],
  },
  {
    id: "z-image-turbo",
    name: "Z-Image Turbo",
    displayName: "Z-Image Turbo",
    provider: "fal",
    mediaType: "image",
    category: "fast",
    description: "Super fast 6B parameter text-to-image model",
    supportsImageInput: false,
    supportsModes: false,
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    tags: ["Fast"],
    variants: [
      { id: "fal-z-image-turbo", kind: "text-to-image", providerModelId: "fal-ai/z-image/turbo", operationId: "image.z_image.turbo" },
    ],
  },
  {
    id: "flux-dev",
    name: "FLUX Dev",
    displayName: "FLUX Dev",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "High-quality FLUX Dev model for detailed images",
    supportsImageInput: false,
    supportsModes: false,
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    variants: [
      { id: "fal-flux-dev", kind: "text-to-image", providerModelId: "fal-ai/flux/dev", operationId: "image.flux.dev" },
    ],
  },
  {
    id: "flux-pro",
    name: "FLUX Pro",
    displayName: "FLUX Pro",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "Premium FLUX model for professional-grade images",
    supportsImageInput: false,
    supportsModes: false,
    maxWidth: 1440,
    maxHeight: 1440,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    variants: [
      { id: "fal-flux-pro", kind: "text-to-image", providerModelId: "fal-ai/flux/pro", operationId: "image.flux.pro" },
    ],
  },
  {
    id: "imagen-4",
    name: "Imagen 4",
    displayName: "Imagen 4",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "Google's state-of-the-art image generation",
    supportsImageInput: false,
    supportsModes: true,
    availableModes: ["fast", "pro"],
    defaultMode: "fast",
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    tags: ["Fast/Pro"],
    variants: [
      { id: "fal-imagen-4-fast", kind: "text-to-image", mode: "fast", providerModelId: "fal-ai/imagen4/preview", operationId: "image.imagen4.fast" },
      { id: "fal-imagen-4", kind: "text-to-image", mode: "pro", providerModelId: "fal-ai/imagen4/preview/ultra", operationId: "image.imagen4.standard" },
    ],
  },
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    displayName: "GPT Image 1.5",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "OpenAI's advanced image generation and editing",
    supportsImageInput: true,
    supportsModes: true,
    availableModes: ["fast", "pro"],
    defaultMode: "pro",
    supportsStyleUpload: true,
    maxWidth: 1536,
    maxHeight: 1536,
    supportedRatios: ["1:1", "3:2", "2:3"],
    tags: ["Style", "Fast/Pro"],
    variants: [
      { id: "fal-gpt-image-1.5-txt2img-low", kind: "text-to-image", mode: "fast", providerModelId: "fal-ai/gpt-image-1.5", operationId: "image.gpt_image_1_5.txt2img_low" },
      { id: "fal-gpt-image-1.5-txt2img-high", kind: "text-to-image", mode: "pro", providerModelId: "fal-ai/gpt-image-1.5", operationId: "image.gpt_image_1_5.txt2img_high" },
      { id: "fal-gpt-image-1.5-edit-low", kind: "image-to-image", mode: "fast", providerModelId: "fal-ai/gpt-image-1.5/edit", operationId: "image.gpt_image_1_5.edit_low" },
      { id: "fal-gpt-image-1.5-edit-high", kind: "image-to-image", mode: "pro", providerModelId: "fal-ai/gpt-image-1.5/edit", operationId: "image.gpt_image_1_5.edit_high" },
    ],
  },
  {
    id: "seedream-4.5",
    name: "SeeDream 4.5",
    displayName: "SeeDream 4.5",
    provider: "fal",
    mediaType: "image",
    category: "fast",
    description: "ByteDance enhanced quality with text rendering",
    supportsImageInput: true,
    supportsModes: false,
    supportsStyleUpload: true,
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedSizes: ["2K", "4K"],
    tags: ["4K", "Style"],
    variants: [
      { id: "fal-seedream-4.5-txt2img", kind: "text-to-image", providerModelId: "fal-ai/bytedance/seedream/v4.5/text-to-image", operationId: "image.seedream45.txt2img" },
      { id: "fal-seedream-4.5-img2img", kind: "image-to-image", providerModelId: "fal-ai/bytedance/seedream/v4.5/edit", operationId: "image.seedream45.edit" },
    ],
  },
  {
    id: "saudi-model",
    name: "Tkoeen Saudi Style",
    displayName: "Tkoeen Saudi Style",
    provider: "fal",
    mediaType: "image",
    category: "fast",
    description: "Saudi-inspired artistic image generation",
    supportsImageInput: true,
    supportsModes: false,
    supportsStyleUpload: false, // TEMPORARY: Disabled - set to true to re-enable reference image upload
    maxWidth: 1024,
    maxHeight: 1024,
    supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    tags: ["Style"],
    variants: [
      { id: "fal-saudi-model", kind: "image-to-image", providerModelId: "fal-ai/nano-banana/edit", operationId: "image.nano_banana.edit" },
    ],
  },
  {
    id: "saudi-model-pro",
    name: "Tkoeen Saudi Style Pro",
    displayName: "Tkoeen Saudi Style Pro",
    provider: "fal",
    mediaType: "image",
    category: "general",
    description: "Premium Saudi-inspired generation with 1K/2K/4K quality",
    supportsImageInput: true,
    supportsModes: false,
    supportsStyleUpload: false, // TEMPORARY: Disabled - set to true to re-enable reference image upload
    maxWidth: 4096,
    maxHeight: 4096,
    supportedRatios: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedSizes: ["1K", "2K", "4K"],
    tags: ["4K", "Style"],
    variants: [
      { id: "fal-saudi-model-pro", kind: "image-to-image", providerModelId: "fal-ai/nano-banana-pro/edit", operationId: "image.nano_banana_pro" },
    ],
  },
];

export const VIDEO_BASE_MODELS: BaseModel[] = [
  {
    id: "sora-2",
    name: "OpenAI Sora 2",
    displayName: "Sora 2",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "OpenAI's most advanced video model",
    supportsImageInput: true,
    supportsModes: true,
    availableModes: ["standard", "pro"],
    defaultMode: "pro",
    supportsAudio: true,
    maxDuration: 12,
    supportedRatios: ["16:9", "9:16"],
    supportedDurations: [4, 8, 12],
    supportedSizes: ["720p", "1080p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    tags: ["Pro"],
    variants: [
      { id: "sora-2-text-to-video", kind: "text-to-video", mode: "standard", providerModelId: "fal-ai/sora-2/text-to-video", operationId: "video.fal.sora2_standard" },
      { id: "sora-2-image-to-video", kind: "image-to-video", mode: "standard", providerModelId: "fal-ai/sora-2/image-to-video", operationId: "video.fal.sora2_standard" },
      { id: "sora-2-pro-text-to-video", kind: "text-to-video", mode: "pro", providerModelId: "fal-ai/sora-2/text-to-video/pro", operationId: "video.fal.sora2_pro" },
      { id: "sora-2-pro-image-to-video", kind: "image-to-video", mode: "pro", providerModelId: "fal-ai/sora-2/image-to-video/pro", operationId: "video.fal.sora2_pro" },
    ],
  },
  {
    id: "veo-3.1",
    name: "Google Veo 3.1",
    displayName: "VEO 3.1",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "Google's precision video with natural sound",
    supportsImageInput: true,
    supportsModes: true,
    availableModes: ["fast", "pro"],
    defaultMode: "pro",
    supportsAudio: true,
    maxDuration: 8,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [4, 6, 8],
    supportedSizes: ["720p", "1080p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    tags: ["Audio", "Fast/Pro"],
    variants: [
      { id: "fal-veo3-t2v", kind: "text-to-video", mode: "pro", providerModelId: "fal-ai/veo3.1", operationId: "video.fal.veo3_1" },
      { id: "fal-veo3-i2v", kind: "image-to-video", mode: "pro", providerModelId: "fal-ai/veo3.1/image-to-video", operationId: "video.fal.veo3_1" },
      { id: "fal-veo3-fast-t2v", kind: "text-to-video", mode: "fast", providerModelId: "fal-ai/veo3.1/fast", operationId: "video.fal.veo3_1_fast" },
      { id: "fal-veo3-fast-i2v", kind: "image-to-video", mode: "fast", providerModelId: "fal-ai/veo3.1/fast/image-to-video", operationId: "video.fal.veo3_1_fast" },
    ],
  },
  {
    id: "kling-2.6",
    name: "Kling 2.6",
    displayName: "Kling 2.6",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "Top-tier video with fluid motion and audio",
    supportsImageInput: true,
    supportsModes: false,
    supportsAudio: true,
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    supportsStartFrame: true,
    supportsEndFrame: true,
    supportsVideoReference: false,
    tags: ["Audio"],
    variants: [
      { id: "kling-2.6-pro-t2v", kind: "text-to-video", providerModelId: "fal-ai/kling-video/v2.6/pro/text-to-video", operationId: "video.fal.kling2_6_pro" },
      { id: "kling-2.6-pro-i2v", kind: "image-to-video", providerModelId: "fal-ai/kling-video/v2.6/pro/image-to-video", operationId: "video.fal.kling2_6_pro" },
    ],
  },
  {
    id: "kling-2.6-motion",
    name: "Kling 2.6 Motion Control",
    displayName: "Kling 2.6 Motion Control",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "Transfer motion from video to character image",
    supportsImageInput: true,
    supportsModes: true,
    availableModes: ["standard", "pro"],
    defaultMode: "pro",
    supportsAudio: false,
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["720p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsVideoReference: true,
    tags: ["Motion Control"],
    variants: [
      { id: "kling-2.6-pro-motion", kind: "motion-control", mode: "pro", providerModelId: "fal-ai/kling-video/v2.6/pro/motion-control", operationId: "video.fal.kling2_6_pro_motion" },
      { id: "kling-2.6-standard-motion", kind: "motion-control", mode: "standard", providerModelId: "fal-ai/kling-video/v2.6/standard/motion-control", operationId: "video.fal.kling2_6_standard_motion" },
    ],
  },
  {
    id: "wan-2.6",
    name: "WAN 2.6",
    displayName: "WAN 2.6",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "Multi-shot with audio and prompt expansion",
    supportsImageInput: true,
    supportsModes: false,
    supportsAudio: true,
    maxDuration: 15,
    supportedRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supportedDurations: [5, 10, 15],
    supportedSizes: ["720p", "1080p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsAudioFile: true,
    supportsPromptExpansion: true,
    supportsMultiShot: true,
    tags: ["Audio", "Multi-shot"],
    variants: [
      { id: "wan-2.6-t2v", kind: "text-to-video", providerModelId: "wan/v2.6/text-to-video", operationId: "video.fal.wan2_6" },
      { id: "wan-2.6-i2v", kind: "image-to-video", providerModelId: "wan/v2.6/image-to-video", operationId: "video.fal.wan2_6" },
    ],
  },
  {
    id: "wan-2.5",
    name: "WAN 2.5 Preview",
    displayName: "WAN 2.5",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "Next-gen quality and motion coherence",
    supportsImageInput: true,
    supportsModes: false,
    maxDuration: 10,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    supportedSizes: ["480p", "720p", "1080p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    variants: [
      { id: "wan-2.5-preview-t2v", kind: "text-to-video", providerModelId: "fal-ai/wan-25-preview/text-to-video", operationId: "video.fal.wan2_5_preview" },
      { id: "wan-2.5-preview-i2v", kind: "image-to-video", providerModelId: "fal-ai/wan-25-preview/image-to-video", operationId: "video.fal.wan2_5_preview" },
    ],
  },
  {
    id: "wan-2.2-fast",
    name: "WAN 2.2 Fast",
    displayName: "WAN 2.2 Fast",
    provider: "fal",
    mediaType: "video",
    category: "fast",
    description: "Fast video generation, 16 FPS",
    supportsImageInput: true,
    supportsModes: false,
    fpsFixed: 16,
    maxDuration: 7,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 7],
    supportedSizes: ["480p", "720p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    tags: ["Fast"],
    variants: [
      { id: "wan-2.2-t2v-fast", kind: "text-to-video", providerModelId: "fal-ai/wan/v2.2-a14b/text-to-video/turbo", operationId: "video.fal.wan2_2_turbo" },
      { id: "wan-2.2-i2v-fast", kind: "image-to-video", providerModelId: "fal-ai/wan/v2.2-a14b/image-to-video/turbo", operationId: "video.fal.wan2_2_turbo" },
    ],
  },
  {
    id: "luma-dream-machine",
    name: "Luma Dream Machine",
    displayName: "Luma Dream Machine",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "High-quality dream-like video generation",
    supportsImageInput: false,
    supportsModes: false,
    maxDuration: 5,
    supportedRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [3, 5],
    supportedSizes: ["720p"],
    supportsStartFrame: false,
    supportsEndFrame: false,
    variants: [
      { id: "fal-luma-dream-machine", kind: "text-to-video", providerModelId: "fal-ai/luma-dream-machine", operationId: "video.luma.flash2" },
    ],
  },
  {
    id: "grok-imagine-video",
    name: "Grok Imagine Video",
    displayName: "Grok Imagine Video",
    provider: "fal",
    mediaType: "video",
    category: "general",
    description: "xAI's Grok video generation with audio support",
    supportsImageInput: true,
    supportsModes: false,
    supportsAudio: true,
    maxDuration: 15,
    supportedRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    supportedDurations: [6, 8, 10, 12, 15],
    supportedSizes: ["480p", "720p"],
    supportsStartFrame: true,
    supportsEndFrame: false,
    supportsVideoReference: true,
    tags: ["Audio"],
    variants: [
      { id: "grok-imagine-t2v", kind: "text-to-video", providerModelId: "xai/grok-imagine-video/text-to-video", operationId: "video.fal.grok_imagine_t2v" },
      { id: "grok-imagine-i2v", kind: "image-to-video", providerModelId: "xai/grok-imagine-video/image-to-video", operationId: "video.fal.grok_imagine_i2v" },
      { id: "grok-imagine-edit", kind: "video-to-video", providerModelId: "xai/grok-imagine-video/edit", operationId: "video.fal.grok_imagine_edit" },
    ],
  },
];

export function resolveImageVariant(params: ResolveVariantParams): ResolvedVariant | null {
  const baseModel = IMAGE_BASE_MODELS.find(m => m.id === params.baseModelId);
  if (!baseModel) return null;

  const targetKind: ModelVariantKind = params.hasInputImage ? "image-to-image" : "text-to-image";
  
  let candidates = baseModel.variants.filter(v => v.kind === targetKind);
  
  if (candidates.length === 0) {
    // Check if this model ONLY supports image-to-image (e.g., saudi-model)
    const hasTextToImage = baseModel.variants.some(v => v.kind === "text-to-image");
    const hasImageToImage = baseModel.variants.some(v => v.kind === "image-to-image");
    
    // User wants text-only but model only supports image-to-image
    if (!params.hasInputImage && !hasTextToImage && hasImageToImage) {
      // Return the image-to-image variant for pricing estimation, but with a warning
      // This allows the UI to show pricing even before an image is uploaded
      const imageVariant = baseModel.variants.find(v => v.kind === "image-to-image");
      return {
        variant: imageVariant || null,
        baseModel,
        fallbackMessage: `${baseModel.displayName} requires a style image to work. Please upload an image.`,
        error: !imageVariant, // Only error if no variant found at all
      };
    }
    
    // User provided image but model only supports text-to-image
    if (params.hasInputImage && hasTextToImage && !hasImageToImage) {
      // Fallback to text-to-image, ignoring the image
      candidates = baseModel.variants.filter(v => v.kind === "text-to-image");
      let selectedVariant = candidates[0];
      if (baseModel.supportsModes && params.mode) {
        const modeMatch = candidates.find(v => v.mode === params.mode);
        if (modeMatch) selectedVariant = modeMatch;
      }
      return {
        variant: selectedVariant,
        baseModel,
        fallbackMessage: `${baseModel.displayName} doesn't support image input. Your image will be ignored.`,
      };
    }
    
    // Unexpected case - use any available variant
    candidates = baseModel.variants;
    if (candidates.length === 0) {
      return null;
    }
  }

  // Apply mode filter if model supports modes
  if (baseModel.supportsModes && params.mode) {
    const modeMatch = candidates.find(v => v.mode === params.mode);
    if (modeMatch) {
      return { variant: modeMatch, baseModel };
    }
    // Fallback to default mode if requested mode not found
    const defaultMode = baseModel.defaultMode || "pro";
    const defaultMatch = candidates.find(v => v.mode === defaultMode);
    if (defaultMatch) {
      return { variant: defaultMatch, baseModel };
    }
  }

  return { variant: candidates[0], baseModel };
}

export function resolveVideoVariant(params: ResolveVariantParams): ResolvedVariant | null {
  const baseModel = VIDEO_BASE_MODELS.find(m => m.id === params.baseModelId);
  if (!baseModel) return null;

  // Special handling for motion-control only models (like kling-2.6-motion)
  const motionControlVariants = baseModel.variants.filter(v => v.kind === "motion-control");
  if (motionControlVariants.length > 0 && baseModel.variants.every(v => v.kind === "motion-control")) {
    // This model only has motion-control variants - resolve based on mode
    if (baseModel.supportsModes && params.mode) {
      const modeMatch = motionControlVariants.find(v => v.mode === params.mode);
      if (modeMatch) {
        return { variant: modeMatch, baseModel };
      }
    }
    // Use default mode
    const defaultMode = baseModel.defaultMode || "pro";
    const defaultMatch = motionControlVariants.find(v => v.mode === defaultMode);
    if (defaultMatch) {
      return { variant: defaultMatch, baseModel };
    }
    // Fallback to first motion-control variant
    return { variant: motionControlVariants[0], baseModel };
  }

  // Handle video-to-video (edit) when a video input is provided
  if (params.hasInputVideo) {
    const videoToVideoVariants = baseModel.variants.filter(v => v.kind === "video-to-video");
    if (videoToVideoVariants.length > 0) {
      // Found video-to-video variant - use it
      if (baseModel.supportsModes && params.mode) {
        const modeMatch = videoToVideoVariants.find(v => v.mode === params.mode);
        if (modeMatch) {
          return { variant: modeMatch, baseModel };
        }
      }
      return { variant: videoToVideoVariants[0], baseModel };
    }
    // No video-to-video variant, fall through to image-to-video or text-to-video
  }

  const targetKind: ModelVariantKind = params.hasInputImage ? "image-to-video" : "text-to-video";
  
  let candidates = baseModel.variants.filter(v => v.kind === targetKind);
  
  if (candidates.length === 0) {
    const fallbackKind = params.hasInputImage ? "text-to-video" : "image-to-video";
    candidates = baseModel.variants.filter(v => v.kind === fallbackKind);
    
    if (candidates.length === 0) {
      candidates = baseModel.variants.filter(v => v.kind !== "motion-control" && v.kind !== "video-to-video");
    }
    
    if (candidates.length > 0) {
      let selectedVariant = candidates[0];
      if (baseModel.supportsModes && params.mode) {
        const modeMatch = candidates.find(v => v.mode === params.mode);
        if (modeMatch) selectedVariant = modeMatch;
      }
      
      return {
        variant: selectedVariant,
        baseModel,
        fallbackMessage: params.hasInputImage 
          ? `${baseModel.displayName} doesn't support image input. Using text-only mode.`
          : `${baseModel.displayName} only supports text-to-video generation.`,
      };
    }
    return null;
  }

  if (baseModel.supportsModes && params.mode) {
    const modeMatch = candidates.find(v => v.mode === params.mode);
    if (modeMatch) {
      return { variant: modeMatch, baseModel };
    }
    const defaultMode = baseModel.defaultMode || "pro";
    const defaultMatch = candidates.find(v => v.mode === defaultMode);
    if (defaultMatch) {
      return { variant: defaultMatch, baseModel };
    }
  }

  return { variant: candidates[0], baseModel };
}

export function resolveVariant(params: ResolveVariantParams): ResolvedVariant | null {
  if (params.mediaType === "image") {
    return resolveImageVariant(params);
  }
  return resolveVideoVariant(params);
}

export function getBaseModelById(id: string, mediaType: MediaType): BaseModel | null {
  const models = mediaType === "image" ? IMAGE_BASE_MODELS : VIDEO_BASE_MODELS;
  return models.find(m => m.id === id) || null;
}

export function findBaseModelByVariantId(variantId: string): { baseModel: BaseModel; variant: ModelVariant } | null {
  for (const baseModel of IMAGE_BASE_MODELS) {
    const variant = baseModel.variants.find(v => v.id === variantId);
    if (variant) return { baseModel, variant };
  }
  for (const baseModel of VIDEO_BASE_MODELS) {
    const variant = baseModel.variants.find(v => v.id === variantId);
    if (variant) return { baseModel, variant };
  }
  return null;
}

export function getVariantOperationId(variantId: string): string | null {
  const result = findBaseModelByVariantId(variantId);
  return result?.variant.operationId || null;
}

export interface NormalizedModelRequest {
  baseModel: BaseModel;
  resolvedVariant: ModelVariant | null;
  fallbackMessage?: string;
  error?: boolean;
  wasVariantId: boolean;
}

export function normalizeModelRequest(
  modelId: string,
  mediaType: MediaType,
  hasInputImage: boolean,
  mode?: VideoMode
): NormalizedModelRequest | null {
  const baseModels = mediaType === "image" ? IMAGE_BASE_MODELS : VIDEO_BASE_MODELS;
  
  // First, check if modelId is a base model ID
  const directBaseModel = baseModels.find(m => m.id === modelId);
  if (directBaseModel) {
    const result = resolveVariant({ baseModelId: modelId, mediaType, hasInputImage, mode });
    if (!result) return null;
    return {
      baseModel: result.baseModel,
      resolvedVariant: result.variant,
      fallbackMessage: result.fallbackMessage,
      error: result.error,
      wasVariantId: false,
    };
  }
  
  // Otherwise, check if modelId is a variant ID
  const variantLookup = findBaseModelByVariantId(modelId);
  if (variantLookup) {
    const { baseModel, variant } = variantLookup;
    const variantKind = variant.kind;
    
    // For specialized kinds like motion-control, always use the variant directly
    // These are explicitly requested by legacy code and should not be re-resolved
    if (variantKind === "motion-control") {
      return {
        baseModel,
        resolvedVariant: variant,
        wasVariantId: true,
      };
    }
    
    // Check if the existing variant matches the user's intent
    const userWantsImg2img = hasInputImage && (variantKind === "image-to-image" || variantKind === "image-to-video");
    const userWantsTxt2img = !hasInputImage && (variantKind === "text-to-image" || variantKind === "text-to-video");
    
    // If variant matches user intent, use it directly
    if (userWantsImg2img || userWantsTxt2img) {
      return {
        baseModel,
        resolvedVariant: variant,
        wasVariantId: true,
      };
    }
    
    // Variant doesn't match intent - re-resolve from base model
    const result = resolveVariant({ baseModelId: baseModel.id, mediaType, hasInputImage, mode });
    if (!result) {
      // Can't resolve, fall back to original variant
      return {
        baseModel,
        resolvedVariant: variant,
        wasVariantId: true,
        fallbackMessage: `Using ${baseModel.displayName} with existing configuration.`,
      };
    }
    
    return {
      baseModel: result.baseModel,
      resolvedVariant: result.variant,
      fallbackMessage: result.fallbackMessage,
      error: result.error,
      wasVariantId: true,
    };
  }
  
  // Neither base model nor variant ID found
  return null;
}
