/**
 * Safe search enforcement for major search engines
 * Uses DNR redirect rules for Chrome/Edge, webRequest for Firefox
 */

import browser, { supportsDeclarativeNetRequest } from '../lib/browser';
import { logger } from '../lib/log';
import { CONSTANTS } from '@shared/index';

// Safe search rule configurations
const SAFE_SEARCH_RULES = {
  google: {
    pattern: '^https://www\\.google\\.[a-z.]+/search\\?(.*)$',
    redirect: 'https://www.google.$1/search?$2&safe=active',
    priority: 10,
  },
  bing: {
    pattern: '^https://www\\.bing\\.com/search\\?(.*)$',
    redirect: 'https://www.bing.com/search?$1&adlt=strict',
    priority: 10,
  },
  duckduckgo: {
    pattern: '^https://duckduckgo\\.com/\\?(.*)$',
    redirect: 'https://duckduckgo.com/?$1&safe-search=strict',
    priority: 10,
  },
  youtube: {
    pattern: '^https://www\\.youtube\\.com/(.*)$',
    redirect: 'https://www.youtube.com/$1',
    priority: 10,
    specialHandling: true, // Requires cookie setting
  },
};

// Apply safe search enforcement
export async function enforceSafeSearch(): Promise<void> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      logger.info('safe-search', 'Using webRequest for safe search enforcement');
      await setupWebRequestSafeSearch();
      return;
    }

    logger.info('safe-search', 'Setting up DNR safe search rules');
    
    const rules = generateSafeSearchRules();
    await updateSafeSearchRules(true, rules);
    
    // Setup YouTube restricted mode (requires special handling)
    await setupYouTubeRestrictions();
    
    logger.info('safe-search', 'Safe search enforcement active');
    
  } catch (error) {
    logger.error('safe-search', 'Failed to enforce safe search', error);
  }
}

// Update safe search rules based on setting
export async function updateSafeSearchRules(enabled: boolean, customRules?: any[]): Promise<void> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      return;
    }

    // Remove existing safe search rules
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const safeSearchRuleIds = existingRules
      .filter(rule => rule.id >= CONSTANTS.RULES.SAFE_SEARCH_RULE_ID_START && 
                     rule.id < CONSTANTS.RULES.USER_RULE_ID_START)
      .map(rule => rule.id);
    
    const updates: chrome.declarativeNetRequest.UpdateRuleOptions = {
      removeRuleIds: safeSearchRuleIds,
    };
    
    if (enabled) {
      const rules = customRules || generateSafeSearchRules();
      updates.addRules = rules;
    }
    
    await browser.declarativeNetRequest.updateDynamicRules(updates);
    
    logger.info('safe-search', `Safe search ${enabled ? 'enabled' : 'disabled'}`, {
      removed: safeSearchRuleIds.length,
      added: enabled ? (updates.addRules?.length || 0) : 0,
    });
    
  } catch (error) {
    logger.error('safe-search', 'Failed to update safe search rules', error);
  }
}

// Generate DNR rules for safe search
function generateSafeSearchRules(): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = CONSTANTS.RULES.SAFE_SEARCH_RULE_ID_START;
  
  // Google safe search
  rules.push({
    id: ruleId++,
    priority: 10,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        regexSubstitution: 'https://www.google.\\1/search?\\2&safe=active',
      },
    },
    condition: {
      regexFilter: '^https://www\\.google\\.([a-z.]+)/search\\?(.*)(?<!&safe=active)$',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  });
  
  // Bing safe search
  rules.push({
    id: ruleId++,
    priority: 10,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        regexSubstitution: 'https://www.bing.com/search?\\1&adlt=strict',
      },
    },
    condition: {
      regexFilter: '^https://www\\.bing\\.com/search\\?(.*)(?<!&adlt=strict)$',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  });
  
  // DuckDuckGo safe search
  rules.push({
    id: ruleId++,
    priority: 10,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        regexSubstitution: 'https://duckduckgo.com/?\\1&safe-search=strict',
      },
    },
    condition: {
      regexFilter: '^https://duckduckgo\\.com/\\?(.*)(?<!&safe-search=strict)$',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  });
  
  return rules;
}

// Setup YouTube restricted mode (requires content script)
async function setupYouTubeRestrictions(): Promise<void> {
  try {
    // YouTube restricted mode requires setting cookies and URL parameters
    // This is handled via content script injection
    
    const script = `
      (function() {
        try {
          // Set restricted mode cookie
          document.cookie = 'PREF=f2=8000000; domain=.youtube.com; path=/';
          
          // Redirect if not already in restricted mode
          const url = new URL(window.location.href);
          if (!url.searchParams.has('restrict_mode') || url.searchParams.get('restrict_mode') !== '1') {
            url.searchParams.set('restrict_mode', '1');
            if (window.location.href !== url.toString()) {
              window.location.replace(url.toString());
            }
          }
        } catch (e) {
          console.warn('YouTube restriction setup failed:', e);
        }
      })();
    `;
    
    // Register content script for YouTube
    if (browser.scripting) {
      await browser.scripting.registerContentScripts([{
        id: 'youtube-restrictions',
        matches: ['*://*.youtube.com/*'],
        js: [{ code: script }],
        runAt: 'document_start',
        allFrames: false,
      }]).catch(() => {
        // Ignore errors if already registered
      });
    }
    
    logger.debug('safe-search', 'YouTube restrictions configured');
    
  } catch (error) {
    logger.warn('safe-search', 'YouTube restrictions setup failed', error);
  }
}

