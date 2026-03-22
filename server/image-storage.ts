import { createStorageService } from './storageProvider';
import { generateImageThumbnailFromBuffer } from './image-thumbnail-generator';

export interface ImageStorageResult {
  imageUrl: string;
  thumbnailUrl: string | null;
}

export async function downloadAndStoreImage(imageUrl: string, imageId: number): Promise<ImageStorageResult> {
  const objectStorage = createStorageService();
  
  try {
    console.log(`Downloading image from: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const storedImageUrl = await objectStorage.uploadImageToStorage(imageUrl, imageId);
    
    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await generateImageThumbnailFromBuffer(buffer, imageId);
    } catch (thumbError) {
      console.error(`Failed to generate thumbnail for image ${imageId}, continuing without:`, thumbError);
    }
    
    return { imageUrl: storedImageUrl, thumbnailUrl };
  } catch (error) {
    console.error('Error in downloadAndStoreImage:', error);
    throw error;
  }
}

export async function downloadAndStoreImageLegacy(imageUrl: string, imageId: number): Promise<string> {
  const objectStorage = createStorageService();
  return await objectStorage.uploadImageToStorage(imageUrl, imageId);
}

export async function deleteStoredImage(imageUrl: string): Promise<void> {
  try {
    if (imageUrl.startsWith('/objects/generated-images/')) {
      console.log(`Image stored in object storage, deletion handled by object storage service: ${imageUrl}`);
    }
  } catch (error) {
    console.error('Error deleting stored image:', error);
  }
}