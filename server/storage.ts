import { 
  users, images, videos, videoJobs, favorites, videoFavorites, adminLogs, siteSettings, imageReports, aiStyles, videoStyles, videoModelConfigs, heroSlides,
  subscriptionPlans, userSubscriptions, creditTransactions, creditRequests, pricingRules, pricingSettings, pricingOperations, userCredits, promptTemplates, translations, imageReferenceCategories, imageReferenceImages,
  randomPrompts, filmProjects, storyboardScenes, sceneVersions, contactSubmissions, imageGenerationJobs, teaserGalleryItems, teaserShowcaseVideo, heroVideos,
  homepageServiceCards, homepagePromotionBar, homepageFeaturedItems, homepageCta, publicGalleryItems,
  creditLedger, topupPacks, topupPurchases, coupons, couponRedemptions, userNotifications,
  pricingPageConfig, pricingFaqItems, pricingComparisonSections, pricingComparisonRows, pricingComparisonCells,
  planDisplayOverrides, creditPackDisplayOverrides, upgradeReasonMappings, annualPlanVariants, moderationLogs,
  upscaleJobs, upscaleModels,
  type User, type UpsertUser, type Image, type InsertImage, type Video, type InsertVideo, type VideoJob, type InsertVideoJob, type InsertFavorite, 
  type VideoFavorite, type InsertVideoFavorite, type AdminLog, type InsertAdminLog, type SiteSetting, type InsertSiteSetting, 
  type ImageReport, type InsertImageReport, type AiStyle, type InsertAiStyle, type VideoStyle, type InsertVideoStyle,
  type VideoModelConfig, type InsertVideoModelConfig, type HeroSlide, type InsertHeroSlide, type SubscriptionPlan, type InsertSubscriptionPlan, type UserSubscription, type InsertUserSubscription, type CreditTransaction, 
  type InsertCreditTransaction, type CreditRequest, type InsertCreditRequest, type PricingRule, type InsertPricingRule, type PricingSetting, type InsertPricingSetting, type PricingOperation, type InsertPricingOperation,
  type UserCredits, type InsertUserCredits, type PromptTemplate, type InsertPromptTemplate, type Translation, type InsertTranslation,
  type ImageReferenceCategory, type InsertImageReferenceCategory, type ImageReferenceImage, type InsertImageReferenceImage,
  type RandomPrompt, type InsertRandomPrompt, type FilmProject, type InsertFilmProject, type StoryboardScene, type InsertStoryboardScene,
  type SceneVersion, type InsertSceneVersion, type ContactSubmission, type InsertContactSubmission,
  type ImageGenerationJob, type InsertImageGenerationJob,
  type TeaserGalleryItem, type InsertTeaserGalleryItem,
  type TeaserShowcaseVideo, type InsertTeaserShowcaseVideo,
  type HeroVideos, type InsertHeroVideos,
  type HomepageServiceCard, type InsertHomepageServiceCard,
  type HomepagePromotionBar, type InsertHomepagePromotionBar,
  type HomepageFeaturedItem, type InsertHomepageFeaturedItem,
  type HomepageCta, type InsertHomepageCta,
  type PublicGalleryItem, type InsertPublicGalleryItem,
  type CreditLedgerEntry, type InsertCreditLedgerEntry,
  type TopupPack, type InsertTopupPack,
  type TopupPurchase, type InsertTopupPurchase,
  type Coupon, type InsertCoupon,
  type CouponRedemption, type InsertCouponRedemption,
  type UserEntitlements, type FeatureFlags,
  type UserNotification, type InsertUserNotification,
  type PricingPageConfig, type InsertPricingPageConfig,
  type PricingFaqItem, type InsertPricingFaqItem,
  type PricingComparisonSection, type InsertPricingComparisonSection,
  type PricingComparisonRow, type InsertPricingComparisonRow,
  type PricingComparisonCell, type InsertPricingComparisonCell,
  type PlanDisplayOverride, type InsertPlanDisplayOverride,
  type CreditPackDisplayOverride, type InsertCreditPackDisplayOverride,
  type UpgradeReasonMapping, type InsertUpgradeReasonMapping,
  type AnnualPlanVariant, type InsertAnnualPlanVariant,
  type ModerationLog, type InsertModerationLog,
  type UpscaleJob, type InsertUpscaleJob,
  type UpscaleModel, type InsertUpscaleModel
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, count, inArray, or, ilike, notExists } from "drizzle-orm";

