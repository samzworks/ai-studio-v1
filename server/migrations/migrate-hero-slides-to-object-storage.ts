import { storage as dbStorage } from '../storage';
import { ObjectStorageService } from '../objectStorage';
import fs from 'fs/promises';
import path from 'path';

async function migrateHeroSlidesToObjectStorage() {
  console.log('Starting hero slides migration to object storage...');
  
  const objectStorage = new ObjectStorageService();
  
  try {
    // Get all hero slides
    const slides = await dbStorage.getAllHeroSlides();
    console.log(`Found ${slides.length} hero slides to check`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const slide of slides) {
      // Skip if already using object storage
      if (slide.imageUrl.startsWith('/objects/')) {
        console.log(`Slide ${slide.id}: Already using object storage, skipping`);
        skippedCount++;
        continue;
      }
      
      // Only migrate local /uploads/ paths
      if (!slide.imageUrl.startsWith('/uploads/')) {
        console.log(`Slide ${slide.id}: External URL, skipping`);
        skippedCount++;
        continue;
      }
      
      try {
        // Construct local file path
        // Remove leading slash and prepend 'public' for files in /uploads/
        const relativePath = slide.imageUrl.startsWith('/') ? slide.imageUrl.slice(1) : slide.imageUrl;
        const localPath = path.join(process.cwd(), '..', 'public', relativePath);
        console.log(`Slide ${slide.id}: Checking ${localPath}`);
        
        // Check if file exists
        try {
          await fs.access(localPath);
        } catch (error) {
          console.error(`Slide ${slide.id}: File not found at ${localPath}, skipping`);
          errorCount++;
          continue;
        }
        
        // Read file
        const fileBuffer = await fs.readFile(localPath);
        
        // Determine content type from extension
        const ext = path.extname(localPath).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.gif') contentType = 'image/gif';
        
        // Upload to object storage
        console.log(`Slide ${slide.id}: Uploading to object storage...`);
        const objectUrl = await objectStorage.uploadBufferToStorage(
          fileBuffer,
          contentType,
          'hero-slides'
        );
        
        // Update database
        await dbStorage.updateHeroSlide(slide.id, {
          imageUrl: objectUrl,
          updatedBy: slide.updatedBy
        });
        
        console.log(`Slide ${slide.id}: Successfully migrated to ${objectUrl}`);
        migratedCount++;
        
        // Optional: Delete old file (commented out for safety)
        // await fs.unlink(localPath);
        
      } catch (error) {
        console.error(`Slide ${slide.id}: Error during migration:`, error);
        errorCount++;
      }
    }
    
    console.log('\nMigration complete!');
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export { migrateHeroSlidesToObjectStorage };

// Run migration if this file is executed directly
migrateHeroSlidesToObjectStorage()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
