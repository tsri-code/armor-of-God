/**
 * Type definitions and re-exports for the extension
 * Centralizes all type imports from shared package
 */

// Re-export all shared types
export * from "@shared/index";

// Extension-specific types
export interface ExtensionMessage {
  type: string;
  data?: any;
  tabId?: number;
  frameId?: number;
}

export interface ContentScriptMessage extends ExtensionMessage {
  type: "CONTENT_BLOCKED" | "SCAN_RESULT" | "PIN_REQUIRED" | "SETTINGS_REQUEST";
}

export interface BackgroundMessage extends ExtensionMessage {
  type:
    | "SETTINGS_UPDATED"
    | "RULES_UPDATED"
    | "VERSE_UPDATED"
    | "STATS_UPDATED";
}

export interface PopupMessage extends ExtensionMessage {
  type: "GET_STATS" | "GET_VERSE" | "TOGGLE_EXTENSION" | "OPEN_OPTIONS";
}

// UI component props
export interface BaseUIProps {
  className?: string;
  children?: React.ReactNode;
}

export interface VerseDisplayProps extends BaseUIProps {
  verse: {
    reference: string;
    text: string;
    copyright?: string;
  } | null;
  loading?: boolean;
  compact?: boolean;
}

export interface SettingsFormProps extends BaseUIProps {
  onSave: (settings: any) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export interface StatsDisplayProps extends BaseUIProps {
  stats: {
    blocksToday: number;
    blocksThisWeek: number;
    blocksTotal: number;
    categories: Record<string, number>;
  };
  showDetails?: boolean;
}

// Content script scanning types
export interface ImageScanContext {
  element: HTMLImageElement;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  isVisible: boolean;
  timestamp: number;
}

export interface VideoScanContext {
  element: HTMLVideoElement;
  src: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  timestamp: number;
}

export interface ScanOptions {
  threshold: number;
  modelSize: number;
  skipSmallImages: boolean;
  maxConcurrentScans: number;
}

// Rule matching types
export interface RuleMatch {
  rule: any; // Rule type from shared
  url: string;
  resourceType: string;
  tabId: number;
  frameId: number;
  timestamp: number;
}

// Storage event types
export interface StorageChangeEvent {
  key: string;
  oldValue?: any;
  newValue?: any;
  area: "local" | "sync" | "managed";
}

// API response types
export interface VerseAPIResponse {
  reference: string;
  text: string;
  copyright?: string;
  error?: string;
}

export interface RulesAPIResponse {
  rules: any[]; // Rule[] from shared
  version: string;
  lastUpdated: string;
  error?: string;
}

// Error types
export class ExtensionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
  ) {
    super(message);
    this.name = "ExtensionError";
  }
}

export class ContentScanError extends ExtensionError {
  constructor(message: string, context?: any) {
    super(message, "CONTENT_SCAN_ERROR", context);
    this.name = "ContentScanError";
  }
}

export class StorageError extends ExtensionError {
  constructor(message: string, context?: any) {
    super(message, "STORAGE_ERROR", context);
    this.name = "StorageError";
  }
}

export class CryptoError extends ExtensionError {
  constructor(message: string, context?: any) {
    super(message, "CRYPTO_ERROR", context);
    this.name = "CryptoError";
  }
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Import configuration
import { CONFIG } from "../config";

// Constants for the extension
export const EXTENSION_CONSTANTS = {
  WORKER_URL: CONFIG.WORKER_URL,
  MAX_CONCURRENT_SCANS: CONFIG.ML.MAX_CONCURRENT_SCANS,
  SCAN_DEBOUNCE_MS: 100,
  VERSE_REFRESH_INTERVAL: 60 * 60 * 1000, // 1 hour
  STATS_UPDATE_INTERVAL: 60 * 1000, // 1 minute
  DEFAULT_POPUP_SIZE: { width: 380, height: 500 },
  BLOCKED_PAGE_PATH: "/src/ui/blocked/blocked.html",
} as const;
