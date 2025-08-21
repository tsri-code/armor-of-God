/**
 * Extension configuration
 * Update these values for your deployment
 */

export const CONFIG = {
  // Cloudflare Worker URL for Bible verses
  // Update this after deploying your worker
  WORKER_URL:
    process.env.VITE_WORKER_URL ||
    "https://armor-of-god-worker.your-domain.workers.dev",

  // Development mode
  DEVELOPMENT: process.env.NODE_ENV === "development",

  // API endpoints
  SCRIPTURE_API: {
    BSB_VERSION_ID: "bba9f40183526463-01",
    BASE_URL: "https://api.scripture.api.bible/v1",
  },

  // Extension metadata
  NAME: "Armor of God",
  VERSION: "0.1.0",

  // Feature flags
  FEATURES: {
    LIVE_VERSES: true,
    IMAGE_SCANNING: true,
    VIDEO_SCANNING: false, // v1.0 feature
    TEXT_FILTERING: false, // v1.0 feature
  },

  // ML Model configuration
  ML: {
    MODEL_SIZE: 224,
    SCANNING_THRESHOLD: 0.75,
    MAX_CONCURRENT_SCANS: 3,
  },
} as const;

// Helper function to check if worker is available
export function isWorkerConfigured(): boolean {
  return (
    CONFIG.WORKER_URL !== "https://armor-of-god-worker.your-domain.workers.dev"
  );
}

// Development helper
export function getDisplayName(): string {
  return CONFIG.DEVELOPMENT ? `[DEV] ${CONFIG.NAME}` : CONFIG.NAME;
}
