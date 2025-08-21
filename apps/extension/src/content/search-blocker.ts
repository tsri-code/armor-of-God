/**
 * Search Result Blocker
 * Blocks inappropriate search results on Google and other search engines
 */

import nsfwWords from "../data/nsfw-words.json";
import type { Settings } from "../lib/types";

// Debug flag
const DEBUG = true;

// Get browser API
const browser = (globalThis as any).browser ||
  (globalThis as any).chrome || {
    runtime: {
      sendMessage: () =>
        Promise.resolve({ error: "Browser API not available" }),
    },
  };

let settings: Settings | null = null;
let isActive = false;

function debugLog(message: string, data?: any): void {
  if (DEBUG) {
    console.log(`[Armor of God - Search Blocker] ${message}`, data || "");
  }
}

// Initialize
async function initialize(): Promise<void> {
  try {
    debugLog("Search blocker initializing...");

    // Get settings
    settings = await getSettings();

    if (!settings?.enabled) {
      debugLog("Extension disabled - search blocker inactive");
      return;
    }

    isActive = true;
    debugLog("Search blocker active");

    // Check if we're on a search page
    if (isSearchPage()) {
      debugLog("Search page detected - scanning results");
      scanSearchResults();
      setupObserver();
    }

    // Listen for settings changes
    browser.runtime.onMessage.addListener((message: any) => {
      if (message.type === "SETTINGS_UPDATED") {
        handleSettingsUpdate(message.data);
      }
    });
  } catch (error) {
    debugLog("Initialization failed", error);
  }
}

