import multer from 'multer';
import { createStorageService } from './storageProvider';

// Configure multer for in-memory uploads (will be uploaded to object storage)
const storage = multer.memoryStorage();

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

// Create multer instance with configuration
export const referenceImageUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper function to upload buffer to object storage and return URL
export const uploadRefImageToStorage = async (buffer: Buffer, contentType: string): Promise<string> => {
  const objectStorage = createStorageService();
  return await objectStorage.uploadBufferToStorage(buffer, contentType, 'ref-images');
};

// Helper function to get relative URL (already returns object storage path)
export const getRefImageUrl = (objectPath: string): string => {
  return objectPath;
};

// Helper function to build absolute URL at request time
export const buildRefImagePublicUrl = (objectPath: string, req: any): string => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${objectPath}`;
};

// Helper function to clean up reference images from object storage
export const cleanupRefImage = async (url: string): Promise<void> => {
  try {
    const objectStorage = createStorageService();
    await objectStorage.deleteObjectEntity(url);
  } catch (error) {
    console.error('Failed to cleanup reference image:', error);
  }
};
