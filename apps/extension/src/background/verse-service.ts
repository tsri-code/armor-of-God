/**
 * Verse service for fetching daily BSB verses
 * Communicates with the serverless worker API
 */

import { storage } from '../lib/storage';
import { logger } from '../lib/log';
import { EXTENSION_CONSTANTS } from '../lib/types';
import type { Verse } from '@shared/index';
import versePlan from '../data/verse-plan.json';

// Fetch verse of the day
export async function fetchVerseOfDay(date?: string): Promise<Verse | null> {
  try {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    logger.info('verse-service', 'Fetching verse of the day', { date: targetDate });
    
    // Check cache first
    const cached = await storage.getCachedVerse(targetDate);
    if (cached) {
      logger.debug('verse-service', 'Using cached verse', { reference: cached.reference });
      return cached;
    }
    
    // Try API first
    let verse = await fetchFromAPI(targetDate);
    
    // Fallback to local plan if API fails
    if (!verse) {
      verse = await getVerseFromLocalPlan(targetDate);
    }
    
    if (verse) {
      // Cache the verse
      await storage.cacheVerse(verse);
      logger.info('verse-service', 'Verse cached', { reference: verse.reference });
    }
    
    return verse;
    
  } catch (error) {
    logger.error('verse-service', 'Failed to fetch verse of the day', error);
    
    // Try fallback
    try {
      return await getVerseFromLocalPlan(date);
    } catch (fallbackError) {
      logger.error('verse-service', 'Fallback verse failed', fallbackError);
      return null;
    }
  }
}

// Fetch verse from worker API
async function fetchFromAPI(date: string): Promise<Verse | null> {
  try {
    const url = `${EXTENSION_CONSTANTS.WORKER_URL}/votd?d=${encodeURIComponent(date)}`;
    
    logger.debug('verse-service', 'Fetching from API', { url });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // No credentials to maintain privacy
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.reference || !data.text) {
      throw new Error('Invalid API response format');
    }
    
    const verse: Verse = {
      reference: data.reference,
      text: data.text.trim(),
      copyright: data.copyright || 'Scripture text © Berean Standard Bible. Used by permission.',
      date,
    };
    
    logger.info('verse-service', 'Verse fetched from API', { 
      reference: verse.reference,
      length: verse.text.length 
    });
    
    return verse;
    
  } catch (error) {
    logger.warn('verse-service', 'API fetch failed', error);
    return null;
  }
}

// Fetch specific passage from API
export async function fetchPassage(reference: string): Promise<Verse | null> {
  try {
    const url = `${EXTENSION_CONSTANTS.WORKER_URL}/passage?ref=${encodeURIComponent(reference)}`;
    
    logger.debug('verse-service', 'Fetching passage from API', { reference });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.reference || !data.text) {
      throw new Error('Invalid API response format');
    }
    
    const verse: Verse = {
      reference: data.reference,
      text: data.text.trim(),
      copyright: data.copyright || 'Scripture text © Berean Standard Bible. Used by permission.',
    };
    
    logger.info('verse-service', 'Passage fetched from API', { 
      reference: verse.reference,
      length: verse.text.length 
    });
    
    return verse;
    
  } catch (error) {
    logger.error('verse-service', 'Failed to fetch passage', error);
    return null;
  }
}

// Get verse from local plan (fallback)
async function getVerseFromLocalPlan(date?: string): Promise<Verse | null> {
  try {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    // Calculate day of year for consistent verse selection
    const dateObj = new Date(targetDate);
    const start = new Date(dateObj.getFullYear(), 0, 0);
    const diff = dateObj.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Use modulo to wrap around if we have fewer verses than days
    const verseIndex = (dayOfYear - 1) % versePlan.length;
    const reference = versePlan[verseIndex];
    
    if (!reference) {
      throw new Error('No reference found in local plan');
    }
    
    logger.info('verse-service', 'Using local verse plan', { 
      reference,
      dayOfYear,
      verseIndex 
    });
    
    // Return verse with placeholder text
    const verse: Verse = {
      reference,
      text: `Today's verse: ${reference}. Scripture text is available when connected to the internet.`,
      copyright: 'Scripture text © Berean Standard Bible. Used by permission.',
      date: targetDate,
    };
    
    return verse;
    
  } catch (error) {
    logger.error('verse-service', 'Local plan fallback failed', error);
    return null;
  }
}

