/**
 * Video content scanning (v1.0 feature)
 * Samples video frames and analyzes them for inappropriate content
 */

import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import { CONSTANTS } from '@shared/index';
import type { VideoScanContext, ScanResult, Settings } from '../lib/types';

// Global state
let model: nsfwjs.NSFWJS | null = null;
let settings: Settings | null = null;
let activeScans = new Map<HTMLVideoElement, { intervalId: number; lastScan: number }>();
const scannedVideos = new WeakSet<HTMLVideoElement>();

// Video scanning configuration
const VIDEO_SCAN_CONFIG = {
  SAMPLE_INTERVAL: 5000, // 5 seconds
  MIN_VIDEO_SIZE: 100, // Minimum width/height to scan
  SKIP_SHORT_VIDEOS: 10, // Skip videos shorter than 10 seconds
  MAX_CONCURRENT_SCANS: 2,
  FRAME_ANALYSIS_SIZE: 224, // Size to resize frames for analysis
} as const;

// Initialize video scanning
export async function initializeVideoScanning(): Promise<void> {
  try {
    console.log('[Armor of God] Video scanning initializing');
    
    // Get settings
    settings = await getSettings();
    
    if (!settings?.enabled || !settings?.modules?.videoScanning) {
      console.log('[Armor of God] Video scanning disabled');
      return;
    }
    
    // Setup observers for video elements
    setupVideoObserver();
    
    // Scan existing videos
    scanExistingVideos();
    
    console.log('[Armor of God] Video scanning initialized');
    
  } catch (error) {
    console.error('[Armor of God] Video scanning initialization failed:', error);
  }
}

// Get current settings
async function getSettings(): Promise<Settings | null> {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    return response?.error ? null : response;
  } catch (error) {
    console.error('[Armor of God] Failed to get settings:', error);
    return null;
  }
}

// Setup video element observer
function setupVideoObserver(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLVideoElement) {
          setupVideoScanning(node);
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll('video').forEach(video => setupVideoScanning(video));
        }
      }
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  
  (window as any).__armorOfGodVideoObserver = observer;
}

// Scan existing videos on page
function scanExistingVideos(): void {
  const videos = document.querySelectorAll('video');
  console.log(`[Armor of God] Found ${videos.length} existing videos`);
  
  videos.forEach(video => setupVideoScanning(video));
}

// Setup scanning for a video element
function setupVideoScanning(video: HTMLVideoElement): void {
  if (!shouldScanVideo(video)) {
    return;
  }
  
  // Wait for video metadata to load
  if (video.readyState < 1) {
    video.addEventListener('loadedmetadata', () => setupVideoScanning(video), { once: true });
    return;
  }
  
  console.log(`[Armor of God] Setting up video scanning:`, {
    src: video.src?.substring(0, 100),
    duration: video.duration,
    dimensions: `${video.videoWidth}x${video.videoHeight}`,
  });
  
  // Add event listeners
  video.addEventListener('play', () => startVideoScanning(video));
  video.addEventListener('pause', () => stopVideoScanning(video));
  video.addEventListener('ended', () => stopVideoScanning(video));
  
  // Start scanning if already playing
  if (!video.paused && video.currentTime > 0) {
    startVideoScanning(video);
  }
  
  scannedVideos.add(video);
}

// Check if video should be scanned
function shouldScanVideo(video: HTMLVideoElement): boolean {
  if (!settings?.enabled || !settings?.modules?.videoScanning) {
    return false;
  }
  
  if (scannedVideos.has(video)) {
    return false;
  }
  
  // Skip small videos
  if (video.videoWidth < VIDEO_SCAN_CONFIG.MIN_VIDEO_SIZE || 
      video.videoHeight < VIDEO_SCAN_CONFIG.MIN_VIDEO_SIZE) {
    return false;
  }
  
  // Skip very short videos (likely GIFs or animations)
  if (video.duration > 0 && video.duration < VIDEO_SCAN_CONFIG.SKIP_SHORT_VIDEOS) {
    return false;
  }
  
  // Skip already processed videos
  if (video.classList.contains('armor-of-god-video-processed')) {
    return false;
  }
  
  return true;
}

