/**
 * Rules updater for managing Declarative Net Request rules
 * Handles both static rules from JSON and dynamic user rules
 */

import browser, { supportsDeclarativeNetRequest } from "../lib/browser";
import { storage } from "../lib/storage";
import { logger } from "../lib/log";
import { CONSTANTS } from "@shared/index";
import initialRules from "../data/initial-rules.json";

interface DNRRule {
  id: number;
  priority: number;
  action: {
    type: "block" | "redirect" | "allow" | "upgradeScheme" | "modifyHeaders";
    redirect?: {
      url?: string;
      extensionPath?: string;
      regexSubstitution?: string;
    };
  };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    domainType?: "firstParty" | "thirdParty";
    resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
    excludedResourceTypes?: chrome.declarativeNetRequest.ResourceType[];
    domains?: string[];
    excludedDomains?: string[];
  };
}

// Load and register initial rules from JSON
export async function loadInitialRules(): Promise<void> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      logger.info(
        "rules-updater",
        "DNR not supported, will use webRequest fallback"
      );
      return;
    }

    logger.info("rules-updater", "Loading initial blocking rules", {
      count: initialRules.length,
    });

    // Initial rules are loaded via manifest.json rule_resources
    // Check if API is available before using it
    try {
      if (
        browser.declarativeNetRequest &&
        typeof browser.declarativeNetRequest.getStaticRules === "function"
      ) {
        const staticRules =
          await browser.declarativeNetRequest.getStaticRules();
        logger.info("rules-updater", "Static rules loaded", {
          count: staticRules.length,
        });
      } else {
        logger.info(
          "rules-updater",
          "getStaticRules API not available, using manifest rules"
        );
      }
    } catch (apiError) {
      logger.info(
        "rules-updater",
        "Static rules API unavailable, using fallback"
      );
    }
  } catch (error) {
    logger.error("rules-updater", "Failed to load initial rules", error);
  }
}

// Apply user-defined rules from settings
export async function applyUserRules(): Promise<void> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      logger.info("rules-updater", "Using webRequest fallback for user rules");
      await setupWebRequestRules();
      return;
    }

    const settings = await storage.getSettings();

    if (!settings.enabled) {
      logger.info("rules-updater", "Extension disabled, clearing user rules");
      await clearUserRules();
      return;
    }

    logger.info("rules-updater", "Applying user rules");

    const userRules = await generateUserRules(settings);
    await updateDynamicRules(userRules);

    logger.info("rules-updater", "User rules applied", {
      count: userRules.length,
    });
  } catch (error) {
    logger.error("rules-updater", "Failed to apply user rules", error);
  }
}

// Generate rules from user settings
async function generateUserRules(settings: any): Promise<DNRRule[]> {
  const rules: DNRRule[] = [];
  let ruleId = CONSTANTS.RULES.USER_RULE_ID_START;

  // Whitelist rules (highest priority)
  if (settings.whitelist && settings.whitelist.length > 0) {
    for (const domain of settings.whitelist) {
      if (domain && domain.trim()) {
        rules.push({
          id: ruleId++,
          priority: 100,
          action: { type: "allow" },
          condition: {
            domainType: "firstParty",
            domains: [domain.trim()],
            resourceTypes: ["main_frame", "sub_frame"],
          },
        });
      }
    }
  }

  // Blacklist rules (medium priority)
  if (settings.blacklist && settings.blacklist.length > 0) {
    for (const domain of settings.blacklist) {
      if (domain && domain.trim()) {
        rules.push({
          id: ruleId++,
          priority: 50,
          action: {
            type: "redirect",
            redirect: {
              extensionPath: "/src/ui/blocked/blocked.html",
            },
          },
          condition: {
            domains: [domain.trim()],
            resourceTypes: ["main_frame"],
          },
        });
      }
    }
  }

  // Category-based rules could be added here
  // e.g., gambling, social media, etc.

  return rules;
}

// Update dynamic rules in DNR
async function updateDynamicRules(newRules: DNRRule[]): Promise<void> {
  try {
    // Get existing user rules
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const userRuleIds = existingRules
      .filter((rule) => rule.id >= CONSTANTS.RULES.USER_RULE_ID_START)
      .map((rule) => rule.id);

    // Update rules
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: userRuleIds,
      addRules: newRules as chrome.declarativeNetRequest.Rule[],
    });

    logger.debug("rules-updater", "Dynamic rules updated", {
      removed: userRuleIds.length,
      added: newRules.length,
    });
  } catch (error) {
    logger.error("rules-updater", "Failed to update dynamic rules", error);
    throw error;
  }
}

