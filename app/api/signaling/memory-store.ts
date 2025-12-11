// In-memory store для локальной разработки (fallback если нет Vercel KV)
// В production всегда используйте Vercel KV!

interface StoreData {
  value: any;
  expiresAt: number;
}

class MemoryStore {
  private store: Map<string, StoreData> = new Map();

  async get(key: string): Promise<any> {
    const data = this.store.get(key);
    if (!data) return null;

    // Проверяем TTL
    if (Date.now() > data.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return data.value;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex
      ? Date.now() + options.ex * 1000
      : Date.now() + 3600 * 1000; // 1 час по умолчанию

    this.store.set(key, { value, expiresAt });
  }

  async del(...keys: string[]): Promise<void> {
    keys.forEach(key => this.store.delete(key));
  }

  // Очистка истекших записей
  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Глобальный экземпляр для всех Edge functions
const memoryStore = new MemoryStore();

// Периодическая очистка каждые 60 секунд
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // @ts-ignore
    memoryStore.cleanup();
  }, 60000);
}

export { memoryStore };
