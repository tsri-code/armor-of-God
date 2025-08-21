/**
 * Main popup component for Armor of God extension
 * Shows daily verse, quick stats, and controls
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../content/blur.css";
import { formatVerse } from "../../background/verse-service";
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

      // Load data in parallel
      const [verseResponse, settingsResponse, statsResponse] =
        await Promise.all([
          browser.runtime.sendMessage({ type: "GET_VERSE" }),
          browser.runtime.sendMessage({ type: "GET_SETTINGS" }),
          browser.runtime.sendMessage({ type: "GET_STATS" }),
        ]);

      setData({
        verse: verseResponse?.error ? null : verseResponse,
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
        error: "Failed to load extension data",
      }));
    }
  };

  const toggleExtension = async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: "TOGGLE_EXTENSION",
      });
      if (response?.enabled !== undefined) {
        setData((prev) => ({
          ...prev,
          settings: prev.settings
            ? { ...prev.settings, enabled: response.enabled }
            : null,
        }));
      }
    } catch (error) {
      console.error("Failed to toggle extension:", error);
    }
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  const refreshVerse = async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: "GET_VERSE",
        data: { refresh: true },
      });
      if (!response?.error) {
        setData((prev) => ({ ...prev, verse: response }));
      }
    } catch (error) {
      console.error("Failed to refresh verse:", error);
    }
  };

  if (data.loading) {
    return <LoadingScreen />;
  }

  if (data.error) {
    return <ErrorScreen error={data.error} onRetry={loadPopupData} />;
  }

  const { verse, settings, stats } = data;

  return (
    <div className="w-[380px] bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-christian-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center p-1">
              <img
                src="/assets/Icons/shield-cross/shield-cross-32.png"
                alt="Armor of God"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Armor of God</h1>
              <p className="text-white/80 text-xs">
                {settings?.enabled
                  ? "Protection Active"
                  : "Protection Disabled"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleExtension}
            className={`w-12 h-6 rounded-full relative transition-colors ${
              settings?.enabled ? "bg-green-400" : "bg-white/30"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                settings?.enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Daily Verse */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src="/assets/Icons/book-cross/book-cross-16.png"
              alt="Bible verse"
              className="w-4 h-4 opacity-70"
            />
            <h2 className="font-medium text-gray-900">Today's Verse</h2>
          </div>
          <button
            onClick={refreshVerse}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh verse"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {verse ? (
          <div className="text-sm">
            <blockquote className="text-gray-700 italic mb-2 leading-relaxed">
              "{verse.text}"
            </blockquote>
            <cite className="text-gray-500 not-italic text-xs">
              — {verse.reference} (BSB)
            </cite>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-4">
            <div className="mb-2">
              <img
                src="/assets/Icons/book-cross/book-cross-32.png"
                alt="Bible"
                className="w-8 h-8 mx-auto opacity-60"
              />
            </div>
            <p>Verse unavailable offline</p>
            <button
              onClick={refreshVerse}
              className="text-primary-600 hover:underline text-xs mt-1"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/assets/Icons/helmet-cross/helmet-cross-16.png"
              alt="Protection"
              className="w-4 h-4 opacity-70"
            />
            <h3 className="font-medium text-gray-900">Protection Stats</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-primary-600">
                {stats.blocksToday}
              </div>
              <div className="text-xs text-gray-500">Today</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-christian-600">
                {stats.blocksThisWeek}
              </div>
              <div className="text-xs text-gray-500">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-600">
                {stats.blocksTotal}
              </div>
              <div className="text-xs text-gray-500">All Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Module Status */}
      {settings && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/assets/Icons/lock-cross/lock-cross-16.png"
              alt="Modules"
              className="w-4 h-4 opacity-70"
            />
            <h3 className="font-medium text-gray-900">Protection Modules</h3>
          </div>
          <div className="space-y-2">
            <ModuleStatus
              label="Image Scanning"
              enabled={settings.modules.imageScanning}
              active={settings.enabled}
            />
            <ModuleStatus
              label="Safe Search"
              enabled={settings.modules.safeSearch}
              active={settings.enabled}
            />
            <ModuleStatus
              label="URL Blocking"
              enabled={settings.modules.urlBlocking}
              active={settings.enabled}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={openOptions}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <svg
              className="w-4 h-4"
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
            Settings
          </button>

          <button
            onClick={() => window.close()}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg
              className="w-4 h-4"
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

// Make browser available
const browser = (globalThis as any).browser || (globalThis as any).chrome;