export interface IStorage {
  // User operations for Google OAuth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  migrateUserId(oldId: string, newId: string): Promise<void>;
  updateUserIdByEmail(email: string, newId: string, updates: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<void>;
  deleteUser(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPublicDefault(userId: string, publicByDefault: boolean): Promise<User | undefined>;
  updateUserFreeGenerationConsent(userId: string): Promise<User | undefined>;
  updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User | undefined>;
  
  // Image operations with privacy controls
  getPublicImages(): Promise<Image[]>;
  getUserImages(userId: string): Promise<Image[]>;
  getImage(id: number): Promise<Image | undefined>;
  createImage(image: InsertImage & { url: string; ownerId: string; isPublic: boolean }): Promise<Image>;
  updateImageUrl(id: number, url: string, thumbnailUrl?: string | null): Promise<Image | undefined>;
  updateImageVisibility(id: number, isPublic: boolean, userId: string): Promise<Image | undefined>;
  deleteImage(id: number, userId: string): Promise<boolean>;
  setAllUserImagesPrivate(userId: string): Promise<void>;
  
  // Video Job operations (job-based video generation system)
  createVideoJob(job: Omit<InsertVideoJob, 'createdAt' | 'updatedAt'> & { ownerId: string }): Promise<VideoJob>;
  getVideoJob(jobId: string): Promise<VideoJob | undefined>;
  getUserVideoJobs(userId: string): Promise<VideoJob[]>;
  updateVideoJobStatus(jobId: string, state: string, progress?: number, stage?: string): Promise<VideoJob | undefined>;
  updateVideoJobProvider(jobId: string, providerId: string): Promise<VideoJob | undefined>;
  completeVideoJob(jobId: string, assetUrl: string, thumbnailUrl?: string): Promise<VideoJob | undefined>;
  failVideoJob(jobId: string, error: string): Promise<VideoJob | undefined>;
  cancelVideoJob(jobId: string): Promise<VideoJob | undefined>;
  getActiveVideoJobs(userId: string): Promise<VideoJob[]>;
  cleanupOldVideoJobs(olderThanDays: number): Promise<number>;

  // Upscale Job operations
  createUpscaleJob(job: Omit<InsertUpscaleJob, 'createdAt' | 'updatedAt'>): Promise<UpscaleJob>;
  getUpscaleJob(jobId: string): Promise<UpscaleJob | undefined>;
  getUserUpscaleJobs(userId: string): Promise<UpscaleJob[]>;
  updateUpscaleJobStatus(jobId: string, state: string, progress?: number, stage?: string): Promise<UpscaleJob | undefined>;
  updateUpscaleJobProvider(jobId: string, providerId: string): Promise<UpscaleJob | undefined>;
  completeUpscaleJob(jobId: string, resultUrl: string, resultWidth: number, resultHeight: number, resultImageId?: number): Promise<UpscaleJob | undefined>;
  failUpscaleJob(jobId: string, error: string): Promise<UpscaleJob | undefined>;
  getActiveUpscaleJobs(userId: string): Promise<UpscaleJob[]>;
  dismissUpscaleJob(jobId: string): Promise<UpscaleJob | undefined>;
  
  // Upscale model operations
  getUpscaleModels(): Promise<UpscaleModel[]>;
  getActiveUpscaleModels(): Promise<UpscaleModel[]>;
  getUpscaleModel(modelId: string): Promise<UpscaleModel | undefined>;

  // Video operations with privacy controls
  getPublicVideos(): Promise<Video[]>;
  getUserVideos(userId: string): Promise<Video[]>;
  getVideo(id: number): Promise<Video | undefined>;
  getVideosByJobId(jobId: string): Promise<Video[]>;
  createVideo(video: InsertVideo & { url: string; ownerId: string; isPublic: boolean; replicateId?: string; jobId?: string }): Promise<Video>;
  updateVideoUrl(id: number, url: string, thumbnailUrl?: string): Promise<Video | undefined>;
  updateVideoStatus(id: number, status: string, replicateId?: string): Promise<Video | undefined>;
  updateVideoProgress(id: number, progressData: { status?: string; progress?: number; stage?: string; etaSeconds?: number }): Promise<Video | undefined>;
  updateVideoVisibility(id: number, isPublic: boolean, userId: string): Promise<Video | undefined>;
  deleteVideo(id: number, userId: string): Promise<boolean>;
  setAllUserVideosPrivate(userId: string): Promise<void>;
  
  // Failed generation cleanup
  getFailedVideos(userId?: string): Promise<Video[]>;
  deleteFailedVideos(userId?: string): Promise<number>;
  refundCreditsForFailedVideo(videoId: number): Promise<boolean>;
  
  // Favorites operations
  toggleFavorite(userId: string, imageId: number): Promise<boolean>;
  getUserFavorites(userId: string): Promise<Image[]>;
  isImageFavorited(userId: string, imageId: number): Promise<boolean>;
  getBulkFavoriteStatus(userId: string, imageIds: number[]): Promise<Record<number, boolean>>;
  
  // Video favorites operations
  toggleVideoFavorite(userId: string, videoId: number): Promise<boolean>;
  getUserVideoFavorites(userId: string): Promise<Video[]>;
  isVideoFavorited(userId: string, videoId: number): Promise<boolean>;
  getBulkVideoFavoriteStatus(userId: string, videoIds: number[]): Promise<Record<number, boolean>>;
  
  // History operations (combined images and videos)
  getUserHistory(
    userId: string,
    filters: {
      search?: string;
      type?: 'all' | 'image' | 'video' | 'upscaled';
      favoritesOnly?: boolean;
      sort?: 'newest' | 'oldest';
    }
  ): Promise<Array<(Image & { type: 'image'; isFavorited: boolean }) | (Video & { type: 'video'; isFavorited: boolean })>>;
  
  // Admin operations
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  getUsersCount(): Promise<number>;
  getAllImages(limit?: number, offset?: number, search?: string): Promise<(Image & { ownerName?: string })[]>;
  getImagesCount(search?: string): Promise<number>;
  getAllVideos(limit?: number, offset?: number, search?: string): Promise<(Video & { ownerName?: string })[]>;
  getVideosCount(search?: string): Promise<number>;
  getImagesByOwner(ownerId: string): Promise<Image[]>;
  updateUserRole(userId: string, role: "user" | "admin", adminId: string): Promise<User | undefined>;
  updateUserActiveStatus(userId: string, isActive: boolean, adminId: string): Promise<User | undefined>;
  adminDeleteUser(userId: string, adminId: string): Promise<boolean>;
  adminDeleteImage(imageId: number, adminId: string): Promise<boolean>;
  adminUpdateImageVisibility(imageId: number, isPublic: boolean, adminId: string): Promise<Image | undefined>;
  adminDeleteVideo(videoId: number, adminId: string): Promise<boolean>;
  adminUpdateVideoVisibility(videoId: number, isPublic: boolean, adminId: string): Promise<Video | undefined>;
  transferImageOwnership(imageId: number, newOwnerId: string, adminId: string): Promise<Image | undefined>;
  getStats(): Promise<{
    totalUsers: number;
    totalImages: number;
    totalVideos: number;
    publicImages: number;
    privateImages: number;
    publicVideos: number;
    privateVideos: number;
    dailyGenerations: number;
  }>;
  
  // Admin logs
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  getAdminLogs(limit?: number, offset?: number): Promise<(AdminLog & { adminName?: string })[]>;
  
  // Site settings
  getSiteSettings(): Promise<SiteSetting[]>;
  getSiteSettingsByCategory(category: string): Promise<SiteSetting[]>;
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  setSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting>;
  updateSiteSetting(key: string, value: any, adminId: string): Promise<SiteSetting | undefined>;
  deleteSiteSetting(key: string, adminId: string): Promise<boolean>;
  
  // Admin pricing rules management (LEGACY)
  getAllPricingRules(): Promise<PricingRule[]>;
  getActivePricingRules(): Promise<PricingRule[]>;
  
  // Pricing settings management
  getAllPricingSettings(): Promise<PricingSetting[]>;
  getPricingSetting(key: string): Promise<PricingSetting | undefined>;
  upsertPricingSetting(setting: InsertPricingSetting): Promise<PricingSetting>;
  
  // Pricing operations catalog management
  getAllPricingOperations(): Promise<PricingOperation[]>;
  getActivePricingOperations(): Promise<PricingOperation[]>;
  getPricingOperation(operationId: string): Promise<PricingOperation | undefined>;
  getPricingOperationsByCategory(category: string): Promise<PricingOperation[]>;
  createPricingOperation(operation: InsertPricingOperation): Promise<PricingOperation>;
  updatePricingOperation(id: number, updates: Partial<InsertPricingOperation>): Promise<PricingOperation | undefined>;
  updatePricingOperationByOperationId(operationId: string, updates: Partial<InsertPricingOperation>): Promise<PricingOperation | undefined>;
  deletePricingOperation(id: number): Promise<boolean>;
  bulkUpdatePricingOperations(updates: Array<{ id: number; updates: Partial<InsertPricingOperation> }>): Promise<number>;
  
  searchUsers(query: string): Promise<User[]>;
  
  // Raw SQL query for admin operations (parameterized)
  rawQuery(query: string, params?: any[]): Promise<any[]>;
  
  // Image reports
  createImageReport(report: InsertImageReport): Promise<ImageReport>;
  getImageReports(limit?: number, offset?: number): Promise<(ImageReport & { reporterName?: string; imageThumbnail?: string })[]>;
  updateReportStatus(reportId: number, status: "dismissed" | "resolved", adminId: string): Promise<ImageReport | undefined>;
  deleteReport(reportId: number, adminId: string): Promise<boolean>;
  
  // AI styles management
  getAiStyles(): Promise<AiStyle[]>;
  getVisibleAiStyles(): Promise<AiStyle[]>;
  getAiStyle(id: number): Promise<AiStyle | undefined>;
  createAiStyle(style: InsertAiStyle): Promise<AiStyle>;
  updateAiStyle(id: number, updates: Partial<InsertAiStyle>, adminId: string): Promise<AiStyle | undefined>;
  deleteAiStyle(id: number, adminId: string): Promise<boolean>;
  toggleAiStyleVisibility(id: number, isVisible: boolean, adminId: string): Promise<AiStyle | undefined>;
  
  // Video styles management
  getVideoStyles(): Promise<VideoStyle[]>;
  getVisibleVideoStyles(): Promise<VideoStyle[]>;
  getVideoStyle(id: number): Promise<VideoStyle | undefined>;
  createVideoStyle(style: InsertVideoStyle): Promise<VideoStyle>;
  updateVideoStyle(id: number, updates: Partial<InsertVideoStyle>, adminId: string): Promise<VideoStyle | undefined>;
  deleteVideoStyle(id: number, adminId: string): Promise<boolean>;
  toggleVideoStyleVisibility(id: number, isVisible: boolean, adminId: string): Promise<VideoStyle | undefined>;
  
  // Video model configurations for progress tracking
  getVideoModelConfigs(): Promise<VideoModelConfig[]>;
  getVideoModelConfig(modelId: string): Promise<VideoModelConfig | undefined>;
  createVideoModelConfig(config: InsertVideoModelConfig): Promise<VideoModelConfig>;
  updateVideoModelConfig(modelId: string, updates: Partial<InsertVideoModelConfig>, adminId: string): Promise<VideoModelConfig | undefined>;
  deleteVideoModelConfig(modelId: string, adminId: string): Promise<boolean>;
  
  // Subscription plans management
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  
  // User subscriptions management
  getUserSubscription(userId: string): Promise<(UserSubscription & { plan?: SubscriptionPlan }) | undefined>;
  getUserSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | undefined>;
  createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(idOrUserId: number | string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  cancelUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  
  // User credits management (legacy - single balance)
  getUserCredits(userId: string): Promise<UserCredits | undefined>;
  initializeUserCredits(userId: string, initialBalance: number): Promise<UserCredits>;
  deductCredits(userId: string, amount: number, description: string, metadata?: any): Promise<CreditTransaction | undefined>;
  addCredits(userId: string, amount: number, description: string, metadata?: any): Promise<CreditTransaction>;
  getUserCreditTransactions(userId: string, limit?: number, offset?: number): Promise<CreditTransaction[]>;
  
  // =============================================================================
  // NEW CREDIT LEDGER SYSTEM (with expiration and FEFO)
  // =============================================================================
  
  // Credit ledger operations
  getCreditLedgerEntries(userId: string): Promise<CreditLedgerEntry[]>;
  getUnexpiredCreditLedgerEntries(userId: string): Promise<CreditLedgerEntry[]>;
  createCreditLedgerEntry(entry: InsertCreditLedgerEntry): Promise<CreditLedgerEntry>;
  getAvailableCreditsFromLedger(userId: string): Promise<number>;
  deductCreditsFromLedger(userId: string, amount: number, reason: string, sourceId: string, metadata?: any): Promise<CreditLedgerEntry[]>;
  getCreditUsageHistory(userId: string, page: number, pageSize: number): Promise<{ entries: CreditLedgerEntry[], total: number, totalPointsConsumed: number }>;
  getExpiringCredits(userId: string): Promise<CreditLedgerEntry[]>;
  
  // User entitlements (comprehensive user status)
  getUserEntitlements(userId: string): Promise<UserEntitlements>;
  
  // Top-up packs management
  getTopupPacks(): Promise<TopupPack[]>;
  getActiveTopupPacks(): Promise<TopupPack[]>;
  getTopupPack(id: number): Promise<TopupPack | undefined>;
  createTopupPack(pack: InsertTopupPack): Promise<TopupPack>;
  updateTopupPack(id: number, updates: Partial<InsertTopupPack>): Promise<TopupPack | undefined>;
  deleteTopupPack(id: number, adminId: string): Promise<boolean>;
  
  // Top-up purchases
  createTopupPurchase(purchase: InsertTopupPurchase): Promise<TopupPurchase>;
  getTopupPurchase(id: number): Promise<TopupPurchase | undefined>;
  getUserTopupPurchases(userId: string): Promise<TopupPurchase[]>;
  getTopupPurchaseByStripeSessionId(sessionId: string): Promise<TopupPurchase | undefined>;
  
  // Coupons management
  getCoupons(): Promise<Coupon[]>;
  getActiveCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number, adminId: string): Promise<boolean>;
  incrementCouponRedemptionCount(couponId: number): Promise<void>;
  
  // Coupon redemptions
  createCouponRedemption(redemption: InsertCouponRedemption): Promise<CouponRedemption>;
  getUserCouponRedemptions(userId: string): Promise<CouponRedemption[]>;
  getCouponRedemptionsForCoupon(couponId: number): Promise<CouponRedemption[]>;
  hasUserRedeemedCoupon(userId: string, couponId: number): Promise<boolean>;
  getUserCouponRedemptionCount(userId: string, couponId: number): Promise<number>;
  
  // =============================================================================
  // END NEW CREDIT LEDGER SYSTEM
  // =============================================================================
  
  // Credit requests management
  createCreditRequest(request: InsertCreditRequest & { userId: string }): Promise<CreditRequest>;
  getCreditRequest(id: number): Promise<(CreditRequest & { user?: User }) | undefined>;
  getAllCreditRequests(status?: string): Promise<(CreditRequest & { user?: User })[]>;
  getUserCreditRequests(userId: string): Promise<CreditRequest[]>;
  getPendingCreditRequestsCount(): Promise<number>;
  processCreditRequest(id: number, adminId: string, status: 'approved' | 'rejected', approvedAmount?: number, adminNote?: string): Promise<CreditRequest | undefined>;
  
  // Pricing rules management
  getPricingRules(): Promise<PricingRule[]>;
  getActivePricingRules(): Promise<PricingRule[]>;
  getPricingRule(featureType: string, featureValue: string): Promise<PricingRule | undefined>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: number, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  deletePricingRule(id: number, adminId: string): Promise<boolean>;
  
  // Hero slides management
  getHeroSlides(): Promise<HeroSlide[]>;
  getAllHeroSlides(): Promise<HeroSlide[]>;
  getHeroSlide(id: number): Promise<HeroSlide | undefined>;
  createHeroSlide(slideData: InsertHeroSlide): Promise<HeroSlide>;
  updateHeroSlide(id: number, updates: Partial<Omit<InsertHeroSlide, 'updatedBy'>> & { updatedBy: string }): Promise<HeroSlide | undefined>;
  deleteHeroSlide(id: number, adminId: string): Promise<boolean>;
  toggleHeroSlideStatus(id: number, isActive: boolean, adminId: string): Promise<HeroSlide | undefined>;

  // Prompt template management
  getPromptTemplates(): Promise<PromptTemplate[]>;
  getActivePromptTemplates(): Promise<PromptTemplate[]>;
  getPromptTemplatesByType(type: string): Promise<PromptTemplate[]>;
  getPromptTemplate(id: number): Promise<PromptTemplate | undefined>;
  getPromptTemplateByName(name: string): Promise<PromptTemplate | undefined>;
  getBestPromptTemplate(type: string, modelId?: string): Promise<PromptTemplate | undefined>;
  createPromptTemplate(templateData: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: number, updates: Partial<Omit<InsertPromptTemplate, 'updatedBy'>> & { updatedBy: string }): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: number, adminId: string): Promise<boolean>;
  togglePromptTemplateStatus(id: number, isActive: boolean, adminId: string): Promise<PromptTemplate | undefined>;
  
  // Translation management
  getAllTranslations(): Promise<Translation[]>;
  getTranslationsByNamespace(namespace: string): Promise<Translation[]>;
  getTranslation(key: string, namespace?: string): Promise<Translation | undefined>;
  updateTranslation(key: string, arabic: string, namespace: string, adminId: string): Promise<Translation | undefined>;
  createTranslation(translation: InsertTranslation): Promise<Translation>;
  deleteTranslation(id: number, adminId: string): Promise<boolean>;
  bulkUpdateTranslations(translations: { key: string; arabic: string; namespace?: string }[], adminId: string): Promise<Translation[]>;
  
  // Image reference categories management
  getImageReferenceCategories(): Promise<ImageReferenceCategory[]>;
  getActiveImageReferenceCategories(): Promise<ImageReferenceCategory[]>;
  getImageReferenceCategory(id: number): Promise<ImageReferenceCategory | undefined>;
  getImageReferenceCategoryBySlug(slug: string): Promise<ImageReferenceCategory | undefined>;
  createImageReferenceCategory(categoryData: InsertImageReferenceCategory): Promise<ImageReferenceCategory>;
  updateImageReferenceCategory(id: number, updates: Partial<Omit<InsertImageReferenceCategory, 'createdBy' | 'updatedBy'>> & { updatedBy: string }): Promise<ImageReferenceCategory | undefined>;
  deleteImageReferenceCategory(id: number, adminId: string): Promise<boolean>;
  
  // Image reference images management
  getImageReferenceImages(categoryId: number): Promise<ImageReferenceImage[]>;
  getImageReferenceImage(id: number): Promise<ImageReferenceImage | undefined>;
  createImageReferenceImage(imageData: InsertImageReferenceImage): Promise<ImageReferenceImage>;
  deleteImageReferenceImage(id: number, adminId: string): Promise<boolean>;
  updateImageReferenceSortOrder(id: number, sortOrder: number): Promise<ImageReferenceImage | undefined>;
  
  // Random prompts management
  getAllRandomPrompts(): Promise<RandomPrompt[]>;
  getRandomPrompt(): Promise<RandomPrompt | undefined>;
  createRandomPrompts(prompts: string[]): Promise<void>;
  deleteAllRandomPrompts(): Promise<void>;
  getRandomPromptsCount(): Promise<number>;
  
  // Film Studio operations
  getFilmProjects(userId: string): Promise<FilmProject[]>;
  getFilmProject(id: number): Promise<FilmProject | undefined>;
  createFilmProject(project: InsertFilmProject & { ownerId: string }): Promise<FilmProject>;
  updateFilmProject(id: number, updates: Partial<InsertFilmProject>, userId: string): Promise<FilmProject | undefined>;
  deleteFilmProject(id: number, userId: string): Promise<boolean>;
  
  // Storyboard scenes operations
  getScenesByProject(projectId: number): Promise<StoryboardScene[]>;
  getScene(id: number): Promise<StoryboardScene | undefined>;
  createScene(scene: InsertStoryboardScene): Promise<StoryboardScene>;
  updateScene(id: number, updates: Partial<InsertStoryboardScene>): Promise<StoryboardScene | undefined>;
  deleteScene(id: number): Promise<boolean>;
  updateSceneSelection(id: number, selectedForFinal: boolean): Promise<StoryboardScene | undefined>;
  
  // Scene versions operations
  getSceneVersions(sceneId: number, versionType?: string): Promise<SceneVersion[]>;
  getActiveSceneVersion(sceneId: number, versionType: string): Promise<SceneVersion | undefined>;
  createSceneVersion(version: InsertSceneVersion): Promise<SceneVersion>;
  updateSceneVersion(id: number, updates: Partial<InsertSceneVersion>): Promise<SceneVersion | undefined>;
  setActiveSceneVersion(versionId: number, sceneId: number, versionType: string): Promise<SceneVersion | undefined>;
  deleteSceneVersion(id: number): Promise<boolean>;
  
  // Contact submissions management
  getAllContactSubmissions(status?: string): Promise<ContactSubmission[]>;
  getContactSubmission(id: number): Promise<ContactSubmission | undefined>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  updateContactSubmissionStatus(id: number, status: string, adminNote?: string): Promise<ContactSubmission | undefined>;
  deleteContactSubmission(id: number): Promise<boolean>;
  getUnreadContactSubmissionsCount(): Promise<number>;
  
  // Image generation jobs (queue management)
  createImageGenerationJob(job: InsertImageGenerationJob & { ownerId: string }): Promise<ImageGenerationJob>;
  getImageGenerationJob(jobId: string): Promise<ImageGenerationJob | undefined>;
  getUserImageGenerationJobs(userId: string, includeCompleted?: boolean): Promise<ImageGenerationJob[]>;
  getUserActiveImageJobs(userId: string): Promise<ImageGenerationJob[]>;
  getUserQueuedImageJobs(userId: string): Promise<ImageGenerationJob[]>;
  getUserRunningImageJobs(userId: string): Promise<ImageGenerationJob[]>;
  updateImageJobStatus(jobId: string, status: string, progress?: number, stage?: string): Promise<ImageGenerationJob | undefined>;
  startImageJob(jobId: string): Promise<ImageGenerationJob | undefined>;
  completeImageJob(jobId: string, resultImageId: number, resultUrl: string): Promise<ImageGenerationJob | undefined>;
  failImageJob(jobId: string, error: string): Promise<ImageGenerationJob | undefined>;
  cancelImageJob(jobId: string): Promise<ImageGenerationJob | undefined>;
  getNextQueuedImageJob(userId: string): Promise<ImageGenerationJob | undefined>;
  getGlobalQueuedJobsCount(): Promise<number>;
  getUserQueuedJobsCount(userId: string): Promise<number>;
  getUserRunningJobsCount(userId: string): Promise<number>;
  cleanupOldImageJobs(olderThanDays: number): Promise<number>;
  deleteImageGenerationJob(jobId: string): Promise<void>;
  cleanupStaleRunningJobs(timeoutMinutes?: number): Promise<number>;
  isJobStale(jobId: string, timeoutMinutes?: number): Promise<boolean>;
  
  // Homepage service cards management
  getHomepageServiceCards(): Promise<HomepageServiceCard[]>;
  getActiveHomepageServiceCards(): Promise<HomepageServiceCard[]>;
  getHomepageServiceCard(id: number): Promise<HomepageServiceCard | undefined>;
  createHomepageServiceCard(card: InsertHomepageServiceCard): Promise<HomepageServiceCard>;
  updateHomepageServiceCard(id: number, updates: Partial<InsertHomepageServiceCard>, adminId: string): Promise<HomepageServiceCard | undefined>;
  deleteHomepageServiceCard(id: number, adminId: string): Promise<boolean>;
  
  // Homepage promotion bar management
  getHomepagePromotionBar(): Promise<HomepagePromotionBar | undefined>;
  upsertHomepagePromotionBar(data: InsertHomepagePromotionBar): Promise<HomepagePromotionBar>;
  
  // Homepage featured items management
  getHomepageFeaturedItems(): Promise<(HomepageFeaturedItem & { imageUrl?: string; thumbnailUrl?: string; prompt?: string })[]>;
  addHomepageFeaturedItem(item: InsertHomepageFeaturedItem): Promise<HomepageFeaturedItem>;
  removeHomepageFeaturedItem(id: number, adminId: string): Promise<boolean>;
  updateHomepageFeaturedItemOrder(id: number, sortOrder: number): Promise<HomepageFeaturedItem | undefined>;
  
  // Homepage CTA management
  getHomepageCta(): Promise<HomepageCta | undefined>;
  upsertHomepageCta(data: InsertHomepageCta): Promise<HomepageCta>;
  
  // Public gallery curated items management
  getPublicGalleryItems(): Promise<(PublicGalleryItem & { imageUrl?: string; thumbnailUrl?: string | null; prompt?: string; width?: number; height?: number })[]>;
  getActivePublicGalleryItems(): Promise<(PublicGalleryItem & { imageUrl?: string; thumbnailUrl?: string | null; prompt?: string; width?: number; height?: number })[]>;
  getActivePublicGalleryItemsPaginated(cursor?: number, limit?: number): Promise<{
    items: (PublicGalleryItem & { type: 'image' | 'video'; url: string; thumbnailUrl?: string | null; width: number; height: number; ownerId: string; createdAt: string; isFeatured: boolean; isStickyTop: boolean })[];
    nextCursor: number | null;
    hasMore: boolean;
    totalCount: number;
  }>;
  addPublicGalleryItem(item: InsertPublicGalleryItem): Promise<PublicGalleryItem>;
  updatePublicGalleryItem(id: number, updates: Partial<InsertPublicGalleryItem>, adminId: string): Promise<PublicGalleryItem | undefined>;
  removePublicGalleryItem(id: number, adminId: string): Promise<boolean>;
  
  // User notifications management
  createNotification(notification: InsertUserNotification): Promise<UserNotification>;
  getUserNotifications(userId: string, limit?: number): Promise<UserNotification[]>;
  getUnreadNotificationsCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: number, userId: string): Promise<UserNotification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: number, userId: string): Promise<boolean>;
  getSubscriptionsNearingEnd(daysAhead: number): Promise<(UserSubscription & { plan?: SubscriptionPlan; user?: User })[]>;
  getUserNotificationByTypeAndData(userId: string, type: string, dataKey: string, dataValue: string): Promise<UserNotification | undefined>;

  // =============================================================================
  // PRICING PAGE CONFIGURATION
  // =============================================================================
  
  // Pricing page config (singleton)
  getPricingPageConfig(): Promise<PricingPageConfig | undefined>;
  upsertPricingPageConfig(config: Partial<InsertPricingPageConfig> & { updatedBy: string }): Promise<PricingPageConfig>;
  
  // Pricing FAQ items
  getPricingFaqItems(): Promise<PricingFaqItem[]>;
  getActivePricingFaqItems(): Promise<PricingFaqItem[]>;
  getPricingFaqItem(id: number): Promise<PricingFaqItem | undefined>;
  createPricingFaqItem(item: InsertPricingFaqItem): Promise<PricingFaqItem>;
  updatePricingFaqItem(id: number, updates: Partial<InsertPricingFaqItem>, adminId: string): Promise<PricingFaqItem | undefined>;
  deletePricingFaqItem(id: number, adminId: string): Promise<boolean>;
  
  // Pricing comparison sections
  getPricingComparisonSections(): Promise<PricingComparisonSection[]>;
  getActivePricingComparisonSections(): Promise<PricingComparisonSection[]>;
  getPricingComparisonSection(id: number): Promise<PricingComparisonSection | undefined>;
  createPricingComparisonSection(section: InsertPricingComparisonSection): Promise<PricingComparisonSection>;
  updatePricingComparisonSection(id: number, updates: Partial<InsertPricingComparisonSection>, adminId: string): Promise<PricingComparisonSection | undefined>;
  deletePricingComparisonSection(id: number, adminId: string): Promise<boolean>;
  
  // Pricing comparison rows
  getPricingComparisonRows(sectionId?: number): Promise<PricingComparisonRow[]>;
  getPricingComparisonRow(id: number): Promise<PricingComparisonRow | undefined>;
  createPricingComparisonRow(row: InsertPricingComparisonRow): Promise<PricingComparisonRow>;
  updatePricingComparisonRow(id: number, updates: Partial<InsertPricingComparisonRow>, adminId: string): Promise<PricingComparisonRow | undefined>;
  deletePricingComparisonRow(id: number, adminId: string): Promise<boolean>;
  
  // Pricing comparison cells
  getPricingComparisonCells(rowId?: number): Promise<PricingComparisonCell[]>;
  getPricingComparisonCell(rowId: number, planId: number): Promise<PricingComparisonCell | undefined>;
  upsertPricingComparisonCell(cell: InsertPricingComparisonCell): Promise<PricingComparisonCell>;
  deletePricingComparisonCell(id: number): Promise<boolean>;
  
  // Plan display overrides
  getPlanDisplayOverrides(): Promise<PlanDisplayOverride[]>;
  getPlanDisplayOverride(planId: number): Promise<PlanDisplayOverride | undefined>;
  upsertPlanDisplayOverride(override: InsertPlanDisplayOverride): Promise<PlanDisplayOverride>;
  deletePlanDisplayOverride(planId: number): Promise<boolean>;
  
  // Credit pack display overrides
  getCreditPackDisplayOverrides(): Promise<CreditPackDisplayOverride[]>;
  getCreditPackDisplayOverride(packId: number): Promise<CreditPackDisplayOverride | undefined>;
  upsertCreditPackDisplayOverride(override: InsertCreditPackDisplayOverride): Promise<CreditPackDisplayOverride>;
  deleteCreditPackDisplayOverride(packId: number): Promise<boolean>;
  
  // Upgrade reason mappings
  getUpgradeReasonMappings(): Promise<UpgradeReasonMapping[]>;
  getUpgradeReasonMapping(reasonKey: string): Promise<UpgradeReasonMapping | undefined>;
  upsertUpgradeReasonMapping(mapping: InsertUpgradeReasonMapping): Promise<UpgradeReasonMapping>;
  deleteUpgradeReasonMapping(reasonKey: string): Promise<boolean>;
  
  // Annual plan variants
  getAnnualPlanVariants(): Promise<AnnualPlanVariant[]>;
  getAnnualPlanVariant(monthlyPlanId: number): Promise<AnnualPlanVariant | undefined>;
  upsertAnnualPlanVariant(variant: InsertAnnualPlanVariant): Promise<AnnualPlanVariant>;
  deleteAnnualPlanVariant(monthlyPlanId: number): Promise<boolean>;
  
  // Full pricing page data (aggregated for frontend)
  getFullPricingPageData(): Promise<{
    config: PricingPageConfig | null;
    plans: (SubscriptionPlan & { displayOverride?: PlanDisplayOverride; annualVariant?: SubscriptionPlan })[];
    creditPacks: (TopupPack & { displayOverride?: CreditPackDisplayOverride })[];
    faqItems: PricingFaqItem[];
    comparisonSections: (PricingComparisonSection & { rows: (PricingComparisonRow & { cells: PricingComparisonCell[] })[] })[];
    upgradeReasonMappings: UpgradeReasonMapping[];
  }>;
  
  // Moderation logs operations
  createModerationLog(log: InsertModerationLog): Promise<ModerationLog>;
  getModerationLogs(filters?: { verdict?: string; userId?: string; limit?: number; offset?: number }): Promise<ModerationLog[]>;
  getModerationLogsCount(filters?: { verdict?: string; userId?: string }): Promise<number>;
  getModerationLog(id: number): Promise<ModerationLog | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE ai_styles SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE annual_plan_variants SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE coupons SET created_by = 'system' WHERE created_by = ${id}`);
      await tx.execute(sql`UPDATE credit_pack_display_overrides SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE credit_requests SET processed_by = NULL WHERE processed_by = ${id}`);
      await tx.execute(sql`UPDATE hero_slides SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE homepage_cta SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE homepage_featured_items SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE homepage_promotion_bar SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE homepage_service_cards SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE image_reference_categories SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE image_reference_categories SET created_by = 'system' WHERE created_by = ${id}`);
      await tx.execute(sql`UPDATE image_reference_images SET uploaded_by = 'system' WHERE uploaded_by = ${id}`);
      await tx.execute(sql`UPDATE image_reports SET resolved_by = NULL WHERE resolved_by = ${id}`);
      await tx.execute(sql`UPDATE plan_display_overrides SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_comparison_cells SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_comparison_rows SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_comparison_sections SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_faq_items SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_operations SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_page_config SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_rules SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE pricing_settings SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE prompt_templates SET created_by = 'system' WHERE created_by = ${id}`);
      await tx.execute(sql`UPDATE prompt_templates SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE public_gallery_items SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE site_settings SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE upgrade_reason_mappings SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE video_model_configs SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.execute(sql`UPDATE video_styles SET updated_by = 'system' WHERE updated_by = ${id}`);
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async migrateUserId(oldId: string, newId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE users SET email = NULL WHERE id = ${oldId}`);

      await tx.execute(sql`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, role, is_active, public_by_default, created_at, updated_at, free_generation_consent_at)
        SELECT ${newId}, NULL, first_name, last_name, profile_image_url, role, is_active, public_by_default, created_at, NOW(), free_generation_consent_at
        FROM users WHERE id = ${oldId}
      `);

      await tx.execute(sql`UPDATE admin_logs SET admin_id = ${newId} WHERE admin_id = ${oldId}`);
      await tx.execute(sql`UPDATE ai_styles SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE annual_plan_variants SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE coupon_redemptions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE coupons SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_ledger SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE credit_pack_display_overrides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_requests SET processed_by = ${newId} WHERE processed_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_requests SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE credit_transactions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE favorites SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE film_projects SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE hero_slides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_cta SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_featured_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_promotion_bar SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_service_cards SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_generation_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_categories SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_categories SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_images SET uploaded_by = ${newId} WHERE uploaded_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reports SET reporter_id = ${newId} WHERE reporter_id = ${oldId}`);
      await tx.execute(sql`UPDATE image_reports SET resolved_by = ${newId} WHERE resolved_by = ${oldId}`);
      await tx.execute(sql`UPDATE images SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE plan_display_overrides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_cells SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_rows SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_sections SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_faq_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_operations SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_page_config SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_rules SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_settings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE prompt_templates SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE prompt_templates SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE public_gallery_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE scene_versions SET image_id = NULL WHERE image_id IN (SELECT id FROM images WHERE owner_id = ${oldId})`);
      await tx.execute(sql`UPDATE site_settings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE topup_purchases SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE translations SET last_modified_by = ${newId} WHERE last_modified_by = ${oldId}`);
      await tx.execute(sql`UPDATE upgrade_reason_mappings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE upscale_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_credits SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_notifications SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_subscriptions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_favorites SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_model_configs SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE video_styles SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE videos SET owner_id = ${newId} WHERE owner_id = ${oldId}`);

      await tx.execute(sql`DELETE FROM users WHERE id = ${oldId}`);
    });
  }

  async updateUserIdByEmail(email: string, newId: string, updates: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<void> {
    await db.transaction(async (tx) => {
      const result = await tx.execute(sql`SELECT id FROM users WHERE email = ${email}`);
      const rows = result.rows as any[];
      if (!rows.length) return;
      const oldId = rows[0].id as string;
      if (oldId === newId) return;

      await tx.execute(sql`UPDATE users SET email = NULL WHERE id = ${oldId}`);

      await tx.execute(sql`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, role, is_active, public_by_default, created_at, updated_at, free_generation_consent_at)
        SELECT ${newId}, ${email}, first_name, last_name, profile_image_url, role, is_active, public_by_default, created_at, NOW(), free_generation_consent_at
        FROM users WHERE id = ${oldId}
      `);

      if (updates.firstName) await tx.execute(sql`UPDATE users SET first_name = ${updates.firstName} WHERE id = ${newId}`);
      if (updates.lastName) await tx.execute(sql`UPDATE users SET last_name = ${updates.lastName} WHERE id = ${newId}`);
      if (updates.profileImageUrl) await tx.execute(sql`UPDATE users SET profile_image_url = ${updates.profileImageUrl} WHERE id = ${newId}`);

      await tx.execute(sql`UPDATE admin_logs SET admin_id = ${newId} WHERE admin_id = ${oldId}`);
      await tx.execute(sql`UPDATE ai_styles SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE annual_plan_variants SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE coupon_redemptions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE coupons SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_ledger SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE credit_pack_display_overrides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_requests SET processed_by = ${newId} WHERE processed_by = ${oldId}`);
      await tx.execute(sql`UPDATE credit_requests SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE credit_transactions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE favorites SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE film_projects SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE hero_slides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_cta SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_featured_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_promotion_bar SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE homepage_service_cards SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_generation_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_categories SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_categories SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reference_images SET uploaded_by = ${newId} WHERE uploaded_by = ${oldId}`);
      await tx.execute(sql`UPDATE image_reports SET reporter_id = ${newId} WHERE reporter_id = ${oldId}`);
      await tx.execute(sql`UPDATE image_reports SET resolved_by = ${newId} WHERE resolved_by = ${oldId}`);
      await tx.execute(sql`UPDATE images SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE plan_display_overrides SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_cells SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_rows SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_comparison_sections SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_faq_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_operations SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_page_config SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_rules SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE pricing_settings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE prompt_templates SET created_by = ${newId} WHERE created_by = ${oldId}`);
      await tx.execute(sql`UPDATE prompt_templates SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE public_gallery_items SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE scene_versions SET image_id = NULL WHERE image_id IN (SELECT id FROM images WHERE owner_id = ${oldId})`);
      await tx.execute(sql`UPDATE site_settings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE topup_purchases SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE translations SET last_modified_by = ${newId} WHERE last_modified_by = ${oldId}`);
      await tx.execute(sql`UPDATE upgrade_reason_mappings SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE upscale_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_credits SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_notifications SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE user_subscriptions SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_favorites SET user_id = ${newId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_jobs SET owner_id = ${newId} WHERE owner_id = ${oldId}`);
      await tx.execute(sql`UPDATE video_model_configs SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE video_styles SET updated_by = ${newId} WHERE updated_by = ${oldId}`);
      await tx.execute(sql`UPDATE videos SET owner_id = ${newId} WHERE owner_id = ${oldId}`);

      await tx.execute(sql`DELETE FROM users WHERE id = ${oldId}`);
    });
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPublicDefault(userId: string, publicByDefault: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ publicByDefault, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserFreeGenerationConsent(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ freeGenerationConsentAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.profileImageUrl !== undefined) updateData.profileImageUrl = updates.profileImageUrl;
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getPublicImages(): Promise<Image[]> {
    return await db
      .select({
        id: images.id,
        ownerId: images.ownerId,
        prompt: images.prompt,
        url: images.url,
        thumbnailUrl: images.thumbnailUrl,
        width: images.width,
        height: images.height,
        style: images.style,
        model: images.model,
        quality: images.quality,
        isPublic: images.isPublic,
        tags: images.tags,
        negativePrompt: images.negativePrompt,
        seed: images.seed,
        steps: images.steps,
        cfgScale: images.cfgScale,
        aspectRatio: images.aspectRatio,
        provider: images.provider,
        styleImageUrl: images.styleImageUrl,
        imageStrength: images.imageStrength,
        jobId: images.jobId, // CRITICAL: Include jobId for progress card cleanup
        createdAt: images.createdAt,
      })
      .from(images)
      .where(
        and(
          eq(images.isPublic, true),
          notExists(
            db.select().from(sceneVersions).where(eq(sceneVersions.imageId, images.id))
          )
        )
      )
      .orderBy(desc(images.createdAt));
  }

  async getUserImages(userId: string): Promise<Image[]> {
    return await db
      .select({
        id: images.id,
        ownerId: images.ownerId,
        prompt: images.prompt,
        url: images.url,
        thumbnailUrl: images.thumbnailUrl,
        width: images.width,
        height: images.height,
        style: images.style,
        model: images.model,
        quality: images.quality,
        isPublic: images.isPublic,
        tags: images.tags,
        negativePrompt: images.negativePrompt,
        seed: images.seed,
        steps: images.steps,
        cfgScale: images.cfgScale,
        aspectRatio: images.aspectRatio,
        provider: images.provider,
        styleImageUrl: images.styleImageUrl,
        imageStrength: images.imageStrength,
        jobId: images.jobId, // CRITICAL: Include jobId for progress card cleanup
        createdAt: images.createdAt,
      })
      .from(images)
      .where(
        and(
          eq(images.ownerId, userId),
          notExists(
            db.select().from(sceneVersions).where(eq(sceneVersions.imageId, images.id))
          )
        )
      )
      .orderBy(desc(images.createdAt));
  }

  async getImage(id: number): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image;
  }

  async createImage(imageData: InsertImage & { url: string; ownerId: string; isPublic: boolean }): Promise<Image> {
    const [image] = await db
      .insert(images)
      .values({
        ownerId: imageData.ownerId,
        prompt: imageData.prompt,
        url: imageData.url,
        width: imageData.width || 1024,
        height: imageData.height || 1024,
        style: imageData.style || "photorealistic",
        model: imageData.model || "dall-e-3",
        quality: imageData.quality || "standard",
        isPublic: imageData.isPublic,
        tags: imageData.tags || [],
        negativePrompt: imageData.negativePrompt,
        seed: imageData.seed,
        steps: imageData.steps,
        cfgScale: imageData.cfgScale,
        aspectRatio: imageData.aspectRatio,
        provider: imageData.provider || "openai",
        styleImageUrl: imageData.styleImageUrl,
        imageStrength: imageData.imageStrength,
        jobId: imageData.jobId, // CRITICAL: Store jobId for progress card matching
      })
      .returning();
    return image;
  }

  async updateImageUrl(id: number, url: string, thumbnailUrl?: string | null): Promise<Image | undefined> {
    const updateData: { url: string; thumbnailUrl?: string | null } = { url };
    if (thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = thumbnailUrl;
    }
    const [image] = await db
      .update(images)
      .set(updateData)
      .where(eq(images.id, id))
      .returning();
    return image;
  }

  async updateImageVisibility(id: number, isPublic: boolean, userId: string): Promise<Image | undefined> {
    const [image] = await db
      .update(images)
      .set({ isPublic })
      .where(and(eq(images.id, id), eq(images.ownerId, userId)))
      .returning();
    return image;
  }

  async setAllUserImagesPrivate(userId: string): Promise<void> {
    await db
      .update(images)
      .set({ isPublic: false })
      .where(eq(images.ownerId, userId));
  }

  // Video operations
  async getPublicVideos(): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(and(eq(videos.isPublic, true), sql`${videos.status} != 'failed'`))
      .orderBy(desc(videos.createdAt));
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(and(eq(videos.ownerId, userId), sql`${videos.status} != 'failed'`))
      .orderBy(desc(videos.createdAt));
  }

  async createVideo(videoData: InsertVideo & { url: string; ownerId: string; isPublic: boolean; replicateId?: string; jobId?: string }): Promise<Video> {
    const [video] = await db
      .insert(videos)
      .values({
        ownerId: videoData.ownerId,
        prompt: videoData.prompt,
        url: videoData.url,
        duration: videoData.duration || 5,
        width: videoData.width || 540,
        height: videoData.height || 960,
        aspectRatio: videoData.aspectRatio || "9:16",
        model: videoData.model || "luma-ray-flash-2-540p",
        provider: videoData.provider || "replicate",
        isPublic: videoData.isPublic,
        tags: videoData.tags || [],
        startFrameUrl: videoData.startFrameUrl,
        endFrameUrl: videoData.endFrameUrl,
        frameRate: videoData.frameRate,
        loop: videoData.loop,
        status: "pending",
        replicateId: videoData.replicateId,
        jobId: videoData.jobId || null
      })
      .returning();
    return video;
  }

  async updateVideoUrl(id: number, url: string, thumbnailUrl?: string): Promise<Video | undefined> {
    const updateData: any = { url };
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    
    const [video] = await db
      .update(videos)
      .set(updateData)
      .where(eq(videos.id, id))
      .returning();
    return video;
  }

  async updateVideoStatus(id: number, status: string, replicateId?: string): Promise<Video | undefined> {
    const updateData: any = { status };
    if (replicateId) updateData.replicateId = replicateId;
    
    const [video] = await db
      .update(videos)
      .set(updateData)
      .where(eq(videos.id, id))
      .returning();
    return video;
  }

  async updateVideoProgress(id: number, progressData: { status?: string; progress?: number; stage?: string; etaSeconds?: number }): Promise<Video | undefined> {
    const updateData: any = {};
    if (progressData.status !== undefined) updateData.status = progressData.status;
    if (progressData.progress !== undefined) updateData.progress = progressData.progress;
    if (progressData.stage !== undefined) updateData.stage = progressData.stage;
    if (progressData.etaSeconds !== undefined) updateData.etaSeconds = progressData.etaSeconds;
    
    const [video] = await db
      .update(videos)
      .set(updateData)
      .where(eq(videos.id, id))
      .returning();
    return video;
  }

  async updateVideoVisibility(id: number, isPublic: boolean, userId: string): Promise<Video | undefined> {
    const [video] = await db
      .update(videos)
      .set({ isPublic })
      .where(and(eq(videos.id, id), eq(videos.ownerId, userId)))
      .returning();
    return video;
  }

  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, id))
      .limit(1);
    return video;
  }

  async getVideoByReplicateId(replicateId: string): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.replicateId, replicateId))
      .limit(1);
    return video;
  }

  async getVideosByJobId(jobId: string): Promise<Video[]> {
    const results = await db
      .select()
      .from(videos)
      .where(eq(videos.jobId, jobId));
    return results;
  }

  async updateVideoByReplicateId(replicateId: string, updates: { url?: string; status?: string; thumbnailUrl?: string; width?: number; height?: number; frameRate?: number }): Promise<Video | undefined> {
    console.log(`Updating video by replicateId ${replicateId}:`, updates);
    const [video] = await db
      .update(videos)
      .set(updates)
      .where(eq(videos.replicateId, replicateId))
      .returning();
    console.log(`Updated video result:`, video);
    return video;
  }

  async deleteVideo(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(videos).where(and(eq(videos.id, id), eq(videos.ownerId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async setAllUserVideosPrivate(userId: string): Promise<void> {
    await db
      .update(videos)
      .set({ isPublic: false })
      .where(eq(videos.ownerId, userId));
  }

  // Video Job operations (job-based video generation system)
  async createVideoJob(job: Omit<InsertVideoJob, 'createdAt' | 'updatedAt'> & { ownerId: string }): Promise<VideoJob> {
    const [videoJob] = await db
      .insert(videoJobs)
      .values({
        id: job.id || sql`gen_random_uuid()`,
        ...job,
      })
      .returning();
    return videoJob;
  }

  async getVideoJob(jobId: string): Promise<VideoJob | undefined> {
    const [videoJob] = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.id, jobId))
      .limit(1);
    return videoJob;
  }

  async getUserVideoJobs(userId: string): Promise<VideoJob[]> {
    return await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.ownerId, userId))
      .orderBy(desc(videoJobs.createdAt));
  }

  async updateVideoJobStatus(jobId: string, state: string, progress?: number, stage?: string): Promise<VideoJob | undefined> {
    const updateData: any = { state, updatedAt: sql`now()` };
    if (progress !== undefined) updateData.progress = progress;
    if (stage !== undefined) updateData.stage = stage;
    
    const [videoJob] = await db
      .update(videoJobs)
      .set(updateData)
      .where(eq(videoJobs.id, jobId))
      .returning();
    return videoJob;
  }

  async updateVideoJobProvider(jobId: string, providerId: string): Promise<VideoJob | undefined> {
    const [videoJob] = await db
      .update(videoJobs)
      .set({ providerId, updatedAt: sql`now()` })
      .where(eq(videoJobs.id, jobId))
      .returning();
    return videoJob;
  }

  async completeVideoJob(jobId: string, assetUrl: string, thumbnailUrl?: string): Promise<VideoJob | undefined> {
    const updateData: any = { 
      state: 'completed', 
      progress: 100,
      stage: 'Completed',
      assetUrl,
      updatedAt: sql`now()`
    };
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    
    const [videoJob] = await db
      .update(videoJobs)
      .set(updateData)
      .where(eq(videoJobs.id, jobId))
      .returning();
    return videoJob;
  }

  async failVideoJob(jobId: string, error: string): Promise<VideoJob | undefined> {
    const [videoJob] = await db
      .update(videoJobs)
      .set({ 
        state: 'failed', 
        error,
        updatedAt: sql`now()`
      })
      .where(eq(videoJobs.id, jobId))
      .returning();
    
    // Auto-refund credits for failed job
    if (videoJob) {
      const { autoRefundService } = await import("./services/auto-refund-service");
      await autoRefundService.refundVideoJob(jobId, 'failed');
    }
    
    return videoJob;
  }

  async cancelVideoJob(jobId: string): Promise<VideoJob | undefined> {
    const [videoJob] = await db
      .update(videoJobs)
      .set({ 
        state: 'canceled',
        updatedAt: sql`now()`
      })
      .where(eq(videoJobs.id, jobId))
      .returning();
    
    // Auto-refund credits for cancelled job
    if (videoJob) {
      const { autoRefundService } = await import("./services/auto-refund-service");
      await autoRefundService.refundVideoJob(jobId, 'cancelled');
    }
    
    return videoJob;
  }

  async getActiveVideoJobs(userId: string): Promise<VideoJob[]> {
    return await db
      .select()
      .from(videoJobs)
      .where(and(
        eq(videoJobs.ownerId, userId),
        inArray(videoJobs.state, ['queued', 'starting', 'processing'])
      ))
      .orderBy(desc(videoJobs.createdAt));
  }

  async cleanupOldVideoJobs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
      .delete(videoJobs)
      .where(and(
        gte(videoJobs.createdAt, cutoffDate),
        inArray(videoJobs.state, ['completed', 'failed', 'canceled'])
      ));
    
    return result.rowCount || 0;
  }

  // Failed generation cleanup methods
  async getFailedVideos(userId?: string): Promise<Video[]> {
    const conditions = [eq(videos.status, "failed")];
    if (userId) {
      conditions.push(eq(videos.ownerId, userId));
    }
    
    return await db
      .select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(desc(videos.createdAt));
  }

  async deleteFailedVideos(userId?: string): Promise<number> {
    const conditions = [eq(videos.status, "failed")];
    if (userId) {
      conditions.push(eq(videos.ownerId, userId));
    }
    
    const result = await db
      .delete(videos)
      .where(and(...conditions));
    
    return result.rowCount || 0;
  }

  async refundCreditsForFailedVideo(videoId: number): Promise<boolean> {
    try {
      // Get the video details first
      const video = await this.getVideo(videoId);
      if (!video || video.status !== "failed") {
        return false;
      }

      // Find the credit transaction for this video
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, video.ownerId),
          eq(creditTransactions.type, "generation"),
          sql`${creditTransactions.metadata}->>'videoId' = ${videoId.toString()}`
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(1);

      if (transactions.length === 0) {
        console.log(`No credit transaction found for failed video ${videoId}`);
        return false;
      }

      const originalTransaction = transactions[0];
      const refundAmount = Math.abs(originalTransaction.amount);

      // Add refund credits
      await this.addCredits(
        video.ownerId,
        refundAmount,
        `Refund for failed video generation (Video ID: ${videoId})`,
        {
          originalVideoId: videoId,
          originalTransactionId: originalTransaction.id,
          refundReason: "video_generation_failed"
        }
      );

      console.log(`Refunded ${refundAmount} credits for failed video ${videoId} to user ${video.ownerId}`);
      return true;
    } catch (error) {
      console.error(`Error refunding credits for video ${videoId}:`, error);
      return false;
    }
  }

  async toggleFavorite(userId: string, imageId: number): Promise<boolean> {
    const existingFavorite = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.imageId, imageId)));

    if (existingFavorite.length > 0) {
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.imageId, imageId)));
      return false;
    } else {
      await db
        .insert(favorites)
        .values({ userId, imageId });
      return true;
    }
  }

  async getUserFavorites(userId: string): Promise<Image[]> {
    return await db
      .select({
        id: images.id,
        ownerId: images.ownerId,
        prompt: images.prompt,
        url: images.url,
        thumbnailUrl: images.thumbnailUrl,
        width: images.width,
        height: images.height,
        style: images.style,
        model: images.model,
        quality: images.quality,
        isPublic: images.isPublic,
        tags: images.tags,
        negativePrompt: images.negativePrompt,
        seed: images.seed,
        steps: images.steps,
        cfgScale: images.cfgScale,
        aspectRatio: images.aspectRatio,
        provider: images.provider,
        styleImageUrl: images.styleImageUrl,
        imageStrength: images.imageStrength,
        jobId: images.jobId,
        createdAt: images.createdAt,
      })
      .from(images)
      .innerJoin(favorites, eq(favorites.imageId, images.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
  }

  async isImageFavorited(userId: string, imageId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.imageId, imageId)));
    return result.length > 0;
  }

  async getBulkFavoriteStatus(userId: string, imageIds: number[]): Promise<Record<number, boolean>> {
    if (imageIds.length === 0) return {};
    
    const result = await db
      .select({ imageId: favorites.imageId })
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        inArray(favorites.imageId, imageIds)
      ));
    
    const favoritedIds = new Set(result.map(r => r.imageId));
    const statusMap: Record<number, boolean> = {};
    
    for (const imageId of imageIds) {
      statusMap[imageId] = favoritedIds.has(imageId);
    }
    
    return statusMap;
  }

  // Video favorites operations
  async toggleVideoFavorite(userId: string, videoId: number): Promise<boolean> {
    const existingFavorite = await db
      .select()
      .from(videoFavorites)
      .where(and(eq(videoFavorites.userId, userId), eq(videoFavorites.videoId, videoId)));

    if (existingFavorite.length > 0) {
      await db
        .delete(videoFavorites)
        .where(and(eq(videoFavorites.userId, userId), eq(videoFavorites.videoId, videoId)));
      return false;
    } else {
      await db
        .insert(videoFavorites)
        .values({ userId, videoId });
      return true;
    }
  }

  async getUserVideoFavorites(userId: string): Promise<Video[]> {
    return await db
      .select({
        id: videos.id,
        ownerId: videos.ownerId,
        prompt: videos.prompt,
        url: videos.url,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        width: videos.width,
        height: videos.height,
        aspectRatio: videos.aspectRatio,
        model: videos.model,
        provider: videos.provider,
        style: videos.style,
        isPublic: videos.isPublic,
        tags: videos.tags,
        startFrameUrl: videos.startFrameUrl,
        endFrameUrl: videos.endFrameUrl,
        frameRate: videos.frameRate,
        loop: videos.loop,
        audioEnabled: videos.audioEnabled,
        jobId: videos.jobId,
        replicateId: videos.replicateId,
        status: videos.status,
        progress: videos.progress,
        stage: videos.stage,
        etaSeconds: videos.etaSeconds,
        createdAt: videos.createdAt,
      })
      .from(videos)
      .innerJoin(videoFavorites, eq(videoFavorites.videoId, videos.id))
      .where(and(eq(videoFavorites.userId, userId), sql`${videos.status} != 'failed'`))
      .orderBy(desc(videoFavorites.createdAt));
  }

  async isVideoFavorited(userId: string, videoId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(videoFavorites)
      .where(and(eq(videoFavorites.userId, userId), eq(videoFavorites.videoId, videoId)));
    return result.length > 0;
  }

  async getBulkVideoFavoriteStatus(userId: string, videoIds: number[]): Promise<Record<number, boolean>> {
    if (videoIds.length === 0) return {};
    
    const result = await db
      .select({ videoId: videoFavorites.videoId })
      .from(videoFavorites)
      .where(and(
        eq(videoFavorites.userId, userId),
        inArray(videoFavorites.videoId, videoIds)
      ));
    
    const favoritedIds = new Set(result.map(r => r.videoId));
    const statusMap: Record<number, boolean> = {};
    
    for (const videoId of videoIds) {
      statusMap[videoId] = favoritedIds.has(videoId);
    }
    
    return statusMap;
  }

  async getUserHistory(
    userId: string,
    filters: {
      search?: string;
      type?: 'all' | 'image' | 'video' | 'upscaled';
      favoritesOnly?: boolean;
      sort?: 'newest' | 'oldest';
    }
  ): Promise<Array<(Image & { type: 'image'; isFavorited: boolean }) | (Video & { type: 'video'; isFavorited: boolean })>> {
    const { search, type = 'all', favoritesOnly = false, sort = 'newest' } = filters;
    
    let userImages: (Image & { type: 'image'; isFavorited: boolean })[] = [];
    let userVideos: (Video & { type: 'video'; isFavorited: boolean })[] = [];

    // Fetch images if needed (all, image, or upscaled)
    if (type === 'all' || type === 'image' || type === 'upscaled') {
      const imageQuery = db
        .select({
          id: images.id,
          ownerId: images.ownerId,
          prompt: images.prompt,
          url: images.url,
          thumbnailUrl: images.thumbnailUrl,
          width: images.width,
          height: images.height,
          style: images.style,
          model: images.model,
          quality: images.quality,
          isPublic: images.isPublic,
          tags: images.tags,
          negativePrompt: images.negativePrompt,
          seed: images.seed,
          steps: images.steps,
          cfgScale: images.cfgScale,
          aspectRatio: images.aspectRatio,
          provider: images.provider,
          styleImageUrl: images.styleImageUrl,
          imageStrength: images.imageStrength,
          jobId: images.jobId,
          createdAt: images.createdAt,
          isFavorited: sql<boolean>`EXISTS(
            SELECT 1 FROM ${favorites} 
            WHERE ${favorites.userId} = ${userId} 
            AND ${favorites.imageId} = ${images.id}
          )`.as('isFavorited')
        })
        .from(images);

      // Apply favorites filter
      if (favoritesOnly) {
        imageQuery
          .innerJoin(favorites, and(
            eq(favorites.imageId, images.id),
            eq(favorites.userId, userId)
          ))
          .where(eq(images.ownerId, userId));
      } else {
        imageQuery.where(eq(images.ownerId, userId));
      }

      const fetchedImages = await imageQuery;
      
      // Apply search and upscaled filter on client side
      userImages = fetchedImages
        .filter(img => {
          // Filter for upscaled images only if type is 'upscaled'
          if (type === 'upscaled') {
            const isUpscaled = img.style === 'upscaled' || (img.tags && img.tags.includes('upscaled'));
            if (!isUpscaled) return false;
          }
          
          if (!search) return true;
          const searchLower = search.toLowerCase();
          return (
            img.prompt.toLowerCase().includes(searchLower) ||
            (img.tags && img.tags.some(tag => tag.toLowerCase().includes(searchLower)))
          );
        })
        .map(img => ({ ...img, type: 'image' as const }));
    }

    // Fetch videos if needed
    if (type === 'all' || type === 'video') {
      const videoQuery = db
        .select({
          id: videos.id,
          ownerId: videos.ownerId,
          prompt: videos.prompt,
          url: videos.url,
          thumbnailUrl: videos.thumbnailUrl,
          duration: videos.duration,
          width: videos.width,
          height: videos.height,
          aspectRatio: videos.aspectRatio,
          model: videos.model,
          provider: videos.provider,
          style: videos.style,
          isPublic: videos.isPublic,
          tags: videos.tags,
          startFrameUrl: videos.startFrameUrl,
          endFrameUrl: videos.endFrameUrl,
          frameRate: videos.frameRate,
          loop: videos.loop,
          audioEnabled: videos.audioEnabled,
          jobId: videos.jobId,
          replicateId: videos.replicateId,
          status: videos.status,
          progress: videos.progress,
          stage: videos.stage,
          etaSeconds: videos.etaSeconds,
          createdAt: videos.createdAt,
          isFavorited: sql<boolean>`EXISTS(
            SELECT 1 FROM ${videoFavorites} 
            WHERE ${videoFavorites.userId} = ${userId} 
            AND ${videoFavorites.videoId} = ${videos.id}
          )`.as('isFavorited')
        })
        .from(videos);

      // Apply favorites filter
      if (favoritesOnly) {
        videoQuery
          .innerJoin(videoFavorites, and(
            eq(videoFavorites.videoId, videos.id),
            eq(videoFavorites.userId, userId)
          ))
          .where(eq(videos.ownerId, userId));
      } else {
        videoQuery.where(eq(videos.ownerId, userId));
      }

      const fetchedVideos = await videoQuery;
      
      // Apply search filter on client side
      userVideos = fetchedVideos
        .filter(video => {
          if (!search) return true;
          const searchLower = search.toLowerCase();
          return (
            video.prompt.toLowerCase().includes(searchLower) ||
            (video.tags && video.tags.some(tag => tag.toLowerCase().includes(searchLower)))
          );
        })
        .map(video => ({ ...video, type: 'video' as const }));
    }

    // Combine and sort
    const combined = [...userImages, ...userVideos];
    
    return combined.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }

  async deleteImage(id: number, userId: string): Promise<boolean> {
    // Get the image first to check if it's a stored image
    const [image] = await db.select().from(images).where(and(eq(images.id, id), eq(images.ownerId, userId)));
    
    if (!image) {
      return false;
    }
    
    // First, clear the resultImageId reference in any generation jobs that point to this image
    await db.update(imageGenerationJobs)
      .set({ resultImageId: null })
      .where(eq(imageGenerationJobs.resultImageId, id));
    
    const result = await db.delete(images).where(and(eq(images.id, id), eq(images.ownerId, userId)));
    
    // Clean up stored image file if it exists
    if ((result.rowCount || 0) > 0 && image?.url?.startsWith('/images/')) {
      const { deleteStoredImage } = await import('./image-storage');
      deleteStoredImage(image.url);
    }
    
    return (result.rowCount || 0) > 0;
  }

  // Admin operations
  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }

  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0].count;
  }

  async getAllImages(limit = 50, offset = 0, search = ''): Promise<(Image & { ownerName?: string })[]> {
    let query = db
      .select({
        image: images,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerEmail: users.email,
      })
      .from(images)
      .leftJoin(users, eq(images.ownerId, users.id));

    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      query = query.where(
        or(
          sql`LOWER(${images.prompt}) LIKE ${searchTerm}`,
          sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
          sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
          sql`LOWER(${users.email}) LIKE ${searchTerm}`
        )
      ) as typeof query;
    }

    const result = await query
      .orderBy(desc(images.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      ...row.image,
      ownerName: row.ownerFirstName && row.ownerLastName 
        ? `${row.ownerFirstName} ${row.ownerLastName}` 
        : row.ownerFirstName || row.ownerEmail?.split('@')[0] || 'Unknown User'
    }));
  }

  async getImagesCount(search = ''): Promise<number> {
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      const result = await db
        .select({ count: count() })
        .from(images)
        .leftJoin(users, eq(images.ownerId, users.id))
        .where(
          or(
            sql`LOWER(${images.prompt}) LIKE ${searchTerm}`,
            sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
            sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
            sql`LOWER(${users.email}) LIKE ${searchTerm}`
          )
        );
      return result[0].count;
    }
    const result = await db.select({ count: count() }).from(images);
    return result[0].count;
  }

  async getImagesByOwner(ownerId: string): Promise<Image[]> {
    return await db.select().from(images).where(eq(images.ownerId, ownerId)).orderBy(desc(images.createdAt));
  }

  async updateUserRole(userId: string, role: "user" | "admin", adminId: string): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (updatedUser) {
        await this.createAdminLog({
          adminId,
          action: role === "admin" ? "promote_user" : "demote_user",
          targetType: "user",
          targetId: userId,
          details: { newRole: role }
        });
      }

      return updatedUser;
    } catch (error) {
      console.error("Error updating user role:", error);
      return undefined;
    }
  }

  async updateUserActiveStatus(userId: string, isActive: boolean, adminId: string): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (updatedUser) {
        await this.createAdminLog({
          adminId,
          action: isActive ? "reactivate_user" : "suspend_user",
          targetType: "user",
          targetId: userId,
          details: { isActive }
        });
      }

      return updatedUser;
    } catch (error) {
      console.error("Error updating user active status:", error);
      return undefined;
    }
  }

  async adminDeleteUser(userId: string, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, userId)).returning();
      
      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_user",
          targetType: "user",
          targetId: userId,
          details: { deletedUser: result[0] }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async adminDeleteImage(imageId: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(images).where(eq(images.id, imageId)).returning();
      
      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_image",
          targetType: "image",
          targetId: imageId.toString(),
          details: { deletedImage: result[0] }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting image:", error);
      return false;
    }
  }

  async adminUpdateImageVisibility(imageId: number, isPublic: boolean, adminId: string): Promise<Image | undefined> {
    try {
      const [updatedImage] = await db
        .update(images)
        .set({ isPublic })
        .where(eq(images.id, imageId))
        .returning();

      if (updatedImage) {
        await this.createAdminLog({
          adminId,
          action: "toggle_image_visibility",
          targetType: "image",
          targetId: imageId.toString(),
          details: { isPublic }
        });
      }

      return updatedImage;
    } catch (error) {
      console.error("Error updating image visibility:", error);
      return undefined;
    }
  }

  async transferImageOwnership(imageId: number, newOwnerId: string, adminId: string): Promise<Image | undefined> {
    try {
      const [updatedImage] = await db
        .update(images)
        .set({ ownerId: newOwnerId })
        .where(eq(images.id, imageId))
        .returning();

      if (updatedImage) {
        await this.createAdminLog({
          adminId,
          action: "transfer_image_ownership",
          targetType: "image",
          targetId: imageId.toString(),
          details: { newOwnerId }
        });
      }

      return updatedImage;
    } catch (error) {
      console.error("Error transferring image ownership:", error);
      return undefined;
    }
  }

  async getAllVideos(limit = 50, offset = 0, search = ''): Promise<(Video & { ownerName?: string })[]> {
    try {
      let query = db
        .select({
          video: videos,
          ownerFirstName: users.firstName,
          ownerLastName: users.lastName,
          ownerEmail: users.email
        })
        .from(videos)
        .leftJoin(users, eq(videos.ownerId, users.id));

      if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        query = query.where(
          or(
            sql`LOWER(${videos.prompt}) LIKE ${searchTerm}`,
            sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
            sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
            sql`LOWER(${users.email}) LIKE ${searchTerm}`
          )
        ) as typeof query;
      }

      const result = await query
        .orderBy(desc(videos.createdAt))
        .limit(limit)
        .offset(offset);

      return result.map(row => ({
        ...row.video,
        ownerName: row.ownerFirstName && row.ownerLastName 
          ? `${row.ownerFirstName} ${row.ownerLastName}` 
          : row.ownerFirstName || row.ownerEmail?.split('@')[0] || 'Unknown User'
      }));
    } catch (error) {
      console.error("Error fetching all videos:", error);
      return [];
    }
  }

  async getVideosCount(search = ''): Promise<number> {
    try {
      if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        const result = await db
          .select({ count: count() })
          .from(videos)
          .leftJoin(users, eq(videos.ownerId, users.id))
          .where(
            or(
              sql`LOWER(${videos.prompt}) LIKE ${searchTerm}`,
              sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
              sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
              sql`LOWER(${users.email}) LIKE ${searchTerm}`
            )
          );
        return result[0].count;
      }
      const [result] = await db.select({ count: count() }).from(videos);
      return result.count;
    } catch (error) {
      console.error("Error counting videos:", error);
      return 0;
    }
  }

  async adminDeleteVideo(videoId: number, adminId: string): Promise<boolean> {
    try {
      const video = await this.getVideo(videoId);
      if (video) {
        await db.delete(videos).where(eq(videos.id, videoId));
        await this.createAdminLog({
          adminId,
          action: "delete_video",
          targetType: "video",
          targetId: videoId.toString(),
          details: { 
            prompt: video.prompt.substring(0, 100),
            ownerId: video.ownerId
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting video:", error);
      return false;
    }
  }

  async adminUpdateVideoVisibility(videoId: number, isPublic: boolean, adminId: string): Promise<Video | undefined> {
    try {
      const [updatedVideo] = await db
        .update(videos)
        .set({ isPublic })
        .where(eq(videos.id, videoId))
        .returning();

      if (updatedVideo) {
        await this.createAdminLog({
          adminId,
          action: "toggle_video_visibility",
          targetType: "video",
          targetId: videoId.toString(),
          details: { isPublic }
        });
      }

      return updatedVideo;
    } catch (error) {
      console.error("Error updating video visibility:", error);
      return undefined;
    }
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalImages: number;
    totalVideos: number;
    publicImages: number;
    privateImages: number;
    publicVideos: number;
    privateVideos: number;
    dailyGenerations: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [userCount] = await db.select({ count: count() }).from(users);
    const [imageCount] = await db.select({ count: count() }).from(images);
    const [videoCount] = await db.select({ count: count() }).from(videos);
    const [publicImageCount] = await db.select({ count: count() }).from(images).where(eq(images.isPublic, true));
    const [privateImageCount] = await db.select({ count: count() }).from(images).where(eq(images.isPublic, false));
    const [publicVideoCount] = await db.select({ count: count() }).from(videos).where(eq(videos.isPublic, true));
    const [privateVideoCount] = await db.select({ count: count() }).from(videos).where(eq(videos.isPublic, false));
    const [dailyCount] = await db.select({ count: count() }).from(images).where(gte(images.createdAt, today));

    return {
      totalUsers: userCount.count,
      totalImages: imageCount.count,
      totalVideos: videoCount.count,
      publicImages: publicImageCount.count,
      privateImages: privateImageCount.count,
      publicVideos: publicVideoCount.count,
      privateVideos: privateVideoCount.count,
      dailyGenerations: dailyCount.count,
    };
  }

  // Admin logs
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const [adminLog] = await db.insert(adminLogs).values(log).returning();
    return adminLog;
  }

  async getAdminLogs(limit = 100, offset = 0): Promise<(AdminLog & { adminName?: string })[]> {
    const result = await db
      .select({
        log: adminLogs,
        adminFirstName: users.firstName,
        adminLastName: users.lastName,
      })
      .from(adminLogs)
      .leftJoin(users, eq(adminLogs.adminId, users.id))
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      ...row.log,
      adminName: row.adminFirstName && row.adminLastName 
        ? `${row.adminFirstName} ${row.adminLastName}` 
        : row.adminFirstName || 'Unknown Admin'
    }));
  }

  // Site settings
  async getSiteSettings(): Promise<SiteSetting[]> {
    return await db.select().from(siteSettings).orderBy(siteSettings.category, siteSettings.key);
  }

  async getSiteSettingsByCategory(category: string): Promise<SiteSetting[]> {
    return await db.select().from(siteSettings).where(eq(siteSettings.category, category)).orderBy(siteSettings.key);
  }

  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return setting;
  }

  async setSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting> {
    const existing = await this.getSiteSetting(setting.key);
    
    if (existing) {
      const [updatedSetting] = await db
        .update(siteSettings)
        .set({
          value: setting.value,
          category: setting.category,
          description: setting.description,
          updatedBy: setting.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.key, setting.key))
        .returning();
      return updatedSetting;
    } else {
      const [newSetting] = await db.insert(siteSettings).values(setting).onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: setting.value,
          category: setting.category,
          description: setting.description,
          updatedBy: setting.updatedBy,
          updatedAt: new Date(),
        },
      }).returning();
      return newSetting;
    }
  }

  async updateSiteSetting(key: string, value: any, adminId: string): Promise<SiteSetting | undefined> {
    try {
      const [updatedSetting] = await db
        .update(siteSettings)
        .set({
          value,
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.key, key))
        .returning();

      if (updatedSetting) {
        await this.createAdminLog({
          adminId,
          action: "update_site_setting",
          targetType: "setting",
          targetId: key,
          details: { newValue: value }
        });
      }

      return updatedSetting;
    } catch (error) {
      console.error("Error updating site setting:", error);
      return undefined;
    }
  }

  async deleteSiteSetting(key: string, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(siteSettings).where(eq(siteSettings.key, key)).returning();
      
      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_site_setting",
          targetType: "setting",
          targetId: key,
          details: { deletedSetting: result[0] }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting site setting:", error);
      return false;
    }
  }

  // Image reports implementation
  async createImageReport(report: InsertImageReport): Promise<ImageReport> {
    const [newReport] = await db.insert(imageReports)
      .values(report)
      .returning();
    return newReport;
  }

  async getImageReports(limit = 50, offset = 0): Promise<(ImageReport & { reporterName?: string; imageThumbnail?: string })[]> {
    const reports = await db.select({
      id: imageReports.id,
      reporterId: imageReports.reporterId,
      imageId: imageReports.imageId,
      reason: imageReports.reason,
      description: imageReports.description,
      status: imageReports.status,
      resolvedBy: imageReports.resolvedBy,
      resolvedAt: imageReports.resolvedAt,
      createdAt: imageReports.createdAt,
      reporterName: users.firstName,
      imageThumbnail: images.url
    })
    .from(imageReports)
    .leftJoin(users, eq(imageReports.reporterId, users.id))
    .leftJoin(images, eq(imageReports.imageId, images.id))
    .orderBy(desc(imageReports.createdAt))
    .limit(limit)
    .offset(offset);

    return reports.map(report => ({
      ...report,
      reporterName: report.reporterName || 'Unknown User',
      imageThumbnail: report.imageThumbnail || undefined
    }));
  }

  async updateReportStatus(reportId: number, status: "dismissed" | "resolved", adminId: string): Promise<ImageReport | undefined> {
    const [updatedReport] = await db.update(imageReports)
      .set({ 
        status, 
        resolvedBy: adminId, 
        resolvedAt: new Date() 
      })
      .where(eq(imageReports.id, reportId))
      .returning();

    if (updatedReport) {
      await this.createAdminLog({
        adminId,
        action: "update_report_status",
        targetType: "report",
        targetId: reportId.toString(),
        details: { status, reportId }
      });
    }

    return updatedReport;
  }

  async deleteReport(reportId: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(imageReports)
        .where(eq(imageReports.id, reportId))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_report",
          targetType: "report",
          targetId: reportId.toString(),
          details: { reportId }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting report:", error);
      return false;
    }
  }

  // AI styles implementation
  async getAiStyles(): Promise<AiStyle[]> {
    return await db.select().from(aiStyles).orderBy(aiStyles.sortOrder, aiStyles.name);
  }

  async getVisibleAiStyles(): Promise<AiStyle[]> {
    return await db.select().from(aiStyles)
      .where(eq(aiStyles.isVisible, true))
      .orderBy(aiStyles.sortOrder, aiStyles.name);
  }

  async getAiStyle(id: number): Promise<AiStyle | undefined> {
    const [style] = await db.select().from(aiStyles).where(eq(aiStyles.id, id));
    return style;
  }

  async createAiStyle(style: InsertAiStyle): Promise<AiStyle> {
    const [newStyle] = await db.insert(aiStyles)
      .values(style)
      .returning();
    return newStyle;
  }

  async updateAiStyle(id: number, updates: Partial<InsertAiStyle>, adminId: string): Promise<AiStyle | undefined> {
    const [updatedStyle] = await db.update(aiStyles)
      .set({ ...updates, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(aiStyles.id, id))
      .returning();

    if (updatedStyle) {
      await this.createAdminLog({
        adminId,
        action: "update_ai_style",
        targetType: "style",
        targetId: id.toString(),
        details: { styleId: id, updates }
      });
    }

    return updatedStyle;
  }

  async deleteAiStyle(id: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(aiStyles)
        .where(eq(aiStyles.id, id))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_ai_style",
          targetType: "style",
          targetId: id.toString(),
          details: { styleId: id }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting AI style:", error);
      return false;
    }
  }

  async toggleAiStyleVisibility(id: number, isVisible: boolean, adminId: string): Promise<AiStyle | undefined> {
    const [updatedStyle] = await db.update(aiStyles)
      .set({ isVisible, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(aiStyles.id, id))
      .returning();

    if (updatedStyle) {
      await this.createAdminLog({
        adminId,
        action: "toggle_style_visibility",
        targetType: "style",
        targetId: id.toString(),
        details: { styleId: id, isVisible }
      });
    }

    return updatedStyle;
  }

  // Video styles implementation
  async getVideoStyles(): Promise<VideoStyle[]> {
    return await db.select().from(videoStyles).orderBy(videoStyles.sortOrder, videoStyles.name);
  }

  async getVisibleVideoStyles(): Promise<VideoStyle[]> {
    return await db.select().from(videoStyles)
      .where(eq(videoStyles.isVisible, true))
      .orderBy(videoStyles.sortOrder, videoStyles.name);
  }

  async getVideoStyle(id: number): Promise<VideoStyle | undefined> {
    const [style] = await db.select().from(videoStyles).where(eq(videoStyles.id, id));
    return style;
  }

  async createVideoStyle(style: InsertVideoStyle): Promise<VideoStyle> {
    const [newStyle] = await db.insert(videoStyles)
      .values(style)
      .returning();
    return newStyle;
  }

  async updateVideoStyle(id: number, updates: Partial<InsertVideoStyle>, adminId: string): Promise<VideoStyle | undefined> {
    const [updatedStyle] = await db.update(videoStyles)
      .set({ ...updates, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(videoStyles.id, id))
      .returning();

    if (updatedStyle) {
      await this.createAdminLog({
        adminId,
        action: "update_video_style",
        targetType: "video_style",
        targetId: id.toString(),
        details: { styleId: id, updates }
      });
    }

    return updatedStyle;
  }

  async deleteVideoStyle(id: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(videoStyles)
        .where(eq(videoStyles.id, id))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_video_style",
          targetType: "video_style",
          targetId: id.toString(),
          details: { styleId: id }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting video style:", error);
      return false;
    }
  }

  async toggleVideoStyleVisibility(id: number, isVisible: boolean, adminId: string): Promise<VideoStyle | undefined> {
    const [updatedStyle] = await db.update(videoStyles)
      .set({ isVisible, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(videoStyles.id, id))
      .returning();

    if (updatedStyle) {
      await this.createAdminLog({
        adminId,
        action: "toggle_video_style_visibility",
        targetType: "video_style",
        targetId: id.toString(),
        details: { styleId: id, isVisible }
      });
    }

    return updatedStyle;
  }

  // Video model configurations implementation
  async getVideoModelConfigs(): Promise<VideoModelConfig[]> {
    return await db.select().from(videoModelConfigs).orderBy(videoModelConfigs.modelId);
  }

  async getVideoModelConfig(modelId: string): Promise<VideoModelConfig | undefined> {
    const [config] = await db.select().from(videoModelConfigs).where(eq(videoModelConfigs.modelId, modelId));
    return config;
  }

  async createVideoModelConfig(config: InsertVideoModelConfig): Promise<VideoModelConfig> {
    const [newConfig] = await db.insert(videoModelConfigs)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateVideoModelConfig(modelId: string, updates: Partial<InsertVideoModelConfig>, adminId: string): Promise<VideoModelConfig | undefined> {
    const [updatedConfig] = await db.update(videoModelConfigs)
      .set({ ...updates, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(videoModelConfigs.modelId, modelId))
      .returning();

    if (updatedConfig) {
      await this.createAdminLog({
        adminId,
        action: "update_video_model_config",
        targetType: "video_model_config",
        targetId: modelId,
        details: { modelId, updates }
      });
    }

    return updatedConfig;
  }

  async deleteVideoModelConfig(modelId: string, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(videoModelConfigs)
        .where(eq(videoModelConfigs.modelId, modelId))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_video_model_config",
          targetType: "video_model_config",
          targetId: modelId,
          details: { modelId }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting video model config:", error);
      return false;
    }
  }

  // Hero slides implementation
  async getHeroSlides(): Promise<HeroSlide[]> {
    return await db.select().from(heroSlides)
      .where(eq(heroSlides.isActive, true))
      .orderBy(heroSlides.sortOrder, heroSlides.id);
  }

  async getAllHeroSlides(): Promise<HeroSlide[]> {
    return await db.select().from(heroSlides)
      .orderBy(heroSlides.sortOrder, heroSlides.id);
  }

  async getHeroSlide(id: number): Promise<HeroSlide | undefined> {
    const [slide] = await db.select().from(heroSlides).where(eq(heroSlides.id, id));
    return slide;
  }

  async createHeroSlide(slideData: InsertHeroSlide): Promise<HeroSlide> {
    const [newSlide] = await db.insert(heroSlides).values(slideData).returning();
    
    await this.createAdminLog({
      adminId: slideData.updatedBy,
      action: "create_hero_slide",
      targetType: "hero_slide",
      targetId: newSlide.id.toString(),
      details: { title: slideData.title, subtitle: slideData.subtitle }
    });

    return newSlide;
  }

  async updateHeroSlide(id: number, updates: Partial<Omit<InsertHeroSlide, 'updatedBy'>> & { updatedBy: string }): Promise<HeroSlide | undefined> {
    const [updatedSlide] = await db.update(heroSlides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(heroSlides.id, id))
      .returning();

    if (updatedSlide) {
      await this.createAdminLog({
        adminId: updates.updatedBy,
        action: "update_hero_slide",
        targetType: "hero_slide",
        targetId: id.toString(),
        details: { slideId: id, updates }
      });
    }

    return updatedSlide;
  }

  async deleteHeroSlide(id: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(heroSlides)
        .where(eq(heroSlides.id, id))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_hero_slide",
          targetType: "hero_slide",
          targetId: id.toString(),
          details: { slideId: id }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting hero slide:", error);
      return false;
    }
  }

  async toggleHeroSlideStatus(id: number, isActive: boolean, adminId: string): Promise<HeroSlide | undefined> {
    const [updatedSlide] = await db.update(heroSlides)
      .set({ isActive, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(heroSlides.id, id))
      .returning();

    if (updatedSlide) {
      await this.createAdminLog({
        adminId,
        action: "toggle_hero_slide_status",
        targetType: "hero_slide",
        targetId: id.toString(),
        details: { slideId: id, isActive }
      });
    }

    return updatedSlide;
  }

  // Subscription plans implementation
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: number, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updatedPlan] = await db.update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updatedPlan;
  }

  // User subscriptions implementation
  async getUserSubscription(userId: string): Promise<(UserSubscription & { plan?: SubscriptionPlan }) | undefined> {
    const results = await db.select({
      subscription: userSubscriptions,
      plan: subscriptionPlans
    })
    .from(userSubscriptions)
    .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active")
    ));
    
    if (results.length === 0) return undefined;
    
    const { subscription, plan } = results[0];
    return { ...subscription, plan: plan || undefined };
  }

  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const [newSubscription] = await db.insert(userSubscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getUserSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return subscription;
  }

  async updateUserSubscription(idOrUserId: number | string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    const condition = typeof idOrUserId === 'number' 
      ? eq(userSubscriptions.id, idOrUserId)
      : and(
          eq(userSubscriptions.userId, idOrUserId),
          eq(userSubscriptions.status, "active")
        );
    const [updatedSubscription] = await db.update(userSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(condition)
      .returning();
    return updatedSubscription;
  }

  async cancelUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [cancelledSubscription] = await db.update(userSubscriptions)
      .set({ 
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active")
      ))
      .returning();
    return cancelledSubscription;
  }

  // User credits implementation
  async getUserCredits(userId: string): Promise<UserCredits | undefined> {
    const [credits] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
    return credits;
  }

  async initializeUserCredits(userId: string, initialBalance: number): Promise<UserCredits> {
    const [credits] = await db.insert(userCredits)
      .values({
        userId,
        balance: initialBalance,
        lifetimeEarned: initialBalance,
        lifetimeSpent: 0
      })
      .onConflictDoNothing()
      .returning();
    
    if (!credits) {
      // User already has credits initialized
      const [existingCredits] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
      return existingCredits;
    }
    
    // Record the initial credit transaction
    await db.insert(creditTransactions).values({
      userId,
      amount: initialBalance,
      balance: initialBalance,
      type: "signup_bonus",
      description: "Welcome bonus credits"
    });
    
    return credits;
  }

  async deductCredits(userId: string, amount: number, description: string, metadata?: any): Promise<CreditTransaction | undefined> {
    // Use a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get current balance with lock
      const [currentCredits] = await tx.select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .for("update");
      
      if (!currentCredits || currentCredits.balance < amount) {
        return undefined; // Insufficient balance
      }
      
      const newBalance = currentCredits.balance - amount;
      
      // Update the balance
      await tx.update(userCredits)
        .set({
          balance: newBalance,
          lifetimeSpent: currentCredits.lifetimeSpent + amount,
          updatedAt: new Date()
        })
        .where(eq(userCredits.userId, userId));
      
      // Extract cost snapshot from metadata if present
      const { costSnapshot, ...otherMetadata } = metadata || {};
      
      // Record the transaction with cost snapshot in dedicated column
      const [transaction] = await tx.insert(creditTransactions)
        .values({
          userId,
          amount: -amount, // Negative for deduction
          balance: newBalance,
          type: "generation",
          description,
          metadata: otherMetadata,
          costSnapshot: costSnapshot || null
        })
        .returning();
      
      return transaction;
    });
  }

  async addCredits(userId: string, amount: number, description: string, metadata?: any): Promise<CreditTransaction> {
    return await db.transaction(async (tx) => {
      // Get current balance or initialize if not exists
      let [currentCredits] = await tx.select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .for("update");
      
      if (!currentCredits) {
        // Initialize credits if not exists
        [currentCredits] = await tx.insert(userCredits)
          .values({
            userId,
            balance: 0,
            lifetimeEarned: 0,
            lifetimeSpent: 0
          })
          .returning();
      }
      
      const newBalance = currentCredits.balance + amount;
      
      // Update the balance
      await tx.update(userCredits)
        .set({
          balance: newBalance,
          lifetimeEarned: currentCredits.lifetimeEarned + amount,
          updatedAt: new Date()
        })
        .where(eq(userCredits.userId, userId));
      
      // Record the transaction
      const [transaction] = await tx.insert(creditTransactions)
        .values({
          userId,
          amount,
          balance: newBalance,
          type: metadata?.type || "admin_adjustment",
          description,
          metadata
        })
        .returning();
      
      return transaction;
    });
  }

  async getUserCreditTransactions(userId: string, limit = 50, offset = 0): Promise<CreditTransaction[]> {
    return await db.select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // =============================================================================
  // NEW CREDIT LEDGER SYSTEM IMPLEMENTATION
  // =============================================================================

  async getCreditLedgerEntries(userId: string): Promise<CreditLedgerEntry[]> {
    return await db.select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(desc(creditLedger.createdAt));
  }

  async getUnexpiredCreditLedgerEntries(userId: string): Promise<CreditLedgerEntry[]> {
    const now = new Date();
    return await db.select()
      .from(creditLedger)
      .where(and(
        eq(creditLedger.userId, userId),
        or(
          sql`${creditLedger.expiresAt} IS NULL`,
          gte(creditLedger.expiresAt, now)
        )
      ))
      .orderBy(creditLedger.expiresAt); // FEFO: earliest expiring first
  }

  async createCreditLedgerEntry(entry: InsertCreditLedgerEntry): Promise<CreditLedgerEntry> {
    const [newEntry] = await db.insert(creditLedger).values(entry).returning();
    return newEntry;
  }

  async getAvailableCreditsFromLedger(userId: string): Promise<number> {
    const now = new Date();
    
    // First, check if this user has any ledger entries at all
    const ledgerEntries = await db.select({ id: creditLedger.id })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .limit(1);
    
    // If no ledger entries exist, check for legacy credits and migrate them
    if (ledgerEntries.length === 0) {
      const legacyCredits = await this.getUserCredits(userId);
      if (legacyCredits && legacyCredits.balance > 0) {
        // Check if migration entry already exists (in case of race condition)
        const existingMigration = await db.select()
          .from(creditLedger)
          .where(and(
            eq(creditLedger.userId, userId),
            eq(creditLedger.sourceId, `legacy_migration_${userId}`)
          ))
          .limit(1);
        
        if (existingMigration.length === 0) {
          // Migrate legacy credits to ledger automatically
          // Use a transaction with conflict handling to prevent race conditions
          try {
            const result = await db.insert(creditLedger).values({
              userId,
              sourceType: "admin_grant",
              sourceId: `legacy_migration_${userId}`,
              amount: legacyCredits.balance,
              expiresAt: null, // Legacy credits don't expire
              description: "Migrated from legacy credit system"
            }).onConflictDoNothing().returning();
            
            if (result.length > 0) {
              console.log(`[Storage] Auto-migrated ${legacyCredits.balance} legacy credits for user ${userId}`);
            }
          } catch (error) {
            // If migration fails for any other reason, just log and continue
            console.error(`[Storage] Failed to auto-migrate legacy credits for user ${userId}:`, error);
          }
        }
      }
    }
    
    // Now calculate available credits from ledger
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${creditLedger.amount}), 0)::integer`
    })
      .from(creditLedger)
      .where(and(
        eq(creditLedger.userId, userId),
        or(
          sql`${creditLedger.expiresAt} IS NULL`,
          gte(creditLedger.expiresAt, now)
        )
      ));
    return result[0]?.total || 0;
  }

  async deductCreditsFromLedger(
    userId: string, 
    amount: number, 
    reason: string, 
    sourceId: string, 
    metadata?: any
  ): Promise<CreditLedgerEntry[]> {
    return await db.transaction(async (tx) => {
      const now = new Date();
      
      // Get unexpired credit entries ordered by expiration (FEFO)
      const creditEntries = await tx.select()
        .from(creditLedger)
        .where(and(
          eq(creditLedger.userId, userId),
          sql`${creditLedger.amount} > 0`, // Only positive entries (grants)
          or(
            sql`${creditLedger.expiresAt} IS NULL`,
            gte(creditLedger.expiresAt, now)
          )
        ))
        .orderBy(creditLedger.expiresAt) // FEFO: earliest expiring first
        .for("update");
      
      // Calculate available credits by summing grants and deductions
      const totalAvailable = await this.getAvailableCreditsFromLedger(userId);
      
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Required: ${amount}, Available: ${totalAvailable}`);
      }
      
      // Create deduction entries using FEFO
      const deductionEntries: CreditLedgerEntry[] = [];
      let remainingToDeduct = amount;
      
      for (const entry of creditEntries) {
        if (remainingToDeduct <= 0) break;
        
        // Calculate how much can be deducted from this entry
        // For now, we create a single deduction entry that references multiple sources
        // This is simpler than tracking per-source deductions
      }
      
      // Create a single deduction entry for the full amount
      const [deductionEntry] = await tx.insert(creditLedger)
        .values({
          userId,
          sourceType: "usage_deduction",
          sourceId,
          amount: -amount,
          expiresAt: null, // Deductions don't expire
          description: reason,
          metadata
        })
        .returning();
      
      deductionEntries.push(deductionEntry);
      
      return deductionEntries;
    });
  }

  async getCreditUsageHistory(userId: string, page: number, pageSize: number): Promise<{ entries: CreditLedgerEntry[], total: number, totalPointsConsumed: number }> {
    const offset = (page - 1) * pageSize;
    
    // Get total count and sum of usage deductions (amounts are negative, so we sum absolute values)
    const statsResult = await db.select({
      count: sql<number>`count(*)::integer`,
      totalPoints: sql<number>`COALESCE(SUM(ABS(${creditLedger.amount})), 0)::integer`
    })
      .from(creditLedger)
      .where(and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.sourceType, 'usage_deduction')
      ));
    
    const total = statsResult[0]?.count || 0;
    const totalPointsConsumed = statsResult[0]?.totalPoints || 0;
    
    // Get paginated entries
    const entries = await db.select()
      .from(creditLedger)
      .where(and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.sourceType, 'usage_deduction')
      ))
      .orderBy(desc(creditLedger.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return { entries, total, totalPointsConsumed };
  }

  async getExpiringCredits(userId: string): Promise<CreditLedgerEntry[]> {
    const now = new Date();
    // Get all unexpired entries with expiration dates and calculate remaining amounts
    const entries = await db.select()
      .from(creditLedger)
      .where(and(
        eq(creditLedger.userId, userId),
        sql`${creditLedger.expiresAt} IS NOT NULL`,
        gte(creditLedger.expiresAt, now)
      ))
      .orderBy(creditLedger.expiresAt); // Earliest expiring first
    
    // Filter to only entries with positive amounts (grants, not deductions)
    // and that have remaining value
    return entries.filter(entry => entry.amount > 0);
  }

  async getUserEntitlements(userId: string): Promise<UserEntitlements> {
    // Check if user is an admin - admins get super plan with all features
    const user = await this.getUser(userId);
    if (user?.role === "admin") {
      // Admin super plan - unlimited access to everything
      const adminFeatureFlags: FeatureFlags = {
        image_generation: true,
        video_generation: true,
        film_studio: true,
        can_make_private: true
      };
      
      return {
        userId,
        subscription: null,
        plan: {
          id: -1,
          name: "Admin",
          displayName: "Admin Super Plan",
          description: "Unlimited admin access",
          isActive: true,
          isFree: false,
          billingPeriodMonths: 0,
          priceCents: 0,
          currency: "usd",
          includedCredits: 999999,
          creditExpiryPolicy: "never_expires",
          featureFlags: adminFeatureFlags,
          stripePriceId: null,
          stripeProductId: null,
          annualPriceCents: null,
          annualStripePriceId: null,
          sortOrder: -1,
          createdAt: new Date(),
          updatedAt: new Date(),
          monthlyPrice: 0,
          creditsPerMonth: 999999,
          features: {}
        },
        featureFlags: adminFeatureFlags,
        currentPeriodEnd: null,
        availableCredits: 999999,
        creditBreakdown: {
          subscriptionCredits: 999999,
          topupCredits: 0,
          otherCredits: 0
        }
      };
    }
    
    // Get user's active subscription with plan
    const subscription = await this.getUserSubscription(userId);
    let plan = subscription?.plan || null;
    
    // If no subscription, get the Free Trial plan as default for all users
    if (!plan) {
      const freePlan = await this.getSubscriptionPlanByName("Free Trial");
      if (freePlan) {
        plan = freePlan;
      }
    }
    
    // Default feature flags (used as fallback if Free Trial plan doesn't exist)
    const defaultFlags: FeatureFlags = {
      image_generation: true,
      video_generation: true,  // Allow video generation by default for free users
      film_studio: false,
      can_make_private: false
    };
    
    // Get feature flags from plan or use defaults
    const featureFlags: FeatureFlags = plan?.featureFlags 
      ? { ...defaultFlags, ...(plan.featureFlags as Partial<FeatureFlags>) }
      : defaultFlags;
    
    // Get current period end from subscription
    const currentPeriodEnd = subscription?.currentPeriodEnd || null;
    
    // Get available credits from ledger
    const availableCredits = await this.getAvailableCreditsFromLedger(userId);
    
    // Calculate credit breakdown
    const now = new Date();
    const ledgerEntries = await this.getUnexpiredCreditLedgerEntries(userId);
    
    let subscriptionCredits = 0;
    let topupCredits = 0;
    let otherCredits = 0;
    
    for (const entry of ledgerEntries) {
      if (entry.amount > 0) {
        switch (entry.sourceType) {
          case "subscription_grant":
            subscriptionCredits += entry.amount;
            break;
          case "topup_purchase":
            topupCredits += entry.amount;
            break;
          default:
            otherCredits += entry.amount;
        }
      } else {
        // Distribute deductions proportionally (simplified: deduct from other first, then topup, then subscription)
        const deduction = Math.abs(entry.amount);
        if (otherCredits >= deduction) {
          otherCredits -= deduction;
        } else if (topupCredits >= deduction - otherCredits) {
          topupCredits -= (deduction - otherCredits);
          otherCredits = 0;
        } else {
          subscriptionCredits -= (deduction - otherCredits - topupCredits);
          otherCredits = 0;
          topupCredits = 0;
        }
      }
    }
    
    return {
      userId,
      subscription: subscription ? { 
        ...subscription, 
        plan: undefined // Don't include nested plan to avoid circular reference
      } as UserSubscription : null,
      plan,
      featureFlags,
      currentPeriodEnd,
      availableCredits,
      creditBreakdown: {
        subscriptionCredits: Math.max(0, subscriptionCredits),
        topupCredits: Math.max(0, topupCredits),
        otherCredits: Math.max(0, otherCredits)
      }
    };
  }

  // Top-up packs implementation
  async getTopupPacks(): Promise<TopupPack[]> {
    return await db.select().from(topupPacks).orderBy(topupPacks.sortOrder);
  }

  async getActiveTopupPacks(): Promise<TopupPack[]> {
    return await db.select()
      .from(topupPacks)
      .where(eq(topupPacks.isActive, true))
      .orderBy(topupPacks.sortOrder);
  }

  async getTopupPack(id: number): Promise<TopupPack | undefined> {
    const [pack] = await db.select().from(topupPacks).where(eq(topupPacks.id, id));
    return pack;
  }

  async createTopupPack(pack: InsertTopupPack): Promise<TopupPack> {
    const [newPack] = await db.insert(topupPacks).values(pack).returning();
    return newPack;
  }

  async updateTopupPack(id: number, updates: Partial<InsertTopupPack>): Promise<TopupPack | undefined> {
    const [updatedPack] = await db.update(topupPacks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(topupPacks.id, id))
      .returning();
    return updatedPack;
  }

  async deleteTopupPack(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(topupPacks).where(eq(topupPacks.id, id));
    await this.createAdminLog({
      adminId,
      action: "delete_topup_pack",
      targetType: "topup_pack",
      targetId: id.toString(),
      details: { packId: id }
    });
    return true;
  }

  // Top-up purchases implementation
  async createTopupPurchase(purchase: InsertTopupPurchase): Promise<TopupPurchase> {
    const [newPurchase] = await db.insert(topupPurchases).values(purchase).returning();
    return newPurchase;
  }

  async getTopupPurchase(id: number): Promise<TopupPurchase | undefined> {
    const [purchase] = await db.select().from(topupPurchases).where(eq(topupPurchases.id, id));
    return purchase;
  }

  async getUserTopupPurchases(userId: string): Promise<TopupPurchase[]> {
    return await db.select()
      .from(topupPurchases)
      .where(eq(topupPurchases.userId, userId))
      .orderBy(desc(topupPurchases.createdAt));
  }

  async getTopupPurchaseByStripeSessionId(sessionId: string): Promise<TopupPurchase | undefined> {
    const [purchase] = await db.select()
      .from(topupPurchases)
      .where(eq(topupPurchases.stripeSessionId, sessionId));
    return purchase;
  }

  // Coupons implementation
  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    const now = new Date();
    return await db.select()
      .from(coupons)
      .where(and(
        eq(coupons.isActive, true),
        or(
          sql`${coupons.expiresAt} IS NULL`,
          gte(coupons.expiresAt, now)
        )
      ))
      .orderBy(desc(coupons.createdAt));
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await db.insert(coupons)
      .values({ ...coupon, code: coupon.code.toUpperCase() })
      .returning();
    return newCoupon;
  }

  async updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    if (updates.code) {
      updateData.code = updates.code.toUpperCase();
    }
    const [updatedCoupon] = await db.update(coupons)
      .set(updateData)
      .where(eq(coupons.id, id))
      .returning();
    return updatedCoupon;
  }

  async deleteCoupon(id: number, adminId: string): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    await this.createAdminLog({
      adminId,
      action: "delete_coupon",
      targetType: "coupon",
      targetId: id.toString(),
      details: { couponId: id }
    });
    return true;
  }

  async incrementCouponRedemptionCount(couponId: number): Promise<void> {
    await db.update(coupons)
      .set({ 
        redemptionCount: sql`${coupons.redemptionCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(coupons.id, couponId));
  }

  // Coupon redemptions implementation
  async createCouponRedemption(redemption: InsertCouponRedemption): Promise<CouponRedemption> {
    const [newRedemption] = await db.insert(couponRedemptions).values(redemption).returning();
    // Increment the redemption count
    await this.incrementCouponRedemptionCount(redemption.couponId);
    return newRedemption;
  }

  async getUserCouponRedemptions(userId: string): Promise<CouponRedemption[]> {
    return await db.select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.userId, userId))
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async getCouponRedemptionsForCoupon(couponId: number): Promise<CouponRedemption[]> {
    return await db.select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, couponId))
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async hasUserRedeemedCoupon(userId: string, couponId: number): Promise<boolean> {
    const [redemption] = await db.select()
      .from(couponRedemptions)
      .where(and(
        eq(couponRedemptions.userId, userId),
        eq(couponRedemptions.couponId, couponId)
      ))
      .limit(1);
    return !!redemption;
  }

  async getUserCouponRedemptionCount(userId: string, couponId: number): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(couponRedemptions)
      .where(and(
        eq(couponRedemptions.userId, userId),
        eq(couponRedemptions.couponId, couponId)
      ));
    return result.count;
  }

  // =============================================================================
  // END NEW CREDIT LEDGER SYSTEM IMPLEMENTATION
  // =============================================================================

  // Credit requests implementation
  async createCreditRequest(request: InsertCreditRequest & { userId: string }): Promise<CreditRequest> {
    const [newRequest] = await db.insert(creditRequests)
      .values({
        userId: request.userId,
        message: request.message,
        requestedAmount: request.requestedAmount,
      })
      .returning();
    return newRequest;
  }

  async getCreditRequest(id: number): Promise<(CreditRequest & { user?: User }) | undefined> {
    const [request] = await db.select({
      request: creditRequests,
      user: users,
    })
      .from(creditRequests)
      .leftJoin(users, eq(creditRequests.userId, users.id))
      .where(eq(creditRequests.id, id));
    
    if (!request) return undefined;
    
    return {
      ...request.request,
      user: request.user || undefined,
    };
  }

  async getAllCreditRequests(status?: string): Promise<(CreditRequest & { user?: User })[]> {
    const query = db.select({
      request: creditRequests,
      user: users,
    })
      .from(creditRequests)
      .leftJoin(users, eq(creditRequests.userId, users.id))
      .orderBy(desc(creditRequests.createdAt));
    
    const results = status 
      ? await query.where(eq(creditRequests.status, status))
      : await query;
    
    return results.map(r => ({
      ...r.request,
      user: r.user || undefined,
    }));
  }

  async getUserCreditRequests(userId: string): Promise<CreditRequest[]> {
    return await db.select()
      .from(creditRequests)
      .where(eq(creditRequests.userId, userId))
      .orderBy(desc(creditRequests.createdAt));
  }

  async getPendingCreditRequestsCount(): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(creditRequests)
      .where(eq(creditRequests.status, "pending"));
    return result.count;
  }

  async processCreditRequest(
    id: number, 
    adminId: string, 
    status: 'approved' | 'rejected', 
    approvedAmount?: number, 
    adminNote?: string
  ): Promise<CreditRequest | undefined> {
    return await db.transaction(async (tx) => {
      // Get the request with user info
      const [requestData] = await tx.select({
        request: creditRequests,
        user: users,
      })
        .from(creditRequests)
        .leftJoin(users, eq(creditRequests.userId, users.id))
        .where(eq(creditRequests.id, id));
      
      if (!requestData || requestData.request.status !== 'pending') {
        return undefined;
      }
      
      const request = requestData.request;
      let creditTransactionId: number | null = null;
      
      // If approved, add credits to user account
      if (status === 'approved' && approvedAmount && approvedAmount > 0) {
        const transaction = await this.addCredits(
          request.userId,
          approvedAmount,
          `Credit request approved - Request #${id}`,
          { type: 'credit_request_approval', requestId: id }
        );
        creditTransactionId = transaction.id;
      }
      
      // Update the request status
      const [updatedRequest] = await tx.update(creditRequests)
        .set({
          status,
          approvedAmount: status === 'approved' ? approvedAmount : null,
          creditTransactionId,
          adminNote,
          processedBy: adminId,
          processedAt: new Date(),
        })
        .where(eq(creditRequests.id, id))
        .returning();
      
      return updatedRequest;
    });
  }

  // Pricing rules implementation
  async getPricingRules(): Promise<PricingRule[]> {
    return await db.select().from(pricingRules).orderBy(desc(pricingRules.priority));
  }

  async getAllPricingRules(): Promise<PricingRule[]> {
    return await db.select().from(pricingRules).orderBy(desc(pricingRules.priority));
  }

  async searchUsers(query: string): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(ilike(users.email, `%${query}%`))
      .limit(20);
  }

  async getActivePricingRules(): Promise<PricingRule[]> {
    return await db.select()
      .from(pricingRules)
      .where(eq(pricingRules.isActive, true))
      .orderBy(desc(pricingRules.priority));
  }

  async getPricingRule(featureType: string, featureValue: string): Promise<PricingRule | undefined> {
    const [rule] = await db.select()
      .from(pricingRules)
      .where(and(
        eq(pricingRules.featureType, featureType),
        eq(pricingRules.featureValue, featureValue),
        eq(pricingRules.isActive, true)
      ))
      .orderBy(desc(pricingRules.priority))
      .limit(1);
    return rule;
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const [newRule] = await db.insert(pricingRules).values(rule).returning();
    return newRule;
  }

  async updatePricingRule(id: number, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const [updatedRule] = await db.update(pricingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingRules.id, id))
      .returning();
    return updatedRule;
  }

  async deletePricingRule(id: number, adminId: string): Promise<boolean> {
    try {
      const result = await db.delete(pricingRules)
        .where(eq(pricingRules.id, id))
        .returning();
      
      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_pricing_rule",
          targetType: "pricing_rule",
          targetId: id.toString(),
          details: { deletedRule: result[0] }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting pricing rule:", error);
      return false;
    }
  }

  // Pricing settings management
  async getAllPricingSettings(): Promise<PricingSetting[]> {
    return await db.select().from(pricingSettings);
  }

  async getPricingSetting(key: string): Promise<PricingSetting | undefined> {
    const [setting] = await db.select().from(pricingSettings)
      .where(eq(pricingSettings.key, key));
    return setting;
  }

  async upsertPricingSetting(setting: InsertPricingSetting): Promise<PricingSetting> {
    const [result] = await db.insert(pricingSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: pricingSettings.key,
        set: { 
          value: setting.value, 
          updatedAt: new Date(),
          updatedBy: setting.updatedBy 
        }
      })
      .returning();
    return result;
  }

  // Pricing operations catalog management
  async getAllPricingOperations(): Promise<PricingOperation[]> {
    return await db.select().from(pricingOperations)
      .orderBy(pricingOperations.category, pricingOperations.displayName);
  }

  async getActivePricingOperations(): Promise<PricingOperation[]> {
    return await db.select().from(pricingOperations)
      .where(eq(pricingOperations.isActive, true))
      .orderBy(pricingOperations.category, pricingOperations.displayName);
  }

  async getPricingOperation(operationId: string): Promise<PricingOperation | undefined> {
    const [operation] = await db.select().from(pricingOperations)
      .where(eq(pricingOperations.operationId, operationId));
    return operation;
  }

  async getPricingOperationsByCategory(category: string): Promise<PricingOperation[]> {
    return await db.select().from(pricingOperations)
      .where(and(
        eq(pricingOperations.category, category),
        eq(pricingOperations.isActive, true)
      ))
      .orderBy(pricingOperations.displayName);
  }

  async createPricingOperation(operation: InsertPricingOperation): Promise<PricingOperation> {
    const [newOp] = await db.insert(pricingOperations).values(operation).returning();
    return newOp;
  }

  async updatePricingOperation(id: number, updates: Partial<InsertPricingOperation>): Promise<PricingOperation | undefined> {
    const [updated] = await db.update(pricingOperations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingOperations.id, id))
      .returning();
    return updated;
  }

  async updatePricingOperationByOperationId(operationId: string, updates: Partial<InsertPricingOperation>): Promise<PricingOperation | undefined> {
    const [updated] = await db.update(pricingOperations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingOperations.operationId, operationId))
      .returning();
    return updated;
  }

  async deletePricingOperation(id: number): Promise<boolean> {
    try {
      await db.delete(pricingOperations)
        .where(eq(pricingOperations.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting pricing operation:", error);
      return false;
    }
  }

  async bulkUpdatePricingOperations(updates: Array<{ id: number; updates: Partial<InsertPricingOperation> }>): Promise<number> {
    let count = 0;
    for (const item of updates) {
      const result = await this.updatePricingOperation(item.id, item.updates);
      if (result) count++;
    }
    return count;
  }

  // Raw SQL query for admin operations (use with caution - always use parameterized queries)
  async rawQuery(query: string, params: any[] = []): Promise<any[]> {
    try {
      // Use parameterized query to prevent SQL injection
      // Replace $1, $2, etc. with sql placeholders for proper parameterization
      let sqlQuery = sql.raw(query);
      if (params.length > 0) {
        // Build parameterized query using drizzle's sql template
        const parts = query.split(/\$\d+/);
        const sqlChunks: any[] = [];
        for (let i = 0; i < parts.length; i++) {
          sqlChunks.push(sql.raw(parts[i]));
          if (i < params.length) {
            sqlChunks.push(sql`${params[i]}`);
          }
        }
        sqlQuery = sql.join(sqlChunks, sql.raw(''));
      }
      const result = await db.execute(sqlQuery);
      return result.rows || [];
    } catch (error) {
      console.error("Raw query error:", error);
      throw error;
    }
  }

  // Prompt template management methods
  async getPromptTemplates(): Promise<PromptTemplate[]> {
    return await db.select().from(promptTemplates).orderBy(promptTemplates.sortOrder, promptTemplates.type);
  }

  async getActivePromptTemplates(): Promise<PromptTemplate[]> {
    return await db.select().from(promptTemplates)
      .where(eq(promptTemplates.isActive, true))
      .orderBy(promptTemplates.sortOrder, promptTemplates.type);
  }

  async getPromptTemplatesByType(type: string): Promise<PromptTemplate[]> {
    return await db.select().from(promptTemplates)
      .where(and(eq(promptTemplates.type, type), eq(promptTemplates.isActive, true)))
      .orderBy(promptTemplates.sortOrder);
  }

  async getPromptTemplate(id: number): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates)
      .where(eq(promptTemplates.id, id));
    return template;
  }

  async getPromptTemplateByName(name: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates)
      .where(eq(promptTemplates.name, name));
    return template;
  }

  async getBestPromptTemplate(type: string, modelId?: string): Promise<PromptTemplate | undefined> {
    // First try to find model-specific template
    if (modelId) {
      const [modelSpecific] = await db.select().from(promptTemplates)
        .where(and(
          eq(promptTemplates.type, type),
          eq(promptTemplates.modelId, modelId),
          eq(promptTemplates.isActive, true)
        ))
        .orderBy(promptTemplates.sortOrder)
        .limit(1);
      
      if (modelSpecific) return modelSpecific;
    }

    // Fallback to default template for this type
    const [defaultTemplate] = await db.select().from(promptTemplates)
      .where(and(
        eq(promptTemplates.type, type),
        eq(promptTemplates.isDefault, true),
        eq(promptTemplates.isActive, true)
      ))
      .limit(1);

    return defaultTemplate;
  }

  async createPromptTemplate(templateData: InsertPromptTemplate): Promise<PromptTemplate> {
    const [newTemplate] = await db.insert(promptTemplates)
      .values({
        ...templateData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return newTemplate;
  }

  async updatePromptTemplate(id: number, updates: Partial<Omit<InsertPromptTemplate, 'updatedBy'>> & { updatedBy: string }): Promise<PromptTemplate | undefined> {
    const [updatedTemplate] = await db.update(promptTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promptTemplates.id, id))
      .returning();

    if (updatedTemplate) {
      await this.createAdminLog({
        adminId: updates.updatedBy,
        action: "update_prompt_template",
        targetType: "prompt_template",
        targetId: id.toString(),
        details: { updates }
      });
    }

    return updatedTemplate;
  }

  async deletePromptTemplate(id: number, adminId: string): Promise<boolean> {
    try {
      const [template] = await db.select().from(promptTemplates)
        .where(eq(promptTemplates.id, id));
      
      if (!template) return false;

      // Don't allow deleting default templates
      if (template.isDefault) {
        throw new Error("Cannot delete default prompt template");
      }

      const result = await db.delete(promptTemplates)
        .where(eq(promptTemplates.id, id))
        .returning();

      if (result.length > 0) {
        await this.createAdminLog({
          adminId,
          action: "delete_prompt_template",
          targetType: "prompt_template", 
          targetId: id.toString(),
          details: { deletedTemplate: result[0] }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting prompt template:", error);
      return false;
    }
  }

  async togglePromptTemplateStatus(id: number, isActive: boolean, adminId: string): Promise<PromptTemplate | undefined> {
    const [updatedTemplate] = await db.update(promptTemplates)
      .set({ isActive, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(promptTemplates.id, id))
      .returning();

    if (updatedTemplate) {
      await this.createAdminLog({
        adminId,
        action: "toggle_prompt_template_status",
        targetType: "prompt_template",
        targetId: id.toString(),
        details: { isActive }
      });
    }

    return updatedTemplate;
  }

  // Translation management methods
  async getAllTranslations(): Promise<Translation[]> {
    return await db.select().from(translations).orderBy(translations.key);
  }

  async getTranslationsByNamespace(namespace: string): Promise<Translation[]> {
    return await db.select()
      .from(translations)
      .where(eq(translations.namespace, namespace))
      .orderBy(translations.key);
  }

  async getTranslation(key: string, namespace: string = "common"): Promise<Translation | undefined> {
    const [translation] = await db.select()
      .from(translations)
      .where(and(
        eq(translations.key, key),
        eq(translations.namespace, namespace)
      ));
    return translation;
  }

  async updateTranslation(key: string, arabic: string, namespace: string, adminId: string): Promise<Translation | undefined> {
    const [updatedTranslation] = await db.update(translations)
      .set({ 
        arabic, 
        lastModifiedBy: adminId, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(translations.key, key),
        eq(translations.namespace, namespace)
      ))
      .returning();

    if (updatedTranslation) {
      await this.createAdminLog({
        adminId,
        action: "update_translation",
        targetType: "translation",
        targetId: key,
        details: { namespace, arabic }
      });
    }

    return updatedTranslation;
  }

  async createTranslation(translation: InsertTranslation): Promise<Translation> {
    const [newTranslation] = await db.insert(translations)
      .values(translation)
      .returning();
    
    if (translation.lastModifiedBy) {
      await this.createAdminLog({
        adminId: translation.lastModifiedBy,
        action: "create_translation",
        targetType: "translation",
        targetId: newTranslation.key,
        details: { namespace: translation.namespace, english: translation.english, arabic: translation.arabic }
      });
    }

    return newTranslation;
  }

  async deleteTranslation(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(translations)
      .where(eq(translations.id, id))
      .returning();

    if (result.length > 0) {
      await this.createAdminLog({
        adminId,
        action: "delete_translation",
        targetType: "translation",
        targetId: result[0].key,
        details: { deletedTranslation: result[0] }
      });
      return true;
    }
    return false;
  }

  async bulkUpdateTranslations(translationUpdates: { key: string; arabic: string; namespace?: string }[], adminId: string): Promise<Translation[]> {
    const updatedTranslations: Translation[] = [];
    
    for (const update of translationUpdates) {
      const namespace = update.namespace || "common";
      
      // Check if translation exists
      const existingTranslation = await this.getTranslation(update.key, namespace);
      
      if (existingTranslation) {
        // Update existing translation
        const updated = await this.updateTranslation(update.key, update.arabic, namespace, adminId);
        if (updated) {
          updatedTranslations.push(updated);
        }
      } else {
        // Create new translation (we'll need the English text from the frontend)
        // For now, we'll skip creating new ones in bulk update
        console.log(`Translation key ${update.key} not found, skipping...`);
      }
    }

    return updatedTranslations;
  }

  // Image reference categories management methods
  async getImageReferenceCategories(): Promise<ImageReferenceCategory[]> {
    return await db.select()
      .from(imageReferenceCategories)
      .orderBy(imageReferenceCategories.sortOrder, imageReferenceCategories.name);
  }

  async getActiveImageReferenceCategories(): Promise<ImageReferenceCategory[]> {
    return await db.select()
      .from(imageReferenceCategories)
      .where(eq(imageReferenceCategories.isActive, true))
      .orderBy(imageReferenceCategories.sortOrder, imageReferenceCategories.name);
  }

  async getImageReferenceCategory(id: number): Promise<ImageReferenceCategory | undefined> {
    const [category] = await db.select()
      .from(imageReferenceCategories)
      .where(eq(imageReferenceCategories.id, id));
    return category;
  }

  async getImageReferenceCategoryBySlug(slug: string): Promise<ImageReferenceCategory | undefined> {
    const [category] = await db.select()
      .from(imageReferenceCategories)
      .where(eq(imageReferenceCategories.slug, slug));
    return category;
  }

  async createImageReferenceCategory(categoryData: InsertImageReferenceCategory): Promise<ImageReferenceCategory> {
    const [newCategory] = await db.insert(imageReferenceCategories)
      .values(categoryData)
      .returning();
    
    if (categoryData.createdBy) {
      await this.createAdminLog({
        adminId: categoryData.createdBy,
        action: "create_image_reference_category",
        targetType: "image_reference_category",
        targetId: String(newCategory.id),
        details: { category: newCategory }
      });
    }

    return newCategory;
  }

  async updateImageReferenceCategory(id: number, updates: Partial<Omit<InsertImageReferenceCategory, 'createdBy' | 'updatedBy'>> & { updatedBy: string }): Promise<ImageReferenceCategory | undefined> {
    const [updatedCategory] = await db.update(imageReferenceCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(imageReferenceCategories.id, id))
      .returning();

    if (updatedCategory) {
      await this.createAdminLog({
        adminId: updates.updatedBy,
        action: "update_image_reference_category",
        targetType: "image_reference_category",
        targetId: String(id),
        details: updates
      });
    }

    return updatedCategory;
  }

  async deleteImageReferenceCategory(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(imageReferenceCategories)
      .where(eq(imageReferenceCategories.id, id))
      .returning();

    if (result.length > 0) {
      await this.createAdminLog({
        adminId,
        action: "delete_image_reference_category",
        targetType: "image_reference_category",
        targetId: String(id),
        details: { deletedCategory: result[0] }
      });
      return true;
    }
    return false;
  }

  // Image reference images management methods
  async getImageReferenceImages(categoryId: number): Promise<ImageReferenceImage[]> {
    return await db.select()
      .from(imageReferenceImages)
      .where(eq(imageReferenceImages.categoryId, categoryId))
      .orderBy(imageReferenceImages.sortOrder);
  }

  async getImageReferenceImage(id: number): Promise<ImageReferenceImage | undefined> {
    const [image] = await db.select()
      .from(imageReferenceImages)
      .where(eq(imageReferenceImages.id, id));
    return image;
  }

  async createImageReferenceImage(imageData: InsertImageReferenceImage): Promise<ImageReferenceImage> {
    const [newImage] = await db.insert(imageReferenceImages)
      .values(imageData)
      .returning();
    
    if (imageData.uploadedBy) {
      await this.createAdminLog({
        adminId: imageData.uploadedBy,
        action: "create_image_reference_image",
        targetType: "image_reference_image",
        targetId: String(newImage.id),
        details: { image: newImage }
      });
    }

    return newImage;
  }

  async deleteImageReferenceImage(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(imageReferenceImages)
      .where(eq(imageReferenceImages.id, id))
      .returning();

    if (result.length > 0) {
      await this.createAdminLog({
        adminId,
        action: "delete_image_reference_image",
        targetType: "image_reference_image",
        targetId: String(id),
        details: { deletedImage: result[0] }
      });
      return true;
    }
    return false;
  }

  async updateImageReferenceSortOrder(id: number, sortOrder: number): Promise<ImageReferenceImage | undefined> {
    const [updatedImage] = await db.update(imageReferenceImages)
      .set({ sortOrder })
      .where(eq(imageReferenceImages.id, id))
      .returning();

    return updatedImage;
  }

  // Random prompts management
  async getAllRandomPrompts(): Promise<RandomPrompt[]> {
    return await db.select().from(randomPrompts).orderBy(randomPrompts.id);
  }

  async getRandomPrompt(): Promise<RandomPrompt | undefined> {
    const allPrompts = await db.select().from(randomPrompts);
    if (allPrompts.length === 0) return undefined;
    
    const randomIndex = Math.floor(Math.random() * allPrompts.length);
    return allPrompts[randomIndex];
  }

  async createRandomPrompts(prompts: string[]): Promise<void> {
    if (prompts.length === 0) return;
    
    const promptData = prompts.map(prompt => ({ prompt: prompt.trim() }));
    await db.insert(randomPrompts).values(promptData);
  }

  async deleteAllRandomPrompts(): Promise<void> {
    await db.delete(randomPrompts);
  }

  async getRandomPromptsCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(randomPrompts);
    return result[0]?.count || 0;
  }

  async getFilmProjects(userId: string): Promise<FilmProject[]> {
    return await db.select()
      .from(filmProjects)
      .where(eq(filmProjects.ownerId, userId))
      .orderBy(desc(filmProjects.updatedAt));
  }

  async getFilmProject(id: number): Promise<FilmProject | undefined> {
    const [project] = await db.select()
      .from(filmProjects)
      .where(eq(filmProjects.id, id));
    return project;
  }

  async createFilmProject(projectData: InsertFilmProject & { ownerId: string }): Promise<FilmProject> {
    const [project] = await db.insert(filmProjects)
      .values(projectData)
      .returning();
    return project;
  }

  async updateFilmProject(id: number, updates: Partial<InsertFilmProject>, userId: string): Promise<FilmProject | undefined> {
    const [project] = await db.update(filmProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(filmProjects.id, id), eq(filmProjects.ownerId, userId)))
      .returning();
    return project;
  }

  async deleteFilmProject(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(filmProjects)
      .where(and(eq(filmProjects.id, id), eq(filmProjects.ownerId, userId)))
      .returning();
    return result.length > 0;
  }

  async getScenesByProject(projectId: number): Promise<StoryboardScene[]> {
    return await db.select()
      .from(storyboardScenes)
      .where(eq(storyboardScenes.projectId, projectId))
      .orderBy(storyboardScenes.sortOrder);
  }

  async getScene(id: number): Promise<StoryboardScene | undefined> {
    const [scene] = await db.select()
      .from(storyboardScenes)
      .where(eq(storyboardScenes.id, id));
    return scene;
  }

  async createScene(sceneData: InsertStoryboardScene): Promise<StoryboardScene> {
    const [scene] = await db.insert(storyboardScenes)
      .values(sceneData)
      .returning();
    return scene;
  }

  async updateScene(id: number, updates: Partial<InsertStoryboardScene>): Promise<StoryboardScene | undefined> {
    const [scene] = await db.update(storyboardScenes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(storyboardScenes.id, id))
      .returning();
    return scene;
  }

  async deleteScene(id: number): Promise<boolean> {
    const result = await db.delete(storyboardScenes)
      .where(eq(storyboardScenes.id, id))
      .returning();
    return result.length > 0;
  }

  async updateSceneSelection(id: number, selectedForFinal: boolean): Promise<StoryboardScene | undefined> {
    const [scene] = await db.update(storyboardScenes)
      .set({ selectedForFinal, updatedAt: new Date() })
      .where(eq(storyboardScenes.id, id))
      .returning();
    return scene;
  }

  async getSceneVersions(sceneId: number, versionType?: string): Promise<SceneVersion[]> {
    const conditions = versionType 
      ? and(eq(sceneVersions.sceneId, sceneId), eq(sceneVersions.versionType, versionType))
      : eq(sceneVersions.sceneId, sceneId);
    
    return await db.select()
      .from(sceneVersions)
      .where(conditions)
      .orderBy(desc(sceneVersions.versionNumber));
  }

  async getActiveSceneVersion(sceneId: number, versionType: string): Promise<SceneVersion | undefined> {
    const [version] = await db.select()
      .from(sceneVersions)
      .where(and(
        eq(sceneVersions.sceneId, sceneId),
        eq(sceneVersions.versionType, versionType),
        eq(sceneVersions.isActive, true)
      ));
    return version;
  }

  async createSceneVersion(versionData: InsertSceneVersion): Promise<SceneVersion> {
    const [version] = await db.insert(sceneVersions)
      .values(versionData)
      .returning();
    return version;
  }

  async updateSceneVersion(id: number, updates: Partial<InsertSceneVersion>): Promise<SceneVersion | undefined> {
    const [version] = await db.update(sceneVersions)
      .set(updates)
      .where(eq(sceneVersions.id, id))
      .returning();
    return version;
  }

  async setActiveSceneVersion(versionId: number, sceneId: number, versionType: string): Promise<SceneVersion | undefined> {
    await db.update(sceneVersions)
      .set({ isActive: false })
      .where(and(
        eq(sceneVersions.sceneId, sceneId),
        eq(sceneVersions.versionType, versionType)
      ));

    const [version] = await db.update(sceneVersions)
      .set({ isActive: true })
      .where(eq(sceneVersions.id, versionId))
      .returning();
    return version;
  }

  async deleteSceneVersion(id: number): Promise<boolean> {
    const result = await db.delete(sceneVersions)
      .where(eq(sceneVersions.id, id))
      .returning();
    return result.length > 0;
  }

  async getAllContactSubmissions(status?: string): Promise<ContactSubmission[]> {
    if (status) {
      return await db.select()
        .from(contactSubmissions)
        .where(eq(contactSubmissions.status, status))
        .orderBy(desc(contactSubmissions.createdAt));
    }
    return await db.select()
      .from(contactSubmissions)
      .orderBy(desc(contactSubmissions.createdAt));
  }

  async getContactSubmission(id: number): Promise<ContactSubmission | undefined> {
    const [submission] = await db.select()
      .from(contactSubmissions)
      .where(eq(contactSubmissions.id, id));
    return submission;
  }

  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [created] = await db.insert(contactSubmissions)
      .values(submission)
      .returning();
    return created;
  }

  async updateContactSubmissionStatus(id: number, status: string, adminNote?: string): Promise<ContactSubmission | undefined> {
    const updates: any = { status };
    if (adminNote !== undefined) {
      updates.adminNote = adminNote;
    }
    const [updated] = await db.update(contactSubmissions)
      .set(updates)
      .where(eq(contactSubmissions.id, id))
      .returning();
    return updated;
  }

  async deleteContactSubmission(id: number): Promise<boolean> {
    const result = await db.delete(contactSubmissions)
      .where(eq(contactSubmissions.id, id))
      .returning();
    return result.length > 0;
  }

  async getUnreadContactSubmissionsCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(contactSubmissions)
      .where(eq(contactSubmissions.status, 'unread'));
    return result[0]?.count || 0;
  }

  // Image generation jobs (queue management)
  async createImageGenerationJob(job: InsertImageGenerationJob & { ownerId: string }): Promise<ImageGenerationJob> {
    const promptPreview = job.prompt.length > 97 
      ? job.prompt.substring(0, 97) + '...' 
      : job.prompt;
    
    const [created] = await db.insert(imageGenerationJobs)
      .values({
        id: job.id || `img_job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        ownerId: job.ownerId,
        prompt: job.prompt,
        promptPreview,
        width: job.width || 1024,
        height: job.height || 1024,
        aspectRatio: job.aspectRatio || "1:1",
        model: job.model || "flux-pro",
        provider: job.provider || "replicate",
        style: job.style || "Realistic",
        quality: job.quality || "standard",
        negativePrompt: job.negativePrompt,
        seed: job.seed,
        steps: job.steps,
        cfgScale: job.cfgScale,
        styleImageUrl: job.styleImageUrl,
        styleImageUrls: job.styleImageUrls,
        imageStrength: job.imageStrength,
        enhancePrompt: job.enhancePrompt || false,
        tags: job.tags || [],
        status: job.status || 'queued',
        progress: job.progress || 0,
        stage: job.stage || 'Queued',
        queuePosition: job.queuePosition,
        creditsUsed: job.creditsUsed,
        costSnapshot: job.costSnapshot,
      })
      .returning();
    return created;
  }

  async getImageGenerationJob(jobId: string): Promise<ImageGenerationJob | undefined> {
    const [job] = await db.select()
      .from(imageGenerationJobs)
      .where(eq(imageGenerationJobs.id, jobId));
    return job;
  }

  async getUserImageGenerationJobs(userId: string, includeCompleted: boolean = false): Promise<ImageGenerationJob[]> {
    if (includeCompleted) {
      return await db.select()
        .from(imageGenerationJobs)
        .where(eq(imageGenerationJobs.ownerId, userId))
        .orderBy(desc(imageGenerationJobs.createdAt));
    }
    return await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        inArray(imageGenerationJobs.status, ['queued', 'running'])
      ))
      .orderBy(desc(imageGenerationJobs.createdAt));
  }

  async getUserActiveImageJobs(userId: string): Promise<ImageGenerationJob[]> {
    return await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        inArray(imageGenerationJobs.status, ['queued', 'running'])
      ))
      .orderBy(imageGenerationJobs.createdAt);
  }

  async getUserQueuedImageJobs(userId: string): Promise<ImageGenerationJob[]> {
    return await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        eq(imageGenerationJobs.status, 'queued')
      ))
      .orderBy(imageGenerationJobs.createdAt);
  }

  async getUserRunningImageJobs(userId: string): Promise<ImageGenerationJob[]> {
    return await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        eq(imageGenerationJobs.status, 'running')
      ))
      .orderBy(imageGenerationJobs.createdAt);
  }

  async updateImageJobStatus(jobId: string, status: string, progress?: number, stage?: string): Promise<ImageGenerationJob | undefined> {
    const updates: any = { status, updatedAt: new Date() };
    if (progress !== undefined) updates.progress = progress;
    if (stage !== undefined) updates.stage = stage;
    
    const [updated] = await db.update(imageGenerationJobs)
      .set(updates)
      .where(eq(imageGenerationJobs.id, jobId))
      .returning();
    return updated;
  }

  async startImageJob(jobId: string): Promise<ImageGenerationJob | undefined> {
    const [updated] = await db.update(imageGenerationJobs)
      .set({
        status: 'running',
        progress: 0,
        stage: 'Starting',
        startedAt: new Date(),
        queuePosition: null,
        updatedAt: new Date(),
      })
      .where(eq(imageGenerationJobs.id, jobId))
      .returning();
    return updated;
  }

  async completeImageJob(jobId: string, resultImageId: number, resultUrl: string): Promise<ImageGenerationJob | undefined> {
    const [updated] = await db.update(imageGenerationJobs)
      .set({
        status: 'completed',
        progress: 100,
        stage: 'Completed',
        resultImageId,
        resultUrl,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(imageGenerationJobs.id, jobId))
      .returning();
    return updated;
  }

  async failImageJob(jobId: string, error: string): Promise<ImageGenerationJob | undefined> {
    const [updated] = await db.update(imageGenerationJobs)
      .set({
        status: 'failed',
        stage: 'Failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(imageGenerationJobs.id, jobId))
      .returning();
    return updated;
  }

  async cancelImageJob(jobId: string): Promise<ImageGenerationJob | undefined> {
    const [updated] = await db.update(imageGenerationJobs)
      .set({
        status: 'cancelled',
        stage: 'Cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(imageGenerationJobs.id, jobId))
      .returning();
    return updated;
  }

  async getNextQueuedImageJob(userId: string): Promise<ImageGenerationJob | undefined> {
    const [job] = await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        eq(imageGenerationJobs.status, 'queued')
      ))
      .orderBy(imageGenerationJobs.createdAt)
      .limit(1);
    return job;
  }

  async getGlobalQueuedJobsCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(imageGenerationJobs)
      .where(inArray(imageGenerationJobs.status, ['queued', 'running']));
    return result[0]?.count || 0;
  }

  async getUserQueuedJobsCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() })
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        eq(imageGenerationJobs.status, 'queued')
      ));
    return result[0]?.count || 0;
  }

  async getUserRunningJobsCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() })
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.ownerId, userId),
        eq(imageGenerationJobs.status, 'running')
      ));
    return result[0]?.count || 0;
  }

  async cleanupOldImageJobs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(imageGenerationJobs)
      .where(and(
        inArray(imageGenerationJobs.status, ['completed', 'failed', 'cancelled']),
        sql`${imageGenerationJobs.completedAt} < ${cutoffDate}`
      ))
      .returning();
    return result.length;
  }

  async deleteImageGenerationJob(jobId: string): Promise<void> {
    await db.delete(imageGenerationJobs)
      .where(eq(imageGenerationJobs.id, jobId));
  }

  async cleanupStaleRunningJobs(timeoutMinutes: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    const staleJobs = await db.select()
      .from(imageGenerationJobs)
      .where(and(
        eq(imageGenerationJobs.status, 'running'),
        sql`${imageGenerationJobs.startedAt} < ${cutoffTime}`
      ));
    
    if (staleJobs.length === 0) return 0;
    
    console.log(`[Cleanup] Found ${staleJobs.length} stale running jobs older than ${timeoutMinutes} minutes`);
    
    const result = await db.update(imageGenerationJobs)
      .set({
        status: 'failed',
        stage: 'Timeout',
        error: `Job timed out after ${timeoutMinutes} minutes. The generation may have failed silently. Please try again.`,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(imageGenerationJobs.status, 'running'),
        sql`${imageGenerationJobs.startedAt} < ${cutoffTime}`
      ))
      .returning();
    
    console.log(`[Cleanup] Marked ${result.length} stale jobs as failed (timeout)`);
    return result.length;
  }

  async isJobStale(jobId: string, timeoutMinutes: number = 30): Promise<boolean> {
    const job = await this.getImageGenerationJob(jobId);
    if (!job || job.status !== 'running') return false;
    
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    return job.startedAt ? new Date(job.startedAt) < cutoffTime : false;
  }

  // Teaser Gallery methods
  async getTeaserGalleryItems(): Promise<TeaserGalleryItem[]> {
    return await db.select()
      .from(teaserGalleryItems)
      .where(eq(teaserGalleryItems.isActive, true))
      .orderBy(teaserGalleryItems.sortOrder);
  }

  async getAllTeaserGalleryItems(): Promise<TeaserGalleryItem[]> {
    return await db.select()
      .from(teaserGalleryItems)
      .orderBy(teaserGalleryItems.sortOrder);
  }

  async getTeaserGalleryItem(id: number): Promise<TeaserGalleryItem | undefined> {
    const [item] = await db.select()
      .from(teaserGalleryItems)
      .where(eq(teaserGalleryItems.id, id));
    return item;
  }

  async createTeaserGalleryItem(data: InsertTeaserGalleryItem): Promise<TeaserGalleryItem> {
    const [created] = await db.insert(teaserGalleryItems)
      .values(data)
      .returning();
    return created;
  }

  async updateTeaserGalleryItem(id: number, data: Partial<InsertTeaserGalleryItem>): Promise<TeaserGalleryItem | undefined> {
    const [updated] = await db.update(teaserGalleryItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teaserGalleryItems.id, id))
      .returning();
    return updated;
  }

  async updateTeaserGalleryItemSortOrder(id: number, sortOrder: number): Promise<TeaserGalleryItem | undefined> {
    const [updated] = await db.update(teaserGalleryItems)
      .set({ sortOrder, updatedAt: new Date() })
      .where(eq(teaserGalleryItems.id, id))
      .returning();
    return updated;
  }

  async deleteTeaserGalleryItem(id: number): Promise<boolean> {
    const result = await db.delete(teaserGalleryItems)
      .where(eq(teaserGalleryItems.id, id))
      .returning();
    return result.length > 0;
  }

  // Teaser Showcase Video methods
  async getTeaserShowcaseVideo(): Promise<TeaserShowcaseVideo | undefined> {
    const [video] = await db.select()
      .from(teaserShowcaseVideo)
      .where(eq(teaserShowcaseVideo.isActive, true))
      .limit(1);
    return video;
  }

  async getOrCreateTeaserShowcaseVideo(): Promise<TeaserShowcaseVideo> {
    let [video] = await db.select().from(teaserShowcaseVideo).limit(1);
    if (!video) {
      [video] = await db.insert(teaserShowcaseVideo)
        .values({
          videoUrl: "/objects/generated-videos/video-320-cb79ab10-0766-4ee6-866b-662a8260e4d2.mp4",
          captionEn: "Culturally aligned visuals",
          captionAr: "صور متوافقة ثقافيًا",
          isActive: true,
        })
        .returning();
    }
    return video;
  }

  async updateTeaserShowcaseVideo(data: Partial<InsertTeaserShowcaseVideo>): Promise<TeaserShowcaseVideo> {
    const existing = await this.getOrCreateTeaserShowcaseVideo();
    const [updated] = await db.update(teaserShowcaseVideo)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teaserShowcaseVideo.id, existing.id))
      .returning();
    return updated;
  }

  // Hero Videos methods
  async getHeroVideos(): Promise<HeroVideos | undefined> {
    const [video] = await db.select()
      .from(heroVideos)
      .where(eq(heroVideos.isActive, true))
      .limit(1);
    return video;
  }

  async getOrCreateHeroVideos(): Promise<HeroVideos> {
    let [video] = await db.select().from(heroVideos).limit(1);
    if (!video) {
      [video] = await db.insert(heroVideos)
        .values({
          desktopVideoUrl: "/videos/31kjPOxbbzyPUtA9rq0Yr_909WCA2C.mp4",
          mobileVideoUrl: "/videos/31kjPOxbbzyPUtA9rq0Yr_909WCA2C.mp4",
          isActive: true,
        })
        .returning();
    }
    return video;
  }

  async updateHeroVideos(data: Partial<InsertHeroVideos>): Promise<HeroVideos> {
    const existing = await this.getOrCreateHeroVideos();
    const [updated] = await db.update(heroVideos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(heroVideos.id, existing.id))
      .returning();
    return updated;
  }

  // Homepage Service Cards methods
  async getHomepageServiceCards(): Promise<HomepageServiceCard[]> {
    return db.select()
      .from(homepageServiceCards)
      .orderBy(homepageServiceCards.sortOrder);
  }

  async getActiveHomepageServiceCards(): Promise<HomepageServiceCard[]> {
    return db.select()
      .from(homepageServiceCards)
      .where(eq(homepageServiceCards.isActive, true))
      .orderBy(homepageServiceCards.sortOrder);
  }

  async getHomepageServiceCard(id: number): Promise<HomepageServiceCard | undefined> {
    const [card] = await db.select()
      .from(homepageServiceCards)
      .where(eq(homepageServiceCards.id, id));
    return card;
  }

  async createHomepageServiceCard(card: InsertHomepageServiceCard): Promise<HomepageServiceCard> {
    const [created] = await db.insert(homepageServiceCards)
      .values(card)
      .returning();
    return created;
  }

  async updateHomepageServiceCard(id: number, updates: Partial<InsertHomepageServiceCard>, adminId: string): Promise<HomepageServiceCard | undefined> {
    const [updated] = await db.update(homepageServiceCards)
      .set({ ...updates, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(homepageServiceCards.id, id))
      .returning();
    return updated;
  }

  async deleteHomepageServiceCard(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(homepageServiceCards)
      .where(eq(homepageServiceCards.id, id))
      .returning();
    return result.length > 0;
  }

  // Homepage Promotion Bar methods
  async getHomepagePromotionBar(): Promise<HomepagePromotionBar | undefined> {
    const [bar] = await db.select()
      .from(homepagePromotionBar)
      .where(eq(homepagePromotionBar.isActive, true))
      .limit(1);
    return bar;
  }

  async upsertHomepagePromotionBar(data: InsertHomepagePromotionBar): Promise<HomepagePromotionBar> {
    const existing = await db.select().from(homepagePromotionBar).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(homepagePromotionBar)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(homepagePromotionBar.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(homepagePromotionBar)
        .values(data)
        .returning();
      return created;
    }
  }

  // Homepage Featured Items methods
  async getHomepageFeaturedItems(): Promise<(HomepageFeaturedItem & { imageUrl?: string; thumbnailUrl?: string; prompt?: string })[]> {
    const items = await db.select()
      .from(homepageFeaturedItems)
      .where(eq(homepageFeaturedItems.isActive, true))
      .orderBy(homepageFeaturedItems.sortOrder);
    
    const enrichedItems = await Promise.all(items.map(async (item) => {
      if (item.itemType === 'image') {
        const [image] = await db.select().from(images).where(eq(images.id, item.itemId));
        return {
          ...item,
          imageUrl: image?.url,
          thumbnailUrl: image?.thumbnailUrl,
          prompt: image?.prompt
        };
      } else {
        const [video] = await db.select().from(videos).where(eq(videos.id, item.itemId));
        return {
          ...item,
          imageUrl: video?.url,
          thumbnailUrl: video?.thumbnailUrl,
          prompt: video?.prompt
        };
      }
    }));
    
    return enrichedItems;
  }

  async addHomepageFeaturedItem(item: InsertHomepageFeaturedItem): Promise<HomepageFeaturedItem> {
    const [created] = await db.insert(homepageFeaturedItems)
      .values(item)
      .returning();
    return created;
  }

  async removeHomepageFeaturedItem(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(homepageFeaturedItems)
      .where(eq(homepageFeaturedItems.id, id))
      .returning();
    return result.length > 0;
  }

  async updateHomepageFeaturedItemOrder(id: number, sortOrder: number): Promise<HomepageFeaturedItem | undefined> {
    const [updated] = await db.update(homepageFeaturedItems)
      .set({ sortOrder })
      .where(eq(homepageFeaturedItems.id, id))
      .returning();
    return updated;
  }

  // Homepage CTA methods
  async getHomepageCta(): Promise<HomepageCta | undefined> {
    const [cta] = await db.select()
      .from(homepageCta)
      .where(eq(homepageCta.isActive, true))
      .limit(1);
    return cta;
  }

  async upsertHomepageCta(data: InsertHomepageCta): Promise<HomepageCta> {
    const existing = await db.select().from(homepageCta).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(homepageCta)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(homepageCta.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(homepageCta)
        .values(data)
        .returning();
      return created;
    }
  }

  // Public gallery curated items methods
  async getPublicGalleryItems(): Promise<(PublicGalleryItem & { imageUrl?: string; thumbnailUrl?: string | null; prompt?: string; width?: number; height?: number })[]> {
    const items = await db.select()
      .from(publicGalleryItems)
      .orderBy(publicGalleryItems.sortOrder);
    
    // Enrich with actual media data
    const enrichedItems = await Promise.all(items.map(async (item) => {
      if (item.itemType === 'image') {
        const image = await db.select().from(images).where(eq(images.id, item.itemId)).limit(1);
        if (image.length > 0) {
          return { 
            ...item, 
            imageUrl: image[0].url, 
            thumbnailUrl: image[0].thumbnailUrl,
            prompt: image[0].prompt,
            width: image[0].width,
            height: image[0].height
          };
        }
      } else if (item.itemType === 'video') {
        const video = await db.select().from(videos).where(eq(videos.id, item.itemId)).limit(1);
        if (video.length > 0) {
          return { 
            ...item, 
            imageUrl: video[0].url, 
            thumbnailUrl: video[0].thumbnailUrl,
            prompt: video[0].prompt,
            width: video[0].width,
            height: video[0].height
          };
        }
      }
      return item;
    }));
    
    return enrichedItems;
  }

  async getActivePublicGalleryItems(): Promise<(PublicGalleryItem & { type: 'image' | 'video'; url: string; imageUrl?: string; thumbnailUrl?: string | null; prompt?: string; width?: number; height?: number; ownerId?: string; createdAt?: string; model?: string })[]> {
    // Optimized: Use JOINs to fetch all data in 2 queries instead of N+1
    // Query for image items with JOIN
    const imageItems = await db.select({
      id: publicGalleryItems.id,
      itemType: publicGalleryItems.itemType,
      itemId: publicGalleryItems.itemId,
      isFeatured: publicGalleryItems.isFeatured,
      isStickyTop: publicGalleryItems.isStickyTop,
      sortOrder: publicGalleryItems.sortOrder,
      isActive: publicGalleryItems.isActive,
      createdAt: publicGalleryItems.createdAt,
      updatedBy: publicGalleryItems.updatedBy,
      url: images.url,
      thumbnailUrl: images.thumbnailUrl,
      prompt: images.prompt,
      width: images.width,
      height: images.height,
      ownerId: images.ownerId,
      mediaCreatedAt: images.createdAt,
      model: images.model,
    })
      .from(publicGalleryItems)
      .innerJoin(images, and(
        eq(publicGalleryItems.itemId, images.id),
        eq(publicGalleryItems.itemType, 'image'),
        eq(images.isPublic, true)
      ))
      .where(eq(publicGalleryItems.isActive, true));

    // Query for video items with JOIN
    const videoItems = await db.select({
      id: publicGalleryItems.id,
      itemType: publicGalleryItems.itemType,
      itemId: publicGalleryItems.itemId,
      isFeatured: publicGalleryItems.isFeatured,
      isStickyTop: publicGalleryItems.isStickyTop,
      sortOrder: publicGalleryItems.sortOrder,
      isActive: publicGalleryItems.isActive,
      createdAt: publicGalleryItems.createdAt,
      updatedBy: publicGalleryItems.updatedBy,
      url: videos.url,
      thumbnailUrl: videos.thumbnailUrl,
      prompt: videos.prompt,
      width: videos.width,
      height: videos.height,
      ownerId: videos.ownerId,
      mediaCreatedAt: videos.createdAt,
      model: videos.model,
    })
      .from(publicGalleryItems)
      .innerJoin(videos, and(
        eq(publicGalleryItems.itemId, videos.id),
        eq(publicGalleryItems.itemType, 'video'),
        eq(videos.isPublic, true)
      ))
      .where(eq(publicGalleryItems.isActive, true));

    // Combine and format results - use mediaCreatedAt for frontend display
    const allItems = [
      ...imageItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        isFeatured: item.isFeatured,
        isStickyTop: item.isStickyTop,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        updatedBy: item.updatedBy,
        type: 'image' as const,
        url: item.url,
        imageUrl: item.url,
        thumbnailUrl: item.thumbnailUrl,
        prompt: item.prompt,
        width: item.width,
        height: item.height,
        ownerId: item.ownerId,
        createdAt: item.mediaCreatedAt?.toISOString() || new Date().toISOString(),
        model: item.model,
      })),
      ...videoItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        isFeatured: item.isFeatured,
        isStickyTop: item.isStickyTop,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        updatedBy: item.updatedBy,
        type: 'video' as const,
        url: item.url,
        imageUrl: item.url,
        thumbnailUrl: item.thumbnailUrl,
        prompt: item.prompt,
        width: item.width,
        height: item.height,
        ownerId: item.ownerId,
        createdAt: item.mediaCreatedAt?.toISOString() || new Date().toISOString(),
        model: item.model,
      })),
    ];

    // Sort by sticky, featured, then sortOrder
    return allItems.sort((a, b) => {
      if (a.isStickyTop !== b.isStickyTop) return a.isStickyTop ? -1 : 1;
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
  }

  async getActivePublicGalleryItemsPaginated(cursor?: number, limit: number = 24): Promise<{
    items: (PublicGalleryItem & { type: 'image' | 'video'; url: string; thumbnailUrl?: string | null; width: number; height: number; ownerId: string; createdAt: string; isFeatured: boolean; isStickyTop: boolean })[];
    nextCursor: number | null;
    hasMore: boolean;
    totalCount: number;
  }> {
    // Get total count for pagination info
    const countResult = await db.select({ count: count() })
      .from(publicGalleryItems)
      .where(eq(publicGalleryItems.isActive, true));
    const totalCount = countResult[0]?.count || 0;

    // Use efficient JOINs for images
    const imageItems = await db.select({
      id: publicGalleryItems.id,
      itemType: publicGalleryItems.itemType,
      itemId: publicGalleryItems.itemId,
      isFeatured: publicGalleryItems.isFeatured,
      isStickyTop: publicGalleryItems.isStickyTop,
      sortOrder: publicGalleryItems.sortOrder,
      isActive: publicGalleryItems.isActive,
      createdAt: publicGalleryItems.createdAt,
      updatedBy: publicGalleryItems.updatedBy,
      url: images.url,
      thumbnailUrl: images.thumbnailUrl,
      width: images.width,
      height: images.height,
      ownerId: images.ownerId,
      mediaCreatedAt: images.createdAt,
    })
      .from(publicGalleryItems)
      .innerJoin(images, and(
        eq(publicGalleryItems.itemId, images.id),
        eq(publicGalleryItems.itemType, 'image'),
        eq(images.isPublic, true)
      ))
      .where(eq(publicGalleryItems.isActive, true));

    // Use efficient JOINs for videos
    const videoItems = await db.select({
      id: publicGalleryItems.id,
      itemType: publicGalleryItems.itemType,
      itemId: publicGalleryItems.itemId,
      isFeatured: publicGalleryItems.isFeatured,
      isStickyTop: publicGalleryItems.isStickyTop,
      sortOrder: publicGalleryItems.sortOrder,
      isActive: publicGalleryItems.isActive,
      createdAt: publicGalleryItems.createdAt,
      updatedBy: publicGalleryItems.updatedBy,
      url: videos.url,
      thumbnailUrl: videos.thumbnailUrl,
      width: videos.width,
      height: videos.height,
      ownerId: videos.ownerId,
      mediaCreatedAt: videos.createdAt,
    })
      .from(publicGalleryItems)
      .innerJoin(videos, and(
        eq(publicGalleryItems.itemId, videos.id),
        eq(publicGalleryItems.itemType, 'video'),
        eq(videos.isPublic, true)
      ))
      .where(eq(publicGalleryItems.isActive, true));

    // Combine results with minimal payload (no prompt for list view)
    const allItems = [
      ...imageItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        isFeatured: item.isFeatured,
        isStickyTop: item.isStickyTop,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        updatedBy: item.updatedBy,
        type: 'image' as const,
        url: item.thumbnailUrl || item.url,
        thumbnailUrl: item.thumbnailUrl,
        width: item.width,
        height: item.height,
        ownerId: item.ownerId,
        createdAt: item.mediaCreatedAt?.toISOString() || new Date().toISOString(),
      })),
      ...videoItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        isFeatured: item.isFeatured,
        isStickyTop: item.isStickyTop,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        updatedBy: item.updatedBy,
        type: 'video' as const,
        url: item.thumbnailUrl || item.url,
        thumbnailUrl: item.thumbnailUrl,
        width: item.width,
        height: item.height,
        ownerId: item.ownerId,
        createdAt: item.mediaCreatedAt?.toISOString() || new Date().toISOString(),
      })),
    ];

    // Sort by sticky, featured, then sortOrder
    const sortedItems = allItems.sort((a, b) => {
      if (a.isStickyTop !== b.isStickyTop) return a.isStickyTop ? -1 : 1;
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });

    // Apply cursor-based pagination (cursor is the index offset)
    const startIndex = cursor || 0;
    const paginatedItems = sortedItems.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sortedItems.length;
    const nextCursor = hasMore ? startIndex + limit : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasMore,
      totalCount,
    };
  }

  async addPublicGalleryItem(item: InsertPublicGalleryItem): Promise<PublicGalleryItem> {
    const [created] = await db.insert(publicGalleryItems)
      .values(item)
      .returning();
    return created;
  }

  async updatePublicGalleryItem(id: number, updates: Partial<InsertPublicGalleryItem>, adminId: string): Promise<PublicGalleryItem | undefined> {
    const [updated] = await db.update(publicGalleryItems)
      .set(updates)
      .where(eq(publicGalleryItems.id, id))
      .returning();
    return updated;
  }

  async removePublicGalleryItem(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(publicGalleryItems)
      .where(eq(publicGalleryItems.id, id))
      .returning();
    return result.length > 0;
  }

  // User notifications methods
  async createNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [created] = await db.insert(userNotifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<UserNotification[]> {
    return await db.select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.isRead, false)
      ));
    return result?.count || 0;
  }

  async markNotificationAsRead(notificationId: number, userId: string): Promise<UserNotification | undefined> {
    const [updated] = await db.update(userNotifications)
      .set({ isRead: true })
      .where(and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.userId, userId)
      ))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.userId, userId));
  }

  async deleteNotification(notificationId: number, userId: string): Promise<boolean> {
    const result = await db.delete(userNotifications)
      .where(and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async getSubscriptionsNearingEnd(daysAhead: number): Promise<(UserSubscription & { plan?: SubscriptionPlan; user?: User })[]> {
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + daysAhead);
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const subscriptions = await db.select()
      .from(userSubscriptions)
      .where(and(
        eq(userSubscriptions.status, 'active'),
        gte(userSubscriptions.currentPeriodEnd, startOfDay),
        sql`${userSubscriptions.currentPeriodEnd} <= ${endOfDay}`
      ));
    
    const enriched = await Promise.all(subscriptions.map(async (sub) => {
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId!));
      const [user] = await db.select().from(users).where(eq(users.id, sub.userId));
      return { ...sub, plan, user };
    }));
    
    return enriched;
  }

  async getUserNotificationByTypeAndData(userId: string, type: string, dataKey: string, dataValue: string): Promise<UserNotification | undefined> {
    const [notification] = await db.select()
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.type, type),
        sql`${userNotifications.data}->>'periodEnd' = ${dataValue}`
      ))
      .orderBy(desc(userNotifications.createdAt))
      .limit(1);
    
    return notification;
  }

  // =============================================================================
  // PRICING PAGE CONFIGURATION IMPLEMENTATIONS
  // =============================================================================

  async getPricingPageConfig(): Promise<PricingPageConfig | undefined> {
    const [config] = await db.select().from(pricingPageConfig).limit(1);
    return config;
  }

  async upsertPricingPageConfig(config: Partial<InsertPricingPageConfig> & { updatedBy: string }): Promise<PricingPageConfig> {
    const existing = await this.getPricingPageConfig();
    if (existing) {
      const [updated] = await db.update(pricingPageConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(pricingPageConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(pricingPageConfig)
        .values(config as InsertPricingPageConfig)
        .returning();
      return created;
    }
  }

  async getPricingFaqItems(): Promise<PricingFaqItem[]> {
    return await db.select().from(pricingFaqItems).orderBy(pricingFaqItems.sortOrder);
  }

  async getActivePricingFaqItems(): Promise<PricingFaqItem[]> {
    return await db.select().from(pricingFaqItems)
      .where(eq(pricingFaqItems.isActive, true))
      .orderBy(pricingFaqItems.sortOrder);
  }

  async getPricingFaqItem(id: number): Promise<PricingFaqItem | undefined> {
    const [item] = await db.select().from(pricingFaqItems).where(eq(pricingFaqItems.id, id));
    return item;
  }

  async createPricingFaqItem(item: InsertPricingFaqItem): Promise<PricingFaqItem> {
    const [created] = await db.insert(pricingFaqItems).values(item).returning();
    return created;
  }

  async updatePricingFaqItem(id: number, updates: Partial<InsertPricingFaqItem>, adminId: string): Promise<PricingFaqItem | undefined> {
    const [updated] = await db.update(pricingFaqItems)
      .set({ ...updates, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(pricingFaqItems.id, id))
      .returning();
    return updated;
  }

  async deletePricingFaqItem(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(pricingFaqItems).where(eq(pricingFaqItems.id, id)).returning();
    return result.length > 0;
  }

  async getPricingComparisonSections(): Promise<PricingComparisonSection[]> {
    return await db.select().from(pricingComparisonSections).orderBy(pricingComparisonSections.sortOrder);
  }

  async getActivePricingComparisonSections(): Promise<PricingComparisonSection[]> {
    return await db.select().from(pricingComparisonSections)
      .where(eq(pricingComparisonSections.isActive, true))
      .orderBy(pricingComparisonSections.sortOrder);
  }

  async getPricingComparisonSection(id: number): Promise<PricingComparisonSection | undefined> {
    const [section] = await db.select().from(pricingComparisonSections).where(eq(pricingComparisonSections.id, id));
    return section;
  }

  async createPricingComparisonSection(section: InsertPricingComparisonSection): Promise<PricingComparisonSection> {
    const [created] = await db.insert(pricingComparisonSections).values(section).returning();
    return created;
  }

  async updatePricingComparisonSection(id: number, updates: Partial<InsertPricingComparisonSection>, adminId: string): Promise<PricingComparisonSection | undefined> {
    const [updated] = await db.update(pricingComparisonSections)
      .set({ ...updates, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(pricingComparisonSections.id, id))
      .returning();
    return updated;
  }

  async deletePricingComparisonSection(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(pricingComparisonSections).where(eq(pricingComparisonSections.id, id)).returning();
    return result.length > 0;
  }

  async getPricingComparisonRows(sectionId?: number): Promise<PricingComparisonRow[]> {
    if (sectionId) {
      return await db.select().from(pricingComparisonRows)
        .where(eq(pricingComparisonRows.sectionId, sectionId))
        .orderBy(pricingComparisonRows.sortOrder);
    }
    return await db.select().from(pricingComparisonRows).orderBy(pricingComparisonRows.sortOrder);
  }

  async getPricingComparisonRow(id: number): Promise<PricingComparisonRow | undefined> {
    const [row] = await db.select().from(pricingComparisonRows).where(eq(pricingComparisonRows.id, id));
    return row;
  }

  async createPricingComparisonRow(row: InsertPricingComparisonRow): Promise<PricingComparisonRow> {
    const [created] = await db.insert(pricingComparisonRows).values(row).returning();
    return created;
  }

  async updatePricingComparisonRow(id: number, updates: Partial<InsertPricingComparisonRow>, adminId: string): Promise<PricingComparisonRow | undefined> {
    const [updated] = await db.update(pricingComparisonRows)
      .set({ ...updates, updatedBy: adminId, updatedAt: new Date() })
      .where(eq(pricingComparisonRows.id, id))
      .returning();
    return updated;
  }

  async deletePricingComparisonRow(id: number, adminId: string): Promise<boolean> {
    const result = await db.delete(pricingComparisonRows).where(eq(pricingComparisonRows.id, id)).returning();
    return result.length > 0;
  }

  async getPricingComparisonCells(rowId?: number): Promise<PricingComparisonCell[]> {
    if (rowId) {
      return await db.select().from(pricingComparisonCells).where(eq(pricingComparisonCells.rowId, rowId));
    }
    return await db.select().from(pricingComparisonCells);
  }

  async getPricingComparisonCell(rowId: number, planId: number): Promise<PricingComparisonCell | undefined> {
    const [cell] = await db.select().from(pricingComparisonCells)
      .where(and(eq(pricingComparisonCells.rowId, rowId), eq(pricingComparisonCells.planId, planId)));
    return cell;
  }

  async upsertPricingComparisonCell(cell: InsertPricingComparisonCell): Promise<PricingComparisonCell> {
    const existing = await this.getPricingComparisonCell(cell.rowId, cell.planId);
    if (existing) {
      const [updated] = await db.update(pricingComparisonCells)
        .set({ ...cell, updatedAt: new Date() })
        .where(eq(pricingComparisonCells.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(pricingComparisonCells).values(cell).returning();
      return created;
    }
  }

  async deletePricingComparisonCell(id: number): Promise<boolean> {
    const result = await db.delete(pricingComparisonCells).where(eq(pricingComparisonCells.id, id)).returning();
    return result.length > 0;
  }

  async getPlanDisplayOverrides(): Promise<PlanDisplayOverride[]> {
    return await db.select().from(planDisplayOverrides).orderBy(planDisplayOverrides.sortOrder);
  }

  async getPlanDisplayOverride(planId: number): Promise<PlanDisplayOverride | undefined> {
    const [override] = await db.select().from(planDisplayOverrides).where(eq(planDisplayOverrides.planId, planId));
    return override;
  }

  async upsertPlanDisplayOverride(override: InsertPlanDisplayOverride): Promise<PlanDisplayOverride> {
    const existing = await this.getPlanDisplayOverride(override.planId);
    if (existing) {
      const [updated] = await db.update(planDisplayOverrides)
        .set({ ...override, updatedAt: new Date() })
        .where(eq(planDisplayOverrides.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(planDisplayOverrides).values(override).returning();
      return created;
    }
  }

  async deletePlanDisplayOverride(planId: number): Promise<boolean> {
    const result = await db.delete(planDisplayOverrides).where(eq(planDisplayOverrides.planId, planId)).returning();
    return result.length > 0;
  }

  async getCreditPackDisplayOverrides(): Promise<CreditPackDisplayOverride[]> {
    return await db.select().from(creditPackDisplayOverrides).orderBy(creditPackDisplayOverrides.sortOrder);
  }

  async getCreditPackDisplayOverride(packId: number): Promise<CreditPackDisplayOverride | undefined> {
    const [override] = await db.select().from(creditPackDisplayOverrides).where(eq(creditPackDisplayOverrides.packId, packId));
    return override;
  }

  async upsertCreditPackDisplayOverride(override: InsertCreditPackDisplayOverride): Promise<CreditPackDisplayOverride> {
    const existing = await this.getCreditPackDisplayOverride(override.packId);
    if (existing) {
      const [updated] = await db.update(creditPackDisplayOverrides)
        .set({ ...override, updatedAt: new Date() })
        .where(eq(creditPackDisplayOverrides.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(creditPackDisplayOverrides).values(override).returning();
      return created;
    }
  }

  async deleteCreditPackDisplayOverride(packId: number): Promise<boolean> {
    const result = await db.delete(creditPackDisplayOverrides).where(eq(creditPackDisplayOverrides.packId, packId)).returning();
    return result.length > 0;
  }

  async getUpgradeReasonMappings(): Promise<UpgradeReasonMapping[]> {
    return await db.select().from(upgradeReasonMappings);
  }

  async getUpgradeReasonMapping(reasonKey: string): Promise<UpgradeReasonMapping | undefined> {
    const [mapping] = await db.select().from(upgradeReasonMappings).where(eq(upgradeReasonMappings.reasonKey, reasonKey));
    return mapping;
  }

  async upsertUpgradeReasonMapping(mapping: InsertUpgradeReasonMapping): Promise<UpgradeReasonMapping> {
    const existing = await this.getUpgradeReasonMapping(mapping.reasonKey);
    if (existing) {
      const [updated] = await db.update(upgradeReasonMappings)
        .set({ ...mapping, updatedAt: new Date() })
        .where(eq(upgradeReasonMappings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(upgradeReasonMappings).values(mapping).returning();
      return created;
    }
  }

  async deleteUpgradeReasonMapping(reasonKey: string): Promise<boolean> {
    const result = await db.delete(upgradeReasonMappings).where(eq(upgradeReasonMappings.reasonKey, reasonKey)).returning();
    return result.length > 0;
  }

  async getAnnualPlanVariants(): Promise<AnnualPlanVariant[]> {
    return await db.select().from(annualPlanVariants);
  }

  async getAnnualPlanVariant(monthlyPlanId: number): Promise<AnnualPlanVariant | undefined> {
    const [variant] = await db.select().from(annualPlanVariants).where(eq(annualPlanVariants.monthlyPlanId, monthlyPlanId));
    return variant;
  }

  async upsertAnnualPlanVariant(variant: InsertAnnualPlanVariant): Promise<AnnualPlanVariant> {
    const existing = await this.getAnnualPlanVariant(variant.monthlyPlanId);
    if (existing) {
      const [updated] = await db.update(annualPlanVariants)
        .set({ ...variant, updatedAt: new Date() })
        .where(eq(annualPlanVariants.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(annualPlanVariants).values(variant).returning();
      return created;
    }
  }

  async deleteAnnualPlanVariant(monthlyPlanId: number): Promise<boolean> {
    const result = await db.delete(annualPlanVariants).where(eq(annualPlanVariants.monthlyPlanId, monthlyPlanId)).returning();
    return result.length > 0;
  }

  async getFullPricingPageData(): Promise<{
    config: PricingPageConfig | null;
    plans: (SubscriptionPlan & { displayOverride?: PlanDisplayOverride; annualVariant?: SubscriptionPlan })[];
    creditPacks: (TopupPack & { displayOverride?: CreditPackDisplayOverride })[];
    faqItems: PricingFaqItem[];
    comparisonSections: (PricingComparisonSection & { rows: (PricingComparisonRow & { cells: PricingComparisonCell[] })[] })[];
    upgradeReasonMappings: UpgradeReasonMapping[];
  }> {
    const config = await this.getPricingPageConfig();
    const allPlans = await this.getActiveSubscriptionPlans();
    const allOverrides = await this.getPlanDisplayOverrides();
    const allAnnualVariants = await this.getAnnualPlanVariants();
    const allCreditPacks = await db.select().from(topupPacks).where(eq(topupPacks.isActive, true)).orderBy(topupPacks.sortOrder);
    const allCreditPackOverrides = await this.getCreditPackDisplayOverrides();
    const faqItems = await this.getActivePricingFaqItems();
    const sections = await this.getActivePricingComparisonSections();
    const allRows = await this.getPricingComparisonRows();
    const allCells = await this.getPricingComparisonCells();
    const reasonMappings = await this.getUpgradeReasonMappings();

    const plans = allPlans.map(plan => {
      const displayOverride = allOverrides.find(o => o.planId === plan.id);
      const annualVariantLink = allAnnualVariants.find(v => v.monthlyPlanId === plan.id);
      const annualVariant = annualVariantLink ? allPlans.find(p => p.id === annualVariantLink.annualPlanId) : undefined;
      return { ...plan, displayOverride, annualVariant };
    });

    const creditPacks = allCreditPacks.map(pack => {
      const displayOverride = allCreditPackOverrides.find(o => o.packId === pack.id);
      return { ...pack, displayOverride };
    });

    const comparisonSections = sections.map(section => {
      const sectionRows = allRows.filter(r => r.sectionId === section.id && r.isActive);
      const rowsWithCells = sectionRows.map(row => {
        const cells = allCells.filter(c => c.rowId === row.id);
        return { ...row, cells };
      });
      return { ...section, rows: rowsWithCells };
    });

    return {
      config: config || null,
      plans,
      creditPacks,
      faqItems,
      comparisonSections,
      upgradeReasonMappings: reasonMappings,
    };
  }

  // Moderation logs operations
  async createModerationLog(log: InsertModerationLog): Promise<ModerationLog> {
    const [newLog] = await db.insert(moderationLogs).values(log).returning();
    return newLog;
  }

  async getModerationLogs(filters?: { verdict?: string; userId?: string; limit?: number; offset?: number }): Promise<(ModerationLog & { firstName?: string | null; lastName?: string | null; email?: string | null })[]> {
    const conditions = [];
    if (filters?.verdict) {
      conditions.push(eq(moderationLogs.verdict, filters.verdict as any));
    }
    if (filters?.userId) {
      conditions.push(eq(moderationLogs.userId, filters.userId));
    }
    
    let query = db
      .select({
        id: moderationLogs.id,
        userId: moderationLogs.userId,
        prompt: moderationLogs.prompt,
        negativePrompt: moderationLogs.negativePrompt,
        verdict: moderationLogs.verdict,
        policyTags: moderationLogs.policyTags,
        reasons: moderationLogs.reasons,
        safeRewrite: moderationLogs.safeRewrite,
        createdAt: moderationLogs.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(moderationLogs)
      .leftJoin(users, eq(moderationLogs.userId, users.id));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(moderationLogs.createdAt)) as typeof query;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getModerationLogsCount(filters?: { verdict?: string; userId?: string }): Promise<number> {
    const conditions = [];
    if (filters?.verdict) {
      conditions.push(eq(moderationLogs.verdict, filters.verdict as any));
    }
    if (filters?.userId) {
      conditions.push(eq(moderationLogs.userId, filters.userId));
    }
    
    let query = db.select({ count: count() }).from(moderationLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const [result] = await query;
    return result?.count || 0;
  }

  async getModerationLog(id: number): Promise<ModerationLog | undefined> {
    const [log] = await db.select().from(moderationLogs).where(eq(moderationLogs.id, id));
    return log;
  }

  // Upscale Job operations
  async createUpscaleJob(job: Omit<InsertUpscaleJob, 'createdAt' | 'updatedAt'>): Promise<UpscaleJob> {
    const [newJob] = await db.insert(upscaleJobs).values({
      ...job,
    }).returning();
    return newJob;
  }

  async getUpscaleJob(jobId: string): Promise<UpscaleJob | undefined> {
    const [job] = await db.select().from(upscaleJobs).where(eq(upscaleJobs.id, jobId));
    return job;
  }

  async getUserUpscaleJobs(userId: string): Promise<UpscaleJob[]> {
    return await db.select().from(upscaleJobs)
      .where(eq(upscaleJobs.ownerId, userId))
      .orderBy(desc(upscaleJobs.createdAt));
  }

  async updateUpscaleJobStatus(jobId: string, state: string, progress?: number, stage?: string): Promise<UpscaleJob | undefined> {
    const updateData: any = { state, updatedAt: new Date() };
    if (progress !== undefined) updateData.progress = progress;
    if (stage !== undefined) updateData.stage = stage;
    
    const [updated] = await db.update(upscaleJobs)
      .set(updateData)
      .where(eq(upscaleJobs.id, jobId))
      .returning();
    return updated;
  }

  async updateUpscaleJobProvider(jobId: string, providerId: string): Promise<UpscaleJob | undefined> {
    const [updated] = await db.update(upscaleJobs)
      .set({ providerId, updatedAt: new Date() })
      .where(eq(upscaleJobs.id, jobId))
      .returning();
    return updated;
  }

  async completeUpscaleJob(jobId: string, resultUrl: string, resultWidth: number, resultHeight: number, resultImageId?: number): Promise<UpscaleJob | undefined> {
    const [updated] = await db.update(upscaleJobs)
      .set({
        state: 'completed',
        progress: 100,
        stage: 'Complete',
        resultUrl,
        resultWidth,
        resultHeight,
        resultImageId,
        updatedAt: new Date(),
      })
      .where(eq(upscaleJobs.id, jobId))
      .returning();
    return updated;
  }

  async failUpscaleJob(jobId: string, error: string): Promise<UpscaleJob | undefined> {
    const [updated] = await db.update(upscaleJobs)
      .set({
        state: 'failed',
        error,
        updatedAt: new Date(),
      })
      .where(eq(upscaleJobs.id, jobId))
      .returning();
    return updated;
  }

  async getActiveUpscaleJobs(userId: string): Promise<UpscaleJob[]> {
    return await db.select().from(upscaleJobs)
      .where(and(
        eq(upscaleJobs.ownerId, userId),
        or(
          eq(upscaleJobs.state, 'queued'),
          eq(upscaleJobs.state, 'starting'),
          eq(upscaleJobs.state, 'processing')
        )
      ))
      .orderBy(desc(upscaleJobs.createdAt));
  }

  async dismissUpscaleJob(jobId: string): Promise<UpscaleJob | undefined> {
    const [updated] = await db.update(upscaleJobs)
      .set({
        state: 'dismissed',
        updatedAt: new Date(),
      })
      .where(eq(upscaleJobs.id, jobId))
      .returning();
    return updated;
  }

  // Upscale model operations
  async getUpscaleModels(): Promise<UpscaleModel[]> {
    return await db.select().from(upscaleModels).orderBy(upscaleModels.sortOrder);
  }

  async getActiveUpscaleModels(): Promise<UpscaleModel[]> {
    return await db.select().from(upscaleModels)
      .where(eq(upscaleModels.isActive, true))
      .orderBy(upscaleModels.sortOrder);
  }

  async getUpscaleModel(modelId: string): Promise<UpscaleModel | undefined> {
    const [model] = await db.select().from(upscaleModels).where(eq(upscaleModels.modelId, modelId));
    return model;
  }
}

export const storage = new DatabaseStorage();
