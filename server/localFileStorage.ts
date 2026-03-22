import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const LOCAL_STORAGE_DIR = path.join(process.cwd(), "uploads", "storage");

export class LocalFileStorageService {
  constructor() {}

  async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
    }
  }

  isConfigured(): boolean {
    return true;
  }

  getPublicObjectSearchPaths(): Array<string> {
    return [LOCAL_STORAGE_DIR];
  }

  getPrivateObjectDir(): string {
    return LOCAL_STORAGE_DIR;
  }

  private getLocalPath(objectPath: string): string {
    if (objectPath.startsWith("/objects/")) {
      return path.join(LOCAL_STORAGE_DIR, objectPath.slice(9));
    }
    return path.join(LOCAL_STORAGE_DIR, objectPath);
  }

  async searchPublicObject(filePath: string): Promise<{ path: string } | null> {
    const fullPath = path.join(LOCAL_STORAGE_DIR, "public", filePath);
    try {
      await fs.access(fullPath);
      return { path: fullPath };
    } catch {
      return null;
    }
  }

  async downloadObject(file: { path: string }, res: Response, cacheTtlSec: number = 3600) {
    try {
      const stat = await fs.stat(file.path);
      const ext = path.extname(file.path).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".svg": "image/svg+xml",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";
      
      res.set({
        "Content-Type": contentType,
        "Content-Length": stat.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      
      const data = await fs.readFile(file.path);
      res.send(data);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/api/local-upload/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<{ path: string }> {
    const localPath = this.getLocalPath(objectPath);
    try {
      await fs.access(localPath);
      return { path: localPath };
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/uploads/storage/")) {
      const relativePath = rawPath.slice("/uploads/storage/".length);
      return `/objects/${relativePath}`;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(params: {
    userId?: string;
    objectFile: { path: string };
    requestedPermission?: any;
  }): Promise<boolean> {
    return true;
  }

  async uploadImageToStorage(imageUrl: string, imageId: number): Promise<string> {
    try {
      console.log(`Downloading image from: ${imageUrl}`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      let extension = ".png";
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("webp")) {
        extension = ".webp";
      } else if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
        extension = ".jpg";
      }

      const filename = `image-${imageId}-${randomUUID()}${extension}`;
      const dir = path.join(LOCAL_STORAGE_DIR, "generated-images");
      await this.ensureDir(dir);
      const filePath = path.join(dir, filename);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      const publicUrl = `/objects/generated-images/${filename}`;
      console.log(`Image saved locally: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image to storage:", error);
      throw error;
    }
  }

  async uploadBufferToStorage(
    buffer: Buffer,
    contentType: string,
    subdir: string = "uploads"
  ): Promise<string> {
    try {
      let extension = ".png";
      if (contentType.includes("webp")) {
        extension = ".webp";
      } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        extension = ".jpg";
      } else if (contentType.includes("png")) {
        extension = ".png";
      }

      const filename = `${randomUUID()}${extension}`;
      const dir = path.join(LOCAL_STORAGE_DIR, subdir);
      await this.ensureDir(dir);
      const filePath = path.join(dir, filename);

      await fs.writeFile(filePath, buffer);

      const publicUrl = `/objects/${subdir}/${filename}`;
      console.log(`Buffer saved locally: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading buffer to storage:", error);
      throw error;
    }
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    try {
      if (!objectPath.startsWith("/objects/")) {
        console.warn(`Invalid object path for deletion: ${objectPath}`);
        return;
      }

      const localPath = this.getLocalPath(objectPath);
      await fs.unlink(localPath);
      console.log(`Deleted object from storage: ${objectPath}`);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log(`Object not found, skipping deletion: ${objectPath}`);
      } else {
        console.error("Error deleting object from storage:", error);
        throw error;
      }
    }
  }

  async uploadVideoToStorage(
    buffer: Buffer,
    videoId: number,
    extension: string,
    contentType: string
  ): Promise<string> {
    try {
      const filename = `video-${videoId}-${randomUUID()}${extension}`;
      const dir = path.join(LOCAL_STORAGE_DIR, "generated-videos");
      await this.ensureDir(dir);
      const filePath = path.join(dir, filename);

      await fs.writeFile(filePath, buffer);

      const publicUrl = `/objects/generated-videos/${filename}`;
      console.log(`Video saved locally: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading video to storage:", error);
      throw error;
    }
  }

  async uploadThumbnailToStorage(
    buffer: Buffer,
    videoId: number,
    extension: string = ".jpg"
  ): Promise<string> {
    try {
      const filename = `thumbnail-${videoId}-${randomUUID()}${extension}`;
      const dir = path.join(LOCAL_STORAGE_DIR, "video-thumbnails");
      await this.ensureDir(dir);
      const filePath = path.join(dir, filename);

      await fs.writeFile(filePath, buffer);

      const publicUrl = `/objects/video-thumbnails/${filename}`;
      console.log(`Thumbnail saved locally: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading thumbnail to storage:", error);
      throw error;
    }
  }

  async downloadObjectBuffer(objectUrl: string): Promise<Buffer> {
    try {
      if (!objectUrl.startsWith("/objects/")) {
        throw new Error(`Invalid object URL: ${objectUrl}`);
      }

      const localPath = this.getLocalPath(objectUrl);
      const buffer = await fs.readFile(localPath);
      console.log(`Downloaded object from storage: ${objectUrl} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error("Error downloading object from storage:", error);
      throw error;
    }
  }

  async uploadImageThumbnailToStorage(
    buffer: Buffer,
    imageId: number,
    extension: string = ".webp"
  ): Promise<string> {
    try {
      const filename = `img-thumb-${imageId}-${randomUUID()}${extension}`;
      const dir = path.join(LOCAL_STORAGE_DIR, "image-thumbnails");
      await this.ensureDir(dir);
      const filePath = path.join(dir, filename);

      await fs.writeFile(filePath, buffer);

      const publicUrl = `/objects/image-thumbnails/${filename}`;
      console.log(`Image thumbnail saved locally: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image thumbnail to storage:", error);
      throw error;
    }
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}
