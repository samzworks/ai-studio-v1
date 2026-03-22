/**
 * Mapping of internal model IDs to database operation IDs
 * 
 * This file is extracted to avoid circular dependencies between routes.ts and pricing-sync-service.ts
 * 
 * Format: operation IDs should follow pattern: {category}.{provider}.{model}
 * Examples:
 * - image.openai.dalle3
 * - image.fal.flux_schnell
 * - video.fal.veo3
 * - text.openai.gpt5_nano
 */
export const MODEL_TO_OPERATION_MAP: Record<string, string> = {
  // Image models - FAL.AI Z-Image Turbo
  'fal-z-image-turbo': 'image.z_image.turbo',
  'z-image-turbo': 'image.z_image.turbo',
  
  // Image models - FAL.AI FLUX
  'fal-flux-schnell': 'image.flux.schnell',
  'fal-flux-fast': 'image.flux.schnell',
  'flux-schnell': 'image.flux.schnell',
  'flux-fast': 'image.flux.schnell',
  'fal-flux-dev': 'image.flux.dev',
  'flux-dev': 'image.flux.dev',
  'fal-flux-pro': 'image.flux.pro',
  'flux-pro': 'image.flux.pro',
  
  // Image models - FAL.AI Nano Banana
  'fal-nano-banana-txt2img': 'image.nano_banana.txt2img',
  'fal-nano-banana-edit': 'image.nano_banana.edit',
  'fal-nano-banana-img2img': 'image.nano_banana.edit',
  'fal-saudi-model': 'image.nano_banana.edit',
  
  // Image models - FAL.AI Nano Banana Pro (all variants use single consolidated operation)
  'fal-nano-banana-pro': 'image.nano_banana_pro',
  'fal-nano-banana-pro-txt2img': 'image.nano_banana_pro',
  'fal-nano-banana-pro-edit': 'image.nano_banana_pro',
  'fal-nano-banana-pro-img2img': 'image.nano_banana_pro',
  'fal-saudi-model-pro': 'image.nano_banana_pro',
  
  // Image models - FAL.AI Imagen
  'fal-imagen-4-fast': 'image.imagen4.fast',
  'fal-imagen-4': 'image.imagen4.standard',
  
  // Image models - FAL.AI SeeDream
  'fal-seedream-4.5': 'image.seedream45.txt2img',
  'fal-seedream-4.5-txt2img': 'image.seedream45.txt2img',
  'fal-seedream-4.5-edit': 'image.seedream45.edit',
  'fal-seedream-4.5-img2img': 'image.seedream45.edit',
  
  // Image models - FAL.AI SDXL
  'fal-stable-diffusion-xl': 'image.sdxl.fast',
  'fal-sdxl': 'image.sdxl.fast',
  'stable-diffusion-xl': 'image.sdxl.fast',
  'sdxl': 'image.sdxl.fast',
  
  // Image models - FAL.AI GPT Image 1.5
  'fal-gpt-image-1.5-txt2img-low': 'image.gpt_image_1_5.txt2img_low',
  'fal-gpt-image-1.5-txt2img-high': 'image.gpt_image_1_5.txt2img_high',
  'fal-gpt-image-1.5-edit-low': 'image.gpt_image_1_5.edit_low',
  'fal-gpt-image-1.5-edit-high': 'image.gpt_image_1_5.edit_high',
  
  // Image models - FAL.AI WAN
  'fal-wan-2.5': 'image.wan25.txt2img',
  'fal-wan-2.5-txt2img': 'image.wan25.txt2img',
  'fal-wan-2.5-img2img': 'image.wan25.img2img',
  
  // Image models - OpenAI
  'dall-e-3': 'image.dalle3.standard',
  'dall-e-3-hd': 'image.dalle3.hd',
  
  // Video models - FAL.AI
  // WAN 2.6 (text-to-video and image-to-video with multi-shot and audio file support)
  'wan-2.6-t2v': 'video.fal.wan2_6',
  'wan-2.6-i2v': 'video.fal.wan2_6',
  
  // WAN 2.5 Preview (text-to-video and image-to-video)
  'wan-2.5-preview-t2v': 'video.fal.wan2_5_preview',
  'wan-2.5-preview-i2v': 'video.fal.wan2_5_preview',
  
  // WAN 2.2 Turbo (text-to-video fast, fixed 5s)
  'wan-2.2-t2v-fast': 'video.fal.wan2_2_turbo',
  'wan-2.2-fast': 'video.fal.wan2_2_turbo',
  'wan-2.2-i2v-fast': 'video.fal.wan2_2_turbo',
  'wan-2.2-i2v-turbo': 'video.fal.wan2_2_turbo',
  'wan-2.2-turbo': 'video.fal.wan2_2_turbo',
  
  // VEO 3.1 (text-to-video and image-to-video)
  'veo-3': 'video.fal.veo3_1',
  'veo-3.1': 'video.fal.veo3_1',
  'fal-veo3-t2v': 'video.fal.veo3_1',
  'fal-veo3-i2v': 'video.fal.veo3_1',
  
  // VEO 3.1 Fast (text-to-video and image-to-video)
  'fal-veo3-fast-t2v': 'video.fal.veo3_1_fast',
  'fal-veo3-fast-i2v': 'video.fal.veo3_1_fast',
  
  // Luma Dream Machine
  'fal-luma-dream-machine': 'video.luma.flash2',
  
  // Sora 2 Standard (text-to-video and image-to-video)
  'sora-2-text-to-video': 'video.fal.sora2_standard',
  'sora-2-image-to-video': 'video.fal.sora2_standard',
  
  // Sora 2 Pro (text-to-video and image-to-video)
  'sora-2-pro-text-to-video': 'video.fal.sora2_pro',
  'sora-2-pro-image-to-video': 'video.fal.sora2_pro',
  
  // Kling 2.6 (text-to-video and image-to-video)
  'kling-2.6-pro-t2v': 'video.fal.kling2_6_pro',
  'kling-2.6-pro-i2v': 'video.fal.kling2_6_pro',
  
  // Kling 2.6 Motion Control (separate model)
  'kling-2.6-pro-motion': 'video.fal.kling2_6_pro_motion',
  'kling-2.6-standard-motion': 'video.fal.kling2_6_standard_motion',
  
  // Base model mappings for pricing lookup
  'kling-2.6': 'video.fal.kling2_6_pro',
  'kling-2.6-motion': 'video.fal.kling2_6_pro_motion',
  
  // Grok Imagine Video (text-to-video, image-to-video, and edit/video-to-video)
  'grok-imagine-t2v': 'video.fal.grok_imagine_t2v',
  'grok-imagine-i2v': 'video.fal.grok_imagine_i2v',
  'grok-imagine-edit': 'video.fal.grok_imagine_edit',
  'grok-imagine-video': 'video.fal.grok_imagine_t2v',
  
  // Film Studio - GPT-5 operations
  'gpt-5-storyboard': 'text.gpt5.storyboard',
  'gpt-5-scene-regenerate': 'text.gpt5.scene_regenerate',
  'gpt-5-image-prompt-regenerate': 'text.gpt5.image_prompt_regenerate',
  'gpt-5-video-prompt-regenerate': 'text.gpt5.video_prompt_regenerate',
};

export function mapModelToOperationId(model: string, category: 'image' | 'video' | 'text' | 'audio'): string {
  // Try direct mapping first
  const directMapping = MODEL_TO_OPERATION_MAP[model];
  if (directMapping) {
    console.log(`[Pricing] Mapped model "${model}" to operation ID "${directMapping}" (direct mapping)`);
    return directMapping;
  }
  
  // Fallback: Build operation ID from model name
  const normalized = model.toLowerCase()
    .replace(/-/g, '_')
    .replace(/\./g, '_');
  
  // Try to determine provider from model name
  let provider = 'unknown';
  if (model.includes('dall-e') || model.includes('dalle')) {
    provider = 'openai';
  } else if (model.includes('fal-') || model.includes('flux') || model.includes('veo') || model.includes('wan') || model.includes('imagen')) {
    provider = 'fal';
  } else if (model.includes('replicate-')) {
    provider = 'replicate';
  } else if (model.includes('gpt')) {
    provider = 'openai';
  }
  
  const operationId = `${category}.${provider}.${normalized}`;
  console.log(`[Pricing] Mapped model "${model}" to operation ID "${operationId}" (fallback mapping)`);
  
  return operationId;
}
