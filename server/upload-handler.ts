import multer from 'multer';
import { createStorageService } from './storageProvider';

// Use memory storage so we can upload to object storage
const memoryStorage = multer.memoryStorage();

// File filter for images only (excluding SVG for security)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Security: explicitly exclude SVG files as they can contain XSS
  if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
    cb(new Error('SVG files are not allowed for security reasons'));
    return;
  }
  
  // Allow other image types
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (excluding SVG)'));
  }
};

// Create multer instance with memory storage configuration
export const styleImageUpload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Upload style image buffer to permanent object storage
export const uploadStyleImageToStorage = async (buffer: Buffer, contentType: string): Promise<string> => {
  const objectStorage = createStorageService();
  // Store in 'style-images' subdirectory within the private object storage
  // This returns a permanent URL like /objects/style-images/uuid.png
  return await objectStorage.uploadBufferToStorage(buffer, contentType, 'style-images');
};

// Helper function to build full URL from object storage path at request time
// This ensures URLs work correctly regardless of environment (dev/production)
export const buildStyleImageFullUrl = (objectPath: string, req: any): string => {
  if (!objectPath) return '';
  
  // If already a full URL, return as-is
  if (objectPath.startsWith('http://') || objectPath.startsWith('https://')) {
    return objectPath;
  }
  
  // Build full URL from relative object storage path
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}${objectPath}`;
};

// Helper function to get relative URL (for backward compatibility)
export const getStyleImageUrl = (filename: string): string => {
  return `/objects/style-images/${filename}`;
};

// Helper function to clean up style images from object storage
export const cleanupStyleImage = async (url: string): Promise<void> => {
  try {
    if (url.startsWith('/objects/')) {
      const objectStorage = createStorageService();
      await objectStorage.deleteObjectEntity(url);
    }
  } catch (error) {
    console.error('Failed to cleanup style image:', error);
  }
};