// Start scanning a video
async function startVideoScanning(video: HTMLVideoElement): Promise<void> {
  if (activeScans.has(video)) {
    return; // Already scanning
  }
  
  try {
    console.log('[Armor of God] Starting video scan:', video.src?.substring(0, 100));
    
    // Load model if needed
    if (!model) {
      model = await loadModel();
    }
    
    // Start periodic sampling
    const intervalId = window.setInterval(() => {
      sampleVideoFrame(video);
    }, VIDEO_SCAN_CONFIG.SAMPLE_INTERVAL);
    
    activeScans.set(video, {
      intervalId,
      lastScan: Date.now(),
    });
    
    // Do initial scan
    await sampleVideoFrame(video);
    
  } catch (error) {
    console.error('[Armor of God] Failed to start video scanning:', error);
  }
}

// Stop scanning a video
function stopVideoScanning(video: HTMLVideoElement): void {
  const scanInfo = activeScans.get(video);
  if (scanInfo) {
    clearInterval(scanInfo.intervalId);
    activeScans.delete(video);
    console.log('[Armor of God] Stopped video scan:', video.src?.substring(0, 100));
  }
}

// Sample and analyze a video frame
async function sampleVideoFrame(video: HTMLVideoElement): Promise<void> {
  try {
    if (video.paused || video.ended || !model) {
      return;
    }
    
    // Create canvas to capture current frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to analysis size for efficiency
    canvas.width = VIDEO_SCAN_CONFIG.FRAME_ANALYSIS_SIZE;
    canvas.height = VIDEO_SCAN_CONFIG.FRAME_ANALYSIS_SIZE;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Create scan context
    const context: VideoScanContext = {
      element: video,
      src: video.src || video.currentSrc,
      currentTime: video.currentTime,
      duration: video.duration,
      isPlaying: !video.paused,
      timestamp: Date.now(),
    };
    
    console.log('[Armor of God] Sampling video frame:', {
      src: context.src.substring(0, 100),
      time: `${Math.floor(context.currentTime)}s / ${Math.floor(context.duration)}s`,
    });
    
    // Analyze frame
    const predictions = await model.classify(canvas);
    
    // Calculate explicit content score
    const explicitScore = CONSTANTS.ML.EXPLICIT_CATEGORIES.reduce((score, category) => {
      const prediction = predictions.find(p => p.className === category);
      return score + (prediction?.probability || 0);
    }, 0);
    
    const scanResult: ScanResult = {
      score: explicitScore,
      categories: predictions.reduce((acc, pred) => {
        acc[pred.className] = pred.probability;
        return acc;
      }, {} as Record<string, number>),
      action: determineVideoAction(explicitScore),
      timestamp: Date.now(),
    };
    
    console.log('[Armor of God] Video frame scan result:', {
      src: context.src.substring(0, 100),
      time: Math.floor(context.currentTime),
      score: explicitScore.toFixed(3),
      action: scanResult.action,
    });
    
    // Apply action if needed
    if (scanResult.action !== 'allow') {
      await applyVideoAction(video, scanResult, context);
    }
    
    // Update scan info
    const scanInfo = activeScans.get(video);
    if (scanInfo) {
      scanInfo.lastScan = Date.now();
    }
    
  } catch (error) {
    console.error('[Armor of God] Video frame sampling failed:', error);
  }
}

// Load ML model
async function loadModel(): Promise<nsfwjs.NSFWJS> {
  try {
    console.log('[Armor of God] Loading ML model for video scanning...');
    
    await tf.ready();
    
    const modelUrl = browser.runtime.getURL(CONSTANTS.ML.MODEL_URL);
    const loadedModel = await nsfwjs.load(modelUrl, { 
      size: CONSTANTS.ML.MODEL_SIZE,
      type: 'graph' 
    });
    
    console.log('[Armor of God] ML model loaded for video scanning');
    return loadedModel;
    
  } catch (error) {
    console.error('[Armor of God] Video model loading failed:', error);
    throw error;
  }
}

// Determine action for video based on score
function determineVideoAction(score: number): ScanResult['action'] {
  if (!settings) return 'allow';
  
  const { thresholds } = settings;
  
  // Use slightly higher thresholds for video to reduce false positives
  const videoThresholds = {
    block: thresholds.block + 0.1,
    blur: thresholds.blur + 0.05,
    warning: thresholds.warning + 0.02,
  };
  
  if (score >= videoThresholds.block) {
    return 'block';
  } else if (score >= videoThresholds.blur) {
    return 'blur';
  } else if (score >= videoThresholds.warning) {
    return 'warn';
  }
  
  return 'allow';
}

