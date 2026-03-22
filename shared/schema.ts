import { pgTable, text, serial, integer, boolean, timestamp, real, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Google OAuth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Google OAuth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  publicByDefault: boolean("public_by_default").notNull().default(false),
  role: varchar("role", { enum: ["user", "admin"] }).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  freeGenerationConsentAt: timestamp("free_generation_consent_at"), // Timestamp when user consented to free plan public generations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"), // Optimized thumbnail for gallery display
  width: integer("width").notNull().default(1024),
  height: integer("height").notNull().default(1024),
  style: text("style").notNull().default("photorealistic"),
  model: text("model").notNull().default("dall-e-3"),
  quality: text("quality").notNull().default("standard"),
  isPublic: boolean("is_public").notNull().default(false),
  tags: text("tags").array().default([]),
  negativePrompt: text("negative_prompt"),
  seed: integer("seed"),
  steps: integer("steps"),
  cfgScale: real("cfg_scale"),
  aspectRatio: text("aspect_ratio"),
  provider: text("provider").notNull().default("openai"), // openai, replicate
  styleImageUrl: text("style_image_url"), // URL of the style reference image
  imageStrength: real("image_strength"), // Strength value for style influence (0-1)
  jobId: varchar("job_id"), // Frontend job ID for progress card matching
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_images_owner_id").on(table.ownerId),
  index("idx_images_is_public").on(table.isPublic),
  index("idx_images_created_at").on(table.createdAt),
]);

// Video jobs table for job-based video generation
export const videoJobs = pgTable("video_jobs", {
  id: varchar("id").primaryKey().notNull(), // UUID job ID for immediate tracking
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  // Generation parameters
  duration: integer("duration").notNull().default(5), // Duration in seconds
  width: integer("width").notNull().default(540),
  height: integer("height").notNull().default(960),
  aspectRatio: text("aspect_ratio").notNull().default("9:16"),
  model: text("model").notNull().default("luma-ray-flash-2-540p"),
  provider: text("provider").notNull().default("replicate"),
  style: text("style").notNull().default("cinematic"),
  startFrameUrl: text("start_frame_url"), // Optional start frame image
  endFrameUrl: text("end_frame_url"), // Optional end frame image
  videoReferenceUrl: text("video_reference_url"), // Optional video reference for motion control models (Kling 2.6)
  characterOrientation: text("character_orientation").default("video"), // For motion control: "video" or "image"
  frameRate: integer("frame_rate").default(24),
  loop: boolean("loop").default(false),
  audioEnabled: boolean("audio_enabled").notNull().default(false), // Whether audio is enabled for this video
  // Job state management (unified states)
  state: varchar("state").notNull().default("queued"), // queued, starting, processing, completed, failed, canceled
  progress: integer("progress").notNull().default(0), // Progress percentage 0-100
  stage: text("stage").notNull().default("Queued"), // Human-readable stage
  // Provider tracking
  providerId: text("provider_id"), // External provider job ID (e.g., Replicate prediction ID)
  // Results (populated on completion)
  assetUrl: text("asset_url"), // Final video URL
  thumbnailUrl: text("thumbnail_url"), // Generated thumbnail
  error: text("error"), // Error message on failure
  // Metadata
  isPublic: boolean("is_public").notNull().default(false),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_jobs_owner_id").on(table.ownerId),
  index("idx_video_jobs_state").on(table.state),
  index("idx_video_jobs_created_at").on(table.createdAt),
]);

// Videos table for video generation (completed videos only)
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"), // Generated thumbnail
  duration: integer("duration").notNull().default(5), // Duration in seconds
  width: integer("width").notNull().default(540),
  height: integer("height").notNull().default(960),
  aspectRatio: text("aspect_ratio").notNull().default("9:16"),
  model: text("model").notNull().default("luma-ray-flash-2-540p"),
  provider: text("provider").notNull().default("replicate"),
  style: text("style").notNull().default("cinematic"), // Video style reference
  isPublic: boolean("is_public").notNull().default(false),
  tags: text("tags").array().default([]),
  // Video-specific parameters
  startFrameUrl: text("start_frame_url"), // Optional start frame image
  endFrameUrl: text("end_frame_url"), // Optional end frame image
  frameRate: integer("frame_rate").default(24),
  loop: boolean("loop").default(false),
  audioEnabled: boolean("audio_enabled").notNull().default(false), // Whether audio is enabled for this video
  // Job reference
  jobId: varchar("job_id").references(() => videoJobs.id), // Reference to the job that created this video
  // Legacy fields for compatibility
  replicateId: text("replicate_id"), // Replicate prediction ID for tracking
  status: varchar("status").notNull().default("completed"), // Always completed for videos table
  // Progress tracking fields (legacy, not used for completed videos)
  progress: integer("progress").default(100), // Always 100 for completed videos
  stage: text("stage"), // Current processing stage text
  etaSeconds: integer("eta_seconds"), // Estimated time remaining in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_videos_owner_id").on(table.ownerId),
  index("idx_videos_is_public").on(table.isPublic),
  index("idx_videos_created_at").on(table.createdAt),
]);

// Favorites table for user-specific favorites
export const favorites = pgTable("favorites", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageId: integer("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: { columns: [table.userId, table.imageId], name: "favorites_pk" }
}));

// Video favorites table for user-specific video favorites
export const videoFavorites = pgTable("video_favorites", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: { columns: [table.userId, table.videoId], name: "video_favorites_pk" }
}));

// Admin logs table for auditing admin actions
export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // e.g., "delete_image", "promote_user", "toggle_visibility"
  targetType: text("target_type").notNull(), // e.g., "user", "image", "system"
  targetId: text("target_id"), // ID of the affected resource
  details: jsonb("details"), // Additional context about the action
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_admin_logs_admin_id").on(table.adminId),
  index("idx_admin_logs_created_at").on(table.createdAt),
]);

