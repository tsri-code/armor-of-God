/**
 * Text content filtering for inappropriate language
 * Scans and filters text content, search queries, and URLs
 */

import type { Settings } from "../lib/types";
import { browser } from "../lib/browser";
import nsfwWords from "../data/nsfw-words.json";

// Global state
let settings: Settings | null = null;
let isInitialized = false;
let textObserver: MutationObserver | null = null;

// Word lists with severity levels
const EXPLICIT_WORDS = nsfwWords.explicit;
const SUGGESTIVE_WORDS = nsfwWords.suggestive;
const MODERATE_WORDS = nsfwWords.moderate;
const BLOCKED_SEARCHES = nsfwWords.searches;

// URL patterns for different sites
const GOOGLE_IMAGES_PATTERN =
  /images\.google\.|google\..+\/imghp|google\..+\/search.*tbm=isch/i;
const SEARCH_PATTERNS = [
  /google\..+\/search/i,
  /bing\.com\/search/i,
  /duckduckgo\.com/i,
  /search\.yahoo\.com/i,
];

interface TextScanResult {
  score: number;
  matchedWords: string[];
  severity: "explicit" | "suggestive" | "moderate";
  action: "block" | "blur" | "warn" | "allow";
}

// Initialize text filtering
async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    console.log("[Armor of God] Text filter initializing");

    // Get settings
    settings = await getSettings();

    if (!settings?.enabled) {
      console.log("[Armor of God] Text filtering disabled");
      return;
    }

    // Handle different site types
    if (isGoogleImages()) {
      initializeGoogleImages();
    } else if (isSearchEngine()) {
      initializeSearchEngine();
    } else {
      initializeGeneralSite();
    }

    // Block inappropriate search queries
    interceptSearchQueries();

    // Setup mutation observer for dynamic content
    setupTextObserver();

    isInitialized = true;
    console.log("[Armor of God] Text filter initialized");
  } catch (error) {
    console.error("[Armor of God] Text filter initialization failed:", error);
  }
}

// Get settings from background
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

// Check if current page is Google Images
function isGoogleImages(): boolean {
  return GOOGLE_IMAGES_PATTERN.test(window.location.href);
}

// Check if current page is a search engine
function isSearchEngine(): boolean {
  return SEARCH_PATTERNS.some((pattern) => pattern.test(window.location.href));
}

// Initialize Google Images specific filtering
function initializeGoogleImages(): void {
  console.log("[Armor of God] Initializing Google Images filtering");

  // Block inappropriate search queries
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q") || "";

  if (isInappropriateSearch(query)) {
    blockCurrentPage("Google Images search blocked", query);
    return;
  }

  // Enhanced image scanning for Google Images
  scanGoogleImages();

  // Watch for new images loading
  setupGoogleImagesObserver();
}

// Initialize search engine filtering
function initializeSearchEngine(): void {
  console.log("[Armor of God] Initializing search engine filtering");

  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q") || "";

  if (isInappropriateSearch(query)) {
    blockCurrentPage("Search blocked", query);
    return;
  }

  // Filter search results text content
  filterSearchResults();
}

// Initialize general website filtering
function initializeGeneralSite(): void {
  console.log("[Armor of God] Initializing general site text filtering");

  // Scan page text content
  scanPageText();
}

// Check if search query is inappropriate
function isInappropriateSearch(query: string): boolean {
  if (!query) return false;

  const normalizedQuery = query.toLowerCase().trim();

  return BLOCKED_SEARCHES.some((blockedTerm) => {
    return (
      normalizedQuery.includes(blockedTerm.toLowerCase()) ||
      normalizedQuery === blockedTerm.toLowerCase()
    );
  });
}

