import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  isConfigured(): boolean {
    const hasPublicPaths = !!process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const hasPrivateDir = !!process.env.PRIVATE_OBJECT_DIR;
    return hasPublicPaths && hasPrivateDir;
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      console.warn(
        "⚠️  PUBLIC_OBJECT_SEARCH_PATHS not set. Object storage features will be limited."
      );
      return [];
    }
    return paths;
  }

  getPrivateObjectDir(): string | null {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      console.warn(
        "⚠️  PRIVATE_OBJECT_DIR not set. Object storage features will be limited."
      );
      return null;
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir) {
      throw new ObjectNotFoundError();
    }
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir) {
      return rawObjectPath;
    }
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
  
  async uploadImageToStorage(
    imageUrl: string,
    imageId: number
  ): Promise<string> {
    try {
      console.log(`Downloading image from: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      let extension = '.png';
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('webp')) {
        extension = '.webp';
      } else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
        extension = '.jpg';
      }

      const filename = `image-${imageId}-${randomUUID()}${extension}`;
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/generated-images/${filename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await file.save(buffer, {
        contentType: contentType || 'image/png',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'public',
      });

      const publicUrl = `/objects/generated-images/${filename}`;
      console.log(`Image uploaded to object storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image to storage:', error);
      throw error;
    }
  }

  async uploadBufferToStorage(
    buffer: Buffer,
    contentType: string,
    subdir: string = 'uploads'
  ): Promise<string> {
    try {
      let extension = '.png';
      if (contentType.includes('webp')) {
        extension = '.webp';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        extension = '.jpg';
      } else if (contentType.includes('png')) {
        extension = '.png';
      }

      const filename = `${randomUUID()}${extension}`;
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/${subdir}/${filename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'public',
      });

      const publicUrl = `/objects/${subdir}/${filename}`;
      console.log(`Buffer uploaded to object storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading buffer to storage:', error);
      throw error;
    }
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    try {
      if (!objectPath.startsWith('/objects/')) {
        console.warn(`Invalid object path for deletion: ${objectPath}`);
        return;
      }

      const objectFile = await this.getObjectEntityFile(objectPath);
      await objectFile.delete();
      console.log(`Deleted object from storage: ${objectPath}`);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        console.log(`Object not found, skipping deletion: ${objectPath}`);
      } else {
        console.error('Error deleting object from storage:', error);
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
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/generated-videos/${filename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.save(buffer, {
        contentType: contentType || 'video/mp4',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'public',
      });

      const publicUrl = `/objects/generated-videos/${filename}`;
      console.log(`Video uploaded to object storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading video to storage:', error);
      throw error;
    }
  }

  async uploadThumbnailToStorage(
    buffer: Buffer,
    videoId: number,
    extension: string = '.jpg'
  ): Promise<string> {
    try {
      const filename = `thumbnail-${videoId}-${randomUUID()}${extension}`;
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/video-thumbnails/${filename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      let contentType = 'image/jpeg';
      if (extension === '.png') {
        contentType = 'image/png';
      } else if (extension === '.webp') {
        contentType = 'image/webp';
      } else if (extension === '.svg') {
        contentType = 'image/svg+xml';
      }

      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'public',
      });

      const publicUrl = `/objects/video-thumbnails/${filename}`;
      console.log(`Thumbnail uploaded to object storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading thumbnail to storage:', error);
      throw error;
    }
  }

  async downloadObjectBuffer(objectUrl: string): Promise<Buffer> {
    try {
      // Convert /objects/... URL to actual storage path
      // /objects/generated-images/filename -> PRIVATE_OBJECT_DIR/generated-images/filename
      if (!objectUrl.startsWith('/objects/')) {
        throw new Error(`Invalid object URL: ${objectUrl}`);
      }

      const relativePath = objectUrl.replace('/objects/', '');
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/${relativePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (!exists) {
        throw new ObjectNotFoundError();
      }

      const [buffer] = await file.download();
      console.log(`Downloaded object from storage: ${objectUrl} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error('Error downloading object from storage:', error);
      throw error;
    }
  }

  async uploadImageThumbnailToStorage(
    buffer: Buffer,
    imageId: number,
    extension: string = '.webp'
  ): Promise<string> {
    try {
      const filename = `img-thumb-${imageId}-${randomUUID()}${extension}`;
      const privateObjectDir = this.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/image-thumbnails/${filename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      let contentType = 'image/webp';
      if (extension === '.png') {
        contentType = 'image/png';
      } else if (extension === '.jpg' || extension === '.jpeg') {
        contentType = 'image/jpeg';
      }

      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'public',
      });

      const publicUrl = `/objects/image-thumbnails/${filename}`;
      console.log(`Image thumbnail uploaded to object storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image thumbnail to storage:', error);
      throw error;
    }
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
