import multer from 'multer';
import { createStorageService } from './storageProvider';

const storage = multer.memoryStorage();

const videoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'));
  }
};

export const videoUpload = multer({
  storage: storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  }
});

export const uploadVideoToStorage = async (buffer: Buffer, contentType: string): Promise<string> => {
  const objectStorage = createStorageService();
  return await objectStorage.uploadBufferToStorage(buffer, contentType, 'motion-videos');
};
