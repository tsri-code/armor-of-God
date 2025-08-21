/**
 * Alarm management for scheduled tasks
 * Handles daily verse updates, schedule enforcement, and cleanup tasks
 */

import browser from '../lib/browser';
import { storage } from '../lib/storage';
import { logger } from '../lib/log';
import { fetchVerseOfDay } from './verse-service';
import { applyUserRules } from './rules-updater';
import { updateSafeSearchRules } from './safe-search';
import type { Schedule, Settings } from '@shared/index';

// Alarm names
export const ALARM_NAMES = {
  DAILY_VERSE: 'daily-verse-fetch',
  SCHEDULE_CHECK: 'schedule-check',
  CLEANUP: 'cleanup-cache',
  STATS_RESET: 'stats-reset',
} as const;

// Setup all alarms
export async function setupAlarms(): Promise<void> {
  try {
    logger.info('alarms', 'Setting up extension alarms');
    
    // Clear existing alarms
    await browser.alarms.clearAll();
    
    // Daily verse alarm - fetch new verse at midnight
    await browser.alarms.create(ALARM_NAMES.DAILY_VERSE, {
      when: getNextMidnight(),
      periodInMinutes: 24 * 60, // 24 hours
    });
    
    // Schedule check - every 5 minutes
    await browser.alarms.create(ALARM_NAMES.SCHEDULE_CHECK, {
      delayInMinutes: 1, // Start in 1 minute
      periodInMinutes: 5,
    });
    
    // Weekly cleanup - every Sunday at 3 AM
    await browser.alarms.create(ALARM_NAMES.CLEANUP, {
      when: getNextWeeklyTime(0, 3, 0), // Sunday 3:00 AM
      periodInMinutes: 7 * 24 * 60, // Weekly
    });
    
    logger.info('alarms', 'Alarms configured successfully');
    
  } catch (error) {
    logger.error('alarms', 'Failed to setup alarms', error);
  }
}

// Handle alarm events
export async function handleAlarm(alarm: browser.Alarms.Alarm): Promise<void> {
  logger.debug('alarms', 'Alarm triggered', { name: alarm.name });
  
  try {
    switch (alarm.name) {
      case ALARM_NAMES.DAILY_VERSE:
        await handleDailyVerse();
        break;
        
      case ALARM_NAMES.SCHEDULE_CHECK:
        await handleScheduleCheck();
        break;
        
      case ALARM_NAMES.CLEANUP:
        await handleCleanup();
        break;
        
      case ALARM_NAMES.STATS_RESET:
        await handleStatsReset();
        break;
        
      default:
        // Handle dynamic schedule alarms
        if (alarm.name.startsWith('schedule-')) {
          await handleScheduleAlarm(alarm);
        } else {
          logger.warn('alarms', 'Unknown alarm', { name: alarm.name });
        }
    }
  } catch (error) {
    logger.error('alarms', 'Alarm handler failed', { name: alarm.name }, error);
  }
}

// Handle daily verse fetch
async function handleDailyVerse(): Promise<void> {
  try {
    logger.info('alarms', 'Fetching daily verse');
    
    await fetchVerseOfDay();
    
    // Notify UI components
    const verse = await storage.getCachedVerse();
    if (verse) {
      // Send message to popup/options if open
      browser.runtime.sendMessage({
        type: 'VERSE_UPDATED',
        data: verse,
      }).catch(() => {
        // Ignore if no receivers
      });
    }
    
    logger.info('alarms', 'Daily verse updated');
    
  } catch (error) {
    logger.error('alarms', 'Daily verse fetch failed', error);
  }
}

