/**
 * Cross-browser polyfill for WebExtension APIs
 * Works with both Chrome and Firefox
 */

// More defensive browser loading to prevent "Cannot access 'Bp' before initialization" errors
let browser: any;

try {
  // Try to import the polyfill
  browser = require("webextension-polyfill");
  if (browser.default) {
    browser = browser.default;
  }
} catch (error) {
  // Fallback to globals if polyfill fails
  browser = (globalThis as any).browser || (globalThis as any).chrome;
}

// If still no browser, create minimal fallback
if (!browser) {
  browser = {
    runtime: {
      sendMessage: () => Promise.reject(new Error("Browser API not available")),
      openOptionsPage: () => {},
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
      onChanged: {
        addListener: () => {},
      },
    },
  };
}

// Re-export the browser object with proper typing
export { browser };
export default browser;

// Type guards for browser-specific features
export const isChrome = () => {
  return (
    typeof (globalThis as any).chrome !== "undefined" &&
    typeof (globalThis as any).chrome.runtime !== "undefined"
  );
};

export const isFirefox = () => {
  return (
    typeof (globalThis as any).browser !== "undefined" &&
    typeof (globalThis as any).browser.runtime !== "undefined"
  );
};

export const supportsDeclarativeNetRequest = () => {
  try {
    return (
      isChrome() &&
      typeof (globalThis as any).chrome?.declarativeNetRequest !==
        "undefined" &&
      typeof (globalThis as any).chrome?.declarativeNetRequest
        ?.updateDynamicRules === "function"
    );
  } catch (error) {
    return false;
  }
};

export const supportsWebRequest = () => {
  return typeof browser.webRequest !== "undefined";
};

// Extension-specific utilities
export const getExtensionURL = (path: string): string => {
  return browser.runtime.getURL(path);
};

export const openOptionsPage = async (): Promise<void> => {
  await browser.runtime.openOptionsPage();
};

export const getCurrentTab = async (): Promise<browser.Tabs.Tab | null> => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
};

export const reloadExtension = (): void => {
  browser.runtime.reload();
};
