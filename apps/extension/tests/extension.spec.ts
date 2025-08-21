/**
 * Main extension functionality tests
 */

import { test, expect } from '@playwright/test';
import {
  getExtensionContext,
  openExtensionPopup,
  openExtensionOptions,
  openBlockedPage,
  waitForExtensionReady,
  getExtensionSettings,
  updateExtensionSettings,
  getDailyVerse,
  toggleExtension,
  setupMockWorkerAPI,
  loadTestPage,
  waitForImageProcessing,
  isImageBlurred,
} from './utils/extension-utils';

test.describe('Armor of God Extension', () => {
  test.beforeEach(async ({ context }) => {
    // Setup mock API
    await setupMockWorkerAPI(context);
  });

  test('loads successfully in Chrome', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      expect(extensionContext.extensionId).toMatch(/[a-z0-9]{32}/);

      const isReady = await waitForExtensionReady(extensionContext.backgroundPage);
      expect(isReady).toBe(true);
    }
  });

  test('background service worker initializes correctly', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Test basic extension functionality
      const settings = await getExtensionSettings(extensionContext.backgroundPage);
      expect(settings).toBeTruthy();
      expect(settings.enabled).toBeDefined();
      expect(settings.modules).toBeDefined();
      expect(settings.modules.imageScanning).toBeDefined();
      expect(settings.modules.safeSearch).toBeDefined();
      expect(settings.modules.urlBlocking).toBeDefined();
    }
  });

  test('daily verse loads correctly', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      const verse = await getDailyVerse(extensionContext.backgroundPage);
      expect(verse).toBeTruthy();
      expect(verse.reference).toBeTruthy();
      expect(verse.text).toBeTruthy();
      expect(verse.text.length).toBeGreaterThan(10);
    }
  });

  test('popup opens and displays content', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      const popupPage = await openExtensionPopup(context, extensionContext.extensionId);

      // Wait for popup to load
      await popupPage.waitForSelector('h1', { timeout: 5000 });

      // Check main elements
      const title = await popupPage.textContent('h1');
      expect(title).toContain('Armor of God');

      // Check for verse section
      const verseSection = await popupPage.locator('[data-testid="daily-verse"], .daily-verse, blockquote').first();
      if (await verseSection.count() > 0) {
        expect(await verseSection.isVisible()).toBe(true);
      }

      // Check toggle button exists
      const toggleButton = await popupPage.locator('button, [role="switch"]').first();
      expect(await toggleButton.count()).toBeGreaterThan(0);

      await popupPage.close();
    }
  });

  test('options page loads and functions', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);

      // Wait for options page to load
      await optionsPage.waitForSelector('h1, h2', { timeout: 10000 });

      // Check page title or header
      const pageContent = await optionsPage.textContent('body');
      expect(pageContent).toMatch(/settings|options|armor of god/i);

      // Look for common settings elements
      const settingsElements = await optionsPage.locator('input, button, select').count();
      expect(settingsElements).toBeGreaterThan(0);

      await optionsPage.close();
    }
  });

  test('blocked page displays correctly', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      const blockedPage = await openBlockedPage(
        context,
        extensionContext.extensionId,
        'https://example.adult'
      );

      // Wait for blocked page to load
      await blockedPage.waitForSelector('body', { timeout: 5000 });

      // Check for blocked page content
      const pageContent = await blockedPage.textContent('body');
      expect(pageContent).toMatch(/blocked|filtered|armor of god/i);

      // Check for verse display (should be present)
      const hasVerse = await blockedPage.locator('blockquote, .verse, [data-verse]').count();
      expect(hasVerse).toBeGreaterThan(0);

      // Check for action buttons
      const buttons = await blockedPage.locator('button').count();
      expect(buttons).toBeGreaterThan(0);

      await blockedPage.close();
    }
  });

  test('extension can be toggled on/off', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Get initial state
      const initialSettings = await getExtensionSettings(extensionContext.backgroundPage);
      const initialState = initialSettings.enabled;

      // Toggle extension
      const toggleResult = await toggleExtension(extensionContext.backgroundPage);
      expect(toggleResult.enabled).toBe(!initialState);

      // Verify state changed
      const newSettings = await getExtensionSettings(extensionContext.backgroundPage);
      expect(newSettings.enabled).toBe(!initialState);

      // Toggle back
      await toggleExtension(extensionContext.backgroundPage);
      const finalSettings = await getExtensionSettings(extensionContext.backgroundPage);
      expect(finalSettings.enabled).toBe(initialState);
    }
  });

  test('settings can be updated', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Get current settings
      const currentSettings = await getExtensionSettings(extensionContext.backgroundPage);

      // Update a setting
      const newSettings = {
        ...currentSettings,
        modules: {
          ...currentSettings.modules,
          imageScanning: !currentSettings.modules.imageScanning,
        },
      };

      await updateExtensionSettings(extensionContext.backgroundPage, newSettings);

      // Verify setting was updated
      const updatedSettings = await getExtensionSettings(extensionContext.backgroundPage);
      expect(updatedSettings.modules.imageScanning).toBe(newSettings.modules.imageScanning);
    }
  });

  // This test would require actual ML models and is more complex
  test.skip('content filtering works on test page', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Load test page
      const testPage = await loadTestPage(context);

      // Wait for extension to process images
      const imageProcessed = await waitForImageProcessing(testPage, '.test-image');
      expect(imageProcessed).toBe(true);

      // Check if inappropriate content would be blurred
      // (This would depend on the actual ML model results)
      const isBlurred = await isImageBlurred(testPage, '.test-image');

      // For safe test images, they should not be blurred
      expect(isBlurred).toBe(false);

      await testPage.close();
    }
  });

  test('manifest is valid', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Get manifest from extension
      const manifest = await extensionContext.backgroundPage.evaluate(() => {
        return chrome.runtime.getManifest();
      });

      expect(manifest).toBeTruthy();
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toContain('Armor of God');
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(manifest.permissions).toContain('storage');
      expect(manifest.host_permissions).toContain('<all_urls>');
    }
  });

  test('extension handles errors gracefully', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      // Test with invalid message
      const result = await extensionContext.backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'INVALID_MESSAGE_TYPE' }, (response) => {
            resolve(response);
          });
        });
      });

      // Should handle gracefully, not crash
      expect(result).toBeDefined();

      // The background page should still be responsive
      const settings = await getExtensionSettings(extensionContext.backgroundPage);
      expect(settings).toBeTruthy();
    }
  });
});