// Handle schedule checks
async function handleScheduleCheck(): Promise<void> {
  try {
    const settings = await storage.getSettings();
    
    if (!settings.enabled || !settings.schedules || settings.schedules.length === 0) {
      return;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday
    
    let activeSchedule: Schedule | null = null;
    
    // Find active schedule
    for (const schedule of settings.schedules) {
      if (!schedule.enabled || !schedule.days.includes(currentDay)) {
        continue;
      }
      
      const startTime = parseTimeString(schedule.startTime);
      const endTime = parseTimeString(schedule.endTime);
      
      // Handle overnight schedules (end < start)
      const isActive = endTime > startTime 
        ? currentTime >= startTime && currentTime < endTime
        : currentTime >= startTime || currentTime < endTime;
      
      if (isActive) {
        activeSchedule = schedule;
        break;
      }
    }
    
    await applyScheduleSettings(activeSchedule);
    
  } catch (error) {
    logger.error('alarms', 'Schedule check failed', error);
  }
}

// Handle weekly cleanup
async function handleCleanup(): Promise<void> {
  try {
    logger.info('alarms', 'Running weekly cleanup');
    
    // Cleanup old cached verses
    await storage.cleanupOldCache();
    
    // Cleanup old logs
    const logs = await logger.getLogs(100);
    if (logs.length > 100) {
      // Keep only recent 50 logs
      await storage.set('logs', logs.slice(0, 50));
    }
    
    logger.info('alarms', 'Cleanup completed');
    
  } catch (error) {
    logger.error('alarms', 'Cleanup failed', error);
  }
}

// Handle stats reset
async function handleStatsReset(): Promise<void> {
  try {
    logger.info('alarms', 'Resetting daily/weekly stats');
    
    const stats = await logger.getStats();
    
    // Reset daily stats at midnight
    stats.blocksToday = 0;
    stats.lastReset = Date.now();
    
    await storage.set('stats', stats);
    
    logger.info('alarms', 'Stats reset completed');
    
  } catch (error) {
    logger.error('alarms', 'Stats reset failed', error);
  }
}

// Handle schedule-specific alarms
async function handleScheduleAlarm(alarm: browser.Alarms.Alarm): Promise<void> {
  try {
    const scheduleId = alarm.name.replace('schedule-', '').replace('-start', '').replace('-end', '');
    const isStart = alarm.name.includes('-start');
    
    logger.info('alarms', `Schedule ${isStart ? 'start' : 'end'}`, { scheduleId });
    
    if (isStart) {
      // Schedule starting - apply strict settings
      const settings = await storage.getSettings();
      const schedule = settings.schedules?.find(s => s.id === scheduleId);
      
      if (schedule) {
        await applyScheduleSettings(schedule);
      }
    } else {
      // Schedule ending - revert to normal settings
      await applyScheduleSettings(null);
    }
    
  } catch (error) {
    logger.error('alarms', 'Schedule alarm failed', error);
  }
}

// Apply schedule-specific settings
async function applyScheduleSettings(schedule: Schedule | null): Promise<void> {
  try {
    const currentSettings = await storage.getSettings();
    
    if (!schedule) {
      // Revert to normal settings if no active schedule
      logger.debug('alarms', 'No active schedule - using normal settings');
      return;
    }
    
    logger.info('alarms', 'Applying schedule settings', { 
      schedule: schedule.name,
      strictMode: schedule.strictMode 
    });
    
    // Create temporary settings for this schedule
    const scheduleSettings: Partial<Settings> = {
      ...currentSettings,
      modules: {
        ...currentSettings.modules,
        ...schedule.modules,
      },
    };
    
    // If strict mode, enable all protection modules
    if (schedule.strictMode) {
      scheduleSettings.modules = {
        imageScanning: true,
        videoScanning: true,
        textFiltering: true,
        safeSearch: true,
        urlBlocking: true,
      };
      
      scheduleSettings.thresholds = {
        blur: 0.5, // Lower threshold = more sensitive
        block: 0.7,
        warning: 0.3,
      };
    }
    
    // Apply the changes
    if (scheduleSettings.modules?.urlBlocking !== currentSettings.modules?.urlBlocking) {
      await applyUserRules();
    }
    
    if (scheduleSettings.modules?.safeSearch !== currentSettings.modules?.safeSearch) {
      await updateSafeSearchRules(scheduleSettings.modules.safeSearch || false);
    }
    
    // Note: We don't actually save these to storage since they're temporary
    // Content scripts will check the current schedule when scanning
    
  } catch (error) {
    logger.error('alarms', 'Failed to apply schedule settings', error);
  }
}

// Utility functions
function getNextMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

function getNextWeeklyTime(day: number, hour: number, minute: number = 0): number {
  const now = new Date();
  const target = new Date(now);
  
  // Calculate days until target day
  const daysUntilTarget = (day - now.getDay() + 7) % 7 || 7;
  target.setDate(now.getDate() + daysUntilTarget);
  target.setHours(hour, minute, 0, 0);
  
  // If target time already passed today and it's the target day, move to next week
  if (daysUntilTarget === 7 && target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  
  return target.getTime();
}

function parseTimeString(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Setup schedule-specific alarms
export async function setupScheduleAlarms(): Promise<void> {
  try {
    const settings = await storage.getSettings();
    
    if (!settings.schedules || settings.schedules.length === 0) {
      return;
    }
    
    // Clear existing schedule alarms
    const allAlarms = await browser.alarms.getAll();
    const scheduleAlarms = allAlarms.filter(alarm => alarm.name.startsWith('schedule-'));
    
    for (const alarm of scheduleAlarms) {
      await browser.alarms.clear(alarm.name);
    }
    
    // Create new schedule alarms
    for (const schedule of settings.schedules) {
      if (!schedule.enabled) continue;
      
      for (const day of schedule.days) {
        const startTime = parseTimeString(schedule.startTime);
        const endTime = parseTimeString(schedule.endTime);
        
        const startHour = Math.floor(startTime / 60);
        const startMinute = startTime % 60;
        const endHour = Math.floor(endTime / 60);
        const endMinute = endTime % 60;
        
        // Create start alarm
        await browser.alarms.create(`schedule-${schedule.id}-start`, {
          when: getNextWeeklyTime(day, startHour, startMinute),
          periodInMinutes: 7 * 24 * 60, // Weekly
        });
        
        // Create end alarm
        await browser.alarms.create(`schedule-${schedule.id}-end`, {
          when: getNextWeeklyTime(day, endHour, endMinute),
          periodInMinutes: 7 * 24 * 60, // Weekly
        });
      }
    }
    
    logger.info('alarms', 'Schedule alarms configured', { 
      schedules: settings.schedules.length 
    });
    
  } catch (error) {
    logger.error('alarms', 'Failed to setup schedule alarms', error);
  }
}

// Get current active schedule
export async function getCurrentActiveSchedule(): Promise<Schedule | null> {
  try {
    const settings = await storage.getSettings();
    
    if (!settings.enabled || !settings.schedules || settings.schedules.length === 0) {
      return null;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();
    
    for (const schedule of settings.schedules) {
      if (!schedule.enabled || !schedule.days.includes(currentDay)) {
        continue;
      }
      
      const startTime = parseTimeString(schedule.startTime);
      const endTime = parseTimeString(schedule.endTime);
      
      const isActive = endTime > startTime 
        ? currentTime >= startTime && currentTime < endTime
        : currentTime >= startTime || currentTime < endTime;
      
      if (isActive) {
        return schedule;
      }
    }
    
    return null;
    
  } catch (error) {
    logger.error('alarms', 'Failed to get current schedule', error);
    return null;
  }
}
