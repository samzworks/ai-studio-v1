import { db } from '../db';
import { images } from '@shared/schema';
import { eq, isNull, or, like, and } from 'drizzle-orm';
import { generateImageThumbnail } from '../image-thumbnail-generator';

async function generateThumbnailsForExistingImages() {
  console.log('Starting thumbnail generation for existing images...');
  
  try {
    // Only process images stored in object storage (/objects/...)
    // The /images/ path images may no longer exist locally
    const imagesToProcess = await db
      .select()
      .from(images)
      .where(
        and(
          or(
            isNull(images.thumbnailUrl),
            eq(images.thumbnailUrl, '')
          ),
          like(images.url, '/objects/%')
        )
      );
    
    console.log(`Found ${imagesToProcess.length} object storage images without thumbnails`);
    
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const image of imagesToProcess) {
      try {
        console.log(`[${generated + failed + 1}/${imagesToProcess.length}] Generating thumbnail for image ${image.id}...`);
        const thumbnailUrl = await generateImageThumbnail(image.url, image.id);
        
        if (thumbnailUrl) {
          await db
            .update(images)
            .set({ thumbnailUrl })
            .where(eq(images.id, image.id));
          generated++;
          console.log(`  ✓ Generated: ${thumbnailUrl}`);
        } else {
          failed++;
          console.log(`  ✗ Failed: no thumbnail URL returned`);
        }
      } catch (error) {
        console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }

    console.log(`\nThumbnail generation completed:`);
    console.log(`  Generated: ${generated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed: ${failed}`);
    
  } catch (error) {
    console.error('Error in thumbnail generation migration:', error);
    throw error;
  }
}

generateThumbnailsForExistingImages()
  .then(() => {
    console.log('Thumbnail migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Thumbnail migration failed:', error);
    process.exit(1);
  });
