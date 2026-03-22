import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addHeroSlideArabicColumns() {
  console.log('Running migration: Ensure hero slide Arabic columns...');

  try {
    await db.execute(sql`
      ALTER TABLE hero_slides
      ADD COLUMN IF NOT EXISTS title_ar VARCHAR
    `);

    await db.execute(sql`
      ALTER TABLE hero_slides
      ADD COLUMN IF NOT EXISTS subtitle_ar TEXT
    `);

    console.log('Migration complete: Hero slide Arabic columns are ready');
  } catch (error) {
    console.error('Migration error:', error);
  }
}
