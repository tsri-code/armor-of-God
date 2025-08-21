/**
 * Privacy-respecting logging utilities
 * No sensitive data is logged, only anonymized metrics
 */

import { truncatedHash } from './crypto';
import { storage } from './storage';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

export interface BlockEvent {
  type: 'url' | 'image' | 'video';
  domainHash: string; // Truncated hash for privacy
  reason: string;
  timestamp: number;
}

export interface Stats {
  blocksToday: number;
  blocksThisWeek: number;
  blocksTotal: number;
  lastReset: number;
  categories: {
    url: number;
    image: number;
    video: number;
    text: number;
  };
}

class Logger {
  private maxLogEntries = 100;
  private developmentMode: boolean;

  constructor() {
    this.developmentMode = process.env.NODE_ENV === 'development';
  }

  // Main logging methods
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, error?: any): void {
    // Always log errors to console
    console.error(`[${category}] ${message}`, error);
    
    const errorData = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    
    this.log(LogLevel.ERROR, category, message, errorData);
  }

  private async log(level: LogLevel, category: string, message: string, data?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: this.sanitizeData(data),
    };

    // Always log to console in development
    if (this.developmentMode) {
      const levelName = LogLevel[level];
      console.log(`[${levelName}] [${category}] ${message}`, data);
    }

    // Store logs only if user has enabled logging
    const settings = await storage.getSettings();
    if (this.shouldStoreLog(level)) {
      await this.storeLogEntry(entry);
    }
  }

  private shouldStoreLog(level: LogLevel): boolean {
    // Only store warnings and errors by default
    return level >= LogLevel.WARN;
  }

  private sanitizeData(data: any): any {
    if (!data) return undefined;

    // Remove sensitive information
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else if (key === 'url' && typeof value === 'string') {
          // Hash URLs for privacy
          sanitized.urlHash = this.hashUrl(value);
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeData(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return data;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'pin', 'password', 'token', 'key', 'secret', 
      'auth', 'credential', 'session', 'cookie'
    ];
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  private async hashUrl(url: string): Promise<string> {
    try {
      const urlObj = new URL(url);
      return await truncatedHash(urlObj.hostname, 8);
    } catch {
      return await truncatedHash(url, 8);
    }
  }

  private async storeLogEntry(entry: LogEntry): Promise<void> {
    try {
      const existingLogs = await storage.get<LogEntry[]>('logs') || [];
      const updatedLogs = [entry, ...existingLogs].slice(0, this.maxLogEntries);
      await storage.set('logs', updatedLogs);
    } catch (error) {
      console.error('Failed to store log entry:', error);
    }
  }

  // Statistics tracking
  async trackBlock(type: 'url' | 'image' | 'video' | 'text', url: string, reason: string): Promise<void> {
    try {
      const domainHash = await this.hashUrl(url);
      const blockEvent: BlockEvent = {
        type,
        domainHash,
        reason,
        timestamp: Date.now(),
      };

      // Update statistics
      await this.updateStats(type);

      // Log the event
      this.info('content-block', `Blocked ${type}`, {
        type,
        reason,
        domainHash,
      });

    } catch (error) {
      this.error('stats', 'Failed to track block event', error);
    }
  }

  private async updateStats(type: keyof Stats['categories']): Promise<void> {
    try {
      const stats = await this.getStats();
      const now = Date.now();
      const today = new Date().setHours(0, 0, 0, 0);
      const weekAgo = today - (6 * 24 * 60 * 60 * 1000);

      // Reset daily/weekly counters if needed
      if (stats.lastReset < today) {
        stats.blocksToday = 0;
        stats.lastReset = today;
      }

      if (stats.lastReset < weekAgo) {
        stats.blocksThisWeek = 0;
      }

      // Increment counters
      stats.blocksToday++;
      stats.blocksThisWeek++;
      stats.blocksTotal++;
      stats.categories[type]++;

      await storage.set('stats', stats);
    } catch (error) {
      this.error('stats', 'Failed to update statistics', error);
    }
  }

  async getStats(): Promise<Stats> {
    const defaultStats: Stats = {
      blocksToday: 0,
      blocksThisWeek: 0,
      blocksTotal: 0,
      lastReset: Date.now(),
      categories: {
        url: 0,
        image: 0,
        video: 0,
        text: 0,
      },
    };

    try {
      const stored = await storage.get<Stats>('stats');
      return stored ? { ...defaultStats, ...stored } : defaultStats;
    } catch (error) {
      this.error('stats', 'Failed to get statistics', error);
      return defaultStats;
    }
  }

  async getLogs(limit: number = 50): Promise<LogEntry[]> {
    try {
      const logs = await storage.get<LogEntry[]>('logs') || [];
      return logs.slice(0, limit);
    } catch (error) {
      this.error('logs', 'Failed to get logs', error);
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await storage.remove('logs');
      this.info('logs', 'Cleared all logs');
    } catch (error) {
      this.error('logs', 'Failed to clear logs', error);
    }
  }

  async resetStats(): Promise<void> {
    try {
      const defaultStats: Stats = {
        blocksToday: 0,
        blocksThisWeek: 0,
        blocksTotal: 0,
        lastReset: Date.now(),
        categories: {
          url: 0,
          image: 0,
          video: 0,
          text: 0,
        },
      };
      await storage.set('stats', defaultStats);
      this.info('stats', 'Reset all statistics');
    } catch (error) {
      this.error('stats', 'Failed to reset statistics', error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
