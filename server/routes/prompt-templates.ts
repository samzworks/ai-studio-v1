import express from 'express';
import { storage } from '../storage';
import { insertPromptTemplateSchema } from '@shared/schema';
import { substituteVariables, extractVariables, validateRequiredVariables, DEFAULT_PROMPTS } from '../prompt-utils';
import { isAdmin } from '../auth';

const router = express.Router();

// Get all prompt templates (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const templates = await storage.getPromptTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get active prompt templates by type (public - used by generation APIs)
router.get('/active/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const templates = await storage.getPromptTemplatesByType(type);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching prompt templates by type:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get best prompt template for type and optional model (public - used by generation APIs)
router.get('/best/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { model } = req.query;
    
    const template = await storage.getBestPromptTemplate(type, model as string);
    
    if (!template) {
      return res.status(404).json({ message: 'No prompt template found for this type' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching best prompt template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single prompt template
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const template = await storage.getPromptTemplate(id);
    
    if (!template) {
      return res.status(404).json({ message: 'Prompt template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching prompt template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Process prompt with variables (public endpoint for testing/preview)
router.post('/process', async (req, res) => {
  try {
    const { templateId, variables, promptText } = req.body;
    
    let template;
    let finalPromptText;
    
    if (templateId) {
      template = await storage.getPromptTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: 'Prompt template not found' });
      }
      finalPromptText = template.promptText;
    } else if (promptText) {
      finalPromptText = promptText;
    } else {
      return res.status(400).json({ message: 'Either templateId or promptText is required' });
    }
    
    // Extract variables from the prompt
    const extractedVars = extractVariables(finalPromptText);
    
    // Substitute variables
    const processedPrompt = substituteVariables(finalPromptText, variables || {});
    
    // Validate required variables if template has variable definitions
    let validationErrors: string[] = [];
    if (template && template.variables) {
      const variableDefinitions = Object.values(template.variables) as any[];
      validationErrors = validateRequiredVariables(finalPromptText, variableDefinitions, variables || {});
    }
    
    res.json({
      originalPrompt: finalPromptText,
      processedPrompt,
      extractedVariables: extractedVars,
      validationErrors,
      template: template || null
    });
  } catch (error) {
    console.error('Error processing prompt:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new prompt template
router.post('/', isAdmin, async (req, res) => {
  try {
    const templateData = insertPromptTemplateSchema.parse({
      ...req.body,
      createdBy: (req as any).adminUser.id,
      updatedBy: (req as any).adminUser.id
    });
    
    const newTemplate = await storage.createPromptTemplate(templateData);
    res.status(201).json(newTemplate);
  } catch (error: any) {
    console.error('Error creating prompt template:', error);
    if (error?.name === 'ZodError') {
      res.status(400).json({ message: 'Invalid data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Update prompt template
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = {
      ...req.body,
      updatedBy: (req as any).adminUser.id
    };
    
    const updatedTemplate = await storage.updatePromptTemplate(id, updates);
    
    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Prompt template not found' });
    }
    
    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle prompt template status
router.patch('/:id/toggle', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isActive } = req.body;
    
    const updatedTemplate = await storage.togglePromptTemplateStatus(id, isActive, (req as any).adminUser.id);
    
    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Prompt template not found' });
    }
    
    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error toggling prompt template status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete prompt template
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deletePromptTemplate(id, (req as any).adminUser.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Prompt template not found or cannot be deleted' });
    }
    
    res.json({ message: 'Prompt template deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Initialize default prompts (admin only)
router.post('/init-defaults', isAdmin, async (req, res) => {
  try {
    const createdTemplates = [];
    
    for (const [key, promptData] of Object.entries(DEFAULT_PROMPTS)) {
      // Check if template already exists
      const existing = await storage.getPromptTemplateByName(promptData.name);
      
      if (!existing) {
        const template = await storage.createPromptTemplate({
          ...promptData,
          createdBy: (req as any).adminUser.id,
          updatedBy: (req as any).adminUser.id,
          isActive: true
        });
        createdTemplates.push(template);
      }
    }
    
    res.json({ 
      message: `Initialized ${createdTemplates.length} default prompt templates`,
      templates: createdTemplates
    });
  } catch (error) {
    console.error('Error initializing default prompts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;