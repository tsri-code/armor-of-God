import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Armor of God extension testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Extension-specific configuration
        headless: false, // Extensions need headed mode
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'dist')}`,
            `--load-extension=${path.resolve(__dirname, 'dist')}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },

    {
      name: 'firefox-extension',
      use: {
        ...devices['Desktop Firefox'],
        headless: false,
        viewport: { width: 1280, height: 720 },
        // Firefox extension loading is handled in tests
      },
    },
  ],

  // Global test setup
  globalSetup: require.resolve('./tests/global-setup.ts'),
});
