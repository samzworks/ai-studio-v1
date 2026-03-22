import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeConfig } from "./site-config";
import { setupSecurityHeaders } from "./security-headers";
import { initStorageService, isOnReplit } from "./storageProvider";
import path from "path";

// Initialize storage service synchronously at module load
// This is called early so other modules can use createStorageService()
initStorageService().catch(err => {
  console.error("Failed to initialize storage service:", err);
});

const app = express();

// Health check endpoint - responds immediately for deployment health checks
// Must be registered BEFORE any other middleware or routes
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/_health', (_req, res) => {
  res.status(200).send('OK');
});

setupSecurityHeaders(app);

// Serve stored images and videos statically with CORS headers
app.use('/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(process.cwd(), 'public', 'images')));

app.use('/videos', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.header('Accept-Ranges', 'bytes');
  next();
}, express.static(path.join(process.cwd(), 'public', 'videos')));

app.use('/thumbnails', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(process.cwd(), 'public', 'thumbnails')));

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Serve style images from root uploads directory (legacy storage before object storage migration)
app.use('/uploads/style-images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'style-images')));

// Serve reference images
app.use('/uploads/ref-images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'ref-images')));

// Serve local storage files when not on Replit (isOnReplit imported from storageProvider)
if (!isOnReplit) {
  console.log('📦 Local mode: Serving files from uploads/storage');
  app.use('/objects', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  }, express.static(path.join(process.cwd(), 'uploads', 'storage')));
}

// Validate object storage configuration
function validateObjectStorage() {
  if (!isOnReplit) {
    console.log('✅ Using local file storage (not on Replit)');
    console.log('   - Storage dir: uploads/storage');
    return;
  }

  const requiredEnvVars = ['PUBLIC_OBJECT_SEARCH_PATHS', 'PRIVATE_OBJECT_DIR'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('⚠️  Object Storage not configured! Missing environment variables:', missing.join(', '));
    console.error('⚠️  Image generation will fail. Please set up object storage in the Replit workspace.');
    console.error('⚠️  Go to Tools > Object Storage to create a bucket and set up the required environment variables.');
  } else {
    console.log('✅ Object storage configured successfully');
    console.log('   - Public paths:', process.env.PUBLIC_OBJECT_SEARCH_PATHS);
    console.log('   - Private dir:', process.env.PRIVATE_OBJECT_DIR);
  }
}
validateObjectStorage();

// Initializations moved to main async block
import { ensureDefaultSettings } from './site-config.js';
import { ensureDefaultPromptTemplates } from './prompt-utils.js';


// Run one-time migration to fix missing video versions
import { fixMissingVideoVersions } from './migrations/fix-video-versions';
fixMissingVideoVersions().catch(console.error);

// Run migration to fix database sequences
import { fixDatabaseSequences } from './migrations/fix-sequences';
fixDatabaseSequences().catch(console.error);

// Run migration to fix image reference URLs
import { fixImageReferenceUrls } from './migrations/fix-image-reference-urls';
fixImageReferenceUrls().catch(console.error);

// Run migration to add jobId column to images table
import { addJobIdToImages } from './migrations/add-job-id-to-images';
addJobIdToImages().catch(console.error);

// Run migration to add thumbnailUrl column to images table
import { addThumbnailUrlToImages } from './migrations/add-thumbnail-url-to-images';
addThumbnailUrlToImages().catch(console.error);

// Run migration to add Arabic hero slide columns when missing
import { addHeroSlideArabicColumns } from './migrations/add-hero-slide-arabic-columns';
addHeroSlideArabicColumns().catch(console.error);

// Run migration to cleanup stuck video jobs and remove duplicate videos
import { cleanupStuckVideoJobs } from './migrations/cleanup-stuck-video-jobs';
cleanupStuckVideoJobs().catch(console.error);

// Run migration to enable all video models (fixes production visibility issues)
import { enableAllVideoModels } from './migrations/enable-all-video-models';
enableAllVideoModels().catch(console.error);

// Sync missing translations from JSON files to database (safe to run multiple times)
import { upsertTranslationsFromJson } from './scripts/upsert-translations';
upsertTranslationsFromJson().catch(console.error);

// Auto-sync pricing operations for any new AI models added
import { syncPricingOnStartup } from './services/pricing-sync-service';
syncPricingOnStartup().catch(console.error);

// Start scheduled jobs for renewal reminders
import { startScheduledJobs } from './services/scheduled-jobs';
startScheduledJobs();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize configuration sequentially to avoid race conditions
    console.log("Initializing site configuration...");
    await initializeConfig();
    console.log("Ensuring default settings...");
    await ensureDefaultSettings("system");
    console.log("Ensuring default prompt templates...");
    await ensureDefaultPromptTemplates();
  } catch (err) {
    console.error("Failed to initialize system settings:", err);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled request error:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment for autoscale deployment, fallback to 5000 for dev
  const PORT = Number(process.env.PORT || 5000);
  server.listen({
    port: PORT,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${PORT}`);
  });
})();
