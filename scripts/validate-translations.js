#!/usr/bin/env node

/**
 * Translation Validation Script
 * 
 * This script ensures parity between English and Arabic translation files.
 * It checks that all keys present in the English file exist in the Arabic file.
 * 
 * Usage:
 *   node scripts/validate-translations.js
 * 
 * Exit codes:
 *   0 - All translations are in sync
 *   1 - Missing translations found or errors occurred
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Flatten a nested object into dot-notation keys
 * Example: {a: {b: 'value'}} becomes {'a.b': 'value'}
 */
function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }
  
  return flattened;
}

/**
 * Load and parse a JSON translation file
 */
function loadTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading ${filePath}:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Main validation function
 */
function validateTranslations() {
  console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Translation Validation Tool${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}\n`);

  const enPath = path.join(path.dirname(__dirname), 'client/src/locales/en/common.json');
  const arPath = path.join(path.dirname(__dirname), 'client/src/locales/ar/common.json');

  // Check if files exist
  if (!fs.existsSync(enPath)) {
    console.error(`${colors.red}Error: English translation file not found at ${enPath}${colors.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(arPath)) {
    console.error(`${colors.red}Error: Arabic translation file not found at ${arPath}${colors.reset}`);
    process.exit(1);
  }

  // Load translation files
  console.log(`${colors.cyan}Loading translation files...${colors.reset}`);
  const enTranslations = loadTranslationFile(enPath);
  const arTranslations = loadTranslationFile(arPath);

  // Flatten objects
  const enFlat = flattenObject(enTranslations);
  const arFlat = flattenObject(arTranslations);

  const enKeys = Object.keys(enFlat).sort();
  const arKeys = Object.keys(arFlat).sort();

  console.log(`${colors.green}✓ English keys: ${enKeys.length}${colors.reset}`);
  console.log(`${colors.green}✓ Arabic keys: ${arKeys.length}${colors.reset}\n`);

  // Find missing keys
  const missingInArabic = enKeys.filter(key => !arKeys.includes(key));
  const extraInArabic = arKeys.filter(key => !enKeys.includes(key));

  // Report results
  let hasErrors = false;

  if (missingInArabic.length > 0) {
    hasErrors = true;
    console.log(`${colors.red}${colors.bold}✗ Found ${missingInArabic.length} missing translation(s) in Arabic:${colors.reset}\n`);
    
    // Group by top-level key for better readability
    const grouped = {};
    missingInArabic.forEach(key => {
      const topLevel = key.split('.')[0];
      if (!grouped[topLevel]) grouped[topLevel] = [];
      grouped[topLevel].push(key);
    });

    for (const [category, keys] of Object.entries(grouped)) {
      console.log(`${colors.yellow}  [${category}]${colors.reset}`);
      keys.forEach(key => {
        console.log(`    ${colors.red}✗${colors.reset} ${key}: "${enFlat[key]}"`);
      });
      console.log();
    }
  }

  if (extraInArabic.length > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠ Found ${extraInArabic.length} extra key(s) in Arabic (not in English):${colors.reset}\n`);
    extraInArabic.forEach(key => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${key}`);
    });
    console.log();
  }

  // Final summary
  console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}`);
  if (!hasErrors && extraInArabic.length === 0) {
    console.log(`${colors.green}${colors.bold}✓ Translation files are in perfect sync!${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}\n`);
    process.exit(0);
  } else if (!hasErrors) {
    console.log(`${colors.green}${colors.bold}✓ No missing translations in Arabic${colors.reset}`);
    console.log(`${colors.yellow}⚠ However, there are extra keys that should be reviewed${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✗ Validation failed!${colors.reset}`);
    console.log(`${colors.red}Please add missing translations to: ${arPath}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}==================================${colors.reset}\n`);
    process.exit(1);
  }
}

// Run validation
validateTranslations();
