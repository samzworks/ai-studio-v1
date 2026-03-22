import { db } from "../db";
import { translations } from "@shared/schema";
import { eq } from "drizzle-orm";
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

async function initializeTranslations() {
  console.log("Starting translation initialization...");
  
  try {
    // Flatten English translations
    const flatEnglish = flattenObject(enTranslations);
    
    console.log(`Found ${flatEnglish.length} translation keys`);
    
    // Insert each translation
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (const { key, value: english } of flatEnglish) {
      const arabic = getNestedValue(arTranslations, key) || english; // Fallback to English if Arabic not found
      
      try {
        // Check if translation already exists
        const [existing] = await db.select()
          .from(translations)
          .where(eq(translations.key, key))
          .limit(1);
        
        if (existing) {
          // Update existing translation
          await db.update(translations)
            .set({ 
              english,
              arabic,
              updatedAt: new Date()
            })
            .where(eq(translations.key, key));
          updatedCount++;
        } else {
          // Insert new translation
          await db.insert(translations)
            .values({
              key,
              namespace: "common",
              english,
              arabic,
              lastModifiedBy: null
            });
          insertedCount++;
        }
      } catch (error) {
        console.error(`Error processing translation key ${key}:`, error);
      }
    }
    
    console.log(`Translation initialization complete!`);
    console.log(`- Inserted: ${insertedCount} new translations`);
    console.log(`- Updated: ${updatedCount} existing translations`);
    console.log(`- Total: ${insertedCount + updatedCount} translations processed`);
    
  } catch (error) {
    console.error("Error initializing translations:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the initialization
initializeTranslations();