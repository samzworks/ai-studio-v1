import type { Response } from "express";

export const isOnReplit = !!process.env.REPL_ID && !!process.env.REPLIT_DOMAINS;

export interface IStorageService {
  isConfigured(): boolean;
  getPublicObjectSearchPaths(): Array<string>;
  getPrivateObjectDir(): string | null;
  searchPublicObject(filePath: string): Promise<any>;
  downloadObject(file: any, res: Response, cacheTtlSec?: number): Promise<void>;
  getObjectEntityUploadURL(): Promise<string>;
  getObjectEntityFile(objectPath: string): Promise<any>;
  normalizeObjectEntityPath(rawPath: string): string;
  trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: any): Promise<string>;
  canAccessObjectEntity(params: { userId?: string; objectFile: any; requestedPermission?: any }): Promise<boolean>;
  uploadImageToStorage(imageUrl: string, imageId: number): Promise<string>;
  uploadBufferToStorage(buffer: Buffer, contentType: string, subdir?: string): Promise<string>;
  deleteObjectEntity(objectPath: string): Promise<void>;
  uploadVideoToStorage(buffer: Buffer, videoId: number, extension: string, contentType: string): Promise<string>;
  uploadThumbnailToStorage(buffer: Buffer, videoId: number, extension?: string): Promise<string>;
  downloadObjectBuffer(objectUrl: string): Promise<Buffer>;
  uploadImageThumbnailToStorage(buffer: Buffer, imageId: number, extension?: string): Promise<string>;
}

let cachedStorageService: IStorageService | null = null;
let initPromise: Promise<IStorageService> | null = null;

async function initStorageService(): Promise<IStorageService> {
  if (cachedStorageService) return cachedStorageService;
  
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    if (isOnReplit) {
      console.log("📦 Using Replit Object Storage");
      const { ObjectStorageService } = await import("./objectStorage.js");
      cachedStorageService = new ObjectStorageService() as IStorageService;
    } else {
      console.log("📦 Using Local File Storage (not on Replit)");
      const { LocalFileStorageService } = await import("./localFileStorage.js");
      cachedStorageService = new LocalFileStorageService() as IStorageService;
    }
    return cachedStorageService;
  })();
  
  return initPromise;
}

export async function getStorageService(): Promise<IStorageService> {
  return initStorageService();
}

export function createStorageService(): IStorageService {
  if (cachedStorageService) {
    return cachedStorageService;
  }
  
  throw new Error(
    "Storage service not initialized. Call initStorageService() at app startup before using createStorageService()."
  );
}

export { initStorageService };
