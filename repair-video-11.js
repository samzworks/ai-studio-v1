import { downloadAndStoreVideo } from './server/video-storage.js';
import { dbStorage } from './server/storage.js';

async function repairVideo11() {
  try {
    const videoUrl = 'https://replicate.delivery/xezq/1af60o4RXpWrPqAiaME4kED87JSOU3S65PDBerGfavT0ISPqA/tmp__3v5l4y.mp4';
    const videoId = 11;
    
    console.log('Downloading video 11...');
    const localUrl = await downloadAndStoreVideo(videoUrl, videoId);
    
    console.log('Updating database...');
    await dbStorage.updateVideoUrl(videoId, localUrl, localUrl);
    
    console.log('Video 11 repaired successfully:', localUrl);
  } catch (error) {
    console.error('Error repairing video 11:', error);
  }
}

repairVideo11();