// Block the current page with Christian message
function blockCurrentPage(reason: string, query: string): void {
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      padding: 2rem;
    ">
      <div style="
        background: white;
        color: #333;
        padding: 3rem;
        border-radius: 1rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        max-width: 600px;
        margin: 0 auto;
      ">
        <div style="margin-bottom: 2rem;">
          <img src="${browser.runtime.getURL("/assets/Icons/helmet-cross/helmet-cross-64.png")}"
               alt="Protection Shield"
               style="width: 80px; height: 80px; margin: 0 auto 1rem;"
               onerror="this.style.display='none'">
        </div>

        <h1 style="
          color: #dc2626;
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 1rem;
        ">Search Blocked</h1>

        <p style="
          color: #6b7280;
          margin-bottom: 2rem;
          line-height: 1.6;
        ">${reason}: This search contains content that conflicts with maintaining a pure mind and heart.</p>

        <div style="
          background: linear-gradient(to right, #dbeafe, #e0e7ff);
          border: 1px solid #bfdbfe;
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
        ">
          <div style="display: flex; align-items: center; margin-bottom: 1rem;">
            <img src="${browser.runtime.getURL("/assets/Icons/book-cross/book-cross-16.png")}"
                 alt="Bible"
                 style="width: 16px; height: 16px; margin-right: 8px;"
                 onerror="this.style.display='none'">
            <h3 style="color: #1e40af; font-weight: 600; margin: 0;">Today's Verse</h3>
          </div>
          <blockquote style="
            color: #1e3a8a;
            font-style: italic;
            font-size: 1.1rem;
            line-height: 1.6;
            margin: 0 0 1rem 0;
          ">
            "Finally, brothers, whatever is true, whatever is noble, whatever is right,
            whatever is pure, whatever is lovely, whatever is admirable—if anything is
            excellent or praiseworthy—think about such things."
          </blockquote>
          <cite style="color: #3730a3; font-size: 0.9rem;">— Philippians 4:8 (BSB)</cite>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button onclick="history.back()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#2563eb'"
             onmouseout="this.style.backgroundColor='#3b82f6'">
            Go Back
          </button>
          <button onclick="window.location.href='${getChristianSearchAlternative(query)}'" style="
            background: #10b981;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#059669'"
             onmouseout="this.style.backgroundColor='#10b981'">
            Safe Search Instead
          </button>
        </div>
      </div>
    </div>
  `;

  // Report block to background
  browser.runtime
    .sendMessage({
      type: "REPORT_BLOCK",
      data: {
        type: "search",
        url: window.location.href,
        reason: `Inappropriate search: "${query}"`,
      },
    })
    .catch(() => {});
}

// Get Christian search alternative
function getChristianSearchAlternative(originalQuery: string): string {
  const safeQuery = originalQuery.replace(
    /\b(sexy|hot|nude|naked|porn|adult|erotic)\b/gi,
    ""
  );
  const cleanQuery = safeQuery.trim() || "Christian resources";
  return `https://www.google.com/search?q=${encodeURIComponent(cleanQuery + " Christian family friendly")}&safe=strict`;
}

// Scan Google Images specifically
function scanGoogleImages(): void {
  // Google Images has specific selectors for image results
  const imageSelectors = [
    "img[data-src]", // Lazy loaded images
    "div[data-ved] img", // Image containers
    ".rg_i", // Image grid items
    ".isv-r img", // Image search results
  ];

  imageSelectors.forEach((selector) => {
    const images = document.querySelectorAll(selector);
    images.forEach((img) => {
      if (img instanceof HTMLImageElement) {
        // Use intersection observer to scan when visible
        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (
                  entry.isIntersecting &&
                  entry.target instanceof HTMLImageElement
                ) {
                  scanGoogleImage(entry.target);
                  observer.unobserve(entry.target);
                }
              });
            },
            { threshold: 0.1 }
          );

          observer.observe(img);
        } else {
          // Fallback for older browsers
          scanGoogleImage(img);
        }
      }
    });
  });
}

