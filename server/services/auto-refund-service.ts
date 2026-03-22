import { storage } from "../storage";
import { creditService } from "./credit-service";
import { db } from "../db";
import { creditTransactions } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

/**
 * Auto-refund service for failed/cancelled AI generation jobs
 * Automatically refunds credits when jobs fail or are cancelled
 */
export class AutoRefundService {
  private static instance: AutoRefundService;
  private refundedJobs: Set<string> = new Set(); // Track refunded jobs to prevent duplicates

  private constructor() {}

  static getInstance(): AutoRefundService {
    if (!AutoRefundService.instance) {
      AutoRefundService.instance = new AutoRefundService();
    }
    return AutoRefundService.instance;
  }

  /**
   * Refund credits for a failed or cancelled video job
   */
  async refundVideoJob(jobId: string, reason: 'failed' | 'cancelled'): Promise<boolean> {
    try {
      // Check if already refunded
      const refundKey = `video_job_${jobId}`;
      if (this.refundedJobs.has(refundKey)) {
        console.log(`Video job ${jobId} already refunded, skipping`);
        return false;
      }

      // Get the video job
      const job = await storage.getVideoJob(jobId);
      if (!job) {
        console.log(`Video job ${jobId} not found`);
        return false;
      }

      // Find the original credit transaction for this job
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, job.ownerId),
          eq(creditTransactions.type, "generation"),
          sql`${creditTransactions.metadata}->>'jobId' = ${jobId}`
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(1);

      if (transactions.length === 0) {
        console.log(`No credit transaction found for video job ${jobId}`);
        return false;
      }

      const originalTransaction = transactions[0];
      const refundAmount = Math.abs(originalTransaction.amount); // Convert negative deduction to positive refund

      // Issue refund
      await creditService.refundCredits(
        job.ownerId,
        refundAmount,
        `Video generation ${reason}: ${job.prompt.substring(0, 50)}...`,
        originalTransaction.id
      );

      // Mark as refunded
      this.refundedJobs.add(refundKey);

      console.log(`✅ Refunded ${refundAmount} credits for ${reason} video job ${jobId}`);
      return true;
    } catch (error) {
      console.error(`Failed to refund video job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Refund credits for a failed image generation
   */
  async refundImage(imageId: number, userId: string, reason: string = 'Generation failed'): Promise<boolean> {
    try {
      // Check if already refunded
      const refundKey = `image_${imageId}`;
      if (this.refundedJobs.has(refundKey)) {
        console.log(`Image ${imageId} already refunded, skipping`);
        return false;
      }

      // Find the original credit transaction for this image
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, "generation"),
          sql`${creditTransactions.metadata}->>'imageId' = ${imageId.toString()}`
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(1);

      if (transactions.length === 0) {
        console.log(`No credit transaction found for image ${imageId}`);
        return false;
      }

      const originalTransaction = transactions[0];
      const refundAmount = Math.abs(originalTransaction.amount);

      // Issue refund
      await creditService.refundCredits(
        userId,
        refundAmount,
        reason,
        originalTransaction.id
      );

      // Mark as refunded
      this.refundedJobs.add(refundKey);

      console.log(`✅ Refunded ${refundAmount} credits for failed image ${imageId}`);
      return true;
    } catch (error) {
      console.error(`Failed to refund image ${imageId}:`, error);
      return false;
    }
  }

  /**
   * Refund credits for a failed audio transcription
   */
  async refundAudioTranscription(userId: string, fileName: string, reason: string = 'Transcription failed'): Promise<boolean> {
    try {
      // Check if already refunded
      const refundKey = `audio_${userId}_${fileName}`;
      if (this.refundedJobs.has(refundKey)) {
        console.log(`Audio ${fileName} already refunded, skipping`);
        return false;
      }

      // Find the most recent audio transcription transaction for this user
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, "generation"),
          sql`${creditTransactions.metadata}->>'fileName' = ${fileName}`
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(1);

      if (transactions.length === 0) {
        console.log(`No credit transaction found for audio ${fileName}`);
        return false;
      }

      const originalTransaction = transactions[0];
      const refundAmount = Math.abs(originalTransaction.amount);

      // Issue refund
      await creditService.refundCredits(
        userId,
        refundAmount,
        reason,
        originalTransaction.id
      );

      // Mark as refunded
      this.refundedJobs.add(refundKey);

      console.log(`✅ Refunded ${refundAmount} credits for failed audio ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Failed to refund audio ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Refund credits for any failed generation by finding the most recent transaction
   * with matching metadata
   */
  async refundByMetadata(
    userId: string,
    metadataKey: string,
    metadataValue: string,
    reason: string
  ): Promise<boolean> {
    try {
      const refundKey = `metadata_${userId}_${metadataKey}_${metadataValue}`;
      if (this.refundedJobs.has(refundKey)) {
        console.log(`Already refunded for ${metadataKey}=${metadataValue}, skipping`);
        return false;
      }

      // Find the transaction
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, "generation"),
          sql`${creditTransactions.metadata}->>${metadataKey} = ${metadataValue}`
        ))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(1);

      if (transactions.length === 0) {
        console.log(`No transaction found for ${metadataKey}=${metadataValue}`);
        return false;
      }

      const originalTransaction = transactions[0];
      const refundAmount = Math.abs(originalTransaction.amount);

      await creditService.refundCredits(
        userId,
        refundAmount,
        reason,
        originalTransaction.id
      );

      this.refundedJobs.add(refundKey);

      console.log(`✅ Refunded ${refundAmount} credits for ${reason}`);
      return true;
    } catch (error) {
      console.error(`Failed to refund by metadata:`, error);
      return false;
    }
  }

  /**
   * Clear refund tracking (useful for testing or after a time period)
   */
  clearRefundTracking(key?: string): void {
    if (key) {
      this.refundedJobs.delete(key);
    } else {
      this.refundedJobs.clear();
    }
  }

  /**
   * Check if a job has been refunded
   */
  isRefunded(jobType: 'video_job' | 'image' | 'audio', identifier: string): boolean {
    const refundKey = `${jobType}_${identifier}`;
    return this.refundedJobs.has(refundKey);
  }
}

export const autoRefundService = AutoRefundService.getInstance();
