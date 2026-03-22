import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

interface TranslationKey {
  file: string;
  line: number;
  key: string;
}

interface ValidationResult {
  missingKeys: {
    [language: string]: {
      key: string;
      usedIn: string[];
    }[];
  };
  totalKeysFound: number;
  filesScanned: number;
}

// Extract translation keys from TypeScript/TSX files
function extractTranslationKeys(filePath: string): TranslationKey[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const keys: TranslationKey[] = [];

  // Pattern to match t('key') or t("key")
  const pattern = /t\(['"`]([^'"`]+)['"`]\)/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      keys.push({
        file: filePath,
        line: index + 1,
        key: match[1]
      });
    }
  });

  return keys;
}

// Flatten nested JSON object to dot notation keys
function flattenKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(flattenKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

async function validateTranslations(): Promise<ValidationResult> {
  console.log('🔍 Validating translation keys...\n');

  // Find all TypeScript/TSX files in client/src
  const files = await glob('client/src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });

  console.log(`📁 Found ${files.length} TypeScript/TSX files to scan\n`);

  // Extract all translation keys used in the codebase
  const usedKeys = new Map<string, string[]>();
  let totalKeysFound = 0;

  files.forEach(file => {
    const keys = extractTranslationKeys(file);
    keys.forEach(({ key, file }) => {
      if (!usedKeys.has(key)) {
        usedKeys.set(key, []);
      }
      usedKeys.get(key)!.push(file);
      totalKeysFound++;
    });
  });

  console.log(`🔑 Found ${usedKeys.size} unique translation keys used in code\n`);

  // Load translation files
  const languages = ['en', 'ar'];
  const translationFiles: { [lang: string]: any } = {};

  for (const lang of languages) {
    const filePath = path.join('client/src/locales', lang, 'common.json');
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      translationFiles[lang] = JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to load translation file for ${lang}:`, error);
      process.exit(1);
    }
  }

  // Validate each language
  const missingKeys: ValidationResult['missingKeys'] = {};

  for (const lang of languages) {
    const availableKeys = new Set(flattenKeys(translationFiles[lang]));
    const missing: { key: string; usedIn: string[] }[] = [];

    usedKeys.forEach((files, key) => {
      if (!availableKeys.has(key)) {
        missing.push({ key, usedIn: files });
      }
    });

    if (missing.length > 0) {
      missingKeys[lang] = missing;
    }
  }

  return {
    missingKeys,
    totalKeysFound,
    filesScanned: files.length
  };
}

// Main execution
async function main() {
  const result = await validateTranslations();

  console.log('═'.repeat(60));
  console.log('📊 VALIDATION RESULTS');
  console.log('═'.repeat(60));
  console.log(`Files scanned: ${result.filesScanned}`);
  console.log(`Total translation calls: ${result.totalKeysFound}`);
  console.log('═'.repeat(60));

  const hasErrors = Object.keys(result.missingKeys).length > 0;

  if (hasErrors) {
    console.log('\n❌ MISSING TRANSLATION KEYS FOUND!\n');

    for (const [lang, keys] of Object.entries(result.missingKeys)) {
      console.log(`\n🌐 Language: ${lang.toUpperCase()}`);
      console.log(`   Missing ${keys.length} key(s):\n`);

      keys.forEach(({ key, usedIn }) => {
        console.log(`   • ${key}`);
        console.log(`     Used in: ${usedIn.slice(0, 3).join(', ')}${usedIn.length > 3 ? ` (+${usedIn.length - 3} more)` : ''}`);
      });
    }

    console.log('\n💡 TIP: Add missing keys to the respective translation files:');
    console.log('   client/src/locales/en/common.json');
    console.log('   client/src/locales/ar/common.json\n');

    process.exit(1);
  } else {
    console.log('\n✅ All translation keys are valid!\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
