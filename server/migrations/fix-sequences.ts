import { db } from '../db';
import { sql } from 'drizzle-orm';

let migrationRun = false;

export async function fixDatabaseSequences() {
  // Only run once per server lifecycle
  if (migrationRun) return;
  
  try {
    console.log('Running migration: Fix database sequences...');
    
    // List of all tables with auto-incrementing IDs
    const tables = [
      'admin_logs',
      'ai_styles',
      'credit_transactions',
      'film_projects',
      'hero_slides',
      'image_reference_categories',
      'image_reference_images',
      'image_reports',
      'images',
      'pricing_operations',
      'pricing_rules',
      'pricing_settings',
      'prompt_templates',
      'random_prompts',
      'scene_versions',
      'site_settings',
      'storyboard_scenes',
      'subscription_plans',
      'translations',
      'user_subscriptions',
      'video_model_configs',
      'video_styles',
      'videos'
    ];
    
    let fixedCount = 0;
    
    for (const tableName of tables) {
      try {
        // Fix the sequence for this table
        const result = await db.execute(sql`
          SELECT setval(
            pg_get_serial_sequence(${tableName}, 'id'),
            COALESCE((SELECT MAX(id) FROM ${sql.raw(tableName)}), 1),
            true
          ) as new_value
        `);
        
        if (result.rows && result.rows.length > 0) {
          const newValue = (result.rows[0] as any).new_value;
          if (newValue > 1) {
            console.log(`Migration: Fixed sequence for ${tableName} (set to ${newValue})`);
            fixedCount++;
          }
        }
      } catch (tableError: any) {
        // Skip tables that don't exist or don't have sequences
        if (!tableError.message?.includes('does not exist')) {
          console.warn(`Migration: Could not fix sequence for ${tableName}:`, tableError.message);
        }
      }
    }
    
    if (fixedCount > 0) {
      console.log(`Migration complete: Fixed ${fixedCount} sequence(s)`);
    } else {
      console.log('Migration complete: All sequences are in sync');
    }
    
    migrationRun = true;
  } catch (error) {
    console.error('Migration failed:', error);
    // Don't throw - we don't want to crash the server if migration fails
  }
}
