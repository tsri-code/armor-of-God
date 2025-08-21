/**
 * Options page for Armor of God extension
 * Full settings management with tabs for different categories
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../content/blur.css";
import { createPINHash, verifyPIN } from "../../lib/crypto";
import type { Settings, Schedule, Stats } from "../../lib/types";

type TabId =
  | "general"
  | "filtering"
  | "lists"
  | "schedules"
  | "privacy"
  | "admin";

interface OptionsData {
  settings: Settings | null;
  stats: Stats | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
}

function Options() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [data, setData] = useState<OptionsData>({
    settings: null,
    stats: null,
    loading: true,
    saving: false,
    error: null,
    success: null,
  });

  // Load initial data
  useEffect(() => {
    loadOptionsData();
  }, []);

  const loadOptionsData = async () => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const [settingsResponse, statsResponse] = await Promise.all([
        browser.runtime.sendMessage({ type: "GET_SETTINGS" }),
        browser.runtime.sendMessage({ type: "GET_STATS" }),
      ]);

      setData({
        settings: settingsResponse?.error ? null : settingsResponse,
        stats: statsResponse?.error ? null : statsResponse,
        loading: false,
        saving: false,
        error: null,
        success: null,
      });
    } catch (error) {
      console.error("Failed to load options data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load settings",
      }));
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      setData((prev) => ({
        ...prev,
        saving: true,
        error: null,
        success: null,
      }));

      await browser.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        data: newSettings,
      });

      setData((prev) => ({
        ...prev,
        settings: newSettings,
        saving: false,
        success: "Settings saved successfully",
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setData((prev) => ({ ...prev, success: null }));
      }, 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setData((prev) => ({
        ...prev,
        saving: false,
        error: "Failed to save settings",
      }));
    }
  };

  const updateSettings = (updates: Partial<Settings>) => {
    if (!data.settings) return;

    const newSettings = { ...data.settings, ...updates };
    setData((prev) => ({ ...prev, settings: newSettings }));
  };

  const tabs = [
    { id: "general" as TabId, label: "General", icon: "⚙️" },
    { id: "filtering" as TabId, label: "Content Filtering", icon: "🛡️" },
    { id: "lists" as TabId, label: "Allow/Block Lists", icon: "📝" },
    { id: "schedules" as TabId, label: "Schedules", icon: "⏰" },
    { id: "privacy" as TabId, label: "Privacy & Stats", icon: "🔒" },
    { id: "admin" as TabId, label: "Admin", icon: "👨‍💼" },
  ];

  if (data.loading) {
    return <LoadingScreen />;
  }

  if (!data.settings) {
    return (
      <ErrorScreen
        error={data.error || "Settings not available"}
        onRetry={loadOptionsData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-600 to-christian-600 rounded-full flex items-center justify-center p-2">
              <img
                src="/assets/Icons/shield-cross/shield-cross-32.png"
                alt="Armor of God"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Armor of God Settings
              </h1>
              <p className="text-sm text-gray-600">
                Manage your content protection preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary-100 text-primary-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Status Messages */}
              {data.error && (
                <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{data.error}</p>
                </div>
              )}

              {data.success && (
                <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">{data.success}</p>
                </div>
              )}

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "general" && (
                  <GeneralTab
                    settings={data.settings}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}

                {activeTab === "filtering" && (
                  <FilteringTab
                    settings={data.settings}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}

                {activeTab === "lists" && (
                  <ListsTab
                    settings={data.settings}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}

                {activeTab === "schedules" && (
                  <SchedulesTab
                    settings={data.settings}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}

                {activeTab === "privacy" && (
                  <PrivacyTab
                    settings={data.settings}
                    stats={data.stats}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}

                {activeTab === "admin" && (
                  <AdminTab
                    settings={data.settings}
                    onUpdate={updateSettings}
                    onSave={saveSettings}
                    saving={data.saving}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// General Settings Tab
function GeneralTab({
  settings,
  onUpdate,
  onSave,
  saving,
}: {
  settings: Settings;
  onUpdate: (updates: Partial<Settings>) => void;
  onSave: (settings: Settings) => void;
  saving: boolean;
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSave(localSettings);
  };

  const updateLocal = (updates: Partial<Settings>) => {
    const updated = { ...localSettings, ...updates };
    setLocalSettings(updated);
    onUpdate(updates);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          General Settings
        </h2>

        {/* Extension Enable/Disable */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900">Extension Protection</h3>
            <p className="text-sm text-gray-600">
              Enable or disable all content filtering
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.enabled}
              onChange={(e) => updateLocal({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {/* Protection Modules */}
        <div className="mt-4 space-y-3">
          <h3 className="font-medium text-gray-900">Protection Modules</h3>

          <ModuleToggle
            label="Image Scanning"
            description="Use AI to detect and blur inappropriate images"
            enabled={localSettings.modules.imageScanning}
            onChange={(enabled) =>
              updateLocal({
                modules: { ...localSettings.modules, imageScanning: enabled },
              })
            }
          />

          <ModuleToggle
            label="Safe Search"
            description="Enforce safe search on Google, Bing, and other search engines"
            enabled={localSettings.modules.safeSearch}
            onChange={(enabled) =>
              updateLocal({
                modules: { ...localSettings.modules, safeSearch: enabled },
              })
            }
          />

          <ModuleToggle
            label="URL Blocking"
            description="Block access to known inappropriate websites"
            enabled={localSettings.modules.urlBlocking}
            onChange={(enabled) =>
              updateLocal({
                modules: { ...localSettings.modules, urlBlocking: enabled },
              })
            }
          />

          <ModuleToggle
            label="Video Scanning (Beta)"
            description="Scan video content for inappropriate material"
            enabled={localSettings.modules.videoScanning}
            onChange={(enabled) =>
              updateLocal({
                modules: { ...localSettings.modules, videoScanning: enabled },
              })
            }
            beta
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Module Toggle Component
function ModuleToggle({
  label,
  description,
  enabled,
  onChange,
  beta = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  beta?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{label}</h4>
          {beta && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
              Beta
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}

// Content Filtering Tab
function FilteringTab({
  settings,
  onUpdate,
  onSave,
  saving,
}: {
  settings: Settings;
  onUpdate: (updates: Partial<Settings>) => void;
  onSave: (settings: Settings) => void;
  saving: boolean;
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSave(localSettings);
  };

  const updateLocal = (updates: Partial<Settings>) => {
    const updated = { ...localSettings, ...updates };
    setLocalSettings(updated);
    onUpdate(updates);
  };

  const updateThreshold = (
    type: keyof Settings["thresholds"],
    value: number,
  ) => {
    updateLocal({
      thresholds: {
        ...localSettings.thresholds,
        [type]: value / 100, // Convert percentage to decimal
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Content Filtering Settings
        </h2>

        {/* Sensitivity Thresholds */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Sensitivity Thresholds</h3>
          <p className="text-sm text-gray-600">
            Adjust how sensitive the content detection should be. Lower values =
            more sensitive.
          </p>

          <div className="space-y-4">
            <ThresholdSlider
              label="Blur Threshold"
              description="Images above this threshold will be blurred"
              value={localSettings.thresholds.blur * 100}
              onChange={(value) => updateThreshold("blur", value)}
              color="yellow"
            />

            <ThresholdSlider
              label="Warning Threshold"
              description="Images above this threshold will show a warning"
              value={localSettings.thresholds.warning * 100}
              onChange={(value) => updateThreshold("warning", value)}
              color="orange"
            />

            <ThresholdSlider
              label="Block Threshold"
              description="Images above this threshold will be completely blocked"
              value={localSettings.thresholds.block * 100}
              onChange={(value) => updateThreshold("block", value)}
              color="red"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Threshold Slider Component
function ThresholdSlider({
  label,
  description,
  value,
  onChange,
  color,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  color: "yellow" | "orange" | "red";
}) {
  const colorClasses = {
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-gray-900">{label}</h4>
        <span className="text-sm font-medium text-gray-700">
          {value.toFixed(0)}%
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>

      <div className="relative">
        <input
          type="range"
          min="10"
          max="95"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${colorClasses[color]} 0%, ${colorClasses[color]} ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>More Sensitive</span>
        <span>Less Sensitive</span>
      </div>
    </div>
  );
}

// Placeholder tabs - simplified for brevity but would be fully implemented
function ListsTab(props: any) {
  return (
    <div className="p-8 text-center text-gray-500">
      Allow/Block Lists - Coming soon
    </div>
  );
}

function SchedulesTab(props: any) {
  return (
    <div className="p-8 text-center text-gray-500">Schedules - Coming soon</div>
  );
}

function PrivacyTab(props: any) {
  return (
    <div className="p-8 text-center text-gray-500">
      Privacy & Stats - Coming soon
    </div>
  );
}

function AdminTab(props: any) {
  return (
    <div className="p-8 text-center text-gray-500">
      Admin Settings - Coming soon
    </div>
  );
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Loading settings...</p>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md">
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

// Initialize options page
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}

// Make browser available
const browser = (globalThis as any).browser || (globalThis as any).chrome;
