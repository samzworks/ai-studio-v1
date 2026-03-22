import OpenAI from "openai";
import { storage } from "./storage";
import { imageRefConfigStorage } from "./image-ref-config-storage";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

/**
 * Analyzes the user's prompt and selects the most relevant Saudi reference category
 * @param prompt - The user's generation prompt
 * @returns The matched category slug, or null if no match
 */
export async function selectReferenceCategoryForPrompt(prompt: string): Promise<string | null> {
  try {
    // Get all active categories from object storage (shared between dev and prod)
    const categories = await imageRefConfigStorage.getActiveCategories();
    
    if (categories.length === 0) {
      console.log('No active reference categories found');
      return null;
    }
    
    // Build list of category names for ChatGPT
    const categoryList = categories.map(c => c.name).join(', ');
    
    // Fetch the system prompt template from the database
    const promptTemplate = await storage.getPromptTemplateByName('saudi_category_classifier');
    
    // Fallback to default prompt if not found in database
    const systemPrompt = promptTemplate?.promptText || 
      `You are an AI classifier for Saudi-specific image reference categories. 

Analyze the user's prompt and determine if it requires Saudi cultural reference images from one of these categories: [{{categoryList}}].

IMPORTANT RULES:
1. ONLY return a category name if the prompt EXPLICITLY relates to Saudi cultural, traditional, or local elements that would benefit from reference images
2. If the prompt is generic or does not specifically mention Saudi context (e.g., "a beautiful landscape", "a person smiling", "modern architecture"), return "none"
3. Return "none" for any prompt that can be generated well without Saudi-specific reference images
4. Only return ONE category name exactly as it appears in the list, or "none"
5. No explanations, just the category name or "none"

Examples:
- "a Saudi man in traditional thobe" → (match to appropriate category if available)
- "Riyadh skyline at sunset" → (match to appropriate category if available)
- "a beautiful sunset" → none
- "a portrait of a person" → none
- "modern office building" → none`;
    
    // Replace the {{categoryList}} variable with actual categories
    const finalSystemPrompt = systemPrompt.replace('{{categoryList}}', categoryList);
    
    // Use GPT-5 nano to classify the prompt using Responses API
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `${finalSystemPrompt}\n\nUser prompt: ${prompt}`
    });
    
    const selectedCategory = response.output_text?.trim() || 'none';
    
    console.log(`[DEBUG] ChatGPT raw response: "${selectedCategory}"`);
    console.log(`[DEBUG] Available categories: ${categoryList}`);
    console.log(`[DEBUG] User prompt: "${prompt}"`);
    
    if (selectedCategory.toLowerCase() === 'none') {
      console.log('ChatGPT determined no category matches the prompt');
      return null;
    }
    
    // Find the matching category by name (case-insensitive)
    const matchedCategory = categories.find(
      c => c.name.toLowerCase() === selectedCategory.toLowerCase()
    );
    
    if (!matchedCategory) {
      console.log(`ChatGPT returned "${selectedCategory}" but no matching category found`);
      return null;
    }
    
    console.log(`Selected category "${matchedCategory.name}" (${matchedCategory.slug}) for prompt: ${prompt}`);
    return matchedCategory.slug;
  } catch (error) {
    console.error('Error in category selection:', error);
    return null;
  }
}

/**
 * Gets reference image URLs for a given category slug
 * @param categorySlug - The category slug
 * @param limit - Maximum number of images to return (default 10)
 * @returns Array of absolute image URLs for AI model consumption
 */
export async function getReferenceImagesForCategory(categorySlug: string, limit: number = 10): Promise<string[]> {
  try {
    // Get category from object storage (shared between dev and prod)
    const category = await imageRefConfigStorage.getCategoryBySlug(categorySlug);
    
    if (!category) {
      console.log(`Category with slug "${categorySlug}" not found`);
      return [];
    }
    
    // Get images from object storage
    const images = await imageRefConfigStorage.getImages(category.id);
    const { convertToFullUrl } = await import('./ai-models');
    
    // Return up to limit images, sorted by sortOrder, converted to absolute URLs
    return images
      .slice(0, limit)
      .map(img => convertToFullUrl(img.url))
      .filter((url): url is string => url !== undefined);
  } catch (error) {
    console.error('Error fetching reference images:', error);
    return [];
  }
}

/**
 * Main preprocessing function for Saudi Model
 * Analyzes the prompt and returns reference image URLs
 * @param prompt - The user's generation prompt
 * @returns Array of reference image URLs (up to 10)
 */
/**
 * Automatically enhances the prompt for Saudi cultural context
 * This happens transparently after classification but before optional user enhancement
 * @param prompt - The user's original prompt
 * @returns Enhanced prompt optimized for Saudi visual culture
 */
export async function autoEnhanceSaudiPrompt(prompt: string): Promise<string> {
  try {
    console.log('Auto-enhancing prompt for Saudi cultural context:', prompt);
    
    // Fetch the system prompt template from the database
    const promptTemplate = await storage.getPromptTemplateByName('saudi_auto_enhancer');
    
    // Fallback to default prompt if not found in database
    const systemPrompt = promptTemplate?.promptText || 
      `You are an image generation assistant focused on Saudi visual culture.
Given a user prompt and reference images, your job is to:
1. Lightly enhance the prompt to make it more visually descriptive and culturally aligned with Saudi customs — without overloading it with too many extra details.
2. The enhanced prompt must be optimized for visual quality, while preserving the user's intent.
3. DO NOT copy the faces or copy any of the reference images directly as is. Instead, the model should generate a new and original image that is inspired by the style, attire, and cultural context of the references — not reproducing or copying them.
4. If the image includes people, always instruct the model to generate new faces, not reuse any existing photo subjects or real-life figures.
5. Ask the model to always create new original faces not the common faces from the training materials you have.
Always aim to reflect Saudi cultural aesthetics, clothing styles, settings, or heritage where relevant — based on what the original prompt implies — and enhance subtly.`;
    
    // Use GPT-5 nano to auto-enhance the prompt for Saudi culture using Responses API
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `${systemPrompt}\n\nUser prompt: ${prompt}`
    });
    
    const enhancedPrompt = response.output_text?.trim() || prompt;
    
    console.log(`Saudi auto-enhancement complete. Original: "${prompt}" -> Enhanced: "${enhancedPrompt}"`);
    return enhancedPrompt;
  } catch (error) {
    console.error('Error in Saudi auto-enhancement:', error);
    // Return original prompt if enhancement fails
    return prompt;
  }
}

export async function preprocessSaudiModelPrompt(prompt: string): Promise<string[]> {
  try {
    console.log('Starting Saudi Model preprocessing for prompt:', prompt);
    
    // Step 1: Use ChatGPT to select the best category
    const categorySlug = await selectReferenceCategoryForPrompt(prompt);
    
    if (!categorySlug) {
      console.log('No category selected, returning empty reference images');
      return [];
    }
    
    // Step 2: Get reference images for the selected category
    const referenceImages = await getReferenceImagesForCategory(categorySlug, 10);
    
    console.log(`Saudi Model preprocessing complete: ${referenceImages.length} reference images selected`);
    return referenceImages;
  } catch (error) {
    console.error('Error in Saudi Model preprocessing:', error);
    return [];
  }
}