// Scan individual Google Images result
function scanGoogleImage(img: HTMLImageElement): void {
  // Skip if already processed
  if (img.hasAttribute("data-armor-processed")) return;
  img.setAttribute("data-armor-processed", "true");

  // Apply more aggressive filtering for Google Images
  const parentElement = img.closest("div[data-ved], .isv-r, .rg_i");

  if (parentElement) {
    // Block the entire image container
    parentElement.style.filter = "blur(20px)";
    parentElement.style.position = "relative";

    // Add click handler with warning
    parentElement.style.cursor = "pointer";
    parentElement.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        const shouldView = confirm(
          "This image result was filtered due to your content protection settings. " +
            "Are you sure you want to view it?"
        );

        if (shouldView) {
          parentElement.style.filter = "none";

          // Re-blur after 5 seconds
          setTimeout(() => {
            parentElement.style.filter = "blur(20px)";
          }, 5000);
        }
      },
      { capture: true }
    );

    // Add overlay with Christian message
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(59, 130, 246, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      z-index: 10;
      pointer-events: none;
    `;
    overlay.innerHTML = "🛡️<br>FILTERED";
    parentElement.appendChild(overlay);
  }
}

// Setup observer for Google Images dynamic loading
function setupGoogleImagesObserver(): void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // Check for new images
          const newImages = node.querySelectorAll(
            "img[data-src], .rg_i img, .isv-r img"
          );
          newImages.forEach((img) => {
            if (img instanceof HTMLImageElement) {
              scanGoogleImage(img);
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Store observer for cleanup
  textObserver = observer;
}

// Scan general page text content
function scanPageText(): void {
  const textElements = document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, span, div, article, section"
  );

  textElements.forEach((element) => {
    if (element.textContent) {
      const scanResult = analyzeText(element.textContent);

      if (scanResult.action !== "allow") {
        applyTextAction(element as HTMLElement, scanResult);
      }
    }
  });
}

// Analyze text content for inappropriate language
function analyzeText(text: string): TextScanResult {
  const normalizedText = text.toLowerCase();
  let score = 0;
  const matchedWords: string[] = [];
  let severity: "explicit" | "suggestive" | "moderate" = "moderate";

  // Check explicit words (highest weight)
  EXPLICIT_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, "gi");
    const matches = normalizedText.match(regex);
    if (matches) {
      score += matches.length * 10;
      matchedWords.push(word);
      severity = "explicit";
    }
  });

  // Check suggestive words
  SUGGESTIVE_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, "gi");
    const matches = normalizedText.match(regex);
    if (matches) {
      score += matches.length * 5;
      matchedWords.push(word);
      if (severity !== "explicit") severity = "suggestive";
    }
  });

  // Check moderate words
  MODERATE_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, "gi");
    const matches = normalizedText.match(regex);
    if (matches) {
      score += matches.length * 2;
      matchedWords.push(word);
    }
  });

  // Determine action based on score and settings
  let action: "block" | "blur" | "warn" | "allow" = "allow";

  if (!settings) return { score, matchedWords, severity, action };

  if (score >= 20 || severity === "explicit") {
    action = "block";
  } else if (score >= 10 || severity === "suggestive") {
    action = "blur";
  } else if (score >= 5) {
    action = "warn";
  }

  return { score, matchedWords, severity, action };
}

// Apply action to text element
function applyTextAction(element: HTMLElement, result: TextScanResult): void {
  switch (result.action) {
    case "block":
      element.style.display = "none";
      break;
    case "blur":
      element.style.filter = "blur(5px)";
      element.style.cursor = "pointer";
      element.title = "Content filtered - click to temporarily reveal";
      element.addEventListener(
        "click",
        () => {
          element.style.filter = "none";
          setTimeout(() => {
            element.style.filter = "blur(5px)";
          }, 3000);
        },
        { once: false }
      );
      break;
    case "warn":
      element.style.backgroundColor = "rgba(255, 165, 0, 0.1)";
      element.style.border = "1px solid orange";
      element.style.borderRadius = "3px";
      break;
  }
}

// Filter search results
function filterSearchResults(): void {
  const resultSelectors = [
    ".g", // Google results
    ".b_algo", // Bing results
    ".result", // DuckDuckGo results
  ];

  resultSelectors.forEach((selector) => {
    const results = document.querySelectorAll(selector);
    results.forEach((result) => {
      const textContent = result.textContent || "";
      const scanResult = analyzeText(textContent);

      if (scanResult.action === "block") {
        (result as HTMLElement).style.display = "none";
      } else if (scanResult.action === "blur") {
        (result as HTMLElement).style.filter = "blur(3px)";
        (result as HTMLElement).style.cursor = "pointer";
        result.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            const shouldReveal = confirm(
              "This search result contains potentially inappropriate content. View anyway?"
            );
            if (shouldReveal) {
              (result as HTMLElement).style.filter = "none";
            }
          },
          { once: true }
        );
      }
    });
  });
}

// Intercept search queries
function interceptSearchQueries(): void {
  // Intercept form submissions
  const searchForms = document.querySelectorAll(
    'form[action*="search"], form[method="get"]'
  );

  searchForms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      const formData = new FormData(form as HTMLFormElement);
      const query = (formData.get("q") as string) || "";

      if (isInappropriateSearch(query)) {
        e.preventDefault();
        alert("Search blocked: This search contains inappropriate content.");

        // Suggest alternative search
        const cleanQuery = getChristianSearchAlternative(query);
        if (
          confirm(
            "Would you like to search for family-friendly alternatives instead?"
          )
        ) {
          window.location.href = cleanQuery;
        }
      }
    });
  });

  // Intercept URL changes (for SPAs)
  const originalPushState = history.pushState;
  history.pushState = function (state, title, url) {
    if (url && typeof url === "string") {
      const urlObj = new URL(url, window.location.origin);
      const query = urlObj.searchParams.get("q") || "";

      if (isInappropriateSearch(query)) {
        console.log(
          "[Armor of God] Blocked navigation to inappropriate search"
        );
        return;
      }
    }

    return originalPushState.apply(this, arguments as any);
  };
}

// Setup text mutation observer
function setupTextObserver(): void {
  if (textObserver) return;

  textObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // Scan new text content
          const textElements = node.querySelectorAll(
            "p, h1, h2, h3, h4, h5, h6, span, div"
          );
          textElements.forEach((element) => {
            if (element.textContent) {
              const scanResult = analyzeText(element.textContent);
              if (scanResult.action !== "allow") {
                applyTextAction(element as HTMLElement, scanResult);
              }
            }
          });
        }
      });
    });
  });

  textObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (textObserver) {
    textObserver.disconnect();
  }
});

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