// Get settings
async function getSettings(): Promise<Settings | null> {
  try {
    if (!browser?.runtime?.sendMessage) {
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
    debugLog("Failed to get settings", error);
    return null;
  }
}

// Handle settings updates
function handleSettingsUpdate(newSettings: Settings): void {
  settings = newSettings;

  if (!settings?.enabled) {
    debugLog("Extension disabled - stopping search blocker");
    isActive = false;
    unblockAllResults();
  } else {
    debugLog("Extension enabled - activating search blocker");
    isActive = true;
    scanSearchResults();
  }
}

// Check if current page is a search page
function isSearchPage(): boolean {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // Google search
  if (hostname.includes("google.") && url.includes("/search")) {
    return true;
  }

  // Bing search
  if (hostname.includes("bing.com") && url.includes("/search")) {
    return true;
  }

  // DuckDuckGo
  if (hostname.includes("duckduckgo.com")) {
    return true;
  }

  return false;
}

// Scan search results
function scanSearchResults(): void {
  if (!isActive) return;

  const hostname = window.location.hostname;

  if (hostname.includes("google.")) {
    scanGoogleResults();
  } else if (hostname.includes("bing.com")) {
    scanBingResults();
  } else if (hostname.includes("duckduckgo.com")) {
    scanDuckDuckGoResults();
  }
}

// Scan Google search results
function scanGoogleResults(): void {
  debugLog("Scanning Google search results");

  // Get all search result containers
  const results = document.querySelectorAll(
    'div[data-sokoban-container], div.g, div[jscontroller][jsaction*="mouseover"]'
  );
  let blockedCount = 0;

  results.forEach((result) => {
    if (shouldBlockResult(result)) {
      blockSearchResult(result as HTMLElement);
      blockedCount++;
    }
  });

  debugLog(`Blocked ${blockedCount} results`);

  // Also check for knowledge panels and other content
  const knowledgePanels = document.querySelectorAll(
    "[data-attrid], [data-ved]"
  );
  knowledgePanels.forEach((panel) => {
    if (shouldBlockResult(panel)) {
      blockSearchResult(panel as HTMLElement);
    }
  });
}

// Scan Bing search results
function scanBingResults(): void {
  debugLog("Scanning Bing search results");

  const results = document.querySelectorAll("li.b_algo, div.b_algo");
  let blockedCount = 0;

  results.forEach((result) => {
    if (shouldBlockResult(result)) {
      blockSearchResult(result as HTMLElement);
      blockedCount++;
    }
  });

  debugLog(`Blocked ${blockedCount} results`);
}

// Scan DuckDuckGo search results
function scanDuckDuckGoResults(): void {
  debugLog("Scanning DuckDuckGo search results");

  const results = document.querySelectorAll(
    '[data-testid="result"], .result, article[data-testid="result"]'
  );
  let blockedCount = 0;

  results.forEach((result) => {
    if (shouldBlockResult(result)) {
      blockSearchResult(result as HTMLElement);
      blockedCount++;
    }
  });

  debugLog(`Blocked ${blockedCount} results`);
}

// Check if a search result should be blocked
function shouldBlockResult(element: Element): boolean {
  const text = element.textContent?.toLowerCase() || "";

  // Check title
  const titleElement = element.querySelector("h3, h2, a[href]");
  const title = titleElement?.textContent?.toLowerCase() || "";

  // Check URL
  const urlElement = element.querySelector(
    "cite, .b_attribution, .result__url"
  );
  const url = urlElement?.textContent?.toLowerCase() || "";

  // Check snippet
  const snippetElement = element.querySelector(
    ".VwiC3b, .b_caption, .result__snippet"
  );
  const snippet = snippetElement?.textContent?.toLowerCase() || "";

  // Combine all text for checking
  const combinedText = `${title} ${url} ${snippet} ${text}`;

  // Check against explicit words
  for (const word of nsfwWords.explicit) {
    if (combinedText.includes(word.toLowerCase())) {
      debugLog(`Blocking result - explicit word found: ${word}`);
      return true;
    }
  }

  // Check against suggestive words (more lenient)
  let suggestiveCount = 0;
  for (const word of nsfwWords.suggestive) {
    if (combinedText.includes(word.toLowerCase())) {
      suggestiveCount++;
    }
  }

  // Block if multiple suggestive words found
  if (suggestiveCount >= 2) {
    debugLog(`Blocking result - multiple suggestive words found`);
    return true;
  }

  // Check for specific domains
  const blockedDomains = [
    "pornhub",
    "xvideos",
    "xhamster",
    "redtube",
    "youporn",
    "chaturbate",
    "onlyfans",
    "xxx",
    "porn",
    "sex",
    "adult",
    "nsfw",
    "escort",
    "cam4",
    "stripchat",
  ];

  for (const domain of blockedDomains) {
    if (url.includes(domain) || text.includes(domain)) {
      debugLog(`Blocking result - blocked domain: ${domain}`);
      return true;
    }
  }

  return false;
}

// Block a search result
function blockSearchResult(element: HTMLElement): void {
  // Don't block if already blocked
  if (element.classList.contains("armor-blocked")) {
    return;
  }

  element.classList.add("armor-blocked");
  element.style.display = "none";

  // Create blocked message
  const blockedMessage = document.createElement("div");
  blockedMessage.className = "armor-blocked-message";
  blockedMessage.style.cssText = `
    padding: 12px;
    margin: 8px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  blockedMessage.innerHTML = `
    <div style="width: 24px; height: 24px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
      <span style="color: #667eea; font-weight: bold;">✓</span>
    </div>
    <div>
      <strong>Content Blocked</strong> - This result contains inappropriate content
    </div>
  `;

  element.parentNode?.insertBefore(blockedMessage, element);
}

// Unblock all results (when extension is disabled)
function unblockAllResults(): void {
  const blockedResults = document.querySelectorAll(".armor-blocked");
  blockedResults.forEach((result) => {
    (result as HTMLElement).style.display = "";
    result.classList.remove("armor-blocked");
  });

  const blockedMessages = document.querySelectorAll(".armor-blocked-message");
  blockedMessages.forEach((message) => {
    message.remove();
  });
}

// Setup mutation observer for dynamic content
function setupObserver(): void {
  const observer = new MutationObserver((mutations) => {
    if (!isActive) return;

    // Debounce to avoid excessive scanning
    clearTimeout((window as any).searchBlockerTimeout);
    (window as any).searchBlockerTimeout = setTimeout(() => {
      scanSearchResults();
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initialize, 100);
  });
} else {
  setTimeout(initialize, 100);
}
