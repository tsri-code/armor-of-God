import { defineManifest } from "@crxjs/vite-plugin";
import type { ManifestV3Export } from "@crxjs/vite-plugin";

interface ManifestOptions {
  mode: "development" | "production";
  browser: "chrome" | "firefox";
}

export default defineManifest((options: ManifestOptions): ManifestV3Export => {
  const { mode, browser } = options;
  const isDev = mode === "development";
  const isFirefox = browser === "firefox";

  const baseManifest = {
    manifest_version: 3,
    name: isDev ? "[DEV] Armor of God" : "Armor of God",
    version: "0.1.0",
    description:
      "Christian content filtering extension with daily Berean Standard Bible verses. Block inappropriate content and stay rooted in Scripture.",

    icons: {
      "16": "assets/icon-16.png",
      "32": "assets/icon-32.png",
      "48": "assets/icon-48.png",
      "128": "assets/icon-128.png",
    },

    action: {
      default_popup: "src/ui/popup/index.html",
      default_title: "Armor of God",
      default_icon: {
        "16": "assets/icon-16.png",
        "32": "assets/icon-32.png",
      },
    },

    options_ui: {
      page: "src/ui/options/index.html",
      open_in_tab: true,
    },

    background: {
      service_worker: "src/background/service-worker.ts",
      type: "module",
    },

    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/content/censor.ts", "src/content/text-filter.ts"],
        run_at: "document_idle",
        all_frames: false,
      },
    ],

    web_accessible_resources: [
      {
        resources: [
          "assets/*",
          "assets/Icons/**/*",
          "public/models/**/*",
          "src/ui/blocked/blocked.html",
        ],
        matches: ["<all_urls>"],
      },
    ],

    permissions: [
      "storage",
      "tabs",
      "scripting",
      "alarms",
      "activeTab",
    ] as chrome.runtime.ManifestPermissions[],

    host_permissions: ["<all_urls>"],
  };

  // Chrome/Edge specific features
  if (!isFirefox) {
    return {
      ...baseManifest,
      permissions: [
        ...baseManifest.permissions,
        "declarativeNetRequest",
        "declarativeNetRequestWithHostAccess",
      ],
      declarative_net_request: {
        rule_resources: [
          {
            id: "base_rules",
            enabled: true,
            path: "src/data/initial-rules.json",
          },
        ],
      },
    };
  }

  // Firefox specific features
  return {
    ...baseManifest,
    permissions: [
      ...baseManifest.permissions,
      "webRequest",
      "webRequestBlocking",
    ],
    browser_specific_settings: {
      gecko: {
        id: "{armor-of-god@christian-extension.org}",
        strict_min_version: "109.0",
      },
    },
  };
});
