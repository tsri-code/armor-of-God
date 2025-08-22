/**
 * Background service worker for Armor of God extension
 * Handles DNR rules, safe search, verse fetching, and alarms
 */

import browser from "../lib/browser";
import { storage } from "../lib/storage";
import { logger } from "../lib/log";
import { applyUserRules, loadInitialRules } from "./rules-updater";
import { enforceSafeSearch, updateSafeSearchRules } from "./safe-search";
import { setupAlarms, handleAlarm } from "./alarms";
import { fetchVerseOfDay } from "./verse-service";
import { CONSTANTS } from "@shared/index";

// Extension lifecycle events
browser.runtime.onInstalled.addListener(async (details) => {
  try {
    logger.info("service-worker", "Extension installed", {
      reason: details.reason,
    });

    // Initialize on install or update
    if (details.reason === "install") {
      await handleFirstInstall();
    } else if (details.reason === "update") {
      await handleUpdate(details.previousVersion);
    }

    // Always setup core functionality
    await initializeExtension();
  } catch (error) {
    logger.error("service-worker", "Installation failed", error);
  }
});

browser.runtime.onStartup.addListener(async () => {
  try {
    logger.info("service-worker", "Extension startup");
    await initializeExtension();
  } catch (error) {
    logger.error("service-worker", "Startup failed", error);
  }
});

// Handle first install
async function handleFirstInstall(): Promise<void> {
  logger.info("service-worker", "First install - setting up defaults");

  // Storage will automatically provide defaults if no settings exist
  const settings = await storage.getSettings();
  logger.info("service-worker", "Default settings initialized", {
    enabled: settings.enabled,
  });

  // Fetch initial verse
  try {
    await fetchVerseOfDay();
  } catch (error) {
    logger.warn("service-worker", "Failed to fetch initial verse", error);
  }
}

// Handle extension updates
async function handleUpdate(previousVersion?: string): Promise<void> {
  logger.info("service-worker", "Extension updated", { from: previousVersion });

  // Cleanup old cache entries
  await storage.cleanupOldCache();

  // Could add migration logic here if needed
  // await migrateSettings(previousVersion);
}

// Core initialization
async function initializeExtension(): Promise<void> {
  logger.info("service-worker", "Initializing extension");

  try {
    // Load and apply blocking rules (with error isolation)
    try {
      await loadInitialRules();
    } catch (rulesError) {
      logger.warn(
        "service-worker",
        "Rules initialization failed, continuing",
        rulesError
      );
    }

    try {
      await applyUserRules();
    } catch (userRulesError) {
      logger.warn(
        "service-worker",
        "User rules failed, continuing",
        userRulesError
      );
    }

    // Setup safe search enforcement (with error isolation)
    try {
      await enforceSafeSearch();
    } catch (safeSearchError) {
      logger.warn(
        "service-worker",
        "Safe search setup failed, continuing",
        safeSearchError
      );
    }

    // Setup scheduled tasks (with error isolation)
    try {
      await setupAlarms();
    } catch (alarmsError) {
      logger.warn(
        "service-worker",
        "Alarms setup failed, continuing",
        alarmsError
      );
    }

    // Fetch verse of the day if needed (with error isolation)
    try {
      const cachedVerse = await storage.getCachedVerse();
      if (!cachedVerse) {
        await fetchVerseOfDay();
      }
    } catch (verseError) {
      logger.warn(
        "service-worker",
        "Verse fetching failed, continuing",
        verseError
      );
    }

    logger.info("service-worker", "Extension initialized successfully");
  } catch (error) {
    logger.error("service-worker", "Initialization failed", error);
  }
}

// Storage change handler
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;

  try {
    logger.debug("service-worker", "Storage changed", Object.keys(changes));

    // Handle settings changes
    if (changes.settings) {
      const newSettings = changes.settings.newValue;
      const oldSettings = changes.settings.oldValue;

      logger.info("service-worker", "Settings updated");

      // Update rules if blocking settings changed
      if (
        newSettings?.modules?.urlBlocking !==
          oldSettings?.modules?.urlBlocking ||
        newSettings?.blacklist !== oldSettings?.blacklist ||
        newSettings?.whitelist !== oldSettings?.whitelist
      ) {
        await applyUserRules();
      }

      // Update safe search if changed
      if (
        newSettings?.modules?.safeSearch !== oldSettings?.modules?.safeSearch
      ) {
        await updateSafeSearchRules(newSettings.modules.safeSearch);
      }

      // Update alarms if schedules changed
      if (
        JSON.stringify(newSettings?.schedules) !==
        JSON.stringify(oldSettings?.schedules)
      ) {
        await setupAlarms();
      }
    }
  } catch (error) {
    logger.error("service-worker", "Failed to handle storage change", error);
  }
});

// Alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  try {
    await handleAlarm(alarm);
  } catch (error) {
    logger.error(
      "service-worker",
      "Alarm handler failed",
      { alarmName: alarm.name },
      error
    );
  }
});

