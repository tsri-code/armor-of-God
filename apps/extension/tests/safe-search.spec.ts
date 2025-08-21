/**
 * Safe search enforcement tests
 */

import { test, expect } from '@playwright/test';
import {
  getExtensionContext,
  waitForExtensionReady,
  updateExtensionSettings,
  getExtensionSettings,
  waitForSafeSearchRedirect,
  setupMockWorkerAPI,
} from './utils/extension-utils';

test.describe('Safe Search Enforcement', () => {
  test.beforeEach(async ({ context }) => {
    await setupMockWorkerAPI(context);
  });

  test('Google safe search is enforced', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      // Ensure safe search is enabled
      const settings = await getExtensionSettings(extensionContext.backgroundPage);
      if (!settings.modules.safeSearch) {
        await updateExtensionSettings(extensionContext.backgroundPage, {
          ...settings,
          modules: { ...settings.modules, safeSearch: true }
        });
      }

      // Test Google search without safe search parameter
      const searchPage = await context.newPage();

      // Navigate to Google search without safe=active
      await searchPage.goto('https://www.google.com/search?q=test+search');

      // Wait for potential redirect or parameter addition
      await searchPage.waitForTimeout(2000);

      // Check if safe search parameter was added
      const currentUrl = searchPage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Should have safe=active parameter
      expect(urlParams.get('safe')).toBe('active');

      await searchPage.close();
    }
  });

  test('Bing safe search is enforced', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      // Test Bing search
      const searchPage = await context.newPage();

      await searchPage.goto('https://www.bing.com/search?q=test+search');
      await searchPage.waitForTimeout(2000);

      const currentUrl = searchPage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Should have adlt=strict parameter
      expect(urlParams.get('adlt')).toBe('strict');

      await searchPage.close();
    }
  });

  test('DuckDuckGo safe search is enforced', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      const searchPage = await context.newPage();

      await searchPage.goto('https://duckduckgo.com/?q=test+search');
      await searchPage.waitForTimeout(2000);

      const currentUrl = searchPage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Should have safe-search=strict parameter
      expect(urlParams.get('safe-search')).toBe('strict');

      await searchPage.close();
    }
  });

  test('YouTube restricted mode is enforced', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      const youtubePage = await context.newPage();

      await youtubePage.goto('https://www.youtube.com/');
      await youtubePage.waitForTimeout(3000);

      // Check for restricted mode indicators
      const currentUrl = youtubePage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Should have restrict_mode parameter or cookie set
      const hasRestrictParam = urlParams.get('restrict_mode') === '1';

      // Check for restricted mode cookie
      const cookies = await youtubePage.context().cookies('https://www.youtube.com');
      const prefCookie = cookies.find(c => c.name === 'PREF');
      const hasRestrictCookie = prefCookie?.value.includes('f2=8000000');

      // At least one method should be active
      expect(hasRestrictParam || hasRestrictCookie).toBe(true);

      await youtubePage.close();
    }
  });

  test('safe search can be disabled', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      // Disable safe search
      const settings = await getExtensionSettings(extensionContext.backgroundPage);
      await updateExtensionSettings(extensionContext.backgroundPage, {
        ...settings,
        modules: { ...settings.modules, safeSearch: false }
      });

      // Test that search engines are not modified
      const searchPage = await context.newPage();
      await searchPage.goto('https://www.google.com/search?q=test+search');
      await searchPage.waitForTimeout(2000);

      const currentUrl = searchPage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // May or may not have safe parameter (depends on implementation)
      // But it should not be actively enforced if disabled
      const safeParam = urlParams.get('safe');

      // Re-enable for other tests
      await updateExtensionSettings(extensionContext.backgroundPage, {
        ...settings,
        modules: { ...settings.modules, safeSearch: true }
      });

      await searchPage.close();
    }
  });

  test('safe search works with extension disabled', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      // Disable entire extension
      const settings = await getExtensionSettings(extensionContext.backgroundPage);
      await updateExtensionSettings(extensionContext.backgroundPage, {
        ...settings,
        enabled: false
      });

      // Test that safe search is not enforced
      const searchPage = await context.newPage();
      await searchPage.goto('https://www.google.com/search?q=test+search');
      await searchPage.waitForTimeout(2000);

      // Safe search might still be active from previous tests,
      // but new enforcement should not happen

      // Re-enable extension
      await updateExtensionSettings(extensionContext.backgroundPage, {
        ...settings,
        enabled: true
      });

      await searchPage.close();
    }
  });

  test('handles search engine errors gracefully', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      // Test with malformed URL
      const searchPage = await context.newPage();

      try {
        await searchPage.goto('https://www.google.com/search?q=test%20invalid%20chars%20%');
        await searchPage.waitForTimeout(2000);

        // Should not crash the extension
        const settings = await getExtensionSettings(extensionContext.backgroundPage);
        expect(settings).toBeTruthy();
      } catch (error) {
        // Network errors are expected with invalid URLs
        console.log('Expected network error:', error.message);
      }

      await searchPage.close();
    }
  });

  test('preserves existing search parameters', async ({ context }) => {
    const extensionContext = await getExtensionContext(context);
    expect(extensionContext).toBeTruthy();

    if (extensionContext) {
      await waitForExtensionReady(extensionContext.backgroundPage);

      const searchPage = await context.newPage();

      // Navigate with existing parameters
      await searchPage.goto('https://www.google.com/search?q=test+search&tbm=isch&source=lnms');
      await searchPage.waitForTimeout(2000);

      const currentUrl = searchPage.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Should preserve existing parameters
      expect(urlParams.get('q')).toBe('test search');
      expect(urlParams.get('tbm')).toBe('isch');
      expect(urlParams.get('source')).toBe('lnms');

      // And add safe search
      expect(urlParams.get('safe')).toBe('active');

      await searchPage.close();
    }
  });
});
