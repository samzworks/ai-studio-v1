import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ""
});

/**
 * Enhances an image generation prompt with the selected style naturally integrated
 * Uses GPT-5-nano to intelligently rewrite the prompt
 * @param prompt - The original image generation prompt
 * @param style - The style to integrate (e.g., "sketch", "photorealistic", "cinematic")
 * @returns Enhanced prompt with style naturally woven in
 */
export async function enhancePromptWithStyle(prompt: string, style: string): Promise<string> {
  // If no style or style is "none", return original prompt
  if (!style || style === 'none') {
    return prompt;
  }

  try {
    console.log(`Enhancing prompt with style "${style}":`, prompt);
    
    const systemPrompt = `You are an expert at enhancing image generation prompts to naturally integrate visual styles.

Your task: Rewrite the user's prompt to naturally incorporate the specified style, making it flow seamlessly as if the style was part of the original description.

IMPORTANT RULES:
1. Keep the core subject and intent of the original prompt intact
2. Naturally weave in visual characteristics of the specified style
3. Make the style description feel organic, not tacked on
4. Be concise - enhance without overloading with unnecessary details
5. Output ONLY the enhanced prompt, no explanations or extra text

Examples:
Original: "A desk with a laptop and coffee cup"
Style: sketch
Enhanced: "A sketch-style illustration of a desk workspace featuring a laptop and steaming coffee cup, rendered with loose pencil strokes and hatching"

Original: "Person walking in a park"
Style: cinematic
Enhanced: "A cinematic shot of a person walking through a sun-dappled park, with dramatic lighting and shallow depth of field capturing the golden hour atmosphere"

Original: "Modern building facade"
Style: watercolor
Enhanced: "A watercolor painting of a modern building facade with soft washes of color blending into the sky, delicate brushwork defining architectural details"`;
    
    // Use GPT-5 nano to enhance the prompt with style integration
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `${systemPrompt}\n\nOriginal prompt: ${prompt}\nStyle: ${style}\n\nEnhanced prompt:`
    });
    
    const enhancedPrompt = response.output_text?.trim() || prompt;
    
    console.log(`Style enhancement complete. Original: "${prompt}" -> Enhanced: "${enhancedPrompt}"`);
    return enhancedPrompt;
  } catch (error) {
    console.error('Error in style enhancement:', error);
    // Return original prompt if enhancement fails
    return prompt;
  }
}
