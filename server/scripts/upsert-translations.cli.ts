import { db } from "../db";
import { translations } from "@shared/schema";
import enTranslations from "../../client/src/locales/en/common.json";
import arTranslations from "../../client/src/locales/ar/common.json";
import { flattenObject, getNestedValue } from "./upsert-translations";

async function runCLI() {
  console.log("Starting translation upsert...");
  console.log("This will add missing keys from JSON without overwriting existing database values.\n");
  
  try {
    const flatEnglish = flattenObject(enTranslations);
    console.log(`Found ${flatEnglish.length} translation keys in JSON files`);
    
    const existingTranslations = await db.select({ key: translations.key }).from(translations);
    const existingKeys = new Set(existingTranslations.map(t => t.key));
    console.log(`Found ${existingKeys.size} existing translations in database\n`);
    
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
      console.log("✅ All translations are already in the database. Nothing to add.");
      process.exit(0);
    }
    
    console.log(`Found ${translationsToInsert.length} missing translations to add:\n`);
    
    const previewCount = Math.min(10, translationsToInsert.length);
    console.log("Preview of missing keys:");
    translationsToInsert.slice(0, previewCount).forEach(({ key }) => {
      console.log(`  - ${key}`);
    });
    if (translationsToInsert.length > previewCount) {
      console.log(`  ... and ${translationsToInsert.length - previewCount} more\n`);
    }
    
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < translationsToInsert.length; i += batchSize) {
      const batch = translationsToInsert.slice(i, i + batchSize);
      
      try {
        await db.insert(translations)
          .values(batch)
          .onConflictDoNothing({ target: translations.key });
        
        insertedCount += batch.length;
        console.log(`Progress: ${insertedCount}/${translationsToInsert.length} inserted`);
      } catch (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      }
    }
    
    console.log("\n✅ Translation upsert complete!");
    console.log(`Summary:`);
    console.log(`  - Total keys in JSON: ${flatEnglish.length}`);
    console.log(`  - Already in database: ${existingKeys.size}`);
    console.log(`  - Newly inserted: ${insertedCount}`);
    console.log(`  - Final database count: ${existingKeys.size + insertedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during translation upsert:", error);
    process.exit(1);
  }
}

// Run the CLI
runCLI();