// Prefetch tomorrow's verse
export async function prefetchTomorrowVerse(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);
    
    const cached = await storage.getCachedVerse(tomorrowDate);
    if (cached) {
      return; // Already cached
    }
    
    logger.info('verse-service', 'Prefetching tomorrow verse', { date: tomorrowDate });
    
    const verse = await fetchFromAPI(tomorrowDate);
    if (verse) {
      await storage.cacheVerse(verse);
      logger.info('verse-service', 'Tomorrow verse prefetched', { reference: verse.reference });
    }
    
  } catch (error) {
    logger.debug('verse-service', 'Prefetch failed (non-critical)', error);
  }
}

// Get verse for specific day of year
export function getVerseReferenceForDay(dayOfYear: number): string {
  const index = (dayOfYear - 1) % versePlan.length;
  return versePlan[index] || versePlan[0];
}

// Get all verse references from plan
export function getAllVerseReferences(): string[] {
  return [...versePlan];
}

// Validate verse data
function validateVerse(data: any): data is Verse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.reference === 'string' &&
    typeof data.text === 'string' &&
    data.reference.length > 0 &&
    data.text.length > 0
  );
}

// Format verse for display
export function formatVerse(verse: Verse, options: { compact?: boolean } = {}): string {
  if (!verse) return '';
  
  const { compact = false } = options;
  
  if (compact) {
    return `"${verse.text}" — ${verse.reference}`;
  }
  
  return `${verse.text}\n\n— ${verse.reference} (BSB)`;
}

// Get verse sharing text
export function getVerseShareText(verse: Verse): string {
  if (!verse) return '';
  
  return `${verse.text}\n\n— ${verse.reference} (Berean Standard Bible)\n\nShared via Armor of God extension`;
}

// Check if API is available
export async function checkAPIHealth(): Promise<{ available: boolean; latency?: number }> {
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${EXTENSION_CONSTANTS.WORKER_URL}/votd?d=2024-01-01`, {
      method: 'HEAD',
      credentials: 'omit',
    });
    
    const latency = Date.now() - startTime;
    
    return {
      available: response.ok,
      latency,
    };
    
  } catch (error) {
    logger.debug('verse-service', 'API health check failed', error);
    return { available: false };
  }
}

// Clear verse cache
export async function clearVerseCache(): Promise<void> {
  try {
    const all = await browser.storage.local.get(null);
    const verseKeys = Object.keys(all).filter(key => key.startsWith('verse_cache_'));
    
    if (verseKeys.length > 0) {
      await browser.storage.local.remove(verseKeys);
      logger.info('verse-service', 'Verse cache cleared', { count: verseKeys.length });
    }
    
  } catch (error) {
    logger.error('verse-service', 'Failed to clear verse cache', error);
  }
}

// Get cache statistics
export async function getVerseCacheStats(): Promise<{ count: number; size: number; oldest?: string; newest?: string }> {
  try {
    const all = await browser.storage.local.get(null);
    const verseEntries = Object.entries(all)
      .filter(([key]) => key.startsWith('verse_cache_'))
      .map(([key, value]) => ({
        key,
        date: key.replace('verse_cache_', ''),
        value: value as any,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const size = JSON.stringify(verseEntries).length;
    
    return {
      count: verseEntries.length,
      size,
      oldest: verseEntries[0]?.date,
      newest: verseEntries[verseEntries.length - 1]?.date,
    };
    
  } catch (error) {
    logger.error('verse-service', 'Failed to get cache stats', error);
    return { count: 0, size: 0 };
  }
}
