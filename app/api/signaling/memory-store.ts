// In-memory store for local development (fallback if no Vercel KV)
// In production, always use Vercel KV!

interface StoreData {
  value: any;
  expiresAt: number;
}

class MemoryStore {
  private store: Map<string, StoreData> = new Map();

  async get(key: string): Promise<any> {
    const data = this.store.get(key);
    if (!data) return null;

    // Check TTL
    if (Date.now() > data.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return data.value;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex
      ? Date.now() + options.ex * 1000
      : Date.now() + 3600 * 1000; // 1 hour by default

    this.store.set(key, { value, expiresAt });
  }

  async del(...keys: string[]): Promise<void> {
    keys.forEach(key => this.store.delete(key));
  }

  // Cleanup expired records
  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global instance for all Edge functions
const memoryStore = new MemoryStore();

// Periodic cleanup every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // @ts-ignore
    memoryStore.cleanup();
  }, 60000);
}

export { memoryStore };
