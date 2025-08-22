/**
 * Site Blocker
 * Blocks access to inappropriate websites
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
    console.log(`[Armor of God - Site Blocker] ${message}`, data || "");
  }
}

// Initialize
async function initialize(): Promise<void> {
  try {
    debugLog("Site blocker initializing...");

    // Get settings
    settings = await getSettings();

    if (!settings?.enabled) {
      debugLog("Extension disabled - site blocker inactive");
      return;
    }

    isActive = true;
    debugLog("Site blocker active - checking current site");

    // Check if current site should be blocked
    if (shouldBlockSite()) {
      blockSite();
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
    debugLog("Extension disabled - stopping site blocker");
    isActive = false;
    // Don't unblock - user needs to navigate away
  } else {
    debugLog("Extension enabled - checking site");
    isActive = true;
    if (shouldBlockSite()) {
      blockSite();
    }
  }
}

// Check if current site should be blocked
function shouldBlockSite(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const title = document.title.toLowerCase();

  // Check against known adult sites
  const blockedDomains = [
    // Major adult sites
    "pornhub.com",
    "xvideos.com",
    "xhamster.com",
    "redtube.com",
    "youporn.com",
    "chaturbate.com",
    "onlyfans.com",
    "stripchat.com",
    "cam4.com",
    "bongacams.com",
    "livejasmin.com",
    "myfreecams.com",

    // Adult content keywords in domain
    "xxx",
    "porn",
    "sex",
    "adult",
    "nsfw",
    "escort",
    "cam",
    "nude",
    "naked",
    "erotic",
    "fetish",
    "milf",
    "teen",

    // Specific sites mentioned by user
    "victoriassecret.com",
    "playboy.com",
    "maxim.com",
    "fhm.com",
    "penthouse.com",
    "hustler.com",
  ];

  // Check if domain contains blocked keywords
  for (const blocked of blockedDomains) {
    if (hostname.includes(blocked)) {
      debugLog(`Blocking site - domain match: ${blocked}`);
      return true;
    }
  }

  // Check page title for explicit content
  const explicitInTitle = nsfwWords.explicit.some((word) =>
    title.includes(word.toLowerCase())
  );

  if (explicitInTitle) {
    debugLog(`Blocking site - explicit content in title`);
    return true;
  }

  // Check URL path for explicit content
  const explicitInPath = nsfwWords.explicit.some((word) =>
    pathname.includes(word.toLowerCase())
  );

  if (explicitInPath) {
    debugLog(`Blocking site - explicit content in URL`);
    return true;
  }

  // Check for multiple suggestive terms
  const suggestiveCount = nsfwWords.suggestive.filter((word) => {
    const lowerWord = word.toLowerCase();
    return (
      hostname.includes(lowerWord) ||
      pathname.includes(lowerWord) ||
      title.includes(lowerWord)
    );
  }).length;

  if (suggestiveCount >= 3) {
    debugLog(`Blocking site - multiple suggestive terms found`);
    return true;
  }

  // Special check for lingerie/underwear sites
  const lingerieKeywords = [
    "lingerie",
    "underwear",
    "bra",
    "panties",
    "thong",
    "bikini",
  ];
  const sexualKeywords = ["sexy", "hot", "nude", "naked", "strip"];

  const hasLingerieContent = lingerieKeywords.some(
    (word) =>
      hostname.includes(word) || pathname.includes(word) || title.includes(word)
  );

  const hasSexualContent = sexualKeywords.some(
    (word) =>
      hostname.includes(word) || pathname.includes(word) || title.includes(word)
  );

  if (hasLingerieContent && hasSexualContent) {
    debugLog(`Blocking site - lingerie + sexual content detected`);
    return true;
  }

  return false;
}

// Block the site
function blockSite(): void {
  debugLog("Blocking site - redirecting to blocked page");

  // Create full-page overlay
  const overlay = document.createElement("div");
  overlay.id = "armor-site-blocked";
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    color: white !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `;

  overlay.innerHTML = `
    <div style="text-align: center; max-width: 600px; padding: 20px;">
      <div style="width: 80px; height: 80px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 7V12C3 16.5 6 20.26 12 21C18 20.26 21 16.5 21 12V7L12 2Z" fill="#667eea"/>
          <path d="M12 7V12M12 16H12.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 style="font-size: 32px; margin: 0 0 20px; font-weight: bold;">Site Blocked</h1>
      <p style="font-size: 18px; margin: 0 0 10px; opacity: 0.9;">
        This website contains inappropriate content and has been blocked by Armor of God.
      </p>
      <p style="font-size: 16px; margin: 0 0 30px; opacity: 0.8;">
        "Finally, brothers and sisters, whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things."
        <br><em>- Philippians 4:8</em>
      </p>
      <button onclick="history.back()" style="
        background: white;
        color: #667eea;
        border: none;
        padding: 12px 30px;
        font-size: 16px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: bold;
        margin: 0 10px;
      ">Go Back</button>
      <button onclick="window.location.href='https://www.google.com'" style="
        background: rgba(255,255,255,0.2);
        color: white;
        border: 2px solid white;
        padding: 12px 30px;
        font-size: 16px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: bold;
        margin: 0 10px;
      ">Go to Google</button>
    </div>
  `;

  // Remove all existing content
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  // Add overlay
  document.body.appendChild(overlay);

  // Prevent removal
  const observer = new MutationObserver(() => {
    if (!document.getElementById("armor-site-blocked")) {
      document.body.appendChild(overlay);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Report block
  try {
    browser.runtime.sendMessage({
      type: "REPORT_BLOCK",
      data: {
        type: "site",
        url: window.location.href,
        reason: "Inappropriate content detected",
      },
    });
  } catch (error) {
    debugLog("Failed to report block", error);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initialize, 50); // Quick check for site blocking
  });
} else {
  setTimeout(initialize, 50);
}
