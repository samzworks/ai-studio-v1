#!/usr/bin/env tsx

import { db } from '../server/db';
import { videos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { createVideoThumbnail } from '../server/thumbnail-generator';
import { spawn } from 'child_process';

async function regenerateThumbnails() {
  console.log('🔍 Finding videos with broken thumbnails...');
  
  // Query videos where thumbnail_url equals the video url (broken state)
  const brokenVideos = await db
    .select({
      id: videos.id,
      url: videos.url,
      thumbnailUrl: videos.thumbnailUrl,
      prompt: videos.prompt
    })
    .from(videos)
    .where(eq(videos.thumbnailUrl, videos.url));

  console.log(`Found ${brokenVideos.length} videos with broken thumbnails`);

  if (brokenVideos.length === 0) {
    console.log('✅ All videos have proper thumbnails!');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const video of brokenVideos) {
    try {
      console.log(`\n📹 Processing video ${video.id}: "${video.prompt.substring(0, 50)}..."`);
      console.log(`   Video URL: ${video.url}`);
      
      // Generate new thumbnail using existing function
      const newThumbnailUrl = await createVideoThumbnail(video.url, video.id);
      
      // Update database with new thumbnail URL
      await db
        .update(videos)
        .set({ thumbnailUrl: newThumbnailUrl })
        .where(eq(videos.id, video.id));
      
      console.log(`✅ Generated thumbnail: ${newThumbnailUrl}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to generate thumbnail for video ${video.id}:`, error);
      failureCount++;
    }
  }

  console.log(`\n🎯 Summary:`);
  console.log(`   ✅ Successfully regenerated: ${successCount} thumbnails`);
  console.log(`   ❌ Failed: ${failureCount} thumbnails`);
  console.log(`   📊 Total processed: ${brokenVideos.length} videos`);
  
  if (successCount > 0) {
    console.log('\n🎉 Thumbnail regeneration completed! Broken thumbnails have been fixed.');
  }
}

// Check if ffmpeg is available
async function checkFFmpeg() {
  return new Promise<boolean>((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    ffmpeg.on('error', () => {
      console.log('⚠️  FFmpeg not found. Thumbnails will use SVG placeholders.');
      resolve(false);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ FFmpeg is available for thumbnail generation');
        resolve(true);
      } else {
        console.log('⚠️  FFmpeg not working properly. Thumbnails will use SVG placeholders.');
        resolve(false);
      }
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting thumbnail regeneration process...');
    
    // Check FFmpeg availability
    await checkFFmpeg();
    
    await regenerateThumbnails();
    
  } catch (error) {
    console.error('💥 Fatal error during thumbnail regeneration:', error);
    process.exit(1);
  }
  
  console.log('🏁 Thumbnail regeneration process finished');
  process.exit(0);
}

// Run the script
main();