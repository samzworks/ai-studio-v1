import { db } from '../db';
import { siteSettings } from '../../shared/schema';
import { sql, eq } from 'drizzle-orm';
import { VIDEO_MODELS } from '../ai-models';

let migrationRun = false;

export async function enableAllVideoModels() {
  if (migrationRun) return;
  
  try {
    console.log('Running migration: Enable all video models...');
    
    let enabledCount = 0;
    
    for (const model of VIDEO_MODELS) {
      const showKey = `show_${model.id.replace(/[-\.]/g, '_')}`;
      
      const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.key, showKey));
      
      if (existing) {
        if (existing.value === false || existing.value === 'false') {
          await db.update(siteSettings)
            .set({ value: true })
            .where(eq(siteSettings.key, showKey));
          console.log(`Migration: Enabled video model ${model.id}`);
          enabledCount++;
        }
      }
    }
    
    if (enabledCount > 0) {
      console.log(`Migration complete: Enabled ${enabledCount} video model(s)`);
    } else {
      console.log('Migration complete: All video models already enabled');
    }
    
    migrationRun = true;
  } catch (error) {
    console.error('Migration error (enable video models):', error);
  }
}
