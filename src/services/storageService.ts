class StorageServiceImpl {
  private cache: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.cache.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

export const StorageService = new StorageServiceImpl();
export default StorageService;
