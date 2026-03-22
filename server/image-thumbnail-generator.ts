import sharp from 'sharp';
import { createStorageService, type IStorageService } from './storageProvider';

function getObjectStorage(): IStorageService {
  return createStorageService();
}

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_QUALITY = 80;

export async function generateImageThumbnail(
  imageUrl: string,
  imageId: number
): Promise<string> {
  try {
    console.log(`Generating thumbnail for image ${imageId} from: ${imageUrl}`);
    
    let inputBuffer: Buffer;
    
    // Handle object storage URLs directly
    if (imageUrl.startsWith('/objects/')) {
      inputBuffer = await getObjectStorage().downloadObjectBuffer(imageUrl);
    } else {
      // For external URLs, fetch via HTTP
      let fullImageUrl = imageUrl;
      if (!imageUrl.startsWith('http')) {
        const baseUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
          : 'http://localhost:5000';
        fullImageUrl = `${baseUrl}${imageUrl}`;
      }
      
      const response = await fetch(fullImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuffer);
    }
    
    const thumbnailBuffer = await sharp(inputBuffer)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
    
    const thumbnailUrl = await getObjectStorage().uploadImageThumbnailToStorage(
      thumbnailBuffer,
      imageId,
      '.webp'
    );
    
    console.log(`Thumbnail generated for image ${imageId}: ${thumbnailUrl}`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error generating thumbnail for image ${imageId}:`, error);
    throw error;
  }
}

export async function generateImageThumbnailFromBuffer(
  inputBuffer: Buffer,
  imageId: number
): Promise<string> {
  try {
    console.log(`Generating thumbnail for image ${imageId} from buffer`);
    
    const thumbnailBuffer = await sharp(inputBuffer)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
    
    const thumbnailUrl = await getObjectStorage().uploadImageThumbnailToStorage(
      thumbnailBuffer,
      imageId,
      '.webp'
    );
    
    console.log(`Thumbnail generated for image ${imageId}: ${thumbnailUrl}`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error generating thumbnail for image ${imageId}:`, error);
    throw error;
  }
}
