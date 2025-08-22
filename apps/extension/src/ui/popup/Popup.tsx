/**
 * Main popup component for Armor of God extension
 * Shows daily verse, quick stats, and controls
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../content/blur.css";
import { formatVerse } from "../../background/verse-service";
import browser from "../../lib/browser";
import type { Verse, Settings, Stats } from "../../lib/types";

interface PopupData {
  verse: Verse | null;
  settings: Settings | null;
  stats: Stats | null;
  loading: boolean;
  error: string | null;
}

function Popup() {
  const [data, setData] = useState<PopupData>({
    verse: null,
    settings: null,
    stats: null,
    loading: true,
    error: null,
  });

  // Load initial data
  useEffect(() => {
    loadPopupData();
  }, []);

  const loadPopupData = async () => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      // Load settings and stats (skip verse for now to avoid errors)
      const [settingsResponse, statsResponse] = await Promise.all([
        browser.runtime
          .sendMessage({ type: "GET_SETTINGS" })
          .catch(() => ({ error: "Settings unavailable" })),
        browser.runtime
          .sendMessage({ type: "GET_STATS" })
          .catch(() => ({ error: "Stats unavailable" })),
      ]);

      setData({
        verse: null, // Skip verse loading for simplicity
        settings: settingsResponse?.error ? null : settingsResponse,
        stats: statsResponse?.error ? null : statsResponse,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Failed to load popup data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: null, // Don't show error, just show disabled state
        settings: { enabled: false } as any, // Fallback state
      }));
    }
  };

  const toggleExtension = async () => {
    try {
      const currentEnabled = data.settings?.enabled ?? false;
      const newEnabled = !currentEnabled;

      console.log(`[Popup] Toggling from ${currentEnabled} to ${newEnabled}`);

      // Optimistic update - update UI immediately
      setData((prev) => ({
        ...prev,
        settings: prev.settings
          ? { ...prev.settings, enabled: newEnabled }
          : ({ enabled: newEnabled } as any),
      }));

      const response = await browser.runtime.sendMessage({
        type: "TOGGLE_EXTENSION",
      });

      console.log("[Popup] Toggle response:", response);

      if (response?.settings) {
        // Update with full settings from response
        setData((prev) => ({
          ...prev,
          settings: response.settings,
        }));

        // Visual feedback
        console.log(
          `[Popup] Extension is now ${response.settings.enabled ? "ENABLED ✅" : "DISABLED ❌"}`
        );
        console.log(`[Popup] All modules status:`, response.settings.modules);
      } else if (response?.enabled !== undefined) {
        // Update with response
        setData((prev) => ({
          ...prev,
          settings: prev.settings
            ? { ...prev.settings, enabled: response.enabled }
            : ({ enabled: response.enabled } as any),
        }));
        console.log(
          `[Popup] Extension is now ${response.enabled ? "ENABLED ✅" : "DISABLED ❌"}`
        );
      } else if (response?.error) {
        console.error("[Popup] Toggle failed:", response.error);
        // Revert optimistic update
        setData((prev) => ({
          ...prev,
          settings: prev.settings
            ? { ...prev.settings, enabled: currentEnabled }
            : ({ enabled: currentEnabled } as any),
        }));
      }
    } catch (error) {
      console.error("[Popup] Failed to toggle extension:", error);
      // Force a reload to get current state
      setTimeout(loadPopupData, 100);
    }
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  if (data.loading) {
    return <LoadingScreen />;
  }

  const { settings, stats } = data;
  const isEnabled = settings?.enabled ?? false;

  return (
    <div className="w-[340px] bg-white">
      {/* Header with Large Toggle */}
      <div
        className={`text-white p-6 transition-colors ${
          isEnabled
            ? "bg-gradient-to-r from-green-600 to-emerald-600"
            : "bg-gradient-to-r from-gray-500 to-gray-600"
        }`}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <img
              src="/assets/Icons/shield-cross/shield-cross-32.png"
              alt="Armor of God"
              className="w-10 h-10 object-contain filter brightness-0 invert"
            />
          </div>
          <h1 className="font-bold text-xl mb-2">Armor of God</h1>

          {/* Large Toggle Button with Clear Visual Feedback */}
          <button
            onClick={toggleExtension}
            className={`w-40 h-20 rounded-2xl relative transition-all duration-300 mb-3 border-4 ${
              isEnabled
                ? "bg-green-500 border-green-400 hover:bg-green-600"
                : "bg-gray-400 border-gray-300 hover:bg-gray-500"
            }`}
          >
            {/* Big Checkmark or X */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isEnabled ? (
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>

            {/* ON/OFF Label */}
            <div className="absolute bottom-1 left-0 right-0 text-white font-bold text-xs">
              {isEnabled ? "ON" : "OFF"}
            </div>
          </button>

          <p className="text-white font-bold text-lg">
            {isEnabled ? "✓ Protection Active" : "✗ Protection Disabled"}
          </p>
          <p className="text-white/90 text-sm">
            {isEnabled
              ? "All filters are working"
              : "Click the button above to enable"}
          </p>
        </div>
      </div>

      {/* Status Indicators */}
      {isEnabled && settings && (
        <div className="p-4 bg-green-50 border-b border-green-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div
                className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  settings.modules?.imageScanning
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              ></div>
              <div className="text-xs text-gray-600">Images</div>
            </div>
            <div>
              <div
                className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  settings.modules?.textFiltering
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              ></div>
              <div className="text-xs text-gray-600">Text</div>
            </div>
            <div>
              <div
                className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  settings.modules?.safeSearch ? "bg-green-500" : "bg-gray-400"
                }`}
              ></div>
              <div className="text-xs text-gray-600">Search</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats (only when enabled) */}
      {isEnabled && stats && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 mb-3 text-center">
            Protection Stats
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.blocksToday || 0}
              </div>
              <div className="text-xs text-gray-500">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.blocksThisWeek || 0}
              </div>
              <div className="text-xs text-gray-500">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.blocksTotal || 0}
              </div>
              <div className="text-xs text-gray-500">All Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4">
        <div className="space-y-3">
          <button
            onClick={openOptions}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Advanced Settings
          </button>

          <button
            onClick={() => window.close()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Close
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <div className="text-center text-xs text-gray-400">
          <p>Walking in faith, browsing with protection</p>
        </div>
      </div>
    </div>
  );
}

// Module Status Component
function ModuleStatus({
  label,
  enabled,
  active,
}: {
  label: string;
  enabled: boolean;
  active: boolean;
}) {
  const isActive = enabled && active;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div
        className={`w-2 h-2 rounded-full ${
          isActive ? "bg-green-400" : enabled ? "bg-yellow-400" : "bg-gray-300"
        }`}
      />
    </div>
  );
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="w-[380px] h-[500px] bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Error Screen
function ErrorScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="w-[380px] bg-white p-6">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Initialize popup
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
