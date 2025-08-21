// Core types for the Armor of God extension

// Rule types for content blocking
export interface Rule {
  id: number;
  priority: number;
  action: RuleAction;
  condition: RuleCondition;
}

export interface RuleAction {
  type: 'block' | 'redirect' | 'allow';
  redirect?: {
    url?: string;
    extensionPath?: string;
    regexSubstitution?: string;
  };
}

export interface RuleCondition {
  urlFilter?: string;
  regexFilter?: string;
  domainType?: 'firstParty' | 'thirdParty';
  resourceTypes?: ResourceType[];
  excludedResourceTypes?: ResourceType[];
  domains?: string[];
  excludedDomains?: string[];
}

export type ResourceType = 
  | 'main_frame'
  | 'sub_frame' 
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle';

// Settings and configuration
export interface Settings {
  enabled: boolean;
  thresholds: {
    blur: number;
    block: number;
    warning: number;
  };
  modules: {
    imageScanning: boolean;
    videoScanning: boolean;
    textFiltering: boolean;
    safeSearch: boolean;
    urlBlocking: boolean;
  };
  whitelist: string[];
  blacklist: string[];
  schedules: Schedule[];
  pin?: {
    saltHex: string;
    hashHex: string;
  };
  lastUpdated: string;
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  days: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  strictMode: boolean;
  modules: Partial<Settings['modules']>;
}

// Verse and scripture types
export interface Verse {
  reference: string;
  text: string;
  copyright?: string;
  date?: string;
}

export interface VersePlan {
  [dayOfYear: number]: string; // reference like "John 3:16"
}

// Events for communication between components
export interface ExtensionEvents {
  'settings-changed': Settings;
  'rule-triggered': { rule: Rule; url: string; timestamp: number };
  'content-blocked': { type: 'image' | 'video' | 'text'; url: string; score: number };
  'pin-required': { context: string };
  'verse-updated': Verse;
}

// Storage keys
export enum StorageKeys {
  SETTINGS = 'settings',
  VERSE_CACHE = 'verse_cache',
  RULES_CACHE = 'rules_cache',
  STATS = 'stats',
  LOGS = 'logs',
}

// Content scanning results
export interface ScanResult {
  score: number;
  categories: {
    [category: string]: number;
  };
  action: 'allow' | 'blur' | 'warn' | 'block';
  timestamp: number;
}

// ML Model categories (nsfwjs)
export enum ContentCategory {
  DRAWING = 'Drawing',
  HENTAI = 'Hentai', 
  NEUTRAL = 'Neutral',
  PORN = 'Porn',
  SEXY = 'Sexy',
}

// Safe search providers
export enum SearchProvider {
  GOOGLE = 'google',
  BING = 'bing',
  DUCKDUCKGO = 'duckduckgo',
  YOUTUBE = 'youtube',
}

// Constants
export const CONSTANTS = {
  API: {
    BSB_VERSION_ID: 'bba9f40183526463-01',
    WORKER_ENDPOINTS: {
      VERSE_OF_DAY: '/votd',
      PASSAGE: '/passage',
    },
  },
  ML: {
    MODEL_URL: '/public/models/',
    MODEL_SIZE: 224,
    SCANNING_THRESHOLD: 0.75,
    EXPLICIT_CATEGORIES: [ContentCategory.PORN, ContentCategory.HENTAI, ContentCategory.SEXY],
  },
  STORAGE: {
    CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    VERSE_CACHE_KEY: 'daily_verse',
  },
  RULES: {
    DYNAMIC_RULE_ID_START: 10000,
    SAFE_SEARCH_RULE_ID_START: 20000,
    USER_RULE_ID_START: 30000,
  },
  CRYPTO: {
    PBKDF2_ITERATIONS: 150000,
    SALT_LENGTH: 32,
    HASH_LENGTH: 32,
  },
  UI: {
    POPUP_WIDTH: 380,
    POPUP_HEIGHT: 500,
    BLOCKED_PAGE_URL: '/ui/blocked/blocked.html',
  },
} as const;

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  thresholds: {
    blur: 0.75,
    block: 0.9,
    warning: 0.6,
  },
  modules: {
    imageScanning: true,
    videoScanning: false, // v1.0 feature
    textFiltering: false, // v1.0 feature
    safeSearch: true,
    urlBlocking: true,
  },
  whitelist: [],
  blacklist: [],
  schedules: [],
  lastUpdated: new Date().toISOString(),
};

// Validation utilities
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidDomain(domain: string): boolean {
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

export function isExplicitContent(scanResult: ScanResult): boolean {
  return CONSTANTS.ML.EXPLICIT_CATEGORIES.some(
    category => scanResult.categories[category] >= CONSTANTS.ML.SCANNING_THRESHOLD
  );
}
