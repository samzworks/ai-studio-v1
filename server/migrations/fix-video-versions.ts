import { db } from '../db';
import { storyboardScenes, sceneVersions } from '../../shared/schema';
import { sql } from 'drizzle-orm';

let migrationRun = false;

export async function fixMissingVideoVersions() {
  // Only run once per server lifecycle
  if (migrationRun) return;
  
  try {
    console.log('Running migration: Fix missing video versions...');
    
    // Get all scenes that have no video versions
    const scenesWithoutVideos = await db.execute(sql`
      SELECT DISTINCT s.id, s.scene_number, 
        (SELECT title FROM scene_versions WHERE scene_id = s.id AND version_type = 'text' AND is_active = true LIMIT 1) as title,
        (SELECT description FROM scene_versions WHERE scene_id = s.id AND version_type = 'text' AND is_active = true LIMIT 1) as description
      FROM storyboard_scenes s
      LEFT JOIN scene_versions sv ON s.id = sv.scene_id AND sv.version_type = 'video'
      WHERE sv.id IS NULL
    `);
    
    let fixedCount = 0;
    
    for (const scene of scenesWithoutVideos.rows as any[]) {
      if (scene.title) {
        // Create a video version from the scene description
        const videoPrompt = scene.description || 
          `${scene.title}: Camera movement and visual transition for this scene.`;
        
        await db.insert(sceneVersions).values({
          sceneId: scene.id,
          versionType: 'video',
          versionNumber: 1,
          videoPrompt,
          isActive: true
        });
        
        fixedCount++;
        console.log(`Migration: Created missing video version for scene ${scene.id} (${scene.title})`);
      }
    }
    
    if (fixedCount > 0) {
      console.log(`Migration complete: Fixed ${fixedCount} missing video version(s)`);
    } else {
      console.log('Migration complete: No missing video versions found');
    }
    
    migrationRun = true;
  } catch (error) {
    console.error('Migration failed:', error);
    // Don't throw - we don't want to crash the server if migration fails
  }
}
