import { db } from '../db';
import { videoJobs, videos } from '@shared/schema';
import { sql, eq, and, inArray, lt, ne } from 'drizzle-orm';

export async function cleanupStuckVideoJobs() {
  console.log('Running migration: Cleanup stuck video jobs and duplicate videos...');
  
  try {
    // 1. Mark old stuck video jobs as failed (jobs older than 1 hour still in processing/queued state)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const stuckJobsResult = await db
      .update(videoJobs)
      .set({ 
        state: 'failed', 
        error: 'Job timed out - automatically cleaned up on server restart',
        updatedAt: new Date()
      })
      .where(and(
        inArray(videoJobs.state, ['processing', 'queued', 'starting']),
        lt(videoJobs.createdAt, oneHourAgo)
      ))
      .returning({ id: videoJobs.id });
    
    if (stuckJobsResult.length > 0) {
      console.log(`Migration: Marked ${stuckJobsResult.length} stuck video jobs as failed`);
    }
    
    // 2. Find and remove duplicate videos (keeping the first one for each jobId)
    // First, find all jobIds that have duplicates
    const duplicatesQuery = await db.execute(sql`
      SELECT job_id, COUNT(*) as count, MIN(id) as keep_id
      FROM videos 
      WHERE job_id IS NOT NULL
      GROUP BY job_id 
      HAVING COUNT(*) > 1
    `);
    
    const duplicateJobIds = duplicatesQuery.rows as Array<{ job_id: string; count: string; keep_id: number }>;
    
    if (duplicateJobIds.length > 0) {
      let totalDeleted = 0;
      
      for (const dup of duplicateJobIds) {
        // Delete all videos for this jobId except the first one (keep_id)
        const deleteResult = await db
          .delete(videos)
          .where(and(
            eq(videos.jobId, dup.job_id),
            ne(videos.id, dup.keep_id)
          ))
          .returning({ id: videos.id });
        
        totalDeleted += deleteResult.length;
      }
      
      console.log(`Migration: Removed ${totalDeleted} duplicate videos from ${duplicateJobIds.length} job(s)`);
    } else {
      console.log('Migration: No duplicate videos found');
    }
    
    console.log('Migration complete: Cleaned up stuck video jobs and duplicates');
    
  } catch (error) {
    console.error('Migration error during stuck video job cleanup:', error);
  }
}
