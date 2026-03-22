import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { fileTypeFromBuffer } from 'file-type';
import { createVideoThumbnail } from './thumbnail-generator.js';
import { createStorageService, type IStorageService } from './storageProvider';

function getObjectStorage(): IStorageService {
  return createStorageService();
}

/**
 * Extract video dimensions using ffprobe
 */
async function extractVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const ffprobeProcess = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',  // First video stream
      filePath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const probe = JSON.parse(stdout);
          const videoStream = probe.streams?.[0];
          
          if (videoStream && videoStream.width && videoStream.height) {
            console.log(`Extracted video dimensions: ${videoStream.width}x${videoStream.height}`);
            resolve({ 
              width: parseInt(videoStream.width), 
              height: parseInt(videoStream.height) 
            });
          } else {
            reject(new Error('No video stream found or missing dimensions'));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse ffprobe output: ${parseError}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`ffprobe process error: ${error.message}`));
    });
  });
}

export async function downloadAndStoreVideo(videoUrl: string, videoId: number): Promise<{videoUrl: string, thumbnailUrl: string, width?: number, height?: number}> {
  let tempFilePath: string | null = null;
  
  try {
    // Validate the URL before attempting download
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
      throw new Error('Invalid video URL: URL is empty or not a string');
    }
    
    if (videoUrl === 'completed') {
      throw new Error('Invalid video URL: received literal "completed" string instead of actual URL');
    }
    
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      throw new Error(`Invalid video URL: must be HTTP(S), got: ${videoUrl}`);
    }
    
    console.log(`Downloading video from: ${videoUrl}`);
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    // Download video to buffer first
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Detect actual file type from buffer content (most reliable)
    let extension = '.mp4';
    let finalContentType = 'video/mp4';
    
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      if (fileType) {
        extension = `.${fileType.ext}`;
        finalContentType = fileType.mime;
        console.log(`Detected file type from buffer: ${fileType.ext} (${fileType.mime})`);
      } else {
        // Fall back to URL and header-based detection if file-type fails
        const contentType = response.headers.get('content-type');
        const urlExtension = videoUrl.split('.').pop()?.toLowerCase();
        
        if (urlExtension && ['mp4', 'mov', 'webm', 'avi'].includes(urlExtension)) {
          extension = `.${urlExtension}`;
        } else if (contentType?.includes('webm')) {
          extension = '.webm';
        } else if (contentType?.includes('quicktime')) {
          extension = '.mov';
        }
        
        // Derive content type from extension
        if (extension === '.webm') {
          finalContentType = 'video/webm';
        } else if (extension === '.mov') {
          finalContentType = 'video/quicktime';
        } else if (extension === '.avi') {
          finalContentType = 'video/x-msvideo';
        }
        
        console.log(`File type detection fallback: using extension ${extension}`);
      }
    } catch (detectionError) {
      console.warn('File type detection failed, using defaults:', detectionError);
      // Keep default .mp4 / video/mp4
    }
    
    // Save to temp file for dimension extraction and thumbnail generation
    tempFilePath = path.join(os.tmpdir(), `video-${videoId}-${uuidv4()}${extension}`);
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`Video downloaded to temp location: ${tempFilePath}`);
    
    // Extract actual video dimensions
    let dimensions: { width?: number; height?: number } = {};
    try {
      dimensions = await extractVideoDimensions(tempFilePath);
      console.log(`Video dimensions extracted: ${dimensions.width}x${dimensions.height}`);
    } catch (dimensionError) {
      console.warn('Failed to extract video dimensions:', dimensionError);
      // Continue without dimensions - they'll remain as the original generation parameters
    }
    
    // Generate thumbnail from temp file
    let thumbnailUrl: string;
    try {
      thumbnailUrl = await createVideoThumbnail(tempFilePath, videoId);
      console.log(`Thumbnail generated successfully: ${thumbnailUrl}`);
    } catch (thumbnailError) {
      console.error('Failed to generate thumbnail:', thumbnailError);
      // We'll set a placeholder after uploading the video
      thumbnailUrl = '';
    }

    // Upload video buffer to object storage with detected content type
    const publicUrl = await getObjectStorage().uploadVideoToStorage(buffer, videoId, extension, finalContentType);
    console.log(`Video uploaded to object storage: ${publicUrl}`);
    
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
    }

    return { 
      videoUrl: publicUrl, 
      thumbnailUrl: thumbnailUrl || publicUrl, // Fallback to video URL if thumbnail failed
      width: dimensions.width,
      height: dimensions.height
    };
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.error('Error downloading video:', error);
    throw error;
  }
}

export async function deleteVideo(videoPath: string): Promise<void> {
  try {
    if (videoPath.startsWith('/objects/')) {
      await getObjectStorage().deleteObjectEntity(videoPath);
      console.log(`Video deleted successfully from object storage: ${videoPath}`);
    } else {
      console.warn(`Video path is not in object storage, skipping deletion: ${videoPath}`);
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
}