import express from 'express';
import { insertImageReferenceCategorySchema, insertImageReferenceImageSchema } from '@shared/schema';
import { isAdmin } from '../auth';
import { referenceImageUpload, uploadRefImageToStorage, getRefImageUrl, cleanupRefImage, buildRefImagePublicUrl } from '../ref-image-upload';
import { imageRefConfigStorage, ImageRefCategory, ImageRefImage } from '../image-ref-config-storage';

const router = express.Router();

router.get('/categories', isAdmin, async (req, res) => {
  try {
    const categories = await imageRefConfigStorage.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching image reference categories:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/categories/active', async (req, res) => {
  try {
    const categories = await imageRefConfigStorage.getActiveCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching active image reference categories:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/categories/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const category = await imageRefConfigStorage.getCategory(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching image reference category:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/categories/slug/:slug', async (req, res) => {
  try {
    const category = await imageRefConfigStorage.getCategoryBySlug(req.params.slug);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching image reference category:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/categories', isAdmin, async (req: any, res) => {
  try {
    const validation = insertImageReferenceCategorySchema.safeParse({
      ...req.body,
      createdBy: req.user.claims.sub,
      updatedBy: req.user.claims.sub,
    });

    if (!validation.success) {
      return res.status(400).json({ 
        message: 'Invalid category data',
        errors: validation.error.errors 
      });
    }

    const category = await imageRefConfigStorage.createCategory({
      name: validation.data.name,
      slug: validation.data.slug,
      description: validation.data.description || null,
      isActive: validation.data.isActive ?? true,
      sortOrder: validation.data.sortOrder ?? 0,
      createdBy: req.user.claims.sub,
      updatedBy: req.user.claims.sub,
    });
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating image reference category:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/categories/:id', isAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const category = await imageRefConfigStorage.updateCategory(id, {
      ...req.body,
      updatedBy: req.user.claims.sub,
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating image reference category:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/categories/:id', isAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const images = await imageRefConfigStorage.getImages(id);
    for (const image of images) {
      await cleanupRefImage(image.url);
    }
    
    const deleted = await imageRefConfigStorage.deleteCategory(id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image reference category:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/categories/:categoryId/images', isAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const images = await imageRefConfigStorage.getImages(categoryId);
    
    const imagesWithAbsoluteUrls = images.map(image => {
      let url = image.url;
      if (url.includes('/uploads/ref-images/')) {
        console.warn(`Legacy reference image path detected: ${url} (ID: ${image.id})`);
      }
      return {
        ...image,
        url: url.startsWith('http') ? url : buildRefImagePublicUrl(url, req)
      };
    });
    
    res.json(imagesWithAbsoluteUrls);
  } catch (error) {
    console.error('Error fetching image reference images:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/categories/:categoryId/images', isAdmin, referenceImageUpload.array('images', 10), async (req: any, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    const category = await imageRefConfigStorage.getCategory(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const existingImages = await imageRefConfigStorage.getImages(categoryId);
    if (existingImages.length + (req.files?.length || 0) > 10) {
      return res.status(400).json({ message: 'Maximum 10 images per category allowed' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    const uploadedImages: ImageRefImage[] = [];
    const files = req.files as Express.Multer.File[];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const objectUrl = await uploadRefImageToStorage(file.buffer, file.mimetype);
      
      const savedImage = await imageRefConfigStorage.createImage({
        categoryId,
        filename: objectUrl.split('/').pop() || 'unknown',
        path: objectUrl,
        url: objectUrl,
        sortOrder: existingImages.length + i,
        uploadedBy: req.user.claims.sub,
      });
      
      uploadedImages.push(savedImage);
    }
    
    const imagesWithAbsoluteUrls = uploadedImages.map(image => ({
      ...image,
      url: image.url.startsWith('http') ? image.url : buildRefImagePublicUrl(image.url, req)
    }));
    
    res.status(201).json(imagesWithAbsoluteUrls);
  } catch (error) {
    console.error('Error uploading image reference images:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/images/:id', isAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const image = await imageRefConfigStorage.getImage(id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    await cleanupRefImage(image.url);
    
    const deleted = await imageRefConfigStorage.deleteImage(id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image reference image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/images/:id/sort', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { sortOrder } = req.body;
    
    if (typeof sortOrder !== 'number') {
      return res.status(400).json({ message: 'Invalid sort order' });
    }
    
    const updated = await imageRefConfigStorage.updateImageSortOrder(id, sortOrder);
    
    if (!updated) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating image sort order:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
