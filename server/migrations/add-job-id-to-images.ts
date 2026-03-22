import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addJobIdToImages() {
  console.log('Running migration: Add jobId column to images table...');
  
  try {
    // Add jobId column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE images
      ADD COLUMN IF NOT EXISTS job_id VARCHAR
    `);
    
    console.log('Migration complete: Added jobId column to images table');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}
