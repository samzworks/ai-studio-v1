import express from 'express';
import { storage } from '../storage';
import { isAdmin, isAuthenticated } from '../auth';
import { 
  insertPricingPageConfigSchema, 
  insertPricingFaqItemSchema,
  insertPricingComparisonSectionSchema,
  insertPricingComparisonRowSchema,
  insertPricingComparisonCellSchema,
  insertPlanDisplayOverrideSchema,
  insertCreditPackDisplayOverrideSchema,
  insertUpgradeReasonMappingSchema,
  insertAnnualPlanVariantSchema
} from '@shared/schema';

const router = express.Router();

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

router.get('/public', async (req, res) => {
  try {
    const data = await storage.getFullPricingPageData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching pricing page data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/upgrade-reason/:key', async (req, res) => {
  try {
    const mapping = await storage.getUpgradeReasonMapping(req.params.key);
    if (!mapping) {
      return res.status(404).json({ message: 'Upgrade reason not found' });
    }
    res.json(mapping);
  } catch (error) {
    console.error('Error fetching upgrade reason:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/nav-config', async (req, res) => {
  try {
    const config = await storage.getPricingPageConfig();
    res.json({ showNavLink: config?.showNavLink ?? true });
  } catch (error) {
    console.error('Error fetching nav config:', error);
    res.json({ showNavLink: true });
  }
});

// =============================================================================
// ADMIN ROUTES - Pricing Page Config
// =============================================================================

router.get('/admin/config', isAdmin, async (req, res) => {
  try {
    const config = await storage.getPricingPageConfig();
    res.json(config || null);
  } catch (error) {
    console.error('Error fetching pricing page config:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/config', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const config = await storage.upsertPricingPageConfig({ ...req.body, updatedBy: adminId });
    res.json(config);
  } catch (error) {
    console.error('Error updating pricing page config:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - FAQ Items
// =============================================================================

router.get('/admin/faq', isAdmin, async (req, res) => {
  try {
    const items = await storage.getPricingFaqItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching FAQ items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/admin/faq', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertPricingFaqItemSchema.parse({ ...req.body, updatedBy: adminId });
    const item = await storage.createPricingFaqItem(data);
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating FAQ item:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/faq/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const item = await storage.updatePricingFaqItem(id, req.body, adminId);
    if (!item) {
      return res.status(404).json({ message: 'FAQ item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating FAQ item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/faq/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const deleted = await storage.deletePricingFaqItem(id, adminId);
    if (!deleted) {
      return res.status(404).json({ message: 'FAQ item not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting FAQ item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Comparison Sections
// =============================================================================

router.get('/admin/comparison-sections', isAdmin, async (req, res) => {
  try {
    const sections = await storage.getPricingComparisonSections();
    res.json(sections);
  } catch (error) {
    console.error('Error fetching comparison sections:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/admin/comparison-sections', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertPricingComparisonSectionSchema.parse({ ...req.body, updatedBy: adminId });
    const section = await storage.createPricingComparisonSection(data);
    res.status(201).json(section);
  } catch (error: any) {
    console.error('Error creating comparison section:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/comparison-sections/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const section = await storage.updatePricingComparisonSection(id, req.body, adminId);
    if (!section) {
      return res.status(404).json({ message: 'Comparison section not found' });
    }
    res.json(section);
  } catch (error) {
    console.error('Error updating comparison section:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/comparison-sections/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const deleted = await storage.deletePricingComparisonSection(id, adminId);
    if (!deleted) {
      return res.status(404).json({ message: 'Comparison section not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison section:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Comparison Rows
// =============================================================================

router.get('/admin/comparison-rows', isAdmin, async (req, res) => {
  try {
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string) : undefined;
    const rows = await storage.getPricingComparisonRows(sectionId);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching comparison rows:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/admin/comparison-rows', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertPricingComparisonRowSchema.parse({ ...req.body, updatedBy: adminId });
    const row = await storage.createPricingComparisonRow(data);
    res.status(201).json(row);
  } catch (error: any) {
    console.error('Error creating comparison row:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/comparison-rows/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const row = await storage.updatePricingComparisonRow(id, req.body, adminId);
    if (!row) {
      return res.status(404).json({ message: 'Comparison row not found' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error updating comparison row:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/comparison-rows/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const adminId = (req as any).adminUser.id;
    const deleted = await storage.deletePricingComparisonRow(id, adminId);
    if (!deleted) {
      return res.status(404).json({ message: 'Comparison row not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison row:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Comparison Cells
// =============================================================================

router.get('/admin/comparison-cells', isAdmin, async (req, res) => {
  try {
    const rowId = req.query.rowId ? parseInt(req.query.rowId as string) : undefined;
    const cells = await storage.getPricingComparisonCells(rowId);
    res.json(cells);
  } catch (error) {
    console.error('Error fetching comparison cells:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/comparison-cells', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertPricingComparisonCellSchema.parse({ ...req.body, updatedBy: adminId });
    const cell = await storage.upsertPricingComparisonCell(data);
    res.json(cell);
  } catch (error: any) {
    console.error('Error upserting comparison cell:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/comparison-cells/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deletePricingComparisonCell(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Comparison cell not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison cell:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Plan Display Overrides
// =============================================================================

router.get('/admin/plan-overrides', isAdmin, async (req, res) => {
  try {
    const overrides = await storage.getPlanDisplayOverrides();
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching plan overrides:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/plan-overrides', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertPlanDisplayOverrideSchema.parse({ ...req.body, updatedBy: adminId });
    const override = await storage.upsertPlanDisplayOverride(data);
    res.json(override);
  } catch (error: any) {
    console.error('Error upserting plan override:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/plan-overrides/:planId', isAdmin, async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const deleted = await storage.deletePlanDisplayOverride(planId);
    if (!deleted) {
      return res.status(404).json({ message: 'Plan override not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan override:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Credit Pack Display Overrides
// =============================================================================

router.get('/admin/credit-pack-overrides', isAdmin, async (req, res) => {
  try {
    const overrides = await storage.getCreditPackDisplayOverrides();
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching credit pack overrides:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/credit-pack-overrides', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertCreditPackDisplayOverrideSchema.parse({ ...req.body, updatedBy: adminId });
    const override = await storage.upsertCreditPackDisplayOverride(data);
    res.json(override);
  } catch (error: any) {
    console.error('Error upserting credit pack override:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/credit-pack-overrides/:packId', isAdmin, async (req, res) => {
  try {
    const packId = parseInt(req.params.packId);
    const deleted = await storage.deleteCreditPackDisplayOverride(packId);
    if (!deleted) {
      return res.status(404).json({ message: 'Credit pack override not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting credit pack override:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Upgrade Reason Mappings
// =============================================================================

router.get('/admin/upgrade-reasons', isAdmin, async (req, res) => {
  try {
    const mappings = await storage.getUpgradeReasonMappings();
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching upgrade reason mappings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/upgrade-reasons', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertUpgradeReasonMappingSchema.parse({ ...req.body, updatedBy: adminId });
    const mapping = await storage.upsertUpgradeReasonMapping(data);
    res.json(mapping);
  } catch (error: any) {
    console.error('Error upserting upgrade reason mapping:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/upgrade-reasons/:key', isAdmin, async (req, res) => {
  try {
    const reasonKey = req.params.key;
    const deleted = await storage.deleteUpgradeReasonMapping(reasonKey);
    if (!deleted) {
      return res.status(404).json({ message: 'Upgrade reason mapping not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting upgrade reason mapping:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - Annual Plan Variants
// =============================================================================

router.get('/admin/annual-variants', isAdmin, async (req, res) => {
  try {
    const variants = await storage.getAnnualPlanVariants();
    res.json(variants);
  } catch (error) {
    console.error('Error fetching annual plan variants:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/admin/annual-variants', isAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const data = insertAnnualPlanVariantSchema.parse({ ...req.body, updatedBy: adminId });
    const variant = await storage.upsertAnnualPlanVariant(data);
    res.json(variant);
  } catch (error: any) {
    console.error('Error upserting annual plan variant:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/admin/annual-variants/:monthlyPlanId', isAdmin, async (req, res) => {
  try {
    const monthlyPlanId = parseInt(req.params.monthlyPlanId);
    const deleted = await storage.deleteAnnualPlanVariant(monthlyPlanId);
    if (!deleted) {
      return res.status(404).json({ message: 'Annual plan variant not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting annual plan variant:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
