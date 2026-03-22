import { db } from '../db';
import { imageReferenceImages } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function fixImageReferenceUrls() {
  console.log('Running migration: Fix image reference URLs to be relative...');
  
  try {
    // Update all absolute URLs to relative URLs
    // Pattern: http(s)://any-host/uploads/ref-images/filename -> /uploads/ref-images/filename
    const result = await db.execute(sql`
      UPDATE image_reference_images
      SET url = REGEXP_REPLACE(url, '^https?://[^/]+(/uploads/ref-images/.+)$', '\\1')
      WHERE url ~ '^https?://'
    `);
    
    console.log('Migration complete: Fixed image reference URLs');
    return result;
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}
