import { db } from '../db';
import { images } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function addThumbnailUrlToImages() {
  console.log('Running migration: Add thumbnailUrl column to images table...');
  
  try {
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'images' AND column_name = 'thumbnail_url'
    `);
    
    if (result.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE images ADD COLUMN thumbnail_url TEXT
      `);
      console.log('Migration complete: Added thumbnail_url column to images table');
    } else {
      console.log('Migration: thumbnail_url column already exists');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}