// Message handling
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    logger.debug("service-worker", "Message received", {
      type: message.type,
      from: sender.tab?.id,
    });

    const response = await handleMessage(message, sender);

    // For async responses, return true to keep message channel open
    if (response && typeof response.then === "function") {
      response.then(sendResponse);
      return true;
    }

    if (response !== undefined) {
      sendResponse(response);
    }
  } catch (error) {
    logger.error(
      "service-worker",
      "Message handling failed",
      { type: message.type },
      error
    );
    sendResponse({ error: error.message });
  }
});

// Message router
async function handleMessage(message: any, sender: any): Promise<any> {
  switch (message.type) {
    case "GET_SETTINGS":
      return await storage.getSettings();

    case "UPDATE_SETTINGS":
      await storage.setSettings(message.data);
      return { success: true };

    case "GET_VERSE":
      return await getOrFetchVerse(message.data?.date);

    case "GET_STATS":
      return await logger.getStats();

    case "RESET_STATS":
      await logger.resetStats();
      return { success: true };

    case "TOGGLE_EXTENSION":
      return await toggleExtension();

    case "REQUEST_ACCESS":
      return await handleAccessRequest(message.data, sender);

    case "REPORT_BLOCK":
      await logger.trackBlock(
        message.data.type,
        message.data.url,
        message.data.reason
      );
      return { success: true };

    default:
      logger.warn("service-worker", "Unknown message type", {
        type: message.type,
      });
      return { error: "Unknown message type" };
  }
}

// Get or fetch verse of the day
async function getOrFetchVerse(date?: string): Promise<any> {
  try {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Try cache first
    let verse = await storage.getCachedVerse(targetDate);

    if (!verse) {
      // Fetch new verse
      verse = await fetchVerseOfDay(targetDate);
    }

    return verse;
  } catch (error) {
    logger.error("service-worker", "Failed to get verse", error);
    return { error: "Failed to fetch verse" };
  }
}

// Toggle extension enabled/disabled state
async function toggleExtension(): Promise<any> {
  try {
    const settings = await storage.getSettings();
    const newEnabled = !settings.enabled;

    console.log(
      `[Service Worker] Toggle requested: ${settings.enabled} -> ${newEnabled}`
    );

    // Update settings with new enabled state
    const updatedSettings = { ...settings, enabled: newEnabled };
    await storage.setSettings(updatedSettings);

    console.log(`[Service Worker] Settings saved with enabled=${newEnabled}`);

    if (newEnabled) {
      await applyUserRules();
      await enforceSafeSearch();
      console.log("[Service Worker] Rules and safe search applied");
    } else {
      await clearAllDynamicRules();
      console.log("[Service Worker] Dynamic rules cleared");
    }

    // CRITICAL: Broadcast settings change to ALL tabs
    const tabs = await browser.tabs.query({});
    let notifiedCount = 0;

    for (const tab of tabs) {
      if (tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: "SETTINGS_UPDATED",
            data: updatedSettings,
          });
          notifiedCount++;
        } catch (err) {
          // Tab might not have content script loaded
          console.debug("Could not send to tab", tab.id);
        }
      }
    }

    console.log(
      `[Service Worker] Extension ${newEnabled ? "ENABLED ✅" : "DISABLED ❌"}`
    );
    console.log(
      `[Service Worker] Notified ${notifiedCount}/${tabs.length} tabs`
    );

    logger.info(
      "service-worker",
      `Extension ${newEnabled ? "enabled" : "disabled"} - notified ${notifiedCount} tabs`
    );

    return { enabled: newEnabled, settings: updatedSettings };
  } catch (error) {
    console.error("[Service Worker] Failed to toggle extension:", error);
    logger.error("service-worker", "Failed to toggle extension", error);
    return { error: "Failed to toggle extension" };
  }
}

// Handle access requests (e.g., from blocked page)
async function handleAccessRequest(data: any, sender: any): Promise<any> {
  try {
    // This would typically require PIN verification
    // For now, just log the request
    logger.info("service-worker", "Access request received", {
      url: data.url,
      reason: data.reason,
      tabId: sender.tab?.id,
    });

    // In a full implementation, this might:
    // 1. Show PIN prompt
    // 2. Temporarily whitelist the domain
    // 3. Log the override for accountability

    return { success: true, message: "Access request logged" };
  } catch (error) {
    logger.error("service-worker", "Failed to handle access request", error);
    return { error: "Failed to process access request" };
  }
}

// Clear all dynamic rules (when disabling extension)
async function clearAllDynamicRules(): Promise<void> {
  try {
    if (browser.declarativeNetRequest) {
      const existingRules =
        await browser.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map((rule) => rule.id);

      if (ruleIds.length > 0) {
        await browser.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds,
        });
      }
    }

    logger.info("service-worker", "Cleared all dynamic rules");
  } catch (error) {
    logger.warn("service-worker", "Failed to clear dynamic rules", error);
  }
}

// Tab update handler (for active content monitoring)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      // Could inject content scripts here if needed
      // Or update per-tab settings
      logger.debug("service-worker", "Tab updated", { tabId, url: tab.url });
    } catch (error) {
      logger.debug("service-worker", "Tab update handler error", error);
    }
  }
});

// Cleanup on extension shutdown/restart
browser.runtime.onSuspend?.addListener(() => {
  logger.info("service-worker", "Extension suspending");
});

logger.info("service-worker", "Service worker script loaded");
