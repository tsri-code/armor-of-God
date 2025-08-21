/**
 * Content script for image censoring using ML
 * Scans images using NSFWJS model and blurs inappropriate content
 */

import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import { CONSTANTS } from "@shared/index";
import type { ImageScanContext, ScanResult, Settings } from "../lib/types";
import "./blur.css";

// Global state
let model: nsfwjs.NSFWJS | null = null;
let settings: Settings | null = null;
let isModelLoading = false;
let scanQueue: HTMLImageElement[] = [];
let activeScanCount = 0;
const scannedImages = new WeakSet<HTMLImageElement>();
const MAX_CONCURRENT_SCANS = 3;
const SCAN_DEBOUNCE_MS = 100;

// Debug system for image scanning
const DEBUG = true;
let imageDebugStats = {
  imagesScanned: 0,
  imagesBlurred: 0,
  imagesBlocked: 0,
  imagesWarned: 0,
  lastActivity: new Date().toISOString(),
};

function imageDebugLog(message: string, data?: any): void {
  if (DEBUG) {
    console.log(`[Armor of God - Image Scanner] ${message}`, data || "");
    imageDebugStats.lastActivity = new Date().toISOString();
  }
}

// Expose debug interface globally
declare global {
  interface Window {
    armorOfGodImageFilter: {
      isActive: boolean;
      stats: typeof imageDebugStats;
      settings: Settings | null;
      forceScan: () => void;
    };
  }
}

// Enhanced filtering for inappropriate searches
const GOOGLE_IMAGES_PATTERN =
  /images\.google\.|google\..+\/imghp|google\..+\/search.*tbm=isch/i;
const NSFW_SEARCH_TERMS = [
  "sexy",
  "hot",
  "nude",
  "naked",
  "porn",
  "adult",
  "erotic",
  "lingerie",
  "bikini",
  "revealing",
  "provocative",
  "sensual",
];

// Check if current context requires aggressive filtering
function requiresAggressiveFiltering(): boolean {
  const isGoogleImages = GOOGLE_IMAGES_PATTERN.test(window.location.href);

  if (!isGoogleImages) return false;

  const urlParams = new URLSearchParams(window.location.search);
  const query = (urlParams.get("q") || "").toLowerCase();

  return NSFW_SEARCH_TERMS.some((term) => query.includes(term));
}

// Initialize the content script
async function initialize(): Promise<void> {
  try {
    imageDebugLog("Image scanner initializing...");

    // Get initial settings
    settings = await getSettings();

    if (!settings?.enabled || !settings?.modules?.imageScanning) {
      imageDebugLog("Image scanning disabled by settings");
      exposeImageDebugInterface(false);
      return;
    }

    imageDebugLog(`Image scanning settings:`, {
      enabled: settings.enabled,
      imageScanning: settings.modules.imageScanning,
      thresholds: settings.thresholds,
      url: window.location.href,
    });

    // Check if aggressive filtering is needed
    const needsAggressive = requiresAggressiveFiltering();
    imageDebugLog(`Aggressive filtering required: ${needsAggressive}`);

    // Setup intersection observer for viewport detection
    setupIntersectionObserver();

    // Setup mutation observer for dynamic content
    setupMutationObserver();

    // Scan existing images
    scanExistingImages();

    // Listen for settings changes
    browser.runtime.onMessage.addListener(handleMessage);

    // Expose debug interface
    exposeImageDebugInterface(true);

    imageDebugLog("Image scanner initialization complete");
  } catch (error) {
    imageDebugLog(
      `Image scanner initialization failed: ${error.message}`,
      error
    );
    exposeImageDebugInterface(false);
  }
}

// Expose image debug interface globally
function exposeImageDebugInterface(isActive: boolean): void {
  window.armorOfGodImageFilter = {
    isActive,
    stats: imageDebugStats,
    settings,
    forceScan: () => {
      imageDebugLog("Forcing manual image scan...");
      scanExistingImages();
      processQueue();
    },
  };

  imageDebugLog(`Image debug interface exposed - Active: ${isActive}`);
}

