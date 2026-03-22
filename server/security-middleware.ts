import type { Request, Response, NextFunction } from "express";
import { getConfig } from "./site-config";
import { storage as dbStorage } from "./storage";

interface GlobalLoadState {
  activeGenerations: number;
  lastUpdated: number;
}

const globalLoadState: GlobalLoadState = {
  activeGenerations: 0,
  lastUpdated: Date.now()
};

export function incrementGlobalLoad(): void {
  globalLoadState.activeGenerations++;
  globalLoadState.lastUpdated = Date.now();
}

export function decrementGlobalLoad(): void {
  globalLoadState.activeGenerations = Math.max(0, globalLoadState.activeGenerations - 1);
  globalLoadState.lastUpdated = Date.now();
}

export function getGlobalLoadStatus(): { active: number; maxAllowed: number; isOverloaded: boolean } {
  const maxGlobalActiveJobs = parseInt(getConfig('max_global_active_jobs', 100)) || 100;
  return {
    active: globalLoadState.activeGenerations,
    maxAllowed: maxGlobalActiveJobs,
    isOverloaded: globalLoadState.activeGenerations >= maxGlobalActiveJobs
  };
}

export function globalLoadGuard(req: Request, res: Response, next: NextFunction) {
  const loadStatus = getGlobalLoadStatus();
  
  if (loadStatus.isOverloaded) {
    console.warn('[GlobalLoadGuard] System is overloaded, rejecting request', {
      active: loadStatus.active,
      max: loadStatus.maxAllowed,
      path: req.path,
      userId: (req as any).user?.claims?.sub
    });
    
    return res.status(503).json({
      error: "The system is currently experiencing high demand. Please try again in a few moments.",
      errorCode: "GLOBAL_LIMIT",
      retryAfter: 30
    });
  }
  
  next();
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  requests: number[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: any) => string;
  namespace?: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests. Please try again later.",
    namespace = 'default',
    keyGenerator = (req: any) => {
      return req.user?.claims?.sub || req.ip || 'anonymous';
    }
  } = config;

  const rateLimitStore = new Map<string, RateLimitEntry>();

  const cleanupStore = () => {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    rateLimitStore.forEach((entry, key) => {
      if (now > entry.resetTime && entry.requests.length === 0) {
        entriesToDelete.push(key);
      }
    });

    entriesToDelete.forEach(key => rateLimitStore.delete(key));
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const userKey = keyGenerator(req);
    const key = `${namespace}:${userKey}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        requests: []
      };
      rateLimitStore.set(key, entry);
    }

    entry.requests = entry.requests.filter(time => now - time < windowMs);
    
    if (entry.requests.length >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(entry.resetTime));
      
      return res.status(429).json({ 
        error: message,
        retryAfter: retryAfter
      });
    }

    entry.requests.push(now);
    entry.count++;
    
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(maxRequests - entry.requests.length));
    res.set('X-RateLimit-Reset', String(entry.resetTime));

    if (Math.random() < 0.01) {
      cleanupStore();
    }

    next();
  };
}

const MAX_PROMPT_LENGTH = 10000;
const MAX_TAGS_COUNT = 20;
const MAX_TAG_LENGTH = 50;

export function validatePromptInput(req: Request, res: Response, next: NextFunction) {
  const { prompt, tags } = req.body;

  if (prompt && typeof prompt === 'string') {
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ 
        error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
        maxLength: MAX_PROMPT_LENGTH,
        currentLength: prompt.length
      });
    }

    const sanitized = prompt.trim();
    if (!sanitized) {
      return res.status(400).json({ error: "Prompt cannot be empty" });
    }

    req.body.prompt = sanitized;
  }

  if (tags && Array.isArray(tags)) {
    if (tags.length > MAX_TAGS_COUNT) {
      return res.status(400).json({ 
        error: `Too many tags. Maximum ${MAX_TAGS_COUNT} allowed.`,
        maxTags: MAX_TAGS_COUNT
      });
    }

    const validatedTags = tags.filter(tag => 
      typeof tag === 'string' && 
      tag.trim().length > 0 && 
      tag.trim().length <= MAX_TAG_LENGTH
    ).map(tag => tag.trim());

    req.body.tags = validatedTags;
  }

  next();
}

export function sanitizeConfig(config: any): any {
  const sanitized = { ...config };
  
  const keysToRemove = [
    'OPENAI_API_KEY',
    'REPLICATE_API_TOKEN', 
    'FAL_KEY',
    'DATABASE_URL',
    'SESSION_SECRET',
    'admin_password',
    'api_key',
    'secret',
    'token',
    'password'
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (keysToRemove.some(k => lowerKey.includes(k.toLowerCase()))) {
      delete sanitized[key];
    }
  }

  return sanitized;
}

export function logSuspiciousActivity(req: any, activity: string, details?: any) {
  const userId = req.user?.claims?.sub || 'anonymous';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  
  console.warn(`[SECURITY] ${activity}`, {
    userId,
    ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    ...details
  });
}

// Dynamic rate limiter that reads config on each request
// Uses a sliding window to track requests per user
const imageRateLimitStore = new Map<string, { requests: number[], resetTime: number }>();

export function imageGenerationRateLimit(req: Request, res: Response, next: NextFunction) {
  const maxRequests = parseInt(getConfig('jobs_per_minute_limit', 60)) || 60;
  const windowMs = 60 * 1000;
  const userId = (req as any).user?.claims?.sub || (req as any).ip || 'anonymous';
  const key = `image-generation:${userId}`;
  const now = Date.now();

  let entry = imageRateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    entry = {
      requests: [],
      resetTime: now + windowMs
    };
    imageRateLimitStore.set(key, entry);
  }

  // Filter to only requests within the window
  entry.requests = entry.requests.filter(time => now - time < windowMs);
  
  console.log(`[HTTP RateLimit] User ${userId}: ${entry.requests.length}/${maxRequests} requests in window`);
  
  if (entry.requests.length >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(entry.resetTime));
    
    console.log(`[HTTP RateLimit] BLOCKED - User ${userId} exceeded rate limit (${entry.requests.length} >= ${maxRequests})`);
    
    return res.status(429).json({ 
      error: `Too many image generation requests. Maximum ${maxRequests} per minute. Please wait a moment.`,
      retryAfter: retryAfter
    });
  }

  entry.requests.push(now);
  
  res.set('X-RateLimit-Limit', String(maxRequests));
  res.set('X-RateLimit-Remaining', String(maxRequests - entry.requests.length));
  res.set('X-RateLimit-Reset', String(entry.resetTime));

  next();
}

export const videoGenerationRateLimit = createRateLimiter({
  namespace: 'video-generation',
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many video generation requests. Please wait a moment."
});

export const promptEnhanceRateLimit = createRateLimiter({
  namespace: 'prompt-enhance',
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "Too many prompt enhancement requests. Please wait a moment."
});

export const uploadRateLimit = createRateLimiter({
  namespace: 'file-upload',
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many upload requests. Please wait a moment."
});

// =============================================================================
// FEATURE ACCESS MIDDLEWARE - Plan-based feature gating
// =============================================================================

import { creditService } from "./services/credit-service";
import type { FeatureFlags } from "@shared/schema";

type FeatureKey = keyof FeatureFlags;

interface FeatureAccessConfig {
  feature: FeatureKey;
  featureName: string;
  creditCheckAmount?: number;
}

export function requireFeature(config: FeatureAccessConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          error: "Authentication required",
          errorCode: "AUTH_REQUIRED"
        });
      }

      const entitlements = await creditService.getUserEntitlements(userId);
      
      if (!entitlements.featureFlags[config.feature]) {
        console.log(`[FeatureAccess] User ${userId} denied access to ${config.feature}`);
        
        // Log to admin logs for visibility
        try {
          const user = await dbStorage.getUser(userId);
          await dbStorage.createAdminLog({
            adminId: "system",
            action: "feature_access_denied",
            targetType: "user",
            targetId: userId,
            details: {
              feature: config.feature,
              featureName: config.featureName,
              userId: userId,
              userEmail: user?.email || "unknown",
              currentPlan: entitlements.planName || "unknown",
              requestPath: req.path,
              timestamp: new Date().toISOString()
            }
          });
        } catch (logError) {
          console.error("[FeatureAccess] Failed to create admin log:", logError);
        }
        
        // User-friendly error message
        const featureDisplayName = config.featureName.toLowerCase();
        return res.status(403).json({ 
          error: `${config.featureName} is not available on your current plan. Please upgrade to access ${featureDisplayName}.`,
          errorCode: "FEATURE_NOT_AVAILABLE",
          feature: config.feature,
          userMessage: `To use ${featureDisplayName}, you'll need to upgrade your subscription. Visit the pricing page to see available plans.`,
          requiredPlan: "Upgrade required"
        });
      }

      if (config.creditCheckAmount !== undefined) {
        if (entitlements.availableCredits < config.creditCheckAmount) {
          return res.status(402).json({
            error: `You don't have enough credits. You need ${config.creditCheckAmount} credits but only have ${entitlements.availableCredits}.`,
            errorCode: "INSUFFICIENT_CREDITS",
            required: config.creditCheckAmount,
            available: entitlements.availableCredits
          });
        }
      }

      (req as any).userEntitlements = entitlements;
      
      next();
    } catch (error) {
      console.error("[FeatureAccess] Error checking feature access:", error);
      next(error);
    }
  };
}

export function requireCredits(minCredits: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          error: "Authentication required",
          errorCode: "AUTH_REQUIRED"
        });
      }

      const entitlements = await creditService.getUserEntitlements(userId);
      
      if (entitlements.availableCredits < minCredits) {
        console.log(`[CreditCheck] User ${userId} has insufficient credits: ${entitlements.availableCredits} < ${minCredits}`);
        return res.status(402).json({
          error: `Insufficient credits. Required: ${minCredits}, Available: ${entitlements.availableCredits}`,
          errorCode: "INSUFFICIENT_CREDITS",
          required: minCredits,
          available: entitlements.availableCredits
        });
      }

      (req as any).userEntitlements = entitlements;
      
      next();
    } catch (error) {
      console.error("[CreditCheck] Error checking credits:", error);
      next(error);
    }
  };
}

export const requireImageGeneration = requireFeature({
  feature: "image_generation",
  featureName: "Image Generation"
});

export const requireVideoGeneration = requireFeature({
  feature: "video_generation",
  featureName: "Video Generation"
});

export const requireFilmStudio = requireFeature({
  feature: "film_studio",
  featureName: "Film Studio"
});

export const requirePrivateContent = requireFeature({
  feature: "can_make_private",
  featureName: "Private Content"
});
