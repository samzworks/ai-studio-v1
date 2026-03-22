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
    
    // Check if any translations exist
    const existingCount = await db.select().from(translations).limit(1);
    
    if (existingCount.length === 0) {
      // No translations exist, insert all at once
      console.log("No existing translations found. Inserting all translations...");
      
      const translationsToInsert = flatEnglish.map(({ key, value: english }) => ({
        key,
        namespace: "common",
        english,
        arabic: getNestedValue(arTranslations, key) || english,
        lastModifiedBy: null
      }));
      
      // Insert in batches of 50 to avoid query size limits
      const batchSize = 50;
      let insertedCount = 0;
      
      for (let i = 0; i < translationsToInsert.length; i += batchSize) {
        const batch = translationsToInsert.slice(i, i + batchSize);
        await db.insert(translations).values(batch);
        insertedCount += batch.length;
        console.log(`Inserted ${insertedCount}/${translationsToInsert.length} translations...`);
      }
      
      console.log(`Translation initialization complete!`);
      console.log(`- Inserted: ${insertedCount} translations`);
    } else {
      console.log("Translations already exist in the database. Skipping initialization.");
      console.log("To re-initialize, please clear the translations table first.");
    }
    
  } catch (error) {
    console.error("Error initializing translations:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the initialization
initializeTranslations();