// Get current settings from background with better error handling
async function getSettings(): Promise<Settings | null> {
  try {
    // Check if browser API is available
    if (!browser || !browser.runtime || !browser.runtime.sendMessage) {
      console.warn("[Armor of God] Browser API not ready, using defaults");
      return {
        enabled: true,
        modules: {
          imageScanning: true,
          videoScanning: false,
          textFiltering: true,
          safeSearch: true,
          urlBlocking: true,
        },
        thresholds: {
          blur: 0.75,
          block: 0.9,
          warning: 0.6,
        },
        whitelist: [],
        blacklist: [],
        schedules: [],
        lastUpdated: new Date().toISOString(),
      } as Settings;
    }

    const response = await browser.runtime.sendMessage({
      type: "GET_SETTINGS",
    });
    return response?.error ? null : response;
  } catch (error) {
    console.error("[Armor of God] Failed to get settings:", error);
    // Return default settings on error
    return {
      enabled: true,
      modules: {
        imageScanning: true,
        videoScanning: false,
        textFiltering: true,
        safeSearch: true,
        urlBlocking: true,
      },
      thresholds: {
        blur: 0.75,
        block: 0.9,
        warning: 0.6,
      },
      whitelist: [],
      blacklist: [],
      schedules: [],
      lastUpdated: new Date().toISOString(),
    } as Settings;
  }
}

// Handle messages from background
function handleMessage(message: any): void {
  if (message.type === "SETTINGS_UPDATED") {
    settings = message.data;

    imageDebugLog("Settings updated received", {
      enabled: settings?.enabled,
      imageScanning: settings?.modules?.imageScanning,
    });

    // Re-evaluate scanning if settings changed
    if (!settings?.enabled || !settings?.modules?.imageScanning) {
      imageDebugLog("Image scanning disabled - cleaning up");
      cleanupBlurredImages();
      // Update debug interface
      if (window.armorOfGodImageFilter) {
        window.armorOfGodImageFilter.isActive = false;
      }
    } else {
      imageDebugLog("Image scanning enabled - starting scan");
      scanExistingImages();
      // Update debug interface
      if (window.armorOfGodImageFilter) {
        window.armorOfGodImageFilter.isActive = true;
      }
    }
  }
}

// Load the NSFWJS model
async function loadModel(): Promise<nsfwjs.NSFWJS> {
  if (model) return model;

  if (isModelLoading) {
    // Wait for existing load to complete
    while (isModelLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (model) return model;
  }

  isModelLoading = true;

  try {
    console.log("[Armor of God] Loading ML model...");

    // Set TensorFlow backend
    await tf.ready();

    // Load model from extension assets
    const modelUrl = browser.runtime.getURL(CONSTANTS.ML.MODEL_URL);
    model = await nsfwjs.load(modelUrl, {
      size: CONSTANTS.ML.MODEL_SIZE,
      type: "graph",
    });

    console.log("[Armor of God] ML model loaded successfully");

    return model;
  } catch (error) {
    console.error("[Armor of God] Model loading failed:", error);
    throw error;
  } finally {
    isModelLoading = false;
  }
}

// Setup intersection observer for viewport detection
function setupIntersectionObserver(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
          queueImageForScanning(entry.target);
        }
      }
    },
    {
      rootMargin: "200px", // Start loading before image enters viewport
      threshold: 0.1,
    }
  );

  // Observe existing images
  document.querySelectorAll("img").forEach((img) => observer.observe(img));

  // Store observer for cleanup
  (window as any).__armorOfGodObserver = observer;
}

// Setup mutation observer for dynamic content
function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          observeImage(node);
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll("img").forEach((img) => observeImage(img));
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  (window as any).__armorOfGodMutationObserver = observer;
}

// Observe a single image
function observeImage(img: HTMLImageElement): void {
  const intersectionObserver = (window as any).__armorOfGodObserver;
  if (intersectionObserver) {
    intersectionObserver.observe(img);
  }
}

// Scan existing images on page
function scanExistingImages(): void {
  const images = document.querySelectorAll("img");
  console.log(`[Armor of God] Found ${images.length} existing images`);

  images.forEach((img) => {
    if (isImageInViewport(img)) {
      queueImageForScanning(img);
    }
  });
}

