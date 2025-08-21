/**
 * Utility functions for extension testing
 */

import { Page, BrowserContext } from '@playwright/test';
import path from 'path';

export interface ExtensionContext {
  extensionId: string;
  backgroundPage: Page;
  popupPage: Page | null;
  optionsPage: Page | null;
}

/**
 * Get extension context from browser
 */
export async function getExtensionContext(context: BrowserContext): Promise<ExtensionContext | null> {
  try {
    // Wait for extension to load
    await context.waitForEvent('page', { timeout: 10000 });

    // Get extension ID from background page
    const backgroundPages = context.backgroundPages();
    if (backgroundPages.length === 0) {
      console.warn('No background pages found');
      return null;
    }

    const backgroundPage = backgroundPages[0];
    await backgroundPage.waitForLoadState('domcontentloaded');

    // Extract extension ID from URL
    const backgroundUrl = backgroundPage.url();
    const match = backgroundUrl.match(/chrome-extension:\/\/([a-z0-9]+)/);
    if (!match) {
      console.warn('Could not extract extension ID from:', backgroundUrl);
      return null;
    }

    const extensionId = match[1];
    console.log('📱 Extension loaded with ID:', extensionId);

    return {
      extensionId,
      backgroundPage,
      popupPage: null,
      optionsPage: null,
    };
  } catch (error) {
    console.error('Failed to get extension context:', error);
    return null;
  }
}

/**
 * Open extension popup
 */
export async function openExtensionPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popupUrl = `chrome-extension://${extensionId}/src/ui/popup/index.html`;
  const page = await context.newPage();
  await page.goto(popupUrl);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Open extension options page
 */
export async function openExtensionOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const optionsUrl = `chrome-extension://${extensionId}/src/ui/options/index.html`;
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Open blocked page
 */
export async function openBlockedPage(context: BrowserContext, extensionId: string, blockedUrl?: string): Promise<Page> {
  const blockedPageUrl = `chrome-extension://${extensionId}/src/ui/blocked/blocked.html`;
  const fullUrl = blockedUrl ? `${blockedPageUrl}?url=${encodeURIComponent(blockedUrl)}` : blockedPageUrl;

  const page = await context.newPage();
  await page.goto(fullUrl);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Wait for extension to be ready
 */
export async function waitForExtensionReady(backgroundPage: Page, timeout = 30000): Promise<boolean> {
  try {
    // Check if extension's service worker is ready
    await backgroundPage.evaluate(() => {
      return new Promise((resolve) => {
        // Check if our extension globals are available
        const checkReady = () => {
          if (globalThis.chrome?.runtime?.getManifest) {
            resolve(true);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }, { timeout });

    console.log('✅ Extension background is ready');
    return true;
  } catch (error) {
    console.warn('Extension background not ready:', error);
    return false;
  }
}

/**
 * Get extension settings
 */
export async function getExtensionSettings(backgroundPage: Page): Promise<any> {
  return await backgroundPage.evaluate(() => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
    });
  });
}

/**
 * Update extension settings
 */
export async function updateExtensionSettings(backgroundPage: Page, settings: any): Promise<void> {
  await backgroundPage.evaluate((newSettings) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: newSettings
      }, resolve);
    });
  }, settings);
}

/**
 * Get extension stats
 */
export async function getExtensionStats(backgroundPage: Page): Promise<any> {
  return await backgroundPage.evaluate(() => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, resolve);
    });
  });
}

/**
 * Get daily verse
 */
export async function getDailyVerse(backgroundPage: Page, date?: string): Promise<any> {
  return await backgroundPage.evaluate((targetDate) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_VERSE',
        data: targetDate ? { date: targetDate } : undefined
      }, resolve);
    });
  }, date);
}

/**
 * Toggle extension on/off
 */
export async function toggleExtension(backgroundPage: Page): Promise<any> {
  return await backgroundPage.evaluate(() => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION' }, resolve);
    });
  });
}

/**
 * Load test page with extension
 */
export async function loadTestPage(context: BrowserContext): Promise<Page> {
  const testPagePath = path.resolve(__dirname, '../fixtures/test-page.html');
  const page = await context.newPage();
  await page.goto(`file://${testPagePath}`);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Simulate image load and wait for ML processing
 */
export async function waitForImageProcessing(page: Page, selector: string, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });

    // Wait for image to load
    await page.waitForFunction((sel) => {
      const img = document.querySelector(sel) as HTMLImageElement;
      return img && img.complete && img.naturalHeight !== 0;
    }, selector, { timeout });

    // Wait a bit for ML processing
    await page.waitForTimeout(2000);

    return true;
  } catch (error) {
    console.warn('Image processing timeout:', error);
    return false;
  }
}

/**
 * Check if image is blurred
 */
export async function isImageBlurred(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const img = document.querySelector(sel) as HTMLImageElement;
    if (!img) return false;

    return img.classList.contains('armor-of-god-blurred') ||
           img.style.filter.includes('blur') ||
           img.getAttribute('data-armor-blurred') === 'true';
  }, selector);
}

/**
 * Check if URL would be blocked
 */
export async function testUrlBlocking(backgroundPage: Page, url: string): Promise<{ blocked: boolean; reason?: string }> {
  return await backgroundPage.evaluate((testUrl) => {
    // This would call a function exposed by the extension
    // For now, return mock result
    const blockedDomains = ['pornhub.com', 'xvideos.com', 'example.adult'];
    const hostname = new URL(testUrl).hostname.toLowerCase();

    const isBlocked = blockedDomains.some(domain => hostname.includes(domain));

    return {
      blocked: isBlocked,
      reason: isBlocked ? 'Blocked domain' : undefined,
    };
  }, url);
}

/**
 * Wait for safe search redirect
 */
export async function waitForSafeSearchRedirect(page: Page, searchEngine: string, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForFunction((engine) => {
      const url = new URL(window.location.href);

      switch (engine) {
        case 'google':
          return url.searchParams.get('safe') === 'active';
        case 'bing':
          return url.searchParams.get('adlt') === 'strict';
        case 'duckduckgo':
          return url.searchParams.get('safe-search') === 'strict';
        default:
          return false;
      }
    }, searchEngine, { timeout });

    return true;
  } catch (error) {
    console.warn('Safe search redirect timeout:', error);
    return false;
  }
}

/**
 * Mock worker API for testing
 */
export async function setupMockWorkerAPI(context: BrowserContext): Promise<void> {
  await context.route('**/votd*', async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('d') || new Date().toISOString().slice(0, 10);

    const mockVerse = {
      reference: 'John 3:16',
      text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
      copyright: 'Scripture text © Berean Standard Bible. Used by permission.',
      date,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockVerse),
    });
  });

  await context.route('**/passage*', async (route) => {
    const url = new URL(route.request().url());
    const reference = url.searchParams.get('ref') || 'John 3:16';

    const mockPassage = {
      reference,
      text: 'This is a test passage from the Berean Standard Bible.',
      copyright: 'Scripture text © Berean Standard Bible. Used by permission.',
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPassage),
    });
  });

  console.log('🎭 Mock worker API configured');
}
