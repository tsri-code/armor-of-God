#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Update Worker URL Configuration
 *
 * Usage:
 *   node update-config.cjs https://your-worker.your-subdomain.workers.dev
 *   node update-config.cjs --help
 */

function updateWorkerURL(newURL) {
  const configPath = path.join(__dirname, "src/config.ts");

  if (!fs.existsSync(configPath)) {
    console.error("❌ Config file not found:", configPath);
    process.exit(1);
  }

  try {
    // Read current config
    let configContent = fs.readFileSync(configPath, "utf8");

    // Replace the worker URL
    const oldPattern = /WORKER_URL: process\.env\.VITE_WORKER_URL \|\| '[^']+'/;
    const newValue = `WORKER_URL: process.env.VITE_WORKER_URL || '${newURL}'`;

    if (!oldPattern.test(configContent)) {
      console.error("❌ Could not find WORKER_URL pattern in config file");
      process.exit(1);
    }

    configContent = configContent.replace(oldPattern, newValue);

    // Write updated config
    fs.writeFileSync(configPath, configContent);

    console.log("✅ Updated worker URL in config.ts");
    console.log("📁 File:", configPath);
    console.log("🔗 New URL:", newURL);
    console.log("");
    console.log("🚀 Next steps:");
    console.log("1. Rebuild extension: npm run build");
    console.log("2. Reload extension in browser");
    console.log("3. Test daily verse functionality");
  } catch (error) {
    console.error("❌ Error updating config:", error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🛡️  Armor of God Extension - Worker URL Updater

Usage:
  node update-config.cjs <worker-url>
  node update-config.cjs --help

Examples:
  node update-config.cjs https://armor-of-god-worker.mydomain.workers.dev
  node update-config.cjs https://my-worker.pages.dev

Description:
  Updates the Cloudflare Worker URL in the extension configuration.
  This is used for fetching daily Bible verses from the Scripture API.

After updating:
  1. Rebuild the extension with 'npm run build'
  2. Reload the extension in your browser
  3. The daily verses will now be fetched from your deployed worker
`);
}

// Main script
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  showHelp();
  process.exit(0);
}

const workerURL = args[0];

// Basic URL validation
try {
  new URL(workerURL);
} catch (error) {
  console.error("❌ Invalid URL provided:", workerURL);
  console.error("   Please provide a valid HTTPS URL");
  process.exit(1);
}

if (!workerURL.startsWith("https://")) {
  console.error("❌ Worker URL must use HTTPS");
  process.exit(1);
}

updateWorkerURL(workerURL);
