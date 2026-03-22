import { storage } from "../storage";
import type { CreditTransaction, UserCredits, UserEntitlements, CreditLedgerEntry, SubscriptionPlan } from "@shared/schema";
import { pricingCalculator } from "./pricing-calculator";
import { sendLowCreditsAlertToAdmin } from "./email-service";

const LOW_CREDITS_THRESHOLD = 50;

export class CreditService {
  private static instance: CreditService;
  
  // Track processed job IDs to prevent double-charging (in-memory, resets on server restart)
  private processedJobs: Map<string, { 
    transactionId: number;
    userId: string;
    timestamp: number;
    settled?: boolean;
    settledAt?: number;
    released?: boolean;
    releasedAt?: number;
  }> = new Map();
  private readonly IDEMPOTENCY_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Track users who have been alerted for low credits (to avoid spamming admin)
  private lowCreditsAlertedUsers: Set<string> = new Set();

  private constructor() {
    // Clean up old entries every hour
    setInterval(() => this.cleanupIdempotencyCache(), 60 * 60 * 1000);
  }

  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService();
    }
    return CreditService.instance;
  }

  /**
   * Clean up expired idempotency cache entries
   */
  private cleanupIdempotencyCache(): void {
    const now = Date.now();
    const entries = Array.from(this.processedJobs.entries());
    for (const [jobId, entry] of entries) {
      if (now - entry.timestamp > this.IDEMPOTENCY_CACHE_DURATION) {
        this.processedJobs.delete(jobId);
      }
    }
  }

  /**
   * Check if user balance dropped below threshold and alert admin (once per user)
   */
  private async checkAndAlertLowBalance(userId: string, newBalance: number): Promise<void> {
    // Only alert if balance dropped below threshold and we haven't already alerted for this user
    if (newBalance < LOW_CREDITS_THRESHOLD && !this.lowCreditsAlertedUsers.has(userId)) {
      try {
        const user = await storage.getUser(userId);
        if (user) {
          const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown User";
          const userEmail = user.email || "No email";
          
          sendLowCreditsAlertToAdmin(userId, userName, userEmail, newBalance).catch(err => {
            console.error("[CreditService] Failed to send low credits alert to admin:", err);
          });
          
          // Mark user as alerted to prevent duplicate alerts
          this.lowCreditsAlertedUsers.add(userId);
          console.log(`[CreditService] Low credits alert sent to admin for user ${userId} (balance: ${newBalance})`);
        }
      } catch (error) {
        console.error("[CreditService] Error checking low balance alert:", error);
      }
    }
    
    // If balance goes back above threshold, clear the alert flag so they can be alerted again in the future
    if (newBalance >= LOW_CREDITS_THRESHOLD && this.lowCreditsAlertedUsers.has(userId)) {
      this.lowCreditsAlertedUsers.delete(userId);
    }
  }

  /**
   * Calculate cost for an AI operation using the new pricing calculator
   */
  async calculateOperationCost(operationId: string, params?: any): Promise<{
    credits: number;
    snapshot: any;
  }> {
    const result = await pricingCalculator.calculate(operationId, params || {});
    return {
      credits: result.credits,
      snapshot: result
    };
  }

  /**
   * Get user's available credit balance from the new ledger system
   * Uses FEFO (First-Expiring-First-Out) calculation for unexpired credits
   * Admins get unlimited credits (999999)
   */
  async getUserBalance(userId: string): Promise<number> {
    // Check if user is admin - admins get unlimited credits
    const user = await storage.getUser(userId);
    if (user?.role === "admin") {
      return 999999;
    }
    // Use the new ledger-based balance calculation
    return await storage.getAvailableCreditsFromLedger(userId);
  }

  /**
   * Get legacy user credits info - still used for backward compatibility
   * New code should use getUserEntitlements() instead
   */
  async getUserCreditsInfo(userId: string): Promise<UserCredits | null> {
    const credits = await storage.getUserCredits(userId);
    if (!credits) {
      // Initialize credits for new users (both legacy and ledger)
      return await this.initializeUserCredits(userId);
    }
    return credits;
  }

  /**
   * Initialize credits for a new user
   * Creates both legacy record and ledger entry for backward compatibility
   */
  async initializeUserCredits(userId: string): Promise<UserCredits> {
    const initialCredits = 100;
    
    // Create legacy record for backward compatibility
    const legacyCredits = await storage.initializeUserCredits(userId, initialCredits);
    
    // Also create a ledger entry for the new system
    try {
      await storage.createCreditLedgerEntry({
        userId,
        sourceType: "admin_grant",
        sourceId: `initial_${userId}`,
        amount: initialCredits,
        expiresAt: null, // Initial credits don't expire
        description: "Initial signup credits"
      });
    } catch (error) {
      // Log but don't fail - legacy system is the primary for now
      console.error("[CreditService] Failed to create ledger entry for initial credits:", error);
    }
    
    return legacyCredits;
  }

  /**
   * Deduct credits using the new ledger system with FEFO logic
   * Also maintains backward compatibility with legacy transactions table
   * Admins are exempt from credit deduction (free usage)
   */
  async deductCredits(
    userId: string, 
    amount: number, 
    description: string, 
    metadata?: any
  ): Promise<CreditTransaction | null> {
    // Check if user is admin - admins don't consume credits
    const user = await storage.getUser(userId);
    if (user?.role === "admin") {
      console.log(`[CreditService] Admin ${userId} exempt from credit deduction: ${description}`);
      return null;
    }
    
    // Use the new ledger-based deduction with FEFO
    const sourceId = metadata?.jobId || metadata?.operationId || `deduction_${Date.now()}`;
    
    try {
      await storage.deductCreditsFromLedger(userId, amount, description, sourceId, metadata);
      
      // Also create legacy transaction for backward compatibility
      const transaction = await storage.deductCredits(userId, amount, description, metadata);
      
      // Check for low balance and alert admin if needed
      if (transaction) {
        const newBalance = await this.getUserBalance(userId);
        this.checkAndAlertLowBalance(userId, newBalance).catch(err => {
          console.error("[CreditService] Failed to check low balance:", err);
        });
      }
      
      return transaction || null;
    } catch (error) {
      console.error("[CreditService] Failed to deduct credits:", error);
      throw error;
    }
  }

  /**
   * Deduct credits for an AI operation with cost snapshot
   * Uses the new ledger-based deduction
   */
  async deductCreditsForOperation(
    userId: string,
    operationId: string,
    description: string,
    params?: any,
    additionalMetadata?: any
  ): Promise<CreditTransaction | null> {
    // Calculate cost using pricing calculator
    const { credits, snapshot } = await this.calculateOperationCost(operationId, params);

    // Use the unified deductCredits method which handles both ledger and legacy
    return await this.deductCredits(
      userId,
      credits,
      description,
      {
        ...additionalMetadata,
        operationId,
        costSnapshot: snapshot
      }
    );
  }

  /**
   * Add credits using both ledger and legacy system
   */
  async addCredits(
    userId: string, 
    amount: number, 
    description: string, 
    metadata?: any
  ): Promise<CreditTransaction> {
    // Also create ledger entry
    const sourceType = metadata?.type || "admin_grant";
    const sourceId = metadata?.sourceId || `grant_${Date.now()}`;
    
    try {
      await storage.createCreditLedgerEntry({
        userId,
        sourceType,
        sourceId,
        amount,
        expiresAt: metadata?.expiresAt || null,
        description,
        metadata
      });
    } catch (error) {
      console.error("[CreditService] Failed to create ledger entry for addCredits:", error);
    }
    
    // Legacy transaction for backward compatibility
    const transaction = await storage.addCredits(userId, amount, description, metadata);
    
    // Check balance to reset low credits alert flag if user is now above threshold
    if (transaction) {
      const newBalance = await this.getUserBalance(userId);
      this.checkAndAlertLowBalance(userId, newBalance).catch(err => {
        console.error("[CreditService] Failed to check low balance:", err);
      });
    }
    
    return transaction;
  }

  /**
   * Grant credits with ledger entry (admin grant type)
   */
  async grantCredits(
    userId: string, 
    amount: number, 
    reason: string, 
    metadata?: any
  ): Promise<CreditTransaction> {
    return await this.addCredits(userId, amount, reason, {
      ...metadata,
      type: "admin_grant",
      sourceId: `admin_grant_${Date.now()}`
    });
  }

  /**
   * Grant subscription credits with proper expiration
   */
  async processSubscriptionCredits(
    userId: string, 
    planCredits: number, 
    periodEnd?: Date
  ): Promise<CreditTransaction> {
    return await this.addCredits(
      userId,
      planCredits,
      "Monthly subscription credits",
      { 
        type: "subscription_grant",
        sourceId: `subscription_${Date.now()}`,
        expiresAt: periodEnd || null // Subscription credits expire at period end
      }
    );
  }

  /**
   * Refund credits (adds to balance)
   */
  async refundCredits(
    userId: string, 
    amount: number, 
    reason: string,
    originalTransactionId?: number
  ): Promise<CreditTransaction> {
    return await this.addCredits(
      userId,
      amount,
      `Refund: ${reason}`,
      { 
        type: "refund",
        sourceId: `refund_${originalTransactionId || Date.now()}`,
        originalTransactionId,
        reason 
      }
    );
  }

  /**
   * Get user's full entitlements including plan, features, and credits
   */
  async getUserEntitlements(userId: string): Promise<import("@shared/schema").UserEntitlements> {
    return await storage.getUserEntitlements(userId);
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeatureAccess(userId: string, feature: keyof import("@shared/schema").FeatureFlags): Promise<boolean> {
    const entitlements = await this.getUserEntitlements(userId);
    return entitlements.featureFlags[feature] === true;
  }

  /**
   * Require feature access - throws if not allowed
   */
  async requireFeatureAccess(userId: string, feature: keyof import("@shared/schema").FeatureFlags): Promise<void> {
    const hasAccess = await this.hasFeatureAccess(userId, feature);
    if (!hasAccess) {
      throw new Error(`Feature '${feature}' is not available on your current plan`);
    }
  }

  async getTransactionHistory(
    userId: string, 
    limit = 50, 
    offset = 0
  ): Promise<CreditTransaction[]> {
    return await storage.getUserCreditTransactions(userId, limit, offset);
  }

  async hasEnoughCredits(userId: string, requiredAmount: number): Promise<boolean> {
    const balance = await this.getUserBalance(userId);
    return balance >= requiredAmount;
  }

  /**
   * Get existing credit_hold transaction by jobId (DB lookup for idempotency)
   * Only returns hold transactions, not settlements or refunds
   * 
   * Note: This is not the most efficient approach as it requires userId.
   * A better solution would be to add a getTransactionByJobId method to storage.
   */
  private async getHoldTransactionByJobId(jobId: string, userId?: string): Promise<CreditTransaction | null> {
    // If we have userId, query just that user's transactions
    if (userId) {
      const transactions = await storage.getUserCreditTransactions(userId, 1000, 0);
      return transactions.find((t: CreditTransaction) => 
        t.metadata && 
        typeof t.metadata === 'object' && 
        'jobId' in t.metadata && 
        t.metadata.jobId === jobId &&
        'type' in t.metadata &&
        t.metadata.type === 'credit_hold'
      ) || null;
    }
    
    // Without userId, check the cache which now stores userId
    const cached = this.processedJobs.get(jobId);
    if (cached && cached.userId) {
      // We have userId from cache, query that user's transactions
      const transactions = await storage.getUserCreditTransactions(cached.userId, 1000, 0);
      return transactions.find((t: CreditTransaction) => 
        t.metadata && 
        typeof t.metadata === 'object' && 
        'jobId' in t.metadata && 
        t.metadata.jobId === jobId &&
        'type' in t.metadata &&
        t.metadata.type === 'credit_hold'
      ) || null;
    }
    
    return null;
  }

  /**
   * Hold credits for a pending operation (auth-hold pattern)
   * Credits are deducted from balance immediately but marked as "credit_hold"
   * Must be settled or released later
   * Admins are exempt from credit holds (free usage)
   * 
   * @param userId - User ID
   * @param operationId - Operation identifier from pricing catalog
   * @param description - Human-readable description
   * @param jobId - Unique job identifier for idempotency
   * @param params - Parameters for cost calculation (e.g., {units: 5} for 5 seconds)
   * @param fallbackCredits - Fallback credit amount if operation not found in catalog
   * @returns Object with status: 'success' (with transaction), 'admin_exempt', or 'already_processed'
   */
  async holdCreditsForOperation(
    userId: string,
    operationId: string,
    description: string,
    jobId: string,
    params?: any,
    fallbackCredits?: number
  ): Promise<{ status: 'success'; transaction: CreditTransaction } | { status: 'admin_exempt' } | { status: 'already_processed'; jobId: string }> {
    // Check if user is admin - admins don't need credit holds
    const user = await storage.getUser(userId);
    if (user?.role === "admin") {
      console.log(`[CreditService] Admin ${userId} exempt from credit hold: ${description}`);
      return { status: 'admin_exempt' };
    }
    
    // Check DB for existing hold transaction with this jobId (idempotency - survives restarts)
    // NOTE: This read-before-write has a race condition window. Ideally we'd use a DB unique
    // constraint on (jobId, type='credit_hold') to enforce idempotency at the database level.
    // For now, we catch any duplicate creation errors below.
    const existingHold = await this.getHoldTransactionByJobId(jobId, userId);
    if (existingHold) {
      console.log(`[CreditService] Job ${jobId} already has hold transaction ${existingHold.id}, skipping duplicate`);
      // Update cache if not present
      if (!this.processedJobs.has(jobId)) {
        this.processedJobs.set(jobId, {
          transactionId: existingHold.id,
          userId: userId,
          timestamp: Date.now()
        });
      }
      return { status: 'already_processed', jobId };
    }

    // Calculate cost
    let credits: number;
    let snapshot: any;
    
    try {
      const cost = await this.calculateOperationCost(operationId, params);
      credits = cost.credits;
      snapshot = cost.snapshot;
    } catch (error) {
      // If operation not found in catalog, use fallback if provided
      if (fallbackCredits !== undefined) {
        console.warn(`[CreditService] Operation ${operationId} not found, using fallback: ${fallbackCredits} credits`);
        credits = fallbackCredits;
        snapshot = { 
          operationId, 
          fallback: true, 
          fallbackCredits,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } else {
        // No fallback provided, re-throw
        throw error;
      }
    }

    // Check sufficient balance
    const hasEnough = await this.hasEnoughCredits(userId, credits);
    if (!hasEnough) {
      throw new Error(`Insufficient credits. Required: ${credits}, Available: ${await this.getUserBalance(userId)}`);
    }

    // Deduct credits and mark as hold
    // In case of race condition (concurrent requests), we might create a duplicate
    // The second check after creation helps but doesn't fully prevent TOCTTOU races
    const transaction = await storage.deductCredits(
      userId,
      credits,
      `[HOLD] ${description}`,
      {
        type: "credit_hold",
        jobId,
        operationId,
        costSnapshot: snapshot,
        status: "pending"
      }
    );

    if (transaction) {
      // Double-check: if another hold was just created, refund this one
      const allHolds = await this.getHoldTransactionByJobId(jobId, userId);
      if (allHolds && allHolds.id !== transaction.id) {
        console.warn(`[CreditService] Race condition detected for job ${jobId}, refunding duplicate hold`);
        await this.refundCredits(
          userId,
          credits,
          `Duplicate hold detected for job ${jobId}`,
          transaction.id
        );
        return { status: 'already_processed', jobId };
      }

      // Cache for performance (but DB is source of truth)
      this.processedJobs.set(jobId, {
        transactionId: transaction.id,
        userId: userId,
        timestamp: Date.now()
      });

      // Check for low balance and alert admin if needed
      this.checkAndAlertLowBalance(userId, transaction.balance).catch(err => {
        console.error("[CreditService] Failed to check low balance:", err);
      });
      
      return { status: 'success', transaction };
    }

    throw new Error('Failed to create credit hold transaction');
  }

  /**
   * Settle a credit hold after successful operation completion
   * Converts the hold transaction to a final generation transaction
   * 
   * @param jobId - Job identifier
   * @param actualUnits - Actual units delivered (for partial completion handling)
   * @returns True if settled successfully
   */
  async settleHold(
    jobId: string,
    actualUnits?: number,
    settlementMetadata?: { model?: string; operationType?: string }
  ): Promise<boolean> {
    // Check if already settled in cache (fast path)
    const entry = this.processedJobs.get(jobId);
    if (entry && 'settled' in entry && entry.settled) {
      console.log(`[CreditService] Job ${jobId} already settled in cache, skipping`);
      return true;
    }

    // Query DB for hold transaction (handles restarts)
    // Note: We don't have userId here, so we check cache first
    const holdTransaction = await this.getHoldTransactionByJobId(jobId);
    
    if (!holdTransaction) {
      console.warn(`[CreditService] No credit_hold found for job ${jobId}, cannot settle`);
      return false;
    }

    const userId = holdTransaction.userId;
    
    // If we got a minimal transaction from cache, query full transaction
    if (!userId && holdTransaction.id) {
      // Need to find the actual transaction - try to get it from user transactions
      // This is inefficient but handles the restart case
      console.warn(`[CreditService] Hold found in cache but userId missing, settle may be incomplete`);
      return false;
    }
    if (!userId) {
      console.error(`[CreditService] Cannot find user for job ${jobId}`);
      return false;
    }

    // Calculate final amount after any partial refunds
    // Note: holdTransaction.amount is stored as negative (deduction), so we use absolute value
    let finalAmount = Math.abs(holdTransaction.amount);
    
    // If actualUnits provided and different from original, handle partial completion
    if (actualUnits !== undefined && holdTransaction.metadata) {
      const originalSnapshot = (holdTransaction.metadata as any).costSnapshot;
      if (originalSnapshot && originalSnapshot.units !== actualUnits) {
        const refundAmount = await this.calculatePartialRefund(
          holdTransaction.amount,
          originalSnapshot.units,
          actualUnits
        );

        if (refundAmount > 0) {
          await this.refundCredits(
            userId,
            refundAmount,
            `Partial completion refund for job ${jobId} (${actualUnits}/${originalSnapshot.units} units)`,
            holdTransaction.id
          );
          finalAmount = holdTransaction.amount - refundAmount;
        }
      }
    }

    // Extract model name from hold description or metadata
    let modelName = settlementMetadata?.model;
    let operationType = settlementMetadata?.operationType;
    
    if (!modelName && holdTransaction.description) {
      // Try to extract model from description like "Image generation: fal-nano-banana-txt2img"
      const match = holdTransaction.description.match(/:\s*(.+)$/);
      if (match) {
        modelName = match[1].replace('[HOLD] ', '').trim();
      }
    }
    
    if (!operationType && holdTransaction.description) {
      if (holdTransaction.description.toLowerCase().includes('image')) {
        operationType = 'Image Generation';
      } else if (holdTransaction.description.toLowerCase().includes('video')) {
        operationType = 'Video Generation';
      } else if (holdTransaction.description.toLowerCase().includes('storyboard')) {
        operationType = 'Film Studio';
      }
    }
    
    // Create usage_deduction ledger entry so it appears in usage history
    if (finalAmount > 0) {
      try {
        const holdMetadata = holdTransaction.metadata as any || {};
        await storage.deductCreditsFromLedger(
          userId,
          finalAmount,
          holdTransaction.description?.replace('[HOLD] ', '') || `Generation job ${jobId}`,
          jobId,
          {
            ...holdMetadata,
            model: modelName,
            operationType: operationType,
            settledAt: new Date().toISOString(),
            holdTransactionId: holdTransaction.id
          }
        );
      } catch (ledgerError) {
        console.error(`[CreditService] Failed to create ledger entry for job ${jobId}:`, ledgerError);
        // Don't fail the settle - the hold transaction already deducted the credits
      }
    }

    // Mark as settled in cache for future lookups
    this.processedJobs.set(jobId, {
      transactionId: holdTransaction.id,
      userId: userId,
      timestamp: Date.now(),
      settled: true,
      settledAt: Date.now()
    });

    console.log(`[CreditService] Settled hold for job ${jobId}, transaction ${holdTransaction.id}, model: ${modelName}`);
    
    return true;
  }

  /**
   * Release a credit hold after operation failure
   * Refunds the held credits back to the user
   * 
   * @param jobId - Job identifier
   * @param reason - Reason for release
   * @returns True if released successfully
   */
  async releaseHold(
    jobId: string,
    reason: string
  ): Promise<boolean> {
    // Query DB for hold transaction (handles restarts)
    // Note: We don't have userId here, so we check cache first
    const holdTransaction = await this.getHoldTransactionByJobId(jobId);
    
    if (!holdTransaction) {
      console.warn(`[CreditService] No credit_hold found for job ${jobId}, cannot release (may already be released)`);
      return false;
    }

    const userId = holdTransaction.userId;
    
    // If we got a minimal transaction from cache, query full transaction
    if (!userId && holdTransaction.id) {
      console.warn(`[CreditService] Hold found in cache but userId missing, release may be incomplete`);
      return false;
    }
    if (!userId) {
      console.error(`[CreditService] Cannot find user for job ${jobId}`);
      return false;
    }

    // Refund the held amount
    // NOTE: This creates a refund transaction but doesn't mark the hold as "released"
    // The hold transaction remains in the DB with type='credit_hold'
    // Future improvement: add a 'released' flag in metadata or create a separate release record
    await this.refundCredits(
      userId,
      holdTransaction.amount,
      `Hold released: ${reason}`,
      holdTransaction.id
    );

    // Mark as released in cache to prevent double-releases
    this.processedJobs.set(jobId, {
      transactionId: holdTransaction.id,
      userId: userId,
      timestamp: Date.now(),
      released: true,
      releasedAt: Date.now()
    });

    console.log(`[CreditService] Released hold for job ${jobId}, refunded ${holdTransaction.amount} credits`);
    return true;
  }

  /**
   * Calculate partial refund amount based on actual vs expected units
   */
  private async calculatePartialRefund(
    totalCharged: number,
    expectedUnits: number,
    actualUnits: number
  ): Promise<number> {
    if (actualUnits >= expectedUnits) {
      return 0; // No refund if we delivered expected or more
    }

    const perUnitCost = totalCharged / expectedUnits;
    const shouldHaveCharged = Math.ceil(perUnitCost * actualUnits);
    return Math.max(0, totalCharged - shouldHaveCharged);
  }

  /**
   * Helper to find user ID from job transaction
   */
  private async getUserIdFromJobTransaction(jobId: string): Promise<string | null> {
    // This is a helper that needs to be implemented based on your job tracking
    // For now, we'll search through recent transactions
    // In production, you might want to store this mapping explicitly
    
    // Try to find from video jobs
    const videoJob = await storage.getVideoJob(jobId);
    if (videoJob) {
      return videoJob.ownerId;
    }

    // If not found, we can't proceed
    return null;
  }

  /**
   * Check if a job has already been charged (idempotency check)
   */
  isJobProcessed(jobId: string): boolean {
    return this.processedJobs.has(jobId);
  }

  /**
   * Get transaction for a job
   */
  getJobTransaction(jobId: string): { transactionId: number; timestamp: number } | undefined {
    return this.processedJobs.get(jobId);
  }

  // =============================================================================
  // NEW CREDIT LEDGER SYSTEM METHODS
  // =============================================================================

  /**
   * Get user entitlements including plan, feature flags, and credits breakdown
   */
  async getUserEntitlements(userId: string): Promise<UserEntitlements> {
    return await storage.getUserEntitlements(userId);
  }

  /**
   * Get available credits from the ledger (unexpired only)
   */
  async getAvailableCreditsFromLedger(userId: string): Promise<number> {
    return await storage.getAvailableCreditsFromLedger(userId);
  }

  /**
   * Grant subscription credits that expire at the end of the billing period
   * These are non-rollover credits tied to the subscription cycle
   * 
   * @param userId - User ID
   * @param amount - Credit amount to grant
   * @param periodEnd - Date when these credits expire (end of billing period)
   * @param subscriptionId - Stripe subscription ID for tracking
   */
  async grantSubscriptionCredits(
    userId: string,
    amount: number,
    periodEnd: Date,
    subscriptionId: string
  ): Promise<CreditLedgerEntry> {
    const entry = await storage.createCreditLedgerEntry({
      userId,
      sourceType: "subscription_grant",
      sourceId: subscriptionId,
      amount,
      expiresAt: periodEnd,
      description: `Monthly subscription credits (expires ${periodEnd.toLocaleDateString()})`,
      metadata: { subscriptionId, grantType: "subscription_renewal" }
    });

    console.log(`[CreditService] Granted ${amount} subscription credits to user ${userId}, expires ${periodEnd.toISOString()}`);
    return entry;
  }

  /**
   * Grant top-up credits that expire after a specified number of days
   * 
   * @param userId - User ID
   * @param amount - Credit amount to grant
   * @param expirationDays - Days until expiration (from now)
   * @param purchaseId - Purchase ID for tracking
   * @param packName - Name of the top-up pack
   */
  async grantTopupCredits(
    userId: string,
    amount: number,
    expirationDays: number,
    purchaseId: number,
    packName: string
  ): Promise<CreditLedgerEntry> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const entry = await storage.createCreditLedgerEntry({
      userId,
      sourceType: "topup_purchase",
      sourceId: purchaseId.toString(),
      amount,
      expiresAt,
      description: `Top-up: ${packName} (expires ${expiresAt.toLocaleDateString()})`,
      metadata: { purchaseId, packName, expirationDays }
    });

    console.log(`[CreditService] Granted ${amount} top-up credits to user ${userId}, expires in ${expirationDays} days`);
    return entry;
  }

  /**
   * Grant admin bonus credits (may or may not expire)
   * 
   * @param userId - User ID
   * @param amount - Credit amount to grant
   * @param reason - Reason for the grant
   * @param expiresAt - Optional expiration date (null for never expires)
   * @param adminId - Admin who granted the credits
   */
  async grantAdminCredits(
    userId: string,
    amount: number,
    reason: string,
    expiresAt: Date | null = null,
    adminId: string
  ): Promise<CreditLedgerEntry> {
    const entry = await storage.createCreditLedgerEntry({
      userId,
      sourceType: "admin_grant",
      sourceId: `admin_${adminId}_${Date.now()}`,
      amount,
      expiresAt,
      description: reason,
      metadata: { adminId, grantReason: reason }
    });

    console.log(`[CreditService] Admin ${adminId} granted ${amount} credits to user ${userId}${expiresAt ? `, expires ${expiresAt.toISOString()}` : ', no expiration'}`);
    return entry;
  }

  /**
   * Grant coupon bonus credits
   * 
   * @param userId - User ID
   * @param amount - Credit amount to grant
   * @param couponCode - Coupon code used
   * @param couponId - Coupon database ID
   * @param expiresAt - Optional expiration date
   */
  async grantCouponCredits(
    userId: string,
    amount: number,
    couponCode: string,
    couponId: number,
    expiresAt: Date | null = null
  ): Promise<CreditLedgerEntry> {
    const entry = await storage.createCreditLedgerEntry({
      userId,
      sourceType: "coupon_redemption",
      sourceId: `coupon_${couponId}`,
      amount,
      expiresAt,
      description: `Coupon ${couponCode} bonus credits`,
      metadata: { couponCode, couponId }
    });

    console.log(`[CreditService] Granted ${amount} coupon credits to user ${userId} (code: ${couponCode})`);
    return entry;
  }

  /**
   * Deduct credits using FEFO (First-Expiring-First-Out) logic
   * 
   * @param userId - User ID
   * @param amount - Credits to deduct
   * @param reason - Reason for deduction
   * @param operationId - Reference ID for the operation
   * @param metadata - Additional metadata
   */
  async deductCreditsFromLedger(
    userId: string,
    amount: number,
    reason: string,
    operationId: string,
    metadata?: any
  ): Promise<CreditLedgerEntry[]> {
    // Check available balance first
    const available = await this.getAvailableCreditsFromLedger(userId);
    if (available < amount) {
      throw new Error(`Insufficient credits. Required: ${amount}, Available: ${available}`);
    }

    const entries = await storage.deductCreditsFromLedger(userId, amount, reason, operationId, metadata);
    
    // Check for low balance alert
    const newBalance = await this.getAvailableCreditsFromLedger(userId);
    this.checkAndAlertLowBalance(userId, newBalance).catch(err => {
      console.error("[CreditService] Failed to check low balance:", err);
    });

    return entries;
  }

  /**
   * Check if user has a specific feature enabled based on their plan
   * 
   * @param userId - User ID
   * @param feature - Feature flag to check
   */
  async hasFeatureAccess(userId: string, feature: keyof UserEntitlements['featureFlags']): Promise<boolean> {
    const entitlements = await this.getUserEntitlements(userId);
    return entitlements.featureFlags[feature] === true;
  }

  /**
   * Validate feature access and throw if not allowed
   * 
   * @param userId - User ID
   * @param feature - Feature flag to check
   * @param featureName - Human-readable feature name for error message
   */
  async requireFeatureAccess(userId: string, feature: keyof UserEntitlements['featureFlags'], featureName: string): Promise<void> {
    const hasAccess = await this.hasFeatureAccess(userId, feature);
    if (!hasAccess) {
      throw new Error(`Your current plan does not include access to ${featureName}. Please upgrade your subscription.`);
    }
  }

  /**
   * Get user's credit ledger history (all entries including expired)
   */
  async getCreditLedgerHistory(userId: string): Promise<CreditLedgerEntry[]> {
    return await storage.getCreditLedgerEntries(userId);
  }

  /**
   * Expire subscription credits for a user (called when subscription ends/cancels)
   * Creates a deduction entry to zero out remaining subscription credits
   * 
   * @param userId - User ID
   * @param subscriptionId - Subscription ID to expire credits for
   */
  async expireSubscriptionCredits(userId: string, subscriptionId: string): Promise<void> {
    const ledgerEntries = await storage.getUnexpiredCreditLedgerEntries(userId);
    
    // Find unexpired subscription credits for this subscription
    const subscriptionCredits = ledgerEntries.filter(
      e => e.sourceType === "subscription_grant" && 
           e.sourceId === subscriptionId && 
           e.amount > 0
    );

    // Calculate total remaining subscription credits
    let remainingSubscriptionCredits = 0;
    for (const entry of subscriptionCredits) {
      remainingSubscriptionCredits += entry.amount;
    }

    // Account for deductions already made
    const deductions = ledgerEntries.filter(e => e.amount < 0);
    for (const deduction of deductions) {
      remainingSubscriptionCredits = Math.max(0, remainingSubscriptionCredits + deduction.amount);
    }

    if (remainingSubscriptionCredits > 0) {
      // Create an expiration entry
      await storage.createCreditLedgerEntry({
        userId,
        sourceType: "subscription_expiry",
        sourceId: subscriptionId,
        amount: -remainingSubscriptionCredits,
        expiresAt: null,
        description: `Subscription credits expired (subscription ended)`,
        metadata: { subscriptionId, expiredAmount: remainingSubscriptionCredits }
      });

      console.log(`[CreditService] Expired ${remainingSubscriptionCredits} subscription credits for user ${userId}`);
    }
  }
}

export const creditService = CreditService.getInstance();