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

// Initialize the content script
async function initialize(): Promise<void> {
  try {
    console.log("[Armor of God] Content script initializing");

    // Get initial settings
    settings = await getSettings();

    if (!settings?.enabled || !settings?.modules?.imageScanning) {
      console.log("[Armor of God] Image scanning disabled");
      return;
    }

    // Setup intersection observer for viewport detection
    setupIntersectionObserver();

    // Setup mutation observer for dynamic content
    setupMutationObserver();

    // Scan existing images
    scanExistingImages();

    // Listen for settings changes
    browser.runtime.onMessage.addListener(handleMessage);

    console.log("[Armor of God] Content script initialized");
  } catch (error) {
    console.error(
      "[Armor of God] Content script initialization failed:",
      error
    );
  }
}

// Get current settings from background
async function getSettings(): Promise<Settings | null> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "GET_SETTINGS",
    });
    return response?.error ? null : response;
  } catch (error) {
    console.error("[Armor of God] Failed to get settings:", error);
    return null;
  }
}

// Handle messages from background
function handleMessage(message: any): void {
  if (message.type === "SETTINGS_UPDATED") {
    settings = message.data;

    // Re-evaluate scanning if settings changed
    if (!settings?.enabled || !settings?.modules?.imageScanning) {
      cleanupBlurredImages();
    } else {
      scanExistingImages();
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
  switch (result.action) {
    case "block":
      blockImage(img, result);
      break;
    case "blur":
      blurImage(img, result);
      break;
    case "warn":
      warnImage(img, result);
      break;
    case "allow":
      // No action needed
      break;
  }
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
  img.style.filter = "blur(20px)";
  img.style.transition = "filter 0.3s ease";
  img.setAttribute("data-armor-blurred", "true");
  img.setAttribute("aria-label", "Image blurred by content filter");

  // Add click handler to temporarily unblur (with warning)
  img.style.cursor = "pointer";
  img.addEventListener(
    "click",
    (e) => handleBlurredImageClick(e, img, result),
    { once: false }
  );

  console.log("[Armor of God] Image blurred:", img.src.substring(0, 100));
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

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Make browser available globally for this script
const browser = (globalThis as any).browser || (globalThis as any).chrome;
