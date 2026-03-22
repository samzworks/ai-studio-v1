class CacheManager {
  private cache: Map<string, { data: any; expires: number; hits: number; lastAccessed: number }> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private readonly MAX_CACHE_SIZE = 1000;

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    const expires = Date.now() + ttl;
    const existing = this.cache.get(key);
    
    this.cache.set(key, { 
      data, 
      expires, 
      hits: existing?.hits || 0,
      lastAccessed: Date.now()
    });

    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.missCount++;
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.missCount++;
      this.evictionCount++;
      return null;
    }
    
    item.hits++;
    item.lastAccessed = Date.now();
    this.hitCount++;
    
    return item.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictionCount++;
    }
  }

  getStats(): { 
    size: number; 
    maxSize: number;
    keys: string[]; 
    hitRate: number;
    hitCount: number;
    missCount: number;
    evictionCount: number;
    topKeys: Array<{ key: string; hits: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now > item.expires) {
        this.cache.delete(key);
        this.evictionCount++;
      }
    }
    
    const topKeys = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, hits: item.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.cache.keys()),
      hitRate: Math.round(hitRate * 100) / 100,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      topKeys
    };
  }

  private pendingFetches: Map<string, Promise<any>> = new Map();

  async getOrFetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const pending = this.pendingFetches.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, ttl);
        return data;
      } finally {
        this.pendingFetches.delete(key);
      }
    })();

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }
}

export const cacheManager = new CacheManager();
