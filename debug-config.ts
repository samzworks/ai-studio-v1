
import { storage } from "./server/storage";
import { getAllConfig, initializeConfig, ensureDefaultSettings, DEFAULT_CONFIG } from "./server/site-config";
import { initStorageService } from "./server/storageProvider";

async function main() {
    console.log("Initializing storage...");
    await initStorageService();

    const fs = await import('fs');
    const path = await import('path');

    const result = {
        initialConfig: getAllConfig(),
        afterInitialize: {},
        afterEnsureDefaults: {},
        dbSettingsCount: 0,
        missingKeys: [],
        primaryColorDB: null as any
    };

    await initializeConfig();
    result.afterInitialize = getAllConfig();

    await ensureDefaultSettings("debug-script");
    result.afterEnsureDefaults = getAllConfig();

    const settings = await storage.getSiteSettings();
    result.dbSettingsCount = settings.length;

    result.missingKeys = Object.keys(DEFAULT_CONFIG).filter(key => !settings.find(s => s.key === key));
    result.primaryColorDB = settings.find(s => s.key === 'primary_color');

    fs.writeFileSync(path.resolve(process.cwd(), 'debug-config-result.json'), JSON.stringify(result, null, 2));
    console.log("Debug results written to debug-config-result.json");
}

main().catch(console.error).finally(() => process.exit());
