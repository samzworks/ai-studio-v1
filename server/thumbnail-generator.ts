import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { createStorageService, type IStorageService } from './storageProvider';

function getObjectStorage(): IStorageService {
  return createStorageService();
}

/**
 * Generate a thumbnail image from a video file and upload to object storage
 * @param videoPath - Local temporary path to the video file
 * @param videoId - Video ID for unique filename
 * @returns Promise<string> - Object storage URL to the generated thumbnail
 */
export async function generateThumbnail(videoPath: string, videoId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Use temp directory for thumbnail generation
      const tempThumbnailPath = path.join(os.tmpdir(), `thumbnail-${videoId}-${uuidv4()}.jpg`);

      console.log(`Generating thumbnail for video: ${videoPath}`);
      console.log(`Temp thumbnail path: ${tempThumbnailPath}`);

      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Use ffmpeg to extract thumbnail at 1 second mark
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', videoPath,                // Input video
        '-ss', '00:00:01',              // Seek to 1 second
        '-vframes', '1',                // Extract 1 frame
        '-q:v', '2',                    // High quality
        '-vf', 'scale=320:-1',          // Resize to 320 width, preserve aspect ratio
        '-y',                           // Overwrite output file
        tempThumbnailPath               // Output path
      ]);

      let stderr = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', async (code) => {
        if (code === 0 && fs.existsSync(tempThumbnailPath)) {
          try {
            // Read the thumbnail buffer
            const buffer = fs.readFileSync(tempThumbnailPath);
            
            // Upload to object storage
            const publicUrl = await getObjectStorage().uploadThumbnailToStorage(buffer, videoId, '.jpg');
            
            // Clean up temp file
            fs.unlinkSync(tempThumbnailPath);
            
            console.log(`Thumbnail generated and uploaded successfully: ${publicUrl}`);
            resolve(publicUrl);
          } catch (uploadError) {
            // Clean up temp file on error
            if (fs.existsSync(tempThumbnailPath)) {
              fs.unlinkSync(tempThumbnailPath);
            }
            console.error('Error uploading thumbnail to object storage:', uploadError);
            reject(uploadError);
          }
        } else {
          console.error(`FFmpeg failed with code ${code}, stderr:`, stderr);
          reject(new Error(`Failed to generate thumbnail: FFmpeg exit code ${code}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });

    } catch (error) {
      console.error('Error in generateThumbnail:', error);
      reject(error);
    }
  });
}

/**
 * Generate a Canvas-based thumbnail fallback (for when FFmpeg is not available) and upload to object storage
 * @param videoId - Video ID for unique filename
 * @returns Promise<string> - Object storage URL to a placeholder thumbnail
 */
export async function generatePlaceholderThumbnail(videoId: number): Promise<string> {
  try {
    // Create a simple SVG placeholder
    const svgContent = `
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1f2937"/>
        <circle cx="160" cy="90" r="30" fill="#374151"/>
        <polygon points="150,75 150,105 175,90" fill="#9ca3af"/>
        <text x="160" y="130" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="12">
          Video Thumbnail
        </text>
      </svg>
    `;

    const buffer = Buffer.from(svgContent.trim(), 'utf-8');
    const publicUrl = await getObjectStorage().uploadThumbnailToStorage(buffer, videoId, '.svg');
    
    console.log(`Placeholder thumbnail created and uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error creating placeholder thumbnail:', error);
    throw error;
  }
}

/**
 * Main function to generate thumbnails with fallback
 */
export async function createVideoThumbnail(videoPath: string, videoId: number): Promise<string> {
  try {
    // First try to generate a real thumbnail with ffmpeg
    return await generateThumbnail(videoPath, videoId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('FFmpeg thumbnail generation failed, creating placeholder:', errorMessage);
    // Fallback to placeholder if ffmpeg fails
    return await generatePlaceholderThumbnail(videoId);
  }
}

/**
 * Delete a thumbnail from object storage
 */
export async function deleteThumbnail(thumbnailPath: string): Promise<void> {
  try {
    if (thumbnailPath.startsWith('/objects/')) {
      await getObjectStorage().deleteObjectEntity(thumbnailPath);
      console.log(`Thumbnail deleted successfully from object storage: ${thumbnailPath}`);
    } else {
      console.warn(`Thumbnail path is not in object storage, skipping deletion: ${thumbnailPath}`);
    }
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    throw error;
  }
}