// Site configuration table for admin-controlled settings
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key").notNull().unique(),
  value: jsonb("value").notNull(),
  category: varchar("category").notNull(), // branding, models, ui_copy, registration, theme, seo, etc.
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Image reports table for content moderation
export const imageReports = pgTable("image_reports", {
  id: serial("id").primaryKey(),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageId: integer("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  reason: varchar("reason").notNull(), // inappropriate, spam, copyright, other
  description: text("description"), // additional details for "other" reports
  status: varchar("status").notNull().default("pending"), // pending, dismissed, resolved
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI styles table for admin-controlled generation styles
export const aiStyles = pgTable("ai_styles", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // Display name like "Oil Painting"
  promptText: text("prompt_text").notNull(), // AI instruction like "in the style of classical oil painting"
  isVisible: boolean("is_visible").notNull().default(true),
  category: varchar("category").notNull().default("general"), // general, artistic, photorealistic, etc.
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Video styles table for admin-controlled video generation styles
export const videoStyles = pgTable("video_styles", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // Display name like "Cinematic"
  promptText: text("prompt_text").notNull(), // AI instruction like "cinematic style with dramatic lighting"
  isVisible: boolean("is_visible").notNull().default(true),
  category: varchar("category").notNull().default("general"), // general, cinematic, artistic, motion, etc.
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Video model configurations for progress tracking and admin settings
export const videoModelConfigs = pgTable("video_model_configs", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id").notNull().unique(), // References VideoModelConfig.id
  estimatedTimeSeconds: integer("estimated_time_seconds").notNull().default(60),
  customStageLabels: jsonb("custom_stage_labels").default(null), // Custom stage labels array
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Hero slides table for homepage dynamic slider
export const heroSlides = pgTable("hero_slides", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(), // Large headline
  titleAr: varchar("title_ar"), // Arabic large headline
  subtitle: text("subtitle").notNull(), // Small subheadline
  subtitleAr: text("subtitle_ar"), // Arabic subheadline
  imageUrl: text("image_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Schema for API requests (excludes server-set fields like ownerId)
export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true,
}).extend({
  ownerId: z.string().optional(),
  url: z.string().optional(),
  isPublic: z.boolean().optional(),
  enhancePrompt: z.boolean().optional(),
  imageCount: z.number().min(1).max(4).optional(),
  styleImageUrl: z.string().optional(),
  styleImageUrls: z.array(z.string()).optional(),
  imageStrength: z.number().min(0).max(1).optional(),
  jobId: z.string().optional(), // CRITICAL: Must explicitly include jobId for validation to pass it through
  imageSize: z.string().optional(), // GPT Image 1.5 specific size (1024x1024, 1536x1024, 1024x1536)
});

export const insertVideoJobSchema = createInsertSchema(videoJobs).omit({
  createdAt: true,
  updatedAt: true,
  providerId: true,
  assetUrl: true,
  thumbnailUrl: true,
  error: true,
}).extend({
  id: z.string().optional(), // Will be auto-generated UUID if not provided
  ownerId: z.string().optional(),
  isPublic: z.boolean().optional(),
  enhancePrompt: z.boolean().optional(),
  style: z.string().optional(),
  resolution: z.enum(["480p", "540p", "720p", "1080p"]).optional(), // For WAN and Luma models - maps to width/height
  videoReferenceUrl: z.string().optional(), // For motion control models (Kling 2.6)
  characterOrientation: z.enum(["video", "image"]).optional(), // For motion control: follow video or image orientation
  // WAN 2.6 specific parameters
  audioFileUrl: z.string().optional(), // URL to uploaded audio file for WAN 2.6
  promptExpansion: z.boolean().optional(), // Enable LLM prompt expansion for WAN 2.6
  multiShot: z.boolean().optional(), // Enable multi-shot generation for WAN 2.6
  negativePrompt: z.string().optional(), // Negative prompt for WAN 2.6 and Kling models
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
  replicateId: true,
  status: true,
  thumbnailUrl: true,
}).extend({
  ownerId: z.string().optional(),
  url: z.string().optional(),
  isPublic: z.boolean().optional(),
  enhancePrompt: z.boolean().optional(),
  style: z.string().optional(),
  resolution: z.enum(["480p", "540p", "720p", "1080p"]).optional(), // For WAN and Luma models - maps to width/height
  jobId: z.string().optional(), // Job ID for tracking progress card matching
});

export const insertFavoriteSchema = createInsertSchema(favorites);
export const insertVideoFavoriteSchema = createInsertSchema(videoFavorites);
export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertImageReportSchema = createInsertSchema(imageReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertAiStyleSchema = createInsertSchema(aiStyles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoStyleSchema = createInsertSchema(videoStyles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoModelConfigSchema = createInsertSchema(videoModelConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHeroSlideSchema = createInsertSchema(heroSlides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;
export type InsertVideoJob = z.infer<typeof insertVideoJobSchema>;
export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertVideoFavorite = z.infer<typeof insertVideoFavoriteSchema>;
export type VideoFavorite = typeof videoFavorites.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertImageReport = z.infer<typeof insertImageReportSchema>;
export type ImageReport = typeof imageReports.$inferSelect;
export type InsertAiStyle = z.infer<typeof insertAiStyleSchema>;
export type AiStyle = typeof aiStyles.$inferSelect;
export type InsertVideoStyle = z.infer<typeof insertVideoStyleSchema>;
export type VideoStyle = typeof videoStyles.$inferSelect;
export type InsertVideoModelConfig = z.infer<typeof insertVideoModelConfigSchema>;
export type VideoModelConfig = typeof videoModelConfigs.$inferSelect;
export type InsertHeroSlide = z.infer<typeof insertHeroSlideSchema>;
export type HeroSlide = typeof heroSlides.$inferSelect;

// Subscription plans table (admin-managed)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // Free, Start, Pro, Legend
  displayName: varchar("display_name").notNull(), // Display name for UI
  displayNameAr: varchar("display_name_ar"), // Arabic display name
  description: text("description"), // Plan description
  descriptionAr: text("description_ar"), // Arabic description
  isActive: boolean("is_active").notNull().default(true),
  isFree: boolean("is_free").notNull().default(false), // Free plan flag
  billingPeriodMonths: integer("billing_period_months").notNull().default(1), // 1=monthly, 3=quarterly, 6=semiannual, 12=annual
  priceCents: integer("price_cents").notNull().default(0), // Price in cents for the billing period
  currency: varchar("currency").notNull().default("usd"), // Currency code
  includedCredits: integer("included_credits").notNull().default(0), // Credits per billing period
  creditExpiryPolicy: varchar("credit_expiry_policy").notNull().default("expires_end_of_period_no_rollover"), // Expiration policy
  featureFlags: jsonb("feature_flags").notNull().default({
    image_generation: true,
    video_generation: false,
    film_studio: false,
    can_make_private: false
  }), // Feature access flags
  stripePriceId: varchar("stripe_price_id"), // Stripe Price ID for checkout (monthly)
  stripeProductId: varchar("stripe_product_id"), // Stripe Product ID
  annualPriceCents: integer("annual_price_cents"), // Annual price in cents (optional)
  annualStripePriceId: varchar("annual_stripe_price_id"), // Stripe Price ID for annual checkout
  discountActive: boolean("discount_active").notNull().default(false), // Whether discount is active
  discountPriceCents: integer("discount_price_cents"), // Discounted monthly price in cents
  discountAnnualPriceCents: integer("discount_annual_price_cents"), // Discounted annual price in cents
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Legacy fields for backward compatibility
  monthlyPrice: integer("monthly_price").notNull().default(0), // @deprecated - use priceCents
  creditsPerMonth: integer("credits_per_month").notNull().default(0), // @deprecated - use includedCredits
  features: jsonb("features").notNull().default({}), // @deprecated - use featureFlags
});

// User subscriptions table (per user)
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status").notNull().default("active"), // active, trialing, canceled, past_due, unpaid, incomplete, paused
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe Customer ID
  stripeSubscriptionId: varchar("stripe_subscription_id"), // Stripe Subscription ID
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false), // Will cancel at period end
  canceledAt: timestamp("canceled_at"), // When cancellation was requested
  trialEnd: timestamp("trial_end"), // Trial period end date
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Legacy field for backward compatibility
  cancelledAt: timestamp("cancelled_at"), // @deprecated - use canceledAt
}, (table) => [
  index("idx_user_subscriptions_user_id").on(table.userId),
  index("idx_user_subscriptions_status").on(table.status),
  index("idx_user_subscriptions_stripe_subscription_id").on(table.stripeSubscriptionId),
]);

// Credit transactions table (ledger)
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  balance: integer("balance").notNull(), // Balance after transaction
  type: varchar("type").notNull(), // signup_bonus, subscription_credit, generation, refund, admin_adjustment, credit_hold
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Additional data (e.g., imageId, model used, jobId for idempotency, type: credit_hold for holds, status: pending/settled/released)
  costSnapshot: jsonb("cost_snapshot"), // Snapshot of pricing calculation for audit (operationId, baseCostUsd, marginPercent, effectiveUsd, credits, units)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_transactions_user_id").on(table.userId),
  index("idx_credit_transactions_type").on(table.type),
  index("idx_credit_transactions_created_at").on(table.createdAt),
]);

// Credit requests table for user credit top-up requests
export const creditRequests = pgTable("credit_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  requestedAmount: integer("requested_amount").notNull(), // Amount user is requesting
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected
  approvedAmount: integer("approved_amount"), // Amount actually approved by admin (may differ from requested)
  creditTransactionId: integer("credit_transaction_id").references(() => creditTransactions.id), // Link to the credit transaction when approved
  adminNote: text("admin_note"),
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_requests_user_id").on(table.userId),
  index("idx_credit_requests_status").on(table.status),
  index("idx_credit_requests_created_at").on(table.createdAt),
]);

// =============================================================================
// NEW SUBSCRIPTION + CREDITS SYSTEM TABLES (Stage 1)
// =============================================================================

// Credit Ledger table - replaces single balance with ledger entries for FEFO expiration
export const creditLedger = pgTable("credit_ledger", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: varchar("source_type").notNull(), // subscription_grant, topup_purchase, admin_adjustment, usage_deduction, refund, legacy_migration
  sourceId: varchar("source_id"), // References subscription ID, topup order ID, admin action ID, generation ID, etc.
  amount: integer("amount").notNull(), // Positive for grants, negative for deductions
  balanceAfter: integer("balance_after"), // Running balance after this entry (optional, can be computed)
  expiresAt: timestamp("expires_at"), // Null for non-expiring; subscription credits expire at period end
  description: text("description"), // Human-readable description
  metadata: jsonb("metadata"), // Additional context (operation details, cost snapshot, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_ledger_user_id").on(table.userId),
  index("idx_credit_ledger_source_type").on(table.sourceType),
  index("idx_credit_ledger_expires_at").on(table.expiresAt),
  index("idx_credit_ledger_created_at").on(table.createdAt),
]);

// Top-up credit packs (admin-managed purchasable credit products)
export const topupPacks = pgTable("topup_packs", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // e.g., "100 Credits", "500 Credits Bundle"
  description: text("description"), // Description for display
  creditsAmount: integer("credits_amount").notNull(), // Number of credits in pack
  priceCents: integer("price_cents").notNull(), // Price in cents
  currency: varchar("currency").notNull().default("usd"), // Currency code
  expiresInDays: integer("expires_in_days").notNull().default(90), // Credits expire N days after purchase
  isActive: boolean("is_active").notNull().default(true), // Show/hide in store
  stripePriceId: varchar("stripe_price_id"), // Stripe Price ID for checkout
  stripeProductId: varchar("stripe_product_id"), // Stripe Product ID
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Coupons / Discounts table (admin-managed) - defined before topupPurchases due to FK reference
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // Unique coupon code
  name: varchar("name"), // Internal name for admin reference
  description: text("description"), // Description for admin
  type: varchar("type").notNull(), // percent, fixed_amount
  value: integer("value").notNull(), // Percentage (0-100) or amount in cents
  appliesTo: varchar("applies_to").notNull().default("both"), // plans, topups, both
  allowedPlanIds: jsonb("allowed_plan_ids"), // Array of plan IDs this coupon applies to (null = all)
  maxRedemptions: integer("max_redemptions"), // Max total uses (null = unlimited)
  maxRedemptionsPerUser: integer("max_redemptions_per_user").default(1), // Max uses per user
  redemptionCount: integer("redemption_count").notNull().default(0), // Current redemption count
  minPurchaseCents: integer("min_purchase_cents"), // Minimum purchase amount for coupon to apply
  expiresAt: timestamp("expires_at"), // Null = never expires
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_coupons_code").on(table.code),
  index("idx_coupons_is_active").on(table.isActive),
]);

// Top-up purchases (orders for credit packs)
export const topupPurchases = pgTable("topup_purchases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  packId: integer("pack_id").notNull().references(() => topupPacks.id),
  creditsGranted: integer("credits_granted").notNull(), // Credits actually granted
  pricePaidCents: integer("price_paid_cents").notNull(), // Price paid (after discounts)
  currency: varchar("currency").notNull().default("usd"),
  expiresAt: timestamp("expires_at").notNull(), // When these credits expire
  stripePaymentIntentId: varchar("stripe_payment_intent_id"), // Stripe Payment Intent ID
  stripeSessionId: varchar("stripe_session_id"), // Stripe Checkout Session ID
  couponId: integer("coupon_id").references(() => coupons.id), // Applied coupon (if any)
  status: varchar("status").notNull().default("completed"), // pending, completed, refunded
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_topup_purchases_user_id").on(table.userId),
  index("idx_topup_purchases_status").on(table.status),
]);