// Check if image is in viewport
function isImageInViewport(img: HTMLImageElement): boolean {
  const rect = img.getBoundingClientRect();
  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

// Queue image for scanning
function queueImageForScanning(img: HTMLImageElement): void {
  if (!shouldScanImage(img)) {
    return;
  }

  if (!scanQueue.includes(img)) {
    scanQueue.push(img);
  }

  processImageQueue();
}

// Check if image should be scanned
function shouldScanImage(img: HTMLImageElement): boolean {
  if (!settings?.enabled || !settings?.modules?.imageScanning) {
    return false;
  }

  if (scannedImages.has(img)) {
    return false;
  }

  // Skip small images
  if (img.naturalWidth < 80 || img.naturalHeight < 80) {
    return false;
  }

  // Skip already blurred images
  if (img.classList.contains("armor-of-god-blurred")) {
    return false;
  }

  // Check if image is loaded
  if (!img.complete || img.naturalWidth === 0) {
    return false;
  }

  return true;
}

// Process the image scanning queue
async function processImageQueue(): Promise<void> {
  if (activeScanCount >= MAX_CONCURRENT_SCANS || scanQueue.length === 0) {
    return;
  }

  const img = scanQueue.shift();
  if (!img || !shouldScanImage(img)) {
    processImageQueue(); // Continue with next image
    return;
  }

  activeScanCount++;
  scannedImages.add(img);

  try {
    await scanImage(img);
  } catch (error) {
    console.error("[Armor of God] Image scan failed:", error);
  } finally {
    activeScanCount--;

    // Process next image with debounce
    setTimeout(() => processImageQueue(), SCAN_DEBOUNCE_MS);
  }
}

// Scan a single image
async function scanImage(img: HTMLImageElement): Promise<void> {
  try {
    // Load model if not loaded
    const modelInstance = await loadModel();

    // Create scan context
    const context: ImageScanContext = {
      element: img,
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      isVisible: isImageInViewport(img),
      timestamp: Date.now(),
    };

    console.log(
      "[Armor of God] Scanning image:",
      context.src.substring(0, 100)
    );

    // Classify the image
    const predictions = await modelInstance.classify(img);

    // Calculate explicit content score
    const explicitScore = CONSTANTS.ML.EXPLICIT_CATEGORIES.reduce(
      (score, category) => {
        const prediction = predictions.find((p) => p.className === category);
        return score + (prediction?.probability || 0);
      },
      0
    );

    const scanResult: ScanResult = {
      score: explicitScore,
      categories: predictions.reduce(
        (acc, pred) => {
          acc[pred.className] = pred.probability;
          return acc;
        },
        {} as Record<string, number>
      ),
      action: determineAction(explicitScore),
      timestamp: Date.now(),
    };

    console.log("[Armor of God] Scan result:", {
      src: context.src.substring(0, 100),
      score: explicitScore.toFixed(3),
      action: scanResult.action,
    });

    // Apply action based on result
    await applyAction(img, scanResult, context);

    // Report to background for statistics
    if (scanResult.action !== "allow") {
      browser.runtime
        .sendMessage({
          type: "REPORT_BLOCK",
          data: {
            type: "image",
            url: context.src,
            reason: `ML score: ${explicitScore.toFixed(3)}`,
          },
        })
        .catch(() => {}); // Ignore errors
    }
  } catch (error) {
    console.error("[Armor of God] Image scanning failed:", error);
  }
}

// Determine action based on score and thresholds
function determineAction(score: number): ScanResult["action"] {
  if (!settings) return "allow";

  const { thresholds } = settings;

  // Apply aggressive filtering for inappropriate searches
  if (requiresAggressiveFiltering()) {
    // Lower all thresholds significantly for inappropriate search contexts
    if (score >= thresholds.blur * 0.3) {
      // Much more aggressive
      return "blur";
    } else if (score >= thresholds.warning * 0.2) {
      return "warn";
    }
  }

  if (score >= thresholds.block) {
    return "block";
  } else if (score >= thresholds.blur) {
    return "blur";
  } else if (score >= thresholds.warning) {
    return "warn";
  }

  return "allow";
}

// Apply action to image
async function applyAction(
  img: HTMLImageElement,
  result: ScanResult,
  context: ImageScanContext
): Promise<void> {
  imageDebugLog(`Applying action "${result.action}" to image:`, {
    src: img.src.substring(0, 100),
    score: result.score,
    predictions: result.predictions,
  });

  switch (result.action) {
    case "block":
      blockImage(img, result);
      imageDebugStats.imagesBlocked++;
      break;
    case "blur":
      blurImage(img, result);
      imageDebugStats.imagesBlurred++;
      break;
    case "warn":
      warnImage(img, result);
      imageDebugStats.imagesWarned++;
      break;
    case "allow":
      // No action needed
      break;
  }

  imageDebugStats.imagesScanned++;
  imageDebugLog(
    `Image processing stats: Scanned=${imageDebugStats.imagesScanned}, Blurred=${imageDebugStats.imagesBlurred}, Blocked=${imageDebugStats.imagesBlocked}, Warned=${imageDebugStats.imagesWarned}`
  );
}

// Block an image completely
function blockImage(img: HTMLImageElement, result: ScanResult): void {
  img.style.display = "none";
  img.classList.add("armor-of-god-blocked");
  img.setAttribute("data-armor-blocked", "true");
  img.setAttribute("aria-label", "Image blocked by content filter");

  console.log("[Armor of God] Image blocked:", img.src.substring(0, 100));
}

// Blur an image
function blurImage(img: HTMLImageElement, result: ScanResult): void {
  img.classList.add("armor-of-god-blurred");

  // Apply more aggressive blur for inappropriate search contexts
  const blurAmount = requiresAggressiveFiltering() ? "40px" : "20px";
  img.style.filter = `blur(${blurAmount})`;
  img.style.transition = "filter 0.3s ease";
  img.setAttribute("data-armor-blurred", "true");
  img.setAttribute("aria-label", "Image blurred by content filter");

  // Add visual overlay for aggressive filtering
  if (requiresAggressiveFiltering()) {
    addProtectionOverlay(img);
  }

  // Add click handler to temporarily unblur (with warning)
  img.style.cursor = "pointer";
  img.addEventListener(
    "click",
    (e) => handleBlurredImageClick(e, img, result),
    { once: false }
  );

  console.log("[Armor of God] Image blurred:", img.src.substring(0, 100));
}

// Add protection overlay to heavily filtered images
function addProtectionOverlay(img: HTMLImageElement): void {
  // Skip if overlay already exists
  if (img.parentElement?.querySelector(".armor-protection-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "armor-protection-overlay";
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(147, 51, 234, 0.95));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    z-index: 1000;
    pointer-events: none;
    border-radius: 4px;
  `;

  overlay.innerHTML = `
    <div style="font-size: 20px; margin-bottom: 4px;">🛡️</div>
    <div>PROTECTED</div>
    <div style="font-size: 10px; font-weight: normal; margin-top: 2px;">Click to review</div>
  `;

  // Make image container relative if needed
  const container = img.parentElement;
  if (container && getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  // Insert overlay
  if (container) {
    container.appendChild(overlay);
  }
}

// Add warning to image
function warnImage(img: HTMLImageElement, result: ScanResult): void {
  img.classList.add("armor-of-god-warned");
  img.setAttribute("data-armor-warned", "true");
  img.style.border = "2px solid orange";
  img.style.boxShadow = "0 0 10px rgba(255, 165, 0, 0.3)";
  img.setAttribute("aria-label", "Image flagged as potentially sensitive");

  console.log("[Armor of God] Image warned:", img.src.substring(0, 100));
}

// Handle click on blurred image
function handleBlurredImageClick(
  e: Event,
  img: HTMLImageElement,
  result: ScanResult
): void {
  e.preventDefault();
  e.stopPropagation();

  const shouldUnblur = confirm(
    "This image was blurred due to potentially inappropriate content. " +
      "Are you sure you want to view it?"
  );

  if (shouldUnblur) {
    img.style.filter = "none";
    img.style.cursor = "default";
    img.classList.add("armor-of-god-unblurred");

    // Re-blur after 10 seconds
    setTimeout(() => {
      if (img.classList.contains("armor-of-god-unblurred")) {
        img.style.filter = "blur(20px)";
        img.style.cursor = "pointer";
        img.classList.remove("armor-of-god-unblurred");
      }
    }, 10000);
  }
}

// Clean up all blurred images (when extension is disabled)
function cleanupBlurredImages(): void {
  const blurredImages = document.querySelectorAll(".armor-of-god-blurred");
  blurredImages.forEach((img) => {
    if (img instanceof HTMLImageElement) {
      img.style.filter = "";
      img.style.cursor = "";
      img.classList.remove("armor-of-god-blurred");
      img.removeAttribute("data-armor-blurred");
      img.removeAttribute("aria-label");
    }
  });

  const blockedImages = document.querySelectorAll(".armor-of-god-blocked");
  blockedImages.forEach((img) => {
    if (img instanceof HTMLImageElement) {
      img.style.display = "";
      img.classList.remove("armor-of-god-blocked");
      img.removeAttribute("data-armor-blocked");
      img.removeAttribute("aria-label");
    }
  });

  const warnedImages = document.querySelectorAll(".armor-of-god-warned");
  warnedImages.forEach((img) => {
    if (img instanceof HTMLImageElement) {
      img.style.border = "";
      img.style.boxShadow = "";
      img.classList.remove("armor-of-god-warned");
      img.removeAttribute("data-armor-warned");
      img.removeAttribute("aria-label");
    }
  });

  console.log("[Armor of God] Cleaned up blurred/blocked images");
}

// Cleanup observers on page unload
window.addEventListener("beforeunload", () => {
  const observer = (window as any).__armorOfGodObserver;
  if (observer) {
    observer.disconnect();
  }

  const mutationObserver = (window as any).__armorOfGodMutationObserver;
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
});

// Initialize when DOM is ready with delay to ensure storage is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initialize, 100);
  });
} else {
  setTimeout(initialize, 100);
}

// Make browser available globally for this script with better fallback
const browser = (globalThis as any).browser ||
  (globalThis as any).chrome || {
    runtime: {
      sendMessage: () =>
        Promise.resolve({ error: "Browser API not available" }),
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
      },
    },
  };
