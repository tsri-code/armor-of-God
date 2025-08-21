/**
 * Global setup for Playwright tests
 * Builds the extension before running tests
 */

import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🔨 Setting up extension tests...');

  const extensionDir = path.resolve(__dirname, '..');
  const distDir = path.resolve(extensionDir, 'dist');

  try {
    // Build the extension for Chrome
    console.log('📦 Building extension for Chrome...');
    execSync('npm run build', {
      cwd: extensionDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Verify build output
    if (!fs.existsSync(distDir)) {
      throw new Error('Extension build failed - dist directory not found');
    }

    const manifestPath = path.join(distDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Extension build failed - manifest.json not found');
    }

    console.log('✅ Extension built successfully');

    // Build Firefox version
    console.log('📦 Building extension for Firefox...');
    execSync('npm run build:firefox', {
      cwd: extensionDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', TARGET: 'firefox' }
    });

    console.log('✅ Firefox extension built successfully');

    // Create test fixtures if they don't exist
    await createTestFixtures();

    console.log('🎯 Test setup complete');

  } catch (error) {
    console.error('❌ Test setup failed:', error);
    process.exit(1);
  }
}

async function createTestFixtures() {
  const fixturesDir = path.resolve(__dirname, 'fixtures');

  // Create test HTML page with mixed content
  const testPagePath = path.join(fixturesDir, 'test-page.html');

  if (!fs.existsSync(testPagePath)) {
    const testPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Armor of God Test Page</title>
</head>
<body>
  <h1>Content Filtering Test Page</h1>

  <!-- Test images for ML scanning -->
  <div id="test-images">
    <img src="https://via.placeholder.com/300x200/cccccc/000000?text=Safe+Image" alt="Safe test image" class="safe-image">
    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='Arial, sans-serif' font-size='14'%3ETest Image%3C/text%3E%3C/svg%3E" alt="SVG test image" class="test-image">
  </div>

  <!-- Test search forms -->
  <div id="test-search">
    <h2>Search Engine Tests</h2>
    <form action="https://www.google.com/search" method="get">
      <input type="text" name="q" value="test search" placeholder="Google search">
      <button type="submit">Google Search</button>
    </form>

    <form action="https://www.bing.com/search" method="get">
      <input type="text" name="q" value="test search" placeholder="Bing search">
      <button type="submit">Bing Search</button>
    </form>
  </div>

  <!-- Test blocked content -->
  <div id="test-blocking">
    <h2>Content Blocking Tests</h2>
    <a href="https://example.com/blocked" id="safe-link">Safe Link</a>
    <a href="https://example.adult" id="blocked-link">Blocked Link (would be blocked)</a>
  </div>

  <!-- Test verse display area -->
  <div id="verse-display" style="margin-top: 2rem; padding: 1rem; border: 1px solid #ccc;">
    <h3>Daily Verse Test Area</h3>
    <div id="verse-content">Loading verse...</div>
  </div>

  <script>
    // Test script for extension interaction
    console.log('Test page loaded');

    // Simulate verse loading
    setTimeout(() => {
      const verseContent = document.getElementById('verse-content');
      if (verseContent) {
        verseContent.innerHTML = '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, to give you hope and a future." — Jeremiah 29:11 (BSB)';
      }
    }, 1000);
  </script>
</body>
</html>`;

    fs.writeFileSync(testPagePath, testPageContent);
    console.log('📄 Created test page fixture');
  }
}

export default globalSetup;
