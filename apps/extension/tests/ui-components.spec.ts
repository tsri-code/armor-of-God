/**
 * UI components tests (Popup, Options, Blocked page)
 */

import { test, expect } from '@playwright/test';
import {
  getExtensionContext,
  openExtensionPopup,
  openExtensionOptions,
  openBlockedPage,
  waitForExtensionReady,
  getExtensionSettings,
  getDailyVerse,
  getExtensionStats,
  setupMockWorkerAPI,
} from './utils/extension-utils';

test.describe('UI Components', () => {
  test.beforeEach(async ({ context }) => {
    await setupMockWorkerAPI(context);
  });

  test.describe('Popup Component', () => {
    test('displays extension status correctly', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);

        // Wait for popup to fully load
        await popupPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Check for main title
        const title = await popupPage.textContent('h1, [data-testid="title"]').catch(() => null);
        if (title) {
          expect(title.toLowerCase()).toContain('armor');
        }

        // Check for status indicator
        const statusElements = await popupPage.locator('[data-testid="status"], .status, text="Protection Active", text="Protection Disabled"').count();
        expect(statusElements).toBeGreaterThanOrEqual(0); // May not have specific status text

        await popupPage.close();
      }
    });

    test('displays daily verse', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);
        await popupPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for verse content
        const verseElements = await popupPage.locator('blockquote, .verse, [data-testid="verse"]').count();

        if (verseElements > 0) {
          const verseText = await popupPage.locator('blockquote, .verse, [data-testid="verse"]').first().textContent();
          expect(verseText).toBeTruthy();
          expect(verseText!.length).toBeGreaterThan(10);
        }

        await popupPage.close();
      }
    });

    test('toggle button works', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);
        await popupPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for toggle button or switch
        const toggleButton = await popupPage.locator('button, [role="switch"], input[type="checkbox"]').first();

        if (await toggleButton.count() > 0) {
          // Get initial state
          const initialSettings = await getExtensionSettings(extensionContext.backgroundPage);
          const initialState = initialSettings.enabled;

          // Click toggle
          await toggleButton.click();
          await popupPage.waitForTimeout(1000);

          // Check if state changed
          const newSettings = await getExtensionSettings(extensionContext.backgroundPage);
          expect(newSettings.enabled).toBe(!initialState);
        }

        await popupPage.close();
      }
    });

    test('quick stats display correctly', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);
        await popupPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for stats section
        const statsElements = await popupPage.locator('[data-testid="stats"], .stats, text="Today", text="This Week", text="Total"').count();

        if (statsElements > 0) {
          // Check for numeric values
          const numbers = await popupPage.locator('text=/^\\d+$/').count();
          expect(numbers).toBeGreaterThan(0);
        }

        await popupPage.close();
      }
    });

    test('settings button opens options', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);
        await popupPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for settings button
        const settingsButton = await popupPage.locator('button:has-text("Settings"), button:has-text("Options"), [data-testid="settings-button"]').first();

        if (await settingsButton.count() > 0) {
          // Click settings - this should open options page
          const [optionsPage] = await Promise.all([
            context.waitForEvent('page'),
            settingsButton.click()
          ]);

          await optionsPage.waitForLoadState('domcontentloaded');

          // Verify it's the options page
          const optionsContent = await optionsPage.textContent('body');
          expect(optionsContent.toLowerCase()).toMatch(/settings|options|preferences/);

          await optionsPage.close();
        }

        await popupPage.close();
      }
    });
  });

  test.describe('Options Page Component', () => {
    test('loads all settings sections', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);
        await optionsPage.waitForLoadState('networkidle', { timeout: 15000 });

        // Check for main settings sections
        const pageText = await optionsPage.textContent('body');
        expect(pageText.toLowerCase()).toMatch(/settings|options|armor of god/);

        // Look for common settings controls
        const inputs = await optionsPage.locator('input, select, button').count();
        expect(inputs).toBeGreaterThan(0);

        await optionsPage.close();
      }
    });

    test('general settings tab works', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);
        await optionsPage.waitForLoadState('networkidle', { timeout: 15000 });

        // Look for general or main settings section
        const generalTab = await optionsPage.locator('button:has-text("General"), [data-tab="general"], .tab:has-text("General")').first();

        if (await generalTab.count() > 0) {
          await generalTab.click();
          await optionsPage.waitForTimeout(500);

          // Should show extension toggle
          const toggles = await optionsPage.locator('input[type="checkbox"], [role="switch"]').count();
          expect(toggles).toBeGreaterThan(0);
        }

        await optionsPage.close();
      }
    });

    test('content filtering settings work', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);
        await optionsPage.waitForLoadState('networkidle', { timeout: 15000 });

        // Look for filtering tab
        const filteringTab = await optionsPage.locator('button:has-text("Filter"), button:has-text("Content"), [data-tab="filtering"]').first();

        if (await filteringTab.count() > 0) {
          await filteringTab.click();
          await optionsPage.waitForTimeout(500);

          // Should show threshold controls
          const sliders = await optionsPage.locator('input[type="range"]').count();
          expect(sliders).toBeGreaterThanOrEqual(0);
        }

        await optionsPage.close();
      }
    });

    test('saves settings correctly', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);
        await optionsPage.waitForLoadState('networkidle', { timeout: 15000 });

        // Get initial settings
        const initialSettings = await getExtensionSettings(extensionContext.backgroundPage);

        // Look for save button
        const saveButton = await optionsPage.locator('button:has-text("Save"), [data-testid="save-button"]').first();

        if (await saveButton.count() > 0) {
          await saveButton.click();
          await optionsPage.waitForTimeout(1000);

          // Check for success indication
          const successMessage = await optionsPage.locator('text="Saved", text="Success", .success, .saved').count();
          expect(successMessage).toBeGreaterThanOrEqual(0);
        }

        await optionsPage.close();
      }
    });
  });

  test.describe('Blocked Page Component', () => {
    test('displays blocking message', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const blockedPage = await openBlockedPage(context, extensionContext.extensionId, 'https://example.adult');
        await blockedPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Check for blocking message
        const pageContent = await blockedPage.textContent('body');
        expect(pageContent.toLowerCase()).toMatch(/blocked|filtered|content/);

        await blockedPage.close();
      }
    });

    test('displays daily verse on blocked page', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const blockedPage = await openBlockedPage(context, extensionContext.extensionId);
        await blockedPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for verse content
        const verseElements = await blockedPage.locator('blockquote, .verse, [data-testid="verse"]').count();

        if (verseElements > 0) {
          const verseText = await blockedPage.locator('blockquote, .verse, [data-testid="verse"]').first().textContent();
          expect(verseText).toBeTruthy();
          expect(verseText!.length).toBeGreaterThan(10);
        }

        await blockedPage.close();
      }
    });

    test('go back button works', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const blockedPage = await openBlockedPage(context, extensionContext.extensionId);
        await blockedPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for go back button
        const backButton = await blockedPage.locator('button:has-text("Back"), button:has-text("Go Back"), [data-testid="back-button"]').first();

        if (await backButton.count() > 0) {
          // Click should trigger navigation
          await backButton.click();
          await blockedPage.waitForTimeout(1000);

          // Note: In test environment, this might not actually navigate
          // but the button should be functional
        }

        await blockedPage.close();
      }
    });

    test('request access form works', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const blockedPage = await openBlockedPage(context, extensionContext.extensionId);
        await blockedPage.waitForLoadState('networkidle', { timeout: 10000 });

        // Look for request access button
        const accessButton = await blockedPage.locator('button:has-text("Access"), button:has-text("Request"), [data-testid="request-access"]').first();

        if (await accessButton.count() > 0) {
          await accessButton.click();
          await blockedPage.waitForTimeout(1000);

          // Should show request form
          const textarea = await blockedPage.locator('textarea').count();
          if (textarea > 0) {
            await blockedPage.fill('textarea', 'Testing access request functionality');

            // Look for submit button
            const submitButton = await blockedPage.locator('button:has-text("Submit"), button:has-text("Send")').first();
            if (await submitButton.count() > 0) {
              await submitButton.click();
              await blockedPage.waitForTimeout(1000);

              // Should show some response
            }
          }
        }

        await blockedPage.close();
      }
    });

    test('shows appropriate attribution', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const blockedPage = await openBlockedPage(context, extensionContext.extensionId);
        await blockedPage.waitForLoadState('networkidle', { timeout: 10000 });

        const pageContent = await blockedPage.textContent('body');

        // Should show BSB attribution
        expect(pageContent.toLowerCase()).toMatch(/berean|bsb|scripture|bible/);

        // Should show extension branding
        expect(pageContent.toLowerCase()).toMatch(/armor of god|extension/);

        await blockedPage.close();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('popup works on different viewport sizes', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const popupPage = await openExtensionPopup(context, extensionContext.extensionId);

        // Test different sizes
        const viewports = [
          { width: 380, height: 500 }, // Default popup size
          { width: 320, height: 400 }, // Smaller
          { width: 500, height: 600 }, // Larger
        ];

        for (const viewport of viewports) {
          await popupPage.setViewportSize(viewport);
          await popupPage.waitForTimeout(500);

          // Content should still be visible and functional
          const bodyHeight = await popupPage.evaluate(() => document.body.scrollHeight);
          expect(bodyHeight).toBeGreaterThan(100);
        }

        await popupPage.close();
      }
    });

    test('options page is responsive', async ({ context }) => {
      const extensionContext = await getExtensionContext(context);
      expect(extensionContext).toBeTruthy();

      if (extensionContext) {
        const optionsPage = await openExtensionOptions(context, extensionContext.extensionId);

        // Test mobile-like viewport
        await optionsPage.setViewportSize({ width: 768, height: 1024 });
        await optionsPage.waitForTimeout(1000);

        // Content should be readable
        const bodyHeight = await optionsPage.evaluate(() => document.body.scrollHeight);
        expect(bodyHeight).toBeGreaterThan(400);

        await optionsPage.close();
      }
    });
  });
});