// Coupon redemptions table (tracks usage)
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  couponId: integer("coupon_id").notNull().references(() => coupons.id),
  appliedTo: varchar("applied_to").notNull(), // subscription, topup
  referenceId: varchar("reference_id").notNull(), // Subscription ID or topup purchase ID
  discountAmountCents: integer("discount_amount_cents").notNull(), // Actual discount applied
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_coupon_redemptions_user_id").on(table.userId),
  index("idx_coupon_redemptions_coupon_id").on(table.couponId),
]);

// =============================================================================
// END NEW SUBSCRIPTION + CREDITS SYSTEM TABLES
// =============================================================================

// Pricing rules table for dynamic cost calculation (LEGACY - keeping for backward compatibility)
export const pricingRules = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  featureType: varchar("feature_type").notNull(), // model, enhancement, resolution, etc.
  featureValue: varchar("feature_value").notNull(), // flux-schnell, prompt_enhancement, 4k, etc.
  creditCost: integer("credit_cost").notNull(), // Cost in credits
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0), // For rule precedence
  metadata: jsonb("metadata"), // Additional configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Image generation jobs table for queue management
export const imageGenerationJobs = pgTable("image_generation_jobs", {
  id: varchar("id").primaryKey().notNull(), // UUID job ID for tracking
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  promptPreview: varchar("prompt_preview", { length: 100 }).notNull(), // Short preview for UI
  // Generation parameters
  width: integer("width").notNull().default(1024),
  height: integer("height").notNull().default(1024),
  aspectRatio: text("aspect_ratio").default("1:1"),
  model: text("model").notNull().default("flux-pro"),
  provider: text("provider").notNull().default("replicate"),
  style: text("style").default("Realistic"),
  quality: text("quality").default("standard"),
  negativePrompt: text("negative_prompt"),
  seed: integer("seed"),
  steps: integer("steps"),
  cfgScale: real("cfg_scale"),
  styleImageUrl: text("style_image_url"),
  styleImageUrls: text("style_image_urls").array(),
  imageStrength: real("image_strength"),
  enhancePrompt: boolean("enhance_prompt").default(false),
  tags: text("tags").array().default([]),
  // Job state management
  status: varchar("status", { enum: ["queued", "running", "completed", "failed", "cancelled"] }).notNull().default("queued"),
  progress: integer("progress").notNull().default(0), // Progress percentage 0-100
  stage: text("stage").default("Queued"), // Human-readable stage
  queuePosition: integer("queue_position"), // Position in queue (null if not queued)
  // Results (populated on completion)
  resultImageId: integer("result_image_id").references(() => images.id),
  resultUrl: text("result_url"),
  error: text("error"), // Error message on failure
  // Cost tracking
  creditsUsed: integer("credits_used"),
  costSnapshot: jsonb("cost_snapshot"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_image_jobs_owner_id").on(table.ownerId),
  index("idx_image_jobs_status").on(table.status),
  index("idx_image_jobs_created_at").on(table.createdAt),
  index("idx_image_jobs_queue_position").on(table.queuePosition),
]);

export const insertImageGenerationJobSchema = createInsertSchema(imageGenerationJobs).omit({
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  resultImageId: true,
  resultUrl: true,
  error: true,
}).extend({
  id: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  queuePosition: z.number().optional(),
});

export type InsertImageGenerationJob = z.infer<typeof insertImageGenerationJobSchema>;
export type ImageGenerationJob = typeof imageGenerationJobs.$inferSelect;

// Pricing settings table for global pricing configuration
export const pricingSettings = pgTable("pricing_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key").notNull().unique(), // credit_usd_rate, general_margin_percent, rounding_mode, min_charge_credits, max_charge_credits
  value: jsonb("value").notNull(), // The setting value
  description: text("description"), // Description for admin UI
  isLocked: boolean("is_locked").notNull().default(false), // Prevent editing (e.g., credit_usd_rate)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Pricing operations catalog table for all 3rd-party API operations
export const pricingOperations = pgTable("pricing_operations", {
  id: serial("id").primaryKey(),
  operationId: varchar("operation_id").notNull().unique(), // e.g., "video.veo3.generate_v1", "image.flux.schnell"
  displayName: varchar("display_name").notNull(), // e.g., "Veo 3 — Video Gen"
  provider: varchar("provider").notNull(), // e.g., "fal.ai", "openai", "replicate"
  model: varchar("model"), // e.g., "Veo 3.1", "FLUX Schnell", "GPT-5-nano"
  category: varchar("category").notNull(), // image, video, audio, text
  unitType: varchar("unit_type").notNull(), // seconds, image, characters, tokens, job
  baseCostUsd: real("base_cost_usd").notNull(), // Base cost in USD per unit (legacy fallback)
  defaultQuantity: real("default_quantity").notNull().default(1), // Default units for estimation
  perOperationMarginPercent: real("per_operation_margin_percent"), // Override margin (null = use general)
  isActive: boolean("is_active").notNull().default(true),
  // New fields for per-second, per-resolution, per-audio pricing
  billingMode: varchar("billing_mode"), // null (legacy), "per_second", "per_second_with_resolution", "per_job_flat_by_resolution"
  rates: jsonb("rates"), // Complex rate structure: { "audio_on": 0.40, "audio_off": 0.20 } OR { "720p": 0.30, "1080p": 0.50 } OR { "720p": { "audio_on": 0.40, "audio_off": 0.20 } }
  metadata: jsonb("metadata"), // Additional info (resolution options, quality tiers, etc.)
  notes: text("notes"), // Admin notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Add credit balance to users table
export const userCredits = pgTable("user_credits", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema for API requests
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

// User-facing credit request schema (only fields users can set)
export const insertCreditRequestSchema = createInsertSchema(creditRequests).omit({
  id: true,
  createdAt: true,
  status: true,
  approvedAmount: true,
  creditTransactionId: true,
  adminNote: true,
  processedBy: true,
  processedAt: true,
}).extend({
  userId: z.string().optional(), // Will be set from session
});

// Admin-facing credit request update schema
export const updateCreditRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]).optional(),
  approvedAmount: z.number().int().positive().optional(),
  adminNote: z.string().optional(),
});

