import { ObjectStorageService, objectStorageClient } from './objectStorage';
import { setObjectAclPolicy } from './objectAcl';
import { isOnReplit } from './storageProvider';

export interface ImageRefCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ImageRefImage {
  id: number;
  categoryId: number;
  filename: string;
  path: string;
  url: string;
  sortOrder: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ImageRefConfig {
  categories: ImageRefCategory[];
  images: ImageRefImage[];
  lastUpdated: string;
  version: number;
}

const CONFIG_FILENAME = 'image-ref-config.json';
const CONFIG_VERSION = 1;

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}

export class ImageRefConfigStorage {
  private objectStorage: ObjectStorageService;
  private cachedConfig: ImageRefConfig | null = null;
  private nextCategoryId: number = 1;
  private nextImageId: number = 1;
  private migrationSuccessful: boolean = false;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  private getConfigPath(): string {
    const privateObjectDir = this.objectStorage.getPrivateObjectDir();
    return `${privateObjectDir}/config/${CONFIG_FILENAME}`;
  }

  private async tryMigrateFromDatabase(): Promise<{ config: ImageRefConfig | null; nothingToMigrate: boolean }> {
    try {
      console.log('Checking if database has image references to migrate...');
      
      const { storage } = await import('./storage');
      const dbCategories = await storage.getImageReferenceCategories();
      
      if (dbCategories.length === 0) {
        console.log('No image references found in database to migrate');
        return { config: null, nothingToMigrate: true };
      }
      
      console.log(`Found ${dbCategories.length} categories in database, migrating to object storage...`);
      
      const allImages: any[] = [];
      for (const cat of dbCategories) {
        const images = await storage.getImageReferenceImages(cat.id);
        allImages.push(...images);
      }
      
      const config: ImageRefConfig = {
        categories: dbCategories.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          isActive: c.isActive,
          sortOrder: c.sortOrder,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          createdBy: c.createdBy,
          updatedBy: c.updatedBy,
        })),
        images: allImages.map(i => ({
          id: i.id,
          categoryId: i.categoryId,
          filename: i.filename,
          path: i.path,
          url: i.url,
          sortOrder: i.sortOrder,
          uploadedAt: i.uploadedAt.toISOString(),
          uploadedBy: i.uploadedBy,
        })),
        lastUpdated: new Date().toISOString(),
        version: CONFIG_VERSION,
      };
      
      if (dbCategories.length > 0) {
        this.nextCategoryId = Math.max(...dbCategories.map(c => c.id)) + 1;
      }
      if (allImages.length > 0) {
        this.nextImageId = Math.max(...allImages.map(i => i.id)) + 1;
      }
      
      await this.saveConfig(config);
      console.log(`Migration complete! Migrated ${dbCategories.length} categories and ${allImages.length} images`);
      
      return { config, nothingToMigrate: false };
    } catch (error) {
      console.error('Error migrating from database:', error);
      throw error;
    }
  }

  async loadConfig(): Promise<ImageRefConfig> {
    try {
      const fullPath = this.getConfigPath();
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      
      if (!exists) {
        console.log('Image reference config not found in object storage');
        
        if (!this.migrationSuccessful) {
          try {
            const result = await this.tryMigrateFromDatabase();
            
            if (result.config) {
              this.migrationSuccessful = true;
              this.cachedConfig = result.config;
              return result.config;
            }
            
            if (result.nothingToMigrate) {
              this.migrationSuccessful = true;
            }
          } catch (migrationError) {
            console.error('Migration failed, will retry on next load:', migrationError);
          }
        }
        
        return this.getEmptyConfig();
      }

      const [buffer] = await file.download();
      const config = JSON.parse(buffer.toString('utf-8')) as ImageRefConfig;
      
      if (config.categories.length > 0) {
        this.nextCategoryId = Math.max(...config.categories.map(c => c.id)) + 1;
      }
      if (config.images.length > 0) {
        this.nextImageId = Math.max(...config.images.map(i => i.id)) + 1;
      }
      
      this.cachedConfig = config;
      this.migrationSuccessful = true;
      console.log(`Loaded image reference config: ${config.categories.length} categories, ${config.images.length} images`);
      return config;
    } catch (error) {
      console.error('Error loading image reference config:', error);
      
      if (!this.migrationSuccessful) {
        try {
          const result = await this.tryMigrateFromDatabase();
          if (result.config) {
            this.migrationSuccessful = true;
            this.cachedConfig = result.config;
            return result.config;
          }
          if (result.nothingToMigrate) {
            this.migrationSuccessful = true;
          }
        } catch (migrationError) {
          console.error('Migration also failed, will retry on next load:', migrationError);
        }
      }
      
      return this.getEmptyConfig();
    }
  }

  async saveConfig(config: ImageRefConfig): Promise<void> {
    try {
      config.lastUpdated = new Date().toISOString();
      config.version = CONFIG_VERSION;

      const fullPath = this.getConfigPath();
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const jsonContent = JSON.stringify(config, null, 2);
      
      await file.save(Buffer.from(jsonContent, 'utf-8'), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache, no-store, must-revalidate',
        },
      });

      await setObjectAclPolicy(file, {
        owner: 'system',
        visibility: 'private',
      });

      this.cachedConfig = config;
      console.log(`Saved image reference config: ${config.categories.length} categories, ${config.images.length} images`);
    } catch (error) {
      console.error('Error saving image reference config:', error);
      throw error;
    }
  }

  private getEmptyConfig(): ImageRefConfig {
    return {
      categories: [],
      images: [],
      lastUpdated: new Date().toISOString(),
      version: CONFIG_VERSION,
    };
  }

  async getCategories(): Promise<ImageRefCategory[]> {
    const config = await this.loadConfig();
    return config.categories.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getActiveCategories(): Promise<ImageRefCategory[]> {
    const categories = await this.getCategories();
    return categories.filter(c => c.isActive);
  }

  async getCategory(id: number): Promise<ImageRefCategory | undefined> {
    const config = await this.loadConfig();
    return config.categories.find(c => c.id === id);
  }

  async getCategoryBySlug(slug: string): Promise<ImageRefCategory | undefined> {
    const config = await this.loadConfig();
    return config.categories.find(c => c.slug === slug);
  }

  async createCategory(data: Omit<ImageRefCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImageRefCategory> {
    const config = await this.loadConfig();
    
    const now = new Date().toISOString();
    const category: ImageRefCategory = {
      id: this.nextCategoryId++,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    config.categories.push(category);
    await this.saveConfig(config);
    return category;
  }

  async updateCategory(id: number, updates: Partial<ImageRefCategory>): Promise<ImageRefCategory | undefined> {
    const config = await this.loadConfig();
    const index = config.categories.findIndex(c => c.id === id);
    
    if (index === -1) {
      return undefined;
    }

    config.categories[index] = {
      ...config.categories[index],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await this.saveConfig(config);
    return config.categories[index];
  }

  async deleteCategory(id: number): Promise<boolean> {
    const config = await this.loadConfig();
    const index = config.categories.findIndex(c => c.id === id);
    
    if (index === -1) {
      return false;
    }

    config.categories.splice(index, 1);
    config.images = config.images.filter(i => i.categoryId !== id);
    
    await this.saveConfig(config);
    return true;
  }

  async getImages(categoryId: number): Promise<ImageRefImage[]> {
    const config = await this.loadConfig();
    return config.images
      .filter(i => i.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getImage(id: number): Promise<ImageRefImage | undefined> {
    const config = await this.loadConfig();
    return config.images.find(i => i.id === id);
  }

  async createImage(data: Omit<ImageRefImage, 'id' | 'uploadedAt'>): Promise<ImageRefImage> {
    const config = await this.loadConfig();
    
    const image: ImageRefImage = {
      id: this.nextImageId++,
      ...data,
      uploadedAt: new Date().toISOString(),
    };

    config.images.push(image);
    await this.saveConfig(config);
    return image;
  }

  async updateImageSortOrder(id: number, sortOrder: number): Promise<ImageRefImage | undefined> {
    const config = await this.loadConfig();
    const index = config.images.findIndex(i => i.id === id);
    
    if (index === -1) {
      return undefined;
    }

    config.images[index].sortOrder = sortOrder;
    await this.saveConfig(config);
    return config.images[index];
  }

  async deleteImage(id: number): Promise<boolean> {
    const config = await this.loadConfig();
    const index = config.images.findIndex(i => i.id === id);
    
    if (index === -1) {
      return false;
    }

    config.images.splice(index, 1);
    await this.saveConfig(config);
    return true;
  }

  async importFromDatabase(
    categories: Array<{
      id: number;
      name: string;
      slug: string;
      description: string | null;
      isActive: boolean;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string;
      updatedBy: string;
    }>,
    images: Array<{
      id: number;
      categoryId: number;
      filename: string;
      path: string;
      url: string;
      sortOrder: number;
      uploadedAt: Date;
      uploadedBy: string;
    }>
  ): Promise<void> {
    const config: ImageRefConfig = {
      categories: categories.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      images: images.map(i => ({
        ...i,
        uploadedAt: i.uploadedAt.toISOString(),
      })),
      lastUpdated: new Date().toISOString(),
      version: CONFIG_VERSION,
    };

    if (categories.length > 0) {
      this.nextCategoryId = Math.max(...categories.map(c => c.id)) + 1;
    }
    if (images.length > 0) {
      this.nextImageId = Math.max(...images.map(i => i.id)) + 1;
    }

    await this.saveConfig(config);
    console.log(`Imported ${categories.length} categories and ${images.length} images from database to object storage`);
  }
  
  resetMigrationState(): void {
    this.migrationSuccessful = false;
    this.cachedConfig = null;
  }
}

export const imageRefConfigStorage = new ImageRefConfigStorage();
