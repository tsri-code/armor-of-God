/**
 * Content overlay component for warnings and access requests
 * React component injected into pages when content is filtered
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

interface OverlayProps {
  type: 'warning' | 'access-request' | 'pin-required';
  message: string;
  details?: string;
  url?: string;
  onAllow?: () => void;
  onDeny?: () => void;
  onClose?: () => void;
}

// Main overlay component
function ContentOverlay({ type, message, details, url, onAllow, onDeny, onClose }: OverlayProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-close countdown for warnings
  useEffect(() => {
    if (type === 'warning' && countdown === null) {
      setCountdown(10);
    }

    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      onClose?.();
    }
  }, [countdown, type, onClose]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Verify PIN with background script
      const response = await browser.runtime.sendMessage({
        type: 'VERIFY_PIN',
        data: { pin: pinInput },
      });

      if (response?.verified) {
        onAllow?.();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPinInput('');
      }
    } catch (err) {
      setError('Failed to verify PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccessRequest = async () => {
    setIsLoading(true);
    try {
      await browser.runtime.sendMessage({
        type: 'REQUEST_ACCESS',
        data: { url, reason: 'User requested access' },
      });
      onClose?.();
    } catch (err) {
      setError('Failed to submit access request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="armor-of-god-overlay">
      <div className="armor-of-god-overlay-backdrop" onClick={onClose} />
      <div className="armor-of-god-overlay-content">
        {/* Header */}
        <div className="armor-of-god-overlay-header">
          <div className="armor-of-god-overlay-icon">
            {type === 'warning' && '⚠️'}
            {type === 'access-request' && '🛡️'}
            {type === 'pin-required' && '🔒'}
          </div>
          <h2 className="armor-of-god-overlay-title">
            {type === 'warning' && 'Content Warning'}
            {type === 'access-request' && 'Access Requested'}
            {type === 'pin-required' && 'PIN Required'}
          </h2>
          <button
            className="armor-of-god-overlay-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="armor-of-god-overlay-body">
          <p className="armor-of-god-overlay-message">{message}</p>
          {details && (
            <p className="armor-of-god-overlay-details">{details}</p>
          )}

          {error && (
            <div className="armor-of-god-overlay-error">
              {error}
            </div>
          )}

          {/* PIN Input */}
          {type === 'pin-required' && (
            <form onSubmit={handlePinSubmit} className="armor-of-god-overlay-form">
              <div className="armor-of-god-overlay-input-group">
                <label htmlFor="pin-input" className="armor-of-god-overlay-label">
                  Enter Admin PIN
                </label>
                <input
                  id="pin-input"
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="armor-of-god-overlay-input"
                  placeholder="Enter PIN"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </form>
          )}

          {/* Countdown */}
          {countdown !== null && (
            <div className="armor-of-god-overlay-countdown">
              Auto-closing in {countdown} seconds
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="armor-of-god-overlay-actions">
          {type === 'warning' && (
            <>
              <button
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-secondary"
                onClick={onDeny}
                disabled={isLoading}
              >
                Go Back
              </button>
              <button
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-primary"
                onClick={onAllow}
                disabled={isLoading}
              >
                Continue Anyway
              </button>
            </>
          )}

          {type === 'access-request' && (
            <>
              <button
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-primary"
                onClick={handleAccessRequest}
                disabled={isLoading}
              >
                {isLoading ? 'Submitting...' : 'Request Access'}
              </button>
            </>
          )}

          {type === 'pin-required' && (
            <>
              <button
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="armor-of-god-overlay-btn armor-of-god-overlay-btn-primary"
                onClick={handlePinSubmit}
                disabled={isLoading || !pinInput.trim()}
              >
                {isLoading ? 'Verifying...' : 'Verify PIN'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="armor-of-god-overlay-footer">
          <small>Armor of God Extension - Protecting your browsing experience</small>
        </div>
      </div>

      <style jsx>{`
        .armor-of-god-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
        }

        .armor-of-god-overlay-backdrop {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(0, 0, 0, 0.7) !important;
          backdrop-filter: blur(4px) !important;
        }

        .armor-of-god-overlay-content {
          position: relative !important;
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
          max-width: 480px !important;
          width: 90% !important;
          max-height: 80vh !important;
          overflow: auto !important;
          margin: 20px !important;
        }

        .armor-of-god-overlay-header {
          display: flex !important;
          align-items: center !important;
          padding: 20px 24px 0 !important;
          gap: 12px !important;
        }

        .armor-of-god-overlay-icon {
          font-size: 32px !important;
          line-height: 1 !important;
        }

        .armor-of-god-overlay-title {
          flex: 1 !important;
          margin: 0 !important;
          font-size: 20px !important;
          font-weight: 600 !important;
          color: #1f2937 !important;
        }

        .armor-of-god-overlay-close {
          background: none !important;
          border: none !important;
          font-size: 24px !important;
          cursor: pointer !important;
          padding: 4px !important;
          border-radius: 4px !important;
          color: #6b7280 !important;
          transition: background-color 0.2s !important;
        }

        .armor-of-god-overlay-close:hover {
          background: #f3f4f6 !important;
        }

        .armor-of-god-overlay-body {
          padding: 20px 24px !important;
        }

        .armor-of-god-overlay-message {
          margin: 0 0 12px !important;
          font-size: 16px !important;
          font-weight: 500 !important;
          color: #1f2937 !important;
        }

        .armor-of-god-overlay-details {
          margin: 0 0 16px !important;
          color: #6b7280 !important;
        }

        .armor-of-god-overlay-error {
          background: #fef2f2 !important;
          color: #dc2626 !important;
          padding: 12px !important;
          border-radius: 8px !important;
          margin-bottom: 16px !important;
          font-size: 14px !important;
        }

        .armor-of-god-overlay-form {
          margin: 16px 0 !important;
        }

        .armor-of-god-overlay-input-group {
          margin-bottom: 16px !important;
        }

        .armor-of-god-overlay-label {
          display: block !important;
          margin-bottom: 6px !important;
          font-weight: 500 !important;
          color: #374151 !important;
        }

        .armor-of-god-overlay-input {
          width: 100% !important;
          padding: 10px 12px !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          transition: border-color 0.2s !important;
        }

        .armor-of-god-overlay-input:focus {
          outline: none !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }

        .armor-of-god-overlay-countdown {
          text-align: center !important;
          color: #6b7280 !important;
          font-size: 13px !important;
          margin-top: 16px !important;
          font-style: italic !important;
        }

        .armor-of-god-overlay-actions {
          display: flex !important;
          gap: 12px !important;
          justify-content: flex-end !important;
          padding: 0 24px 20px !important;
        }

        .armor-of-god-overlay-btn {
          padding: 10px 20px !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }

        .armor-of-god-overlay-btn:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
        }

        .armor-of-god-overlay-btn-primary {
          background: #3b82f6 !important;
          color: white !important;
        }

        .armor-of-god-overlay-btn-primary:hover:not(:disabled) {
          background: #2563eb !important;
        }

        .armor-of-god-overlay-btn-secondary {
          background: #f3f4f6 !important;
          color: #374151 !important;
        }

        .armor-of-god-overlay-btn-secondary:hover:not(:disabled) {
          background: #e5e7eb !important;
        }

        .armor-of-god-overlay-footer {
          padding: 0 24px 20px !important;
          text-align: center !important;
          border-top: 1px solid #e5e7eb !important;
          padding-top: 16px !important;
        }

        .armor-of-god-overlay-footer small {
          color: #6b7280 !important;
          font-size: 12px !important;
        }

        @media (max-width: 480px) {
          .armor-of-god-overlay-content {
            width: 95% !important;
            margin: 10px !important;
          }

          .armor-of-god-overlay-header,
          .armor-of-god-overlay-body,
          .armor-of-god-overlay-actions,
          .armor-of-god-overlay-footer {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .armor-of-god-overlay-actions {
            flex-direction: column !important;
          }

          .armor-of-god-overlay-btn {
            width: 100% !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .armor-of-god-overlay-content {
            background: #1f2937 !important;
            color: #f9fafb !important;
          }

          .armor-of-god-overlay-title {
            color: #f9fafb !important;
          }

          .armor-of-god-overlay-message {
            color: #f9fafb !important;
          }

          .armor-of-god-overlay-close:hover {
            background: #374151 !important;
          }

          .armor-of-god-overlay-input {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #f9fafb !important;
          }

          .armor-of-god-overlay-btn-secondary {
            background: #374151 !important;
            color: #f9fafb !important;
          }

          .armor-of-god-overlay-btn-secondary:hover:not(:disabled) {
            background: #4b5563 !important;
          }
        }
      `}</style>
    </div>
  );
}

// Utility functions for showing overlays
export function showContentWarning(
  message: string,
  details?: string,
  options: { onAllow?: () => void; onDeny?: () => void } = {}
): void {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);

  const cleanup = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <ContentOverlay
      type="warning"
      message={message}
      details={details}
      onAllow={() => {
        options.onAllow?.();
        cleanup();
      }}
      onDeny={() => {
        options.onDeny?.();
        cleanup();
      }}
      onClose={cleanup}
    />
  );
}

export function showAccessRequest(
  url: string,
  message: string,
  options: { onSubmit?: () => void } = {}
): void {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);

  const cleanup = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <ContentOverlay
      type="access-request"
      message={message}
      url={url}
      onAllow={() => {
        options.onSubmit?.();
        cleanup();
      }}
      onClose={cleanup}
    />
  );
}

export function showPinPrompt(
  message: string,
  options: { onVerified?: () => void; onCancel?: () => void } = {}
): void {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);

  const cleanup = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <ContentOverlay
      type="pin-required"
      message={message}
      onAllow={() => {
        options.onVerified?.();
        cleanup();
      }}
      onClose={() => {
        options.onCancel?.();
        cleanup();
      }}
    />
  );
}

// Make browser available
const browser = (globalThis as any).browser || (globalThis as any).chrome;