// Clear all user-defined rules
export async function clearUserRules(): Promise<void> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      return;
    }

    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const userRuleIds = existingRules
      .filter((rule) => rule.id >= CONSTANTS.RULES.USER_RULE_ID_START)
      .map((rule) => rule.id);

    if (userRuleIds.length > 0) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: userRuleIds,
      });

      logger.info("rules-updater", "Cleared user rules", {
        count: userRuleIds.length,
      });
    }
  } catch (error) {
    logger.error("rules-updater", "Failed to clear user rules", error);
  }
}

// WebRequest fallback for Firefox
async function setupWebRequestRules(): Promise<void> {
  if (typeof browser.webRequest === "undefined") {
    logger.warn("rules-updater", "webRequest API not available");
    return;
  }

  try {
    const settings = await storage.getSettings();

    if (!settings.enabled) {
      return;
    }

    // Setup blocking listeners for Firefox
    // This is a simplified version - full implementation would need
    // proper request filtering and redirect handling

    logger.info("rules-updater", "WebRequest rules configured for Firefox");
  } catch (error) {
    logger.error("rules-updater", "Failed to setup webRequest rules", error);
  }
}

// Utility to test if a URL matches user rules
export async function testUrlAgainstRules(
  url: string
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const settings = await storage.getSettings();

    if (!settings.enabled) {
      return { blocked: false };
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check whitelist first (allow)
    if (
      settings.whitelist?.some(
        (domain: string) =>
          hostname === domain.toLowerCase() ||
          hostname.endsWith("." + domain.toLowerCase())
      )
    ) {
      return { blocked: false, reason: "whitelisted" };
    }

    // Check blacklist
    if (
      settings.blacklist?.some(
        (domain: string) =>
          hostname === domain.toLowerCase() ||
          hostname.endsWith("." + domain.toLowerCase())
      )
    ) {
      return { blocked: true, reason: "blacklisted" };
    }

    // Check against initial rules patterns
    for (const rule of initialRules) {
      if (rule.condition.urlFilter) {
        const pattern = rule.condition.urlFilter.replace(
          /\|\|([^\/\^]+)\^/,
          "$1"
        );
        if (hostname.includes(pattern.toLowerCase())) {
          return { blocked: true, reason: "content-filter" };
        }
      }
    }

    return { blocked: false };
  } catch (error) {
    logger.error("rules-updater", "Failed to test URL against rules", error);
    return { blocked: false };
  }
}

// Get rule statistics
export async function getRuleStats(): Promise<{
  static: number;
  dynamic: number;
  user: number;
}> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      return { static: 0, dynamic: 0, user: 0 };
    }

    let staticRules: any[] = [];
    let dynamicRules: any[] = [];

    try {
      // Check API availability before using
      if (
        browser.declarativeNetRequest &&
        typeof browser.declarativeNetRequest.getStaticRules === "function"
      ) {
        staticRules = await browser.declarativeNetRequest.getStaticRules();
      }
      if (
        browser.declarativeNetRequest &&
        typeof browser.declarativeNetRequest.getDynamicRules === "function"
      ) {
        dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
      }
    } catch (apiError) {
      logger.error("rules-updater", "API error getting rules", apiError);
    }

    const userRules = dynamicRules.filter(
      (rule) => rule.id >= CONSTANTS.RULES.USER_RULE_ID_START
    );

    return {
      static: staticRules.length,
      dynamic: dynamicRules.length,
      user: userRules.length,
    };
  } catch (error) {
    logger.error("rules-updater", "Failed to get rule stats", error);
    return { static: 0, dynamic: 0, user: 0 };
  }
}

// Export rules for backup/sharing
export async function exportRules(): Promise<any> {
  try {
    const settings = await storage.getSettings();

    return {
      version: "1.0",
      exported: new Date().toISOString(),
      whitelist: settings.whitelist || [],
      blacklist: settings.blacklist || [],
      settings: {
        enabled: settings.enabled,
        modules: settings.modules,
        thresholds: settings.thresholds,
      },
    };
  } catch (error) {
    logger.error("rules-updater", "Failed to export rules", error);
    throw error;
  }
}

// Import rules from backup
export async function importRules(data: any): Promise<void> {
  try {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid import data");
    }

    const settings = await storage.getSettings();

    const updatedSettings = {
      ...settings,
      whitelist: Array.isArray(data.whitelist)
        ? data.whitelist
        : settings.whitelist,
      blacklist: Array.isArray(data.blacklist)
        ? data.blacklist
        : settings.blacklist,
    };

    if (data.settings && typeof data.settings === "object") {
      Object.assign(updatedSettings, {
        enabled: data.settings.enabled ?? settings.enabled,
        modules: { ...settings.modules, ...data.settings.modules },
        thresholds: { ...settings.thresholds, ...data.settings.thresholds },
      });
    }

    await storage.setSettings(updatedSettings);
    await applyUserRules();

    logger.info("rules-updater", "Rules imported successfully");
  } catch (error) {
    logger.error("rules-updater", "Failed to import rules", error);
    throw error;
  }
}
