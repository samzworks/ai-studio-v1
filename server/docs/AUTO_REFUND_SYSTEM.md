# Auto-Refund System Documentation

## Overview
The auto-refund system automatically returns credits to users when AI generation jobs fail or are cancelled, ensuring fair billing and a positive user experience.

## How It Works

### Credit Deduction Timing

**Video Jobs (Job-based system)**
- Credits are deducted AFTER successful generation
- If a job fails before completion, credits were never deducted → no refund needed
- If a job completes but download fails, credits were already deducted → refund issued
- If a user cancels an in-progress job, credits may or may not have been deducted → refund only if found

**Image Generation**
- Credits are deducted AFTER successful generation
- If generation fails, credits were never deducted → no refund needed
- No persistent "failed" state for images (they either succeed or never exist)

**Audio Transcription**
- Credits are deducted AFTER successful transcription
- If transcription fails, credits were never deducted → no refund needed

### Auto-Refund Trigger Points

The auto-refund service automatically triggers when:

1. **Video Job Failures** (`failVideoJob` in storage.ts)
   - Called when: generation fails to start, polling detects failure, or timeout occurs
   - Refund: Only if a transaction with matching `jobId` exists

2. **Video Job Cancellations** (`cancelVideoJob` in storage.ts)
   - Called when: user cancels a job
   - Refund: Only if a transaction with matching `jobId` exists

3. **Manual Admin Actions** (via admin API)
   - Admins can manually trigger refunds for edge cases

### Refund Transaction Details

When a refund is issued:
- Transaction type: `"refund"`
- Amount: Positive (adds credits back)
- Description: Clear reason (e.g., "Video generation failed: timeout")
- Metadata: References the original transaction ID

### Duplicate Prevention

The auto-refund service tracks refunded jobs in memory to prevent duplicate refunds:
- Each refund is keyed by job type + identifier
- Prevents double-refunds if `failVideoJob` is called multiple times
- Cache persists for the lifetime of the server process

### Finding Original Transactions

The system finds the original credit deduction by:
1. Querying `credit_transactions` table
2. Filtering by `userId` and `type = 'generation'`
3. Matching metadata field (e.g., `jobId`, `imageId`, `fileName`)
4. Taking the most recent match (in case of retries)

## API Endpoints

### Manual Refund (Admin Only)
```
POST /api/admin/credits/refund
Body: {
  "userId": "user123",
  "jobType": "video_job" | "image" | "audio",
  "identifier": "job-uuid-123",
  "reason": "Manual refund due to [reason]"
}
```

## Edge Cases

### Case 1: Job fails during generation
- Credits not yet deducted → No refund needed ✓
- Auto-refund service finds no transaction → Returns false (no action)

### Case 2: Job completes, download fails
- Credits already deducted → Refund needed ✓
- Video marked as failed, auto-refund service finds transaction and refunds

### Case 3: User cancels job immediately
- Credits not yet deducted → No refund needed ✓
- Auto-refund service finds no transaction → Returns false (no action)

### Case 4: User cancels job during processing
- Credits may or may not be deducted
- Auto-refund service checks for transaction and refunds if found ✓

### Case 5: Server restarts during job processing
- In-memory duplicate prevention cache is cleared
- Database queries prevent actual duplicate transactions (even if refund is called twice)

## Code Integration

### Storage Layer Integration
```typescript
async failVideoJob(jobId: string, error: string): Promise<VideoJob | undefined> {
  // Update job state
  const [videoJob] = await db.update(videoJobs)...
  
  // Auto-refund if credits were deducted
  if (videoJob) {
    const { autoRefundService } = await import("./services/auto-refund-service");
    await autoRefundService.refundVideoJob(jobId, 'failed');
  }
  
  return videoJob;
}
```

### Direct Usage (for edge cases)
```typescript
import { autoRefundService } from './services/auto-refund-service';

// Refund a specific job
await autoRefundService.refundVideoJob(jobId, 'failed');

// Refund by metadata
await autoRefundService.refundByMetadata(
  userId, 
  'imageId', 
  '123', 
  'Image generation failed'
);
```

## Monitoring & Debugging

### Check if a job was refunded
```typescript
const isRefunded = autoRefundService.isRefunded('video_job', jobId);
```

### Clear refund tracking (for testing)
```typescript
autoRefundService.clearRefundTracking(); // Clear all
autoRefundService.clearRefundTracking('video_job_abc123'); // Clear specific
```

### Logs
The auto-refund service logs all refund attempts:
- Success: `✅ Refunded X credits for failed video job Y`
- No transaction found: `No credit transaction found for video job X`
- Already refunded: `Video job X already refunded, skipping`

## Best Practices

1. **Let the system handle it**: The auto-refund is integrated into `failVideoJob` and `cancelVideoJob`, so normal failure flows are automatically handled.

2. **Manual intervention**: Only use manual refund endpoints for edge cases or admin corrections.

3. **Check transaction history**: Before manually refunding, verify the original transaction exists and hasn't been refunded already.

4. **Monitor logs**: Watch for patterns of frequent refunds which may indicate issues with AI providers.
