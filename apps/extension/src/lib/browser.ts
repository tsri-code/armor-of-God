/**
 * Cross-browser polyfill for WebExtension APIs
 * Works with both Chrome and Firefox
 */
import browser from "webextension-polyfill";

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
