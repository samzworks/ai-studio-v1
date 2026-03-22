// Utility functions for prompt template management and variable substitution
import { storage } from "./storage";

export interface PromptVariables {
  [key: string]: string | number | boolean;
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  description?: string;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
}

/**
 * Substitute variables in a prompt template
 * Replaces {{variable_name}} placeholders with provided values
 */
export function substituteVariables(promptText: string, variables: PromptVariables): string {
  let result = promptText;
  
  // Find all variable placeholders {{variable_name}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  let match;
  
  while ((match = variableRegex.exec(promptText)) !== null) {
    const variableName = match[1];
    const placeholder = match[0];
    
    if (variables.hasOwnProperty(variableName)) {
      result = result.replace(placeholder, String(variables[variableName]));
    }
  }
  
  return result;
}

/**
 * Extract variable placeholders from a prompt template
 * Returns array of variable names found in {{variable_name}} format
 */
export function extractVariables(promptText: string): string[] {
  const variables: string[] = [];
  const variableRegex = /\{\{(\w+)\}\}/g;
  let match;
  
  while ((match = variableRegex.exec(promptText)) !== null) {
    const variableName = match[1];
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }
  
  return variables;
}

/**
 * Validate that all required variables are provided
 */
export function validateRequiredVariables(promptText: string, variableDefinitions: VariableDefinition[], providedVariables: PromptVariables): string[] {
  const extractedVars = extractVariables(promptText);
  const missingRequired: string[] = [];
  
  for (const varDef of variableDefinitions) {
    if (varDef.required && extractedVars.includes(varDef.name) && !providedVariables.hasOwnProperty(varDef.name)) {
      missingRequired.push(varDef.name);
    }
  }
  
  return missingRequired;
}

/**
 * Default prompt templates for initialization
 */
export const DEFAULT_PROMPTS = {
  image_generation: {
    name: 'image_generation_default',
    displayName: 'Default Image Generation',
    type: 'image_generation',
    category: 'default',
    promptText: '{{user_prompt}}, {{style}}, high quality, detailed',
    variables: {
      user_prompt: { name: 'user_prompt', type: 'string', required: true, description: 'The main prompt from user' },
      style: { name: 'style', type: 'string', required: false, description: 'Style modifier', defaultValue: 'photorealistic' }
    },
    isDefault: true,
    description: 'Default prompt template for image generation'
  },
  video_generation: {
    name: 'video_generation_default', 
    displayName: 'Default Video Generation',
    type: 'video_generation',
    category: 'default',
    promptText: '{{user_prompt}}, {{style}}, smooth motion, cinematic',
    variables: {
      user_prompt: { name: 'user_prompt', type: 'string', required: true, description: 'The main prompt from user' },
      style: { name: 'style', type: 'string', required: false, description: 'Style modifier', defaultValue: 'cinematic' }
    },
    isDefault: true,
    description: 'Default prompt template for video generation'
  },
  image_enhancement: {
    name: 'image_enhancement_default',
    displayName: 'Default Image Enhancement', 
    type: 'image_enhancement',
    category: 'default',
    promptText: 'Enhance and improve this prompt for image generation: {{user_prompt}}. Add creative details, improve composition, and suggest artistic enhancements while maintaining the core intent.',
    variables: {
      user_prompt: { name: 'user_prompt', type: 'string', required: true, description: 'The original prompt to enhance' }
    },
    isDefault: true,
    description: 'Default prompt template for enhancing image prompts'
  },
  video_enhancement: {
    name: 'video_enhancement_default',
    displayName: 'Default Video Enhancement',
    type: 'video_enhancement', 
    category: 'default',
    promptText: 'Enhance and improve this prompt for video generation: {{user_prompt}}. Add dynamic motion descriptions, camera movements, and cinematic details while preserving the original concept.',
    variables: {
      user_prompt: { name: 'user_prompt', type: 'string', required: true, description: 'The original prompt to enhance' }
    },
    isDefault: true,
    description: 'Default prompt template for enhancing video prompts'
  },
  translation: {
    name: 'translation_default',
    displayName: 'Default Translation',
    type: 'translation',
    category: 'default', 
    promptText: 'Translate the following text from {{source_language}} to {{target_language}}. Maintain the original meaning and tone: {{text}}',
    variables: {
      text: { name: 'text', type: 'string', required: true, description: 'Text to translate' },
      source_language: { name: 'source_language', type: 'string', required: true, description: 'Source language' },
      target_language: { name: 'target_language', type: 'string', required: true, description: 'Target language' }
    },
    isDefault: true,
    description: 'Default prompt template for text translation'
  },
  saudi_auto_enhancer: {
    name: 'saudi_auto_enhancer',
    displayName: 'Saudi Auto-Enhancer',
    type: 'saudi_enhancement',
    category: 'saudi',
    promptText: `You are an image generation assistant focused on Saudi visual culture.
Given a user prompt and reference images, your job is to:
1. Lightly enhance the prompt to make it more visually descriptive and culturally aligned with Saudi customs — without overloading it with too many extra details.
2. The enhanced prompt must be optimized for visual quality, while preserving the user's intent.
3. DO NOT copy the faces or copy any of the reference images directly as is. Instead, the model should generate a new and original image that is inspired by the style, attire, and cultural context of the references — not reproducing or copying them.
4. If the image includes people, always instruct the model to generate new faces, not reuse any existing photo subjects or real-life figures.
5. Ask the model to always create new original faces not the common faces from the training materials you have.
Always aim to reflect Saudi cultural aesthetics, clothing styles, settings, or heritage where relevant — based on what the original prompt implies — and enhance subtly.`,
    variables: {},
    isDefault: true,
    description: 'Automatic prompt enhancement for Saudi Model to align with Saudi visual culture'
  }
} as const;

/**
 * Ensures all default prompt templates are initialized in the database
 * Called on server startup to sync DEFAULT_PROMPTS to the database
 */
export async function ensureDefaultPromptTemplates() {
  try {
    console.log('Initializing default prompt templates...');
    let createdCount = 0;
    
    for (const [key, promptData] of Object.entries(DEFAULT_PROMPTS)) {
      // Check if template already exists
      const existing = await storage.getPromptTemplateByName(promptData.name);
      
      if (!existing) {
        await storage.createPromptTemplate({
          ...promptData,
          createdBy: 'system',
          updatedBy: 'system',
          isActive: true
        });
        createdCount++;
        console.log(`  ✓ Created default prompt template: ${promptData.name}`);
      }
    }
    
    if (createdCount > 0) {
      console.log(`Initialized ${createdCount} default prompt templates`);
    } else {
      console.log('All default prompt templates already exist');
    }
  } catch (error) {
    console.error('Error initializing default prompt templates:', error);
  }
}