// Apply action to video
async function applyVideoAction(
  video: HTMLVideoElement,
  result: ScanResult,
  context: VideoScanContext
): Promise<void> {
  switch (result.action) {
    case 'block':
      blockVideo(video, result);
      break;
    case 'blur':
      blurVideo(video, result);
      break;
    case 'warn':
      warnVideo(video, result);
      break;
  }
  
  // Report to background
  browser.runtime.sendMessage({
    type: 'REPORT_BLOCK',
    data: {
      type: 'video',
      url: context.src,
      reason: `ML score: ${result.score.toFixed(3)} at ${Math.floor(context.currentTime)}s`,
    },
  }).catch(() => {});
}

// Block video completely
function blockVideo(video: HTMLVideoElement, result: ScanResult): void {
  video.pause();
  video.style.display = 'none';
  video.classList.add('armor-of-god-video-blocked');
  
  // Create replacement element
  const replacement = document.createElement('div');
  replacement.className = 'armor-of-god-video-overlay';
  replacement.innerHTML = `
    <div class="icon">🛡️</div>
    <div class="message">Video blocked by content filter</div>
    <div class="details">Content detected: ${(result.score * 100).toFixed(1)}% explicit</div>
  `;
  
  video.parentNode?.insertBefore(replacement, video);
  
  stopVideoScanning(video);
  console.log('[Armor of God] Video blocked:', context.src.substring(0, 100));
}

// Blur video with overlay
function blurVideo(video: HTMLVideoElement, result: ScanResult): void {
  video.classList.add('armor-of-god-video-blurred');
  video.style.filter = 'blur(20px)';
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'armor-of-god-video-overlay';
  overlay.style.cursor = 'pointer';
  overlay.innerHTML = `
    <div class="icon">🛡️</div>
    <div class="message">Video content filtered</div>
    <div class="details">Click to temporarily view (${(result.score * 100).toFixed(1)}% explicit content detected)</div>
  `;
  
  // Position overlay
  video.style.position = 'relative';
  video.parentNode?.insertBefore(overlay, video.nextSibling);
  
  // Add click handler
  overlay.addEventListener('click', () => handleVideoUnblur(video, overlay), { once: true });
  
  console.log('[Armor of God] Video blurred:', context.src.substring(0, 100));
}

// Add warning to video
function warnVideo(video: HTMLVideoElement, result: ScanResult): void {
  video.classList.add('armor-of-god-video-warned');
  
  // Add warning indicator
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: absolute !important;
    top: 10px !important;
    right: 10px !important;
    background: rgba(245, 158, 11, 0.9) !important;
    color: white !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    font-size: 12px !important;
    font-weight: bold !important;
    z-index: 1000 !important;
    pointer-events: none !important;
  `;
  warning.textContent = '⚠️ Sensitive Content';
  
  video.style.position = 'relative';
  video.parentNode?.insertBefore(warning, video.nextSibling);
  
  console.log('[Armor of God] Video warned:', context.src.substring(0, 100));
}

// Handle video unblur
function handleVideoUnblur(video: HTMLVideoElement, overlay: HTMLElement): void {
  const confirmed = confirm(
    'This video was filtered due to potentially inappropriate content. ' +
    'Are you sure you want to view it?'
  );
  
  if (confirmed) {
    video.style.filter = 'none';
    overlay.style.display = 'none';
    
    // Re-blur after 30 seconds
    setTimeout(() => {
      if (!video.paused) {
        video.style.filter = 'blur(20px)';
        overlay.style.display = 'flex';
      }
    }, 30000);
  }
}

// Cleanup video scanning
export function cleanupVideoScanning(): void {
  // Stop all active scans
  for (const [video, scanInfo] of activeScans) {
    clearInterval(scanInfo.intervalId);
  }
  activeScans.clear();
  
  // Remove all video filters
  const processedVideos = document.querySelectorAll('.armor-of-god-video-blocked, .armor-of-god-video-blurred, .armor-of-god-video-warned');
  processedVideos.forEach(video => {
    if (video instanceof HTMLVideoElement) {
      video.style.display = '';
      video.style.filter = '';
      video.classList.remove('armor-of-god-video-blocked', 'armor-of-god-video-blurred', 'armor-of-god-video-warned');
    }
  });
  
  // Remove overlays
  const overlays = document.querySelectorAll('.armor-of-god-video-overlay');
  overlays.forEach(overlay => overlay.remove());
  
  // Disconnect observer
  const observer = (window as any).__armorOfGodVideoObserver;
  if (observer) {
    observer.disconnect();
  }
  
  console.log('[Armor of God] Video scanning cleaned up');
}

// Export for use in main content script
export { setupVideoScanning, shouldScanVideo, stopVideoScanning };

// Make browser available
const browser = (globalThis as any).browser || (globalThis as any).chrome;
