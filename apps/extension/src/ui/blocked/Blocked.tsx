/**
 * Blocked page component shown when content is blocked
 * Displays a gentle message with daily verse and action options
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../content/blur.css";
import type { Verse } from "../../lib/types";

interface BlockedPageData {
  verse: Verse | null;
  url: string;
  reason: string;
  canRequestAccess: boolean;
  loading: boolean;
}

function BlockedPage() {
  const [data, setData] = useState<BlockedPageData>({
    verse: null,
    url: "",
    reason: "Content filtering",
    canRequestAccess: true,
    loading: true,
  });

  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadBlockedPageData();
  }, []);

  const loadBlockedPageData = async () => {
    try {
      // Get URL from query params
      const urlParams = new URLSearchParams(window.location.search);
      const blockedUrl = urlParams.get("url") || window.location.href;
      const reason = urlParams.get("reason") || "Content filtering";

      // Load verse
      const verseResponse = await browser.runtime.sendMessage({
        type: "GET_VERSE",
      });

      setData({
        verse: verseResponse?.error ? null : verseResponse,
        url: blockedUrl,
        reason,
        canRequestAccess: true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load blocked page data:", error);
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "https://www.google.com";
    }
  };

  const handleRequestAccess = async () => {
    if (!requestReason.trim()) return;

    setSubmittingRequest(true);
    try {
      await browser.runtime.sendMessage({
        type: "REQUEST_ACCESS",
        data: {
          url: data.url,
          reason: requestReason,
          timestamp: Date.now(),
        },
      });

      // Show success and close request form
      alert(
        "Access request submitted. An administrator will review your request.",
      );
      setShowAccessRequest(false);
      setRequestReason("");
    } catch (error) {
      console.error("Failed to submit access request:", error);
      alert("Failed to submit request. Please try again.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleOpenSettings = () => {
    browser.runtime.openOptionsPage();
  };

  if (data.loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon and Title */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-christian-500 rounded-full flex items-center justify-center mx-auto mb-4 p-4">
              <img
                src="/assets/Icons/helmet-cross/helmet-cross-64.png"
                alt="Protection Shield"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Content Blocked
            </h1>
            <p className="text-gray-600">
              This page has been blocked to help maintain a safe browsing
              experience.
            </p>
          </div>

          {/* Reason */}
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium flex items-center justify-center gap-2">
              <img
                src="/assets/Icons/lock-cross/lock-cross-16.png"
                alt="Warning"
                className="w-4 h-4"
              />
              Reason: {data.reason}
            </p>
          </div>

          {/* Daily Verse */}
          {data.verse && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <img
                    src="/assets/Icons/book-cross/book-cross-16.png"
                    alt="Bible"
                    className="w-4 h-4"
                  />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Today's Verse
                  </h2>
                </div>
                <div className="w-12 h-0.5 bg-gradient-to-r from-primary-500 to-christian-500 mx-auto"></div>
              </div>
              <blockquote className="text-gray-700 italic text-lg leading-relaxed mb-4">
                "{data.verse.text}"
              </blockquote>
              <cite className="text-gray-600 font-medium not-italic">
                — {data.verse.reference} (BSB)
              </cite>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGoBack}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Go Back
              </button>

              <button
                onClick={() => setShowAccessRequest(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                disabled={!data.canRequestAccess}
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Request Access
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex justify-center">
              <button
                onClick={handleOpenSettings}
                className="text-gray-600 hover:text-gray-800 text-sm underline transition-colors"
              >
                Extension Settings
              </button>
            </div>
          </div>

          {/* Access Request Form */}
          {showAccessRequest && (
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">
                Request Access
              </h3>
              <div className="text-left">
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Please explain why you need access to this content:
                </label>
                <textarea
                  id="reason"
                  rows={4}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g., This is needed for work/research/educational purposes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                  disabled={submittingRequest}
                />
              </div>
              <div className="flex gap-3 mt-4 justify-end">
                <button
                  onClick={() => {
                    setShowAccessRequest(false);
                    setRequestReason("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                  disabled={submittingRequest}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestAccess}
                  disabled={!requestReason.trim() || submittingRequest}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {submittingRequest ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-2">
              <span>🛡️</span>
              <span>Armor of God Extension</span>
            </div>
            <p className="text-xs text-gray-400">
              Walking in faith, browsing with protection
            </p>
            {data.verse?.copyright && (
              <p className="text-xs text-gray-400 mt-2">
                {data.verse.copyright}
              </p>
            )}
          </div>
        </div>

        {/* Alternative Resources */}
        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm mb-4">
            Looking for something else? Try these trusted resources:
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://www.bible.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Bible.com
            </a>
            <a
              href="https://www.christianity.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Christianity.com
            </a>
            <a
              href="https://www.desiringgod.org"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Desiring God
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-christian-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
          🛡️
        </div>
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Initialize blocked page
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<BlockedPage />);
}

// Make browser available
const browser = (globalThis as any).browser || (globalThis as any).chrome;