// WebRequest-based safe search for Firefox
async function setupWebRequestSafeSearch(): Promise<void> {
  if (typeof browser.webRequest === 'undefined') {
    logger.warn('safe-search', 'webRequest API not available');
    return;
  }

  try {
    // Remove existing listeners
    if (browser.webRequest.onBeforeRequest.hasListener(handleSearchRequest)) {
      browser.webRequest.onBeforeRequest.removeListener(handleSearchRequest);
    }
    
    // Add new listener
    browser.webRequest.onBeforeRequest.addListener(
      handleSearchRequest,
      {
        urls: [
          '*://www.google.*/search?*',
          '*://www.bing.com/search?*',
          '*://duckduckgo.com/?*',
          '*://www.youtube.com/*',
        ],
        types: ['main_frame'],
      },
      ['blocking']
    );
    
    logger.info('safe-search', 'WebRequest safe search listeners configured');
    
  } catch (error) {
    logger.error('safe-search', 'WebRequest safe search setup failed', error);
  }
}

// Handle search requests (Firefox webRequest)
function handleSearchRequest(details: any): any {
  try {
    const url = new URL(details.url);
    let needsRedirect = false;
    
    // Google safe search
    if (url.hostname.includes('google.') && url.pathname === '/search') {
      if (!url.searchParams.has('safe') || url.searchParams.get('safe') !== 'active') {
        url.searchParams.set('safe', 'active');
        needsRedirect = true;
      }
    }
    
    // Bing safe search
    if (url.hostname === 'www.bing.com' && url.pathname === '/search') {
      if (!url.searchParams.has('adlt') || url.searchParams.get('adlt') !== 'strict') {
        url.searchParams.set('adlt', 'strict');
        needsRedirect = true;
      }
    }
    
    // DuckDuckGo safe search
    if (url.hostname === 'duckduckgo.com' && url.pathname === '/') {
      if (!url.searchParams.has('safe-search') || url.searchParams.get('safe-search') !== 'strict') {
        url.searchParams.set('safe-search', 'strict');
        needsRedirect = true;
      }
    }
    
    // YouTube restrictions
    if (url.hostname === 'www.youtube.com') {
      if (!url.searchParams.has('restrict_mode') || url.searchParams.get('restrict_mode') !== '1') {
        url.searchParams.set('restrict_mode', '1');
        needsRedirect = true;
      }
    }
    
    if (needsRedirect) {
      logger.debug('safe-search', 'Redirecting to safe search', { 
        from: details.url, 
        to: url.toString() 
      });
      
      return { redirectUrl: url.toString() };
    }
    
  } catch (error) {
    logger.error('safe-search', 'Search request handling failed', error);
  }
  
  return {};
}

// Test if safe search is active for a URL
export async function testSafeSearchStatus(url: string): Promise<{ active: boolean; provider?: string }> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Google
    if (hostname.includes('google.')) {
      const safeParam = urlObj.searchParams.get('safe');
      return {
        active: safeParam === 'active' || safeParam === 'strict',
        provider: 'google',
      };
    }
    
    // Bing
    if (hostname === 'www.bing.com') {
      const adltParam = urlObj.searchParams.get('adlt');
      return {
        active: adltParam === 'strict',
        provider: 'bing',
      };
    }
    
    // DuckDuckGo
    if (hostname === 'duckduckgo.com') {
      const safeParam = urlObj.searchParams.get('safe-search');
      return {
        active: safeParam === 'strict',
        provider: 'duckduckgo',
      };
    }
    
    // YouTube
    if (hostname === 'www.youtube.com') {
      const restrictParam = urlObj.searchParams.get('restrict_mode');
      return {
        active: restrictParam === '1',
        provider: 'youtube',
      };
    }
    
    return { active: false };
    
  } catch (error) {
    logger.error('safe-search', 'Failed to test safe search status', error);
    return { active: false };
  }
}

// Disable safe search enforcement
export async function disableSafeSearch(): Promise<void> {
  try {
    await updateSafeSearchRules(false);
    
    // Remove webRequest listeners
    if (browser.webRequest?.onBeforeRequest.hasListener(handleSearchRequest)) {
      browser.webRequest.onBeforeRequest.removeListener(handleSearchRequest);
    }
    
    // Remove YouTube content script
    if (browser.scripting) {
      await browser.scripting.unregisterContentScripts({
        ids: ['youtube-restrictions'],
      }).catch(() => {
        // Ignore errors if not registered
      });
    }
    
    logger.info('safe-search', 'Safe search enforcement disabled');
    
  } catch (error) {
    logger.error('safe-search', 'Failed to disable safe search', error);
  }
}

// Get safe search statistics
export async function getSafeSearchStats(): Promise<any> {
  try {
    if (!supportsDeclarativeNetRequest()) {
      return { enabled: false, method: 'webRequest' };
    }

    const rules = await browser.declarativeNetRequest.getDynamicRules();
    const safeSearchRules = rules.filter(rule => 
      rule.id >= CONSTANTS.RULES.SAFE_SEARCH_RULE_ID_START && 
      rule.id < CONSTANTS.RULES.USER_RULE_ID_START
    );
    
    return {
      enabled: safeSearchRules.length > 0,
      method: 'declarativeNetRequest',
      rulesCount: safeSearchRules.length,
    };
  } catch (error) {
    logger.error('safe-search', 'Failed to get safe search stats', error);
    return { enabled: false, error: error.message };
  }
}