export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricingSettingSchema = createInsertSchema(pricingSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertPricingOperationSchema = createInsertSchema(pricingOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  updatedAt: true,
});

// =============================================================================
// INSERT SCHEMAS FOR NEW SUBSCRIPTION + CREDITS SYSTEM TABLES
// =============================================================================

export const insertCreditLedgerSchema = createInsertSchema(creditLedger).omit({
  id: true,
  createdAt: true,
});

export const insertTopupPackSchema = createInsertSchema(topupPacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopupPurchaseSchema = createInsertSchema(topupPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  redemptionCount: true,
});

export const insertCouponRedemptionSchema = createInsertSchema(couponRedemptions).omit({
  id: true,
  createdAt: true,
});

// Feature flags type definition for subscription plans
export const featureFlagsSchema = z.object({
  image_generation: z.boolean().default(true),
  video_generation: z.boolean().default(false),
  film_studio: z.boolean().default(false),
  can_make_private: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

// =============================================================================
// END INSERT SCHEMAS FOR NEW TABLES
// =============================================================================

// Translations table for managing website translations
export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  namespace: varchar("namespace", { length: 50 }).notNull().default("common"),
  english: text("english").notNull(),
  arabic: text("arabic").notNull(),
  lastModifiedBy: varchar("last_modified_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prompt templates table for centralized prompt management
export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(), // Unique identifier like "image_generation_default"
  displayName: varchar("display_name").notNull(), // Human readable name like "Image Generation"
  type: varchar("type").notNull(), // image_generation, video_generation, image_enhancement, video_enhancement, translation
  category: varchar("category").notNull().default("default"), // default, model_specific, custom
  modelId: varchar("model_id"), // Specific model override (e.g., "dall-e-3", "flux-schnell") - null for global defaults
  promptText: text("prompt_text").notNull(), // The actual prompt template with variables
  variables: jsonb("variables").notNull().default({}), // Variable definitions and metadata
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Mark as the fallback default for this type
  sortOrder: integer("sort_order").notNull().default(0),
  description: text("description"), // Admin notes about this prompt
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Image reference categories for Saudi Model
export const imageReferenceCategories = pgTable("image_reference_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(), // e.g., "Jazan", "Riyadh", "Najd women"
  slug: varchar("slug").notNull().unique(), // e.g., "jazan", "riyadh", "najd-women"
  description: text("description"), // Optional description
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

// Image reference images table (up to 10 per category)
export const imageReferenceImages = pgTable("image_reference_images", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => imageReferenceCategories.id, { onDelete: "cascade" }),
  filename: varchar("filename").notNull(), // Stored filename
  path: text("path").notNull(), // Relative path to the image file
  url: text("url").notNull(), // Public URL to access the image
  sortOrder: integer("sort_order").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImageReferenceCategorySchema = createInsertSchema(imageReferenceCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImageReferenceImageSchema = createInsertSchema(imageReferenceImages).omit({
  id: true,
  uploadedAt: true,
});

// Random prompts table for admin-editable random prompt suggestions
export const randomPrompts = pgTable("random_prompts", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRandomPromptSchema = createInsertSchema(randomPrompts).omit({
  id: true,
  createdAt: true,
});

// Film Studio tables
export const filmProjects = pgTable("film_projects", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  idea: text("idea").notNull(),
  style: varchar("style").notNull().default("cinematic"),
  mood: varchar("mood").notNull().default("dramatic"),
  cutsStyle: varchar("cuts_style").notNull().default("hard"),
  targetDuration: integer("target_duration").notNull().default(30),
  aspectRatio: varchar("aspect_ratio").notNull().default("16:9"),
  cameraLanguage: varchar("camera_language").notNull().default("cinematic"),
  pacing: varchar("pacing").notNull().default("medium"),
  visualEra: varchar("visual_era").notNull().default("modern"),
  scriptLanguage: varchar("script_language").notNull().default("english"),
  finalFilmUrl: text("final_film_url"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storyboardScenes = pgTable("storyboard_scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => filmProjects.id, { onDelete: "cascade" }),
  sceneNumber: integer("scene_number").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  suggestedDuration: integer("suggested_duration").notNull().default(5),
  selectedForFinal: boolean("selected_for_final").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sceneVersions = pgTable("scene_versions", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => storyboardScenes.id, { onDelete: "cascade" }),
  versionType: varchar("version_type").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  title: varchar("title"),
  description: text("description"),
  notes: text("notes"),
  imagePrompt: text("image_prompt"),
  imageModel: text("image_model").default("fal-ai/flux-pro/v1.1"),
  imageStyle: text("image_style").default("sketch"),
  imageUrl: text("image_url"),
  imageId: integer("image_id").references(() => images.id),
  videoPrompt: text("video_prompt"),
  videoUrl: text("video_url"),
  videoId: integer("video_id").references(() => videos.id),
  jobId: varchar("job_id").references(() => videoJobs.id),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFilmProjectSchema = createInsertSchema(filmProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ownerId: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const insertStoryboardSceneSchema = createInsertSchema(storyboardScenes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSceneVersionSchema = createInsertSchema(sceneVersions).omit({
  id: true,
  createdAt: true,
}).extend({
  isActive: z.boolean().optional(),
});

// Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditRequest = typeof creditRequests.$inferSelect;
export type InsertCreditRequest = z.infer<typeof insertCreditRequestSchema>;
export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type PricingSetting = typeof pricingSettings.$inferSelect;
export type InsertPricingSetting = z.infer<typeof insertPricingSettingSchema>;
export type PricingOperation = typeof pricingOperations.$inferSelect;
export type InsertPricingOperation = z.infer<typeof insertPricingOperationSchema>;
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;

// New Subscription + Credits System Types
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type InsertCreditLedgerEntry = z.infer<typeof insertCreditLedgerSchema>;
export type TopupPack = typeof topupPacks.$inferSelect;
export type InsertTopupPack = z.infer<typeof insertTopupPackSchema>;
export type TopupPurchase = typeof topupPurchases.$inferSelect;
export type InsertTopupPurchase = z.infer<typeof insertTopupPurchaseSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemption = z.infer<typeof insertCouponRedemptionSchema>;

// User entitlements type (returned by getUserEntitlements)
export type UserEntitlements = {
  userId: string;
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  featureFlags: FeatureFlags;
  currentPeriodEnd: Date | null;
  availableCredits: number;
  creditBreakdown: {
    subscriptionCredits: number;
    topupCredits: number;
    otherCredits: number;
  };
};

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type ImageReferenceCategory = typeof imageReferenceCategories.$inferSelect;
export type InsertImageReferenceCategory = z.infer<typeof insertImageReferenceCategorySchema>;
export type ImageReferenceImage = typeof imageReferenceImages.$inferSelect;
export type InsertImageReferenceImage = z.infer<typeof insertImageReferenceImageSchema>;

// Translation schema and types
export const insertTranslationSchema = createInsertSchema(translations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;

// Random prompt types
export type RandomPrompt = typeof randomPrompts.$inferSelect;
export type InsertRandomPrompt = z.infer<typeof insertRandomPromptSchema>;

// Film Studio types
export type FilmProject = typeof filmProjects.$inferSelect;
export type InsertFilmProject = z.infer<typeof insertFilmProjectSchema>;
export type StoryboardScene = typeof storyboardScenes.$inferSelect;
export type InsertStoryboardScene = z.infer<typeof insertStoryboardSceneSchema>;
export type SceneVersion = typeof sceneVersions.$inferSelect;
export type InsertSceneVersion = z.infer<typeof insertSceneVersionSchema>;

// Contact submissions table for contact form entries
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").notNull().default("unread"), // unread, read, replied
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_contact_submissions_status").on(table.status),
  index("idx_contact_submissions_created_at").on(table.createdAt),
]);

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true,
  adminNote: true,
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;

// Teaser gallery items table for admin-managed gallery on teaser page
export const teaserGalleryItems = pgTable("teaser_gallery_items", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  captionEn: varchar("caption_en").notNull(),
  captionAr: varchar("caption_ar").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_teaser_gallery_sort_order").on(table.sortOrder),
]);

export const insertTeaserGalleryItemSchema = createInsertSchema(teaserGalleryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TeaserGalleryItem = typeof teaserGalleryItems.$inferSelect;
export type InsertTeaserGalleryItem = z.infer<typeof insertTeaserGalleryItemSchema>;

// Teaser showcase video - single video displayed in the showcase section
export const teaserShowcaseVideo = pgTable("teaser_showcase_video", {
  id: serial("id").primaryKey(),
  videoUrl: text("video_url").notNull(),
  captionEn: varchar("caption_en").notNull().default("Culturally aligned visuals"),
  captionAr: varchar("caption_ar").notNull().default("صور متوافقة ثقافيًا"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTeaserShowcaseVideoSchema = createInsertSchema(teaserShowcaseVideo).omit({
  id: true,
  updatedAt: true,
});

export type TeaserShowcaseVideo = typeof teaserShowcaseVideo.$inferSelect;
export type InsertTeaserShowcaseVideo = z.infer<typeof insertTeaserShowcaseVideoSchema>;

// Hero videos table for teaser page - desktop (wide) and mobile (tall) versions
export const heroVideos = pgTable("hero_videos", {
  id: serial("id").primaryKey(),
  desktopVideoUrl: text("desktop_video_url").notNull(),
  mobileVideoUrl: text("mobile_video_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHeroVideosSchema = createInsertSchema(heroVideos).omit({
  id: true,
  updatedAt: true,
});

export type HeroVideos = typeof heroVideos.$inferSelect;
export type InsertHeroVideos = z.infer<typeof insertHeroVideosSchema>;

// Homepage service cards (top 3 cards for Image Generation, Video Generation, Film Studio)
export const homepageServiceCards = pgTable("homepage_service_cards", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"), // Arabic translation
  description: text("description").notNull(),
  descriptionAr: text("description_ar"), // Arabic translation
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  linkType: varchar("link_type").notNull().default("internal"), // internal, external, modal
  modalType: varchar("modal_type"), // image, video (used when linkType is modal)
  initialModel: varchar("initial_model"), // Pre-selected model ID when opening modal (e.g., "saudi-model-pro")
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_homepage_service_cards_sort_order").on(table.sortOrder),
]);

export const insertHomepageServiceCardSchema = createInsertSchema(homepageServiceCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HomepageServiceCard = typeof homepageServiceCards.$inferSelect;
export type InsertHomepageServiceCard = z.infer<typeof insertHomepageServiceCardSchema>;

// Homepage promotion bar
export const homepagePromotionBar = pgTable("homepage_promotion_bar", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  buttonText: varchar("button_text"),
  buttonUrl: text("button_url"),
  backgroundColor: varchar("background_color").default("#1a1a2e"),
  textColor: varchar("text_color").default("#ffffff"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

export const insertHomepagePromotionBarSchema = createInsertSchema(homepagePromotionBar).omit({
  id: true,
  updatedAt: true,
});

export type HomepagePromotionBar = typeof homepagePromotionBar.$inferSelect;
export type InsertHomepagePromotionBar = z.infer<typeof insertHomepagePromotionBarSchema>;

// Featured gallery items (admin-selected from public gallery)
export const homepageFeaturedItems = pgTable("homepage_featured_items", {
  id: serial("id").primaryKey(),
  itemType: varchar("item_type").notNull(), // image, video
  itemId: integer("item_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_homepage_featured_items_sort_order").on(table.sortOrder),
  index("idx_homepage_featured_items_type").on(table.itemType),
]);

export const insertHomepageFeaturedItemSchema = createInsertSchema(homepageFeaturedItems).omit({
  id: true,
  createdAt: true,
});

export type HomepageFeaturedItem = typeof homepageFeaturedItems.$inferSelect;
export type InsertHomepageFeaturedItem = z.infer<typeof insertHomepageFeaturedItemSchema>;

// Homepage call to action section
export const homepageCta = pgTable("homepage_cta", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  buttonText: varchar("button_text").notNull(),
  buttonUrl: text("button_url").notNull(),
  backgroundImageUrl: text("background_image_url"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

export const insertHomepageCtaSchema = createInsertSchema(homepageCta).omit({
  id: true,
  updatedAt: true,
});

export type HomepageCta = typeof homepageCta.$inferSelect;
export type InsertHomepageCta = z.infer<typeof insertHomepageCtaSchema>;

// Public gallery curated items (admin-selected items to show on /gallery page)
export const publicGalleryItems = pgTable("public_gallery_items", {
  id: serial("id").primaryKey(),
  itemType: varchar("item_type").notNull(), // image, video
  itemId: integer("item_id").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false), // Featured items get special styling
  isStickyTop: boolean("is_sticky_top").notNull().default(false), // Sticky items stay at the top
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_public_gallery_items_sort_order").on(table.sortOrder),
  index("idx_public_gallery_items_type").on(table.itemType),
  index("idx_public_gallery_items_featured").on(table.isFeatured),
  index("idx_public_gallery_items_sticky").on(table.isStickyTop),
]);

export const insertPublicGalleryItemSchema = createInsertSchema(publicGalleryItems).omit({
  id: true,
  createdAt: true,
});

export type PublicGalleryItem = typeof publicGalleryItems.$inferSelect;
export type InsertPublicGalleryItem = z.infer<typeof insertPublicGalleryItemSchema>;

// User notifications table
export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // subscription_started, subscription_renewed, subscription_canceled, payment_failed, trial_ending, renewal_reminder, credits_granted, credits_low, plan_changed
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"), // Additional context (planName, credits, etc.)
  isRead: boolean("is_read").notNull().default(false),
  emailSent: boolean("email_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_notifications_user_id").on(table.userId),
  index("idx_user_notifications_is_read").on(table.isRead),
  index("idx_user_notifications_created_at").on(table.createdAt),
]);

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;

// =============================================================================
// PRICING PAGE CONFIGURATION TABLES
// =============================================================================

// Pricing page main configuration (singleton)
export const pricingPageConfig = pgTable("pricing_page_config", {
  id: serial("id").primaryKey(),
  navVisible: boolean("nav_visible").notNull().default(true),
  pageTitle: varchar("page_title").notNull().default("Choose Your Plan"),
  pageTitleAr: varchar("page_title_ar").default("اختر خطتك"),
  pageSubtitle: text("page_subtitle").default("Unlock the full power of AI-generated images and videos"),
  pageSubtitleAr: text("page_subtitle_ar").default("أطلق العنان للقوة الكاملة للصور ومقاطع الفيديو المولدة بالذكاء الاصطناعي"),
  smallNote: text("small_note"),
  smallNoteAr: text("small_note_ar"),
  defaultBillingView: varchar("default_billing_view").notNull().default("monthly"), // monthly, annually
  featuredPlanId: integer("featured_plan_id").references(() => subscriptionPlans.id),
  showCreditPacks: boolean("show_credit_packs").notNull().default(true),
  subscriptionComingSoon: boolean("subscription_coming_soon").notNull().default(false),
  comingSoonMessage: text("coming_soon_message").default("Coming soon, we are currently in beta testing stage"),
  comingSoonMessageAr: text("coming_soon_message_ar").default("قريباً، نحن حالياً في مرحلة الاختبار التجريبي"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

export const insertPricingPageConfigSchema = createInsertSchema(pricingPageConfig).omit({
  id: true,
  updatedAt: true,
});

export type PricingPageConfig = typeof pricingPageConfig.$inferSelect;
export type InsertPricingPageConfig = z.infer<typeof insertPricingPageConfigSchema>;

// Pricing FAQ items
export const pricingFaqItems = pgTable("pricing_faq_items", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  questionAr: text("question_ar"),
  answer: text("answer").notNull(),
  answerAr: text("answer_ar"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_pricing_faq_items_sort_order").on(table.sortOrder),
]);

export const insertPricingFaqItemSchema = createInsertSchema(pricingFaqItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingFaqItem = typeof pricingFaqItems.$inferSelect;
export type InsertPricingFaqItem = z.infer<typeof insertPricingFaqItemSchema>;

// Pricing comparison table sections
export const pricingComparisonSections = pgTable("pricing_comparison_sections", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_pricing_comparison_sections_sort_order").on(table.sortOrder),
]);

export const insertPricingComparisonSectionSchema = createInsertSchema(pricingComparisonSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingComparisonSection = typeof pricingComparisonSections.$inferSelect;
export type InsertPricingComparisonSection = z.infer<typeof insertPricingComparisonSectionSchema>;

// Pricing comparison table rows
export const pricingComparisonRows = pgTable("pricing_comparison_rows", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => pricingComparisonSections.id, { onDelete: "cascade" }),
  label: varchar("label").notNull(),
  labelAr: varchar("label_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  rowType: varchar("row_type").notNull().default("boolean"), // boolean, text
  entitlementKey: varchar("entitlement_key"), // Optional link to featureFlags key
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_pricing_comparison_rows_section_id").on(table.sectionId),
  index("idx_pricing_comparison_rows_sort_order").on(table.sortOrder),
]);

export const insertPricingComparisonRowSchema = createInsertSchema(pricingComparisonRows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingComparisonRow = typeof pricingComparisonRows.$inferSelect;
export type InsertPricingComparisonRow = z.infer<typeof insertPricingComparisonRowSchema>;

// Pricing comparison table cells (values per plan per row)
export const pricingComparisonCells = pgTable("pricing_comparison_cells", {
  id: serial("id").primaryKey(),
  rowId: integer("row_id").notNull().references(() => pricingComparisonRows.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  valueBoolean: boolean("value_boolean"),
  valueText: varchar("value_text"),
  valueTextAr: varchar("value_text_ar"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_pricing_comparison_cells_row_id").on(table.rowId),
  index("idx_pricing_comparison_cells_plan_id").on(table.planId),
]);

export const insertPricingComparisonCellSchema = createInsertSchema(pricingComparisonCells).omit({
  id: true,
  updatedAt: true,
});

export type PricingComparisonCell = typeof pricingComparisonCells.$inferSelect;
export type InsertPricingComparisonCell = z.infer<typeof insertPricingComparisonCellSchema>;

// Plan display overrides (marketing labels for pricing page)
export const planDisplayOverrides = pgTable("plan_display_overrides", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }).unique(),
  badgeText: varchar("badge_text"), // e.g., "Most Popular", "Best Value"
  badgeTextAr: varchar("badge_text_ar"),
  marketingLabel: varchar("marketing_label"), // e.g., "For professionals"
  marketingLabelAr: varchar("marketing_label_ar"),
  highlightFeatures: jsonb("highlight_features").default([]), // Array of highlighted feature strings
  highlightFeaturesAr: jsonb("highlight_features_ar").default([]),
  annualSavingsPercent: integer("annual_savings_percent"), // "Save X%" badge
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_plan_display_overrides_plan_id").on(table.planId),
  index("idx_plan_display_overrides_sort_order").on(table.sortOrder),
]);

export const insertPlanDisplayOverrideSchema = createInsertSchema(planDisplayOverrides).omit({
  id: true,
  updatedAt: true,
});

export type PlanDisplayOverride = typeof planDisplayOverrides.$inferSelect;
export type InsertPlanDisplayOverride = z.infer<typeof insertPlanDisplayOverrideSchema>;

// Credit pack display overrides (ordering and visibility)
export const creditPackDisplayOverrides = pgTable("credit_pack_display_overrides", {
  id: serial("id").primaryKey(),
  packId: integer("pack_id").notNull().references(() => topupPacks.id, { onDelete: "cascade" }).unique(),
  badgeText: varchar("badge_text"), // e.g., "Best Value"
  badgeTextAr: varchar("badge_text_ar"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_credit_pack_display_overrides_pack_id").on(table.packId),
  index("idx_credit_pack_display_overrides_sort_order").on(table.sortOrder),
]);

export const insertCreditPackDisplayOverrideSchema = createInsertSchema(creditPackDisplayOverrides).omit({
  id: true,
  updatedAt: true,
});

export type CreditPackDisplayOverride = typeof creditPackDisplayOverrides.$inferSelect;
export type InsertCreditPackDisplayOverride = z.infer<typeof insertCreditPackDisplayOverrideSchema>;

// Upgrade reason mappings (friendly copy for upgrade=1&reason=X)
export const upgradeReasonMappings = pgTable("upgrade_reason_mappings", {
  id: serial("id").primaryKey(),
  reasonKey: varchar("reason_key").notNull().unique(), // e.g., "video_generation", "film_studio", "private_content"
  title: varchar("title").notNull(),
  titleAr: varchar("title_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  icon: varchar("icon"), // lucide icon name
  recommendedPlanId: integer("recommended_plan_id").references(() => subscriptionPlans.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
});

export const insertUpgradeReasonMappingSchema = createInsertSchema(upgradeReasonMappings).omit({
  id: true,
  updatedAt: true,
});

export type UpgradeReasonMapping = typeof upgradeReasonMappings.$inferSelect;
export type InsertUpgradeReasonMapping = z.infer<typeof insertUpgradeReasonMappingSchema>;

// Annual plan variants (linking monthly plans to their annual equivalents)
export const annualPlanVariants = pgTable("annual_plan_variants", {
  id: serial("id").primaryKey(),
  monthlyPlanId: integer("monthly_plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }).unique(),
  annualPlanId: integer("annual_plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").notNull().references(() => users.id),
}, (table) => [
  index("idx_annual_plan_variants_monthly_plan_id").on(table.monthlyPlanId),
  index("idx_annual_plan_variants_annual_plan_id").on(table.annualPlanId),
]);

export const insertAnnualPlanVariantSchema = createInsertSchema(annualPlanVariants).omit({
  id: true,
  updatedAt: true,
});

export type AnnualPlanVariant = typeof annualPlanVariants.$inferSelect;
export type InsertAnnualPlanVariant = z.infer<typeof insertAnnualPlanVariantSchema>;

// =============================================================================
// END PRICING PAGE CONFIGURATION TABLES
// =============================================================================

// =============================================================================
// MODERATION LOGS TABLE
// =============================================================================

export const moderationLogs = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  verdict: varchar("verdict", { enum: ["ALLOW", "ALLOW_WITH_REWRITE", "BLOCK", "ESCALATE"] }).notNull(),
  policyTags: text("policy_tags").array().default([]),
  reasons: text("reasons").array().default([]),
  safeRewrite: text("safe_rewrite"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_moderation_logs_user_id").on(table.userId),
  index("idx_moderation_logs_verdict").on(table.verdict),
  index("idx_moderation_logs_created_at").on(table.createdAt),
]);

export const insertModerationLogSchema = createInsertSchema(moderationLogs).omit({
  id: true,
  createdAt: true,
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type InsertModerationLog = z.infer<typeof insertModerationLogSchema>;

// =============================================================================
// END MODERATION LOGS TABLE
// =============================================================================

// =============================================================================
// UPSCALE JOBS TABLE
// =============================================================================

export const upscaleJobs = pgTable("upscale_jobs", {
  id: varchar("id").primaryKey().notNull(), // UUID job ID for immediate tracking
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceImageId: integer("source_image_id").references(() => images.id, { onDelete: "set null" }), // Reference to original image
  sourceImageUrl: text("source_image_url").notNull(), // URL of the original image
  sourceWidth: integer("source_width").notNull(), // Original image width
  sourceHeight: integer("source_height").notNull(), // Original image height
  // Upscale parameters
  scaleFactor: integer("scale_factor").notNull().default(2), // 2x, 4x, 8x, 10x
  model: text("model").notNull().default("seedvr-upscale"), // Model used for upscaling
  provider: text("provider").notNull().default("fal"), // Provider (fal, etc.)
  outputFormat: text("output_format").notNull().default("jpg"), // png, jpg, webp
  // Job state management
  state: varchar("state").notNull().default("queued"), // queued, starting, processing, completed, failed, canceled
  progress: integer("progress").notNull().default(0), // Progress percentage 0-100
  stage: text("stage").notNull().default("Queued"), // Human-readable stage
  // Provider tracking
  providerId: text("provider_id"), // External provider job ID (e.g., fal.ai request ID)
  // Results (populated on completion)
  resultUrl: text("result_url"), // Final upscaled image URL
  resultWidth: integer("result_width"), // Upscaled image width
  resultHeight: integer("result_height"), // Upscaled image height
  resultImageId: integer("result_image_id").references(() => images.id, { onDelete: "set null" }), // Reference to created image
  error: text("error"), // Error message on failure
  // Cost tracking
  creditCost: integer("credit_cost").notNull().default(0), // Credits charged for this upscale
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_upscale_jobs_owner_id").on(table.ownerId),
  index("idx_upscale_jobs_state").on(table.state),
  index("idx_upscale_jobs_created_at").on(table.createdAt),
]);

export const insertUpscaleJobSchema = createInsertSchema(upscaleJobs).omit({
  createdAt: true,
  updatedAt: true,
});

export type UpscaleJob = typeof upscaleJobs.$inferSelect;
export type InsertUpscaleJob = z.infer<typeof insertUpscaleJobSchema>;

// Upscale model configurations
export const upscaleModels = pgTable("upscale_models", {
  id: serial("id").primaryKey(),
  modelId: varchar("model_id").notNull().unique(), // e.g., "seedvr-upscale"
  name: varchar("name").notNull(), // Display name e.g., "SeedVR2 Upscale"
  description: text("description"), // Model description
  provider: varchar("provider").notNull().default("fal"), // Provider (fal, etc.)
  endpoint: varchar("endpoint").notNull(), // API endpoint e.g., "fal-ai/seedvr/upscale/image"
  costPerMegapixel: real("cost_per_megapixel").notNull().default(0.001), // USD cost per megapixel
  creditsPerMegapixel: integer("credits_per_megapixel").notNull().default(1), // Credits per megapixel
  maxScaleFactor: integer("max_scale_factor").notNull().default(10), // Maximum supported scale factor
  supportedScaleFactors: text("supported_scale_factors").array().default([]), // e.g., ["2", "4", "8", "10"]
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUpscaleModelSchema = createInsertSchema(upscaleModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpscaleModel = typeof upscaleModels.$inferSelect;
export type InsertUpscaleModel = z.infer<typeof insertUpscaleModelSchema>;

// =============================================================================
// END UPSCALE JOBS TABLE
// =============================================================================
