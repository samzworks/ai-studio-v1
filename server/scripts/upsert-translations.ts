import { db } from "../db";
import { translations } from "@shared/schema";
import { sql } from "drizzle-orm";
import enTranslations from "../../client/src/locales/en/common.json";
import arTranslations from "../../client/src/locales/ar/common.json";

function flattenObject(obj: any, prefix = ''): { key: string; value: string }[] {
  let result: { key: string; value: string }[] = [];
  
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      result = result.concat(flattenObject(obj[key], prefix + key + '.'));
    } else {
      result.push({
        key: prefix + key,
        value: obj[key]
      });
    }
  }
  
  return result;
}

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => current?.[key], obj) || '';
}

// Export helper functions for both CLI and server use
export { flattenObject, getNestedValue };

// Main function: Safe for server startup (no process.exit)
export async function upsertTranslationsFromJson() {
  console.log("🔄 Syncing translations from JSON to database...");
  
  try {
    // Flatten English translations
    const flatEnglish = flattenObject(enTranslations);
    
    // Get all existing translation keys from database
    const existingTranslations = await db.select({ key: translations.key }).from(translations);
    const existingKeys = new Set(existingTranslations.map(t => t.key));
    
    // Prepare translations to insert (only missing keys)
    const translationsToInsert = flatEnglish
      .filter(({ key }) => !existingKeys.has(key))
      .map(({ key, value: english }) => ({
        key,
        namespace: "common",
        english,
        arabic: getNestedValue(arTranslations, key) || english,
        lastModifiedBy: null
      }));
    
    if (translationsToInsert.length === 0) {
      console.log("✅ All translations synced (no missing keys)");
      return { inserted: 0, total: existingKeys.size };
    }
    
    // Insert in batches using Drizzle's onConflictDoNothing
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < translationsToInsert.length; i += batchSize) {
      const batch = translationsToInsert.slice(i, i + batchSize);
      
      try {
        await db.insert(translations)
          .values(batch)
          .onConflictDoNothing({ target: translations.key });
        
        insertedCount += batch.length;
      } catch (error) {
        console.error(`Error inserting translation batch:`, error);
      }
    }
    
    const finalTotal = existingKeys.size + insertedCount;
    console.log(`✅ Synced ${insertedCount} new translations from JSON (${finalTotal} total)`);
    
    return { inserted: insertedCount, total: finalTotal };
    
  } catch (error) {
    console.error("❌ Error syncing translations:", error);
    return { inserted: 0, total: 0, error };
  }
}
