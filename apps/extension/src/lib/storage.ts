/**
 * Storage utilities for extension settings and data
 */
import browser from "./browser";
import { Settings, StorageKeys, DEFAULT_SETTINGS, Verse } from "@shared/index";

// Type for storage change listener
type StorageChangeListener = (
  changes: { [key: string]: any },
  areaName: string
) => void;

class ExtensionStorage {
  private listeners: Set<StorageChangeListener> = new Set();

  constructor() {
    // Listen for storage changes and notify listeners
    browser.storage.onChanged.addListener((changes, areaName) => {
      this.listeners.forEach((listener) => listener(changes, areaName));
    });
  }

  // Settings management
  async getSettings(): Promise<Settings> {
    try {
      const result = await browser.storage.local.get(StorageKeys.SETTINGS);
      const stored = result[StorageKeys.SETTINGS];

      if (!stored) {
        // First time - save and return defaults
        const defaultSettings = DEFAULT_SETTINGS;
        await this.setSettings(defaultSettings);
        console.log(
          "[Armor of God] No settings found, using defaults with enabled=true"
        );
        return defaultSettings;
      }

      // Merge with defaults to handle missing properties
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        modules: {
          ...DEFAULT_SETTINGS.modules,
          ...stored.modules,
        },
        thresholds: {
          ...DEFAULT_SETTINGS.thresholds,
          ...stored.thresholds,
        },
      };
    } catch (error) {
      console.error("Failed to get settings:", error);
      // Save defaults on error too
      const defaultSettings = DEFAULT_SETTINGS;
      try {
        await this.setSettings(defaultSettings);
      } catch (e) {
        // Ignore save error
      }
      return defaultSettings;
    }
  }

  async setSettings(settings: Settings): Promise<void> {
    try {
      const updatedSettings = {
        ...settings,
        lastUpdated: new Date().toISOString(),
      };

      await browser.storage.local.set({
        [StorageKeys.SETTINGS]: updatedSettings,
      });
    } catch (error) {
      console.error("Failed to set settings:", error);
      throw error;
    }
  }

  async updateSettings(partialSettings: Partial<Settings>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings = {
      ...currentSettings,
      ...partialSettings,
      lastUpdated: new Date().toISOString(),
    };
    await this.setSettings(updatedSettings);
  }

  // Verse caching
  async cacheVerse(verse: Verse): Promise<void> {
    try {
      const cacheKey = `${StorageKeys.VERSE_CACHE}_${verse.date || new Date().toISOString().slice(0, 10)}`;
      await browser.storage.local.set({
        [cacheKey]: {
          ...verse,
          cachedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Failed to cache verse:", error);
    }
  }

  async getCachedVerse(date?: string): Promise<Verse | null> {
    try {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      const cacheKey = `${StorageKeys.VERSE_CACHE}_${targetDate}`;
      const result = await browser.storage.local.get(cacheKey);
      const cached = result[cacheKey];

      if (!cached) return null;

      // Check if cache is still valid (24 hours)
      const now = Date.now();
      const cacheAge = now - cached.cachedAt;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxAge) {
        // Cache expired, remove it
        await browser.storage.local.remove(cacheKey);
        return null;
      }

      return {
        reference: cached.reference,
        text: cached.text,
        copyright: cached.copyright,
        date: cached.date,
      };
    } catch (error) {
      console.error("Failed to get cached verse:", error);
      return null;
    }
  }

  // Generic storage methods
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const result = await browser.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      await browser.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`Failed to set ${key}:`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await browser.storage.local.remove(key);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await browser.storage.local.clear();
    } catch (error) {
      console.error("Failed to clear storage:", error);
      throw error;
    }
  }

  // Storage change listeners
  addChangeListener(listener: StorageChangeListener): void {
    this.listeners.add(listener);
  }

  removeChangeListener(listener: StorageChangeListener): void {
    this.listeners.delete(listener);
  }

  // Utility methods
  async getStorageUsage(): Promise<number> {
    try {
      const usage = await browser.storage.local.getBytesInUse();
      return usage || 0;
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return 0;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const all = await browser.storage.local.get(null);
      const keysToRemove: string[] = [];
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      Object.entries(all).forEach(([key, value]) => {
        if (
          key.startsWith(StorageKeys.VERSE_CACHE) &&
          value &&
          typeof value === "object" &&
          "cachedAt" in value
        ) {
          const cacheAge = now - (value as any).cachedAt;
          if (cacheAge > maxAge) {
            keysToRemove.push(key);
          }
        }
      });

      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old cache entries`);
      }
    } catch (error) {
      console.error("Failed to cleanup old cache:", error);
    }
  }
}

// Export singleton instance
export const storage = new ExtensionStorage();
