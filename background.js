/**
 * ImmoScan24 - Background Script
 * Manages extension state, icon updates, and message handling
 */

/**
 * Check if URL is on ImmoScout24 domain
 */
function isImmoScout24Domain(url) {
  return url && url.includes('immobilienscout24.de');
}

/**
 * Get alarm name for a specific tab
 */
function getAlarmName(tabId) {
  return `immoscan24-tab-${tabId}`;
}

/**
 * Create alarm for periodic page refresh
 */
async function createAlarm(tabId) {
  const settings = await Storage.getSettings();
  const alarmName = getAlarmName(tabId);

  // Create alarm that fires every refreshInterval seconds
  await browser.alarms.create(alarmName, {
    periodInMinutes: settings.refreshInterval / 60
  });

  console.log(`[ImmoScan24] Created alarm for tab ${tabId} (every ${settings.refreshInterval}s)`);
}

/**
 * Delete alarm for a tab
 */
async function deleteAlarm(tabId) {
  const alarmName = getAlarmName(tabId);
  await browser.alarms.clear(alarmName);
  console.log(`[ImmoScan24] Deleted alarm for tab ${tabId}`);
}

/**
 * Get captcha reminder alarm name for a specific tab
 */
function getCaptchaAlarmName(tabId) {
  return `immoscan24-captcha-${tabId}`;
}

/**
 * Create alarm for captcha reminder
 */
async function createCaptchaAlarm(tabId) {
  const settings = await Storage.getSettings();
  const alarmName = getCaptchaAlarmName(tabId);
  if (settings.captchaReminderInterval == 0)
  {
    return;
  }
  // Create alarm that fires every captchaReminderInterval seconds
  await browser.alarms.create(alarmName, {
    periodInMinutes: settings.captchaReminderInterval / 60
  });

  console.log(`[ImmoScan24] Created captcha alarm for tab ${tabId} (every ${settings.captchaReminderInterval}s)`);
}

/**
 * Delete captcha reminder alarm for a tab
 */
async function deleteCaptchaAlarm(tabId) {
  const alarmName = getCaptchaAlarmName(tabId);
  await browser.alarms.clear(alarmName);
  console.log(`[ImmoScan24] Deleted captcha alarm for tab ${tabId}`);
}

/**
 * Update browser action icon based on domain and toggle state
 */
async function updateIcon(tabId, enabled, url) {
  let iconName;
  let title;

  if (!isImmoScout24Domain(url)) {
    // Not on IS24 domain - use disabled icon
    iconName = 'icon-disabled';
    title = 'ImmoScan24 (Not available)';
  } else if (enabled) {
    // On IS24 and monitoring active - use on icon
    iconName = 'icon-on';
    title = 'ImmoScan24 (ON)';
  } else {
    // On IS24 but monitoring disabled - use off icon
    iconName = 'icon-off';
    title = 'ImmoScan24 (OFF)';
  }

  await browser.browserAction.setIcon({
    path: {
      48: `icons/${iconName}-48.png`,
      96: `icons/${iconName}-96.png`
    },
    tabId
  });
  await browser.browserAction.setTitle({
    title: title,
    tabId
  });
}

/**
 * Toggle extension for a specific tab
 */
async function toggleExtension(tab) {
  if (!isImmoScout24Domain(tab.url)) {
    console.log('[ImmoScan24] Not on ImmoScout24 domain, ignoring toggle');
    return;
  }

  const currentState = await Storage.getToggleState(tab.id);
  const newState = !currentState;

  await Storage.setToggleState(tab.id, newState);
  await updateIcon(tab.id, newState, tab.url);

  // Manage alarm
  if (newState) {
    await createAlarm(tab.id);
  } else {
    await deleteAlarm(tab.id);
  }

  // Notify content script
  try {
    await browser.tabs.sendMessage(tab.id, {
      type: newState ? 'ENABLE' : 'DISABLE'
    });
  } catch (error) {
    console.error('[ImmoScan24] Failed to send message to content script:', error);
  }

  console.log(`[ImmoScan24] Extension ${newState ? 'enabled' : 'disabled'} for tab ${tab.id}`);
}

/**
 * Message handlers
 */
const messageHandlers = {
  /**
   * Get toggle state for current tab
   */
  GET_STATE: async (message, sender) => {
    // Use tabId from message if provided (popup), otherwise from sender (content script)
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    const enabled = await Storage.getToggleState(tabId);
    return { enabled };
  },

  /**
   * Toggle extension for specified tab
   */
  TOGGLE: async (message) => {
    const tab = await browser.tabs.get(message.tabId);
    await toggleExtension(tab);
    return { success: true };
  },

  /**
   * Get current settings
   */
  GET_SETTINGS: async () => {
    const settings = await Storage.getSettings();
    return { settings };
  },

  /**
   * Close the tab that sent the message
   */
  CLOSE_TAB: async (message, sender) => {
    if (sender.tab && sender.tab.id) {
      console.log(`[ImmoScan24] Closing tab ${sender.tab.id} after successful auto-click`);
      await browser.tabs.remove(sender.tab.id);
      return { closed: true };
    }
    return { closed: false };
  },

  /**
   * Handle captcha detection
   */
  CAPTCHA_DETECTED: async (message, sender) => {
    const location = message.isMainPage ? 'main search page' : 'new listing tab';
    console.log(`[ImmoScan24] Captcha detected in tab ${sender.tab.id} on ${location}, selector:`, message.selector);

    if (message.playCaptchaSound) {
      // Play urgent, disruptive sound for captcha detection
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEg==';
      try {
        await audio.play();
        console.log('[ImmoScan24] Captcha sound played');
      } catch (error) {
        console.error('[ImmoScan24] Failed to play captcha sound:', error);
      }
    }

    // Send notification
    const notificationMessage = message.isMainPage
      ? 'Captcha detected on search page - monitoring paused'
      : 'Manual intervention required on new listing';

    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-on-48.png'),
      title: 'ImmoScan24 - Captcha Detected! ⚠️',
      message: notificationMessage
    });

    // If captcha on main page, optionally pause monitoring
    if (message.isMainPage) {
      console.warn('[ImmoScan24] Captcha on main page detected - scans will be skipped until resolved');
    }

    // Create repeating alarm to remind user about unresolved captcha
    await createCaptchaAlarm(sender.tab.id);

    return { received: true };
  },

  /**
   * Process new IDs found by content script
   */
  NEW_IDS_FOUND: async (message, sender) => {
    const { ids } = message;
    const settings = await Storage.getSettings();
    const lastScanTime = await Storage.getLastScanTime();
    const now = Date.now();

    console.log(`[ImmoScan24] Received ${ids.length} IDs from content script`);

    // Check time condition
    let shouldProcessNewIds = true;
    if (lastScanTime !== null) {
      const timeSinceLastScan = now - lastScanTime;
      const maxTime = settings.maxTimeSinceLastScan * 60 * 1000; // Convert minutes to ms

      shouldProcessNewIds = timeSinceLastScan <= maxTime;

      if (!shouldProcessNewIds) {
        console.log(`[ImmoScan24] Last scan was ${Math.round(timeSinceLastScan / 1000 / 60)} minutes ago (>${settings.maxTimeSinceLastScan} min), skipping actions`);
      }
    }

    // Update last scan time
    await Storage.updateLastScanTime();

    if (!shouldProcessNewIds) {
      return { processed: 0, skipped: true };
    }

    // Filter for truly new IDs
    const seenIds = await Storage.getSeenIds();
    const newIds = ids.filter(id => !seenIds.includes(id));

    console.log(`[ImmoScan24] Found ${newIds.length} new IDs out of ${ids.length} total`);

    if (newIds.length > 0) {
      // Add new IDs to database
      await Storage.addSeenIds(newIds);

      // Execute actions
      await executeActions(newIds, {
        url: sender.tab.url,
        tabId: sender.tab.id
      });

      console.log(`[ImmoScan24] Processed ${newIds.length} new IDs`);
    }

    return { processed: newIds.length, skipped: false };
  }
};

/**
 * Main message listener
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];

  if (handler) {
    handler(message, sender)
      .then(sendResponse)
      .catch(error => {
        console.error(`[ImmoScan24] Error handling message ${message.type}:`, error);
        sendResponse({ error: error.message });
      });
    return true; // Async response
  }

  console.warn('[ImmoScan24] Unknown message type:', message.type);
  return false;
});

/**
 * Browser action click listener
 * Note: Disabled because we use a popup instead
 */
// browser.browserAction.onClicked.addListener(toggleExtension);

/**
 * Tab navigation listener - auto-disable on URL change (not reload)
 */
browser.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame

  // Only disable if this is a navigation to a different URL (not a reload)
  // Check transition qualifiers to see if it's a reload
  const isReload = details.transitionQualifiers &&
                   details.transitionQualifiers.includes('forward_back');

  // If it's a reload, don't disable
  if (isReload) {
    console.log(`[ImmoScan24] Page reload detected for tab ${details.tabId}, keeping monitoring enabled`);
    return;
  }

  const enabled = await Storage.getToggleState(details.tabId);
  if (enabled) {
    // If we're still on immobilienscout24.de, this might be a reload
    // Only disable if domain changed
    if (!isImmoScout24Domain(details.url)) {
      await deleteAlarm(details.tabId);
      await Storage.setToggleState(details.tabId, false);
      await updateIcon(details.tabId, false, details.url);
      console.log(`[ImmoScan24] Auto-disabled extension for tab ${details.tabId} - navigated away from IS24`);
    }
  }
});

/**
 * Tab close listener - cleanup state and alarms
 */
browser.tabs.onRemoved.addListener(async (tabId) => {
  await deleteAlarm(tabId);
  await deleteCaptchaAlarm(tabId);
  await Storage.clearToggleState(tabId);
  console.log(`[ImmoScan24] Cleaned up tab ${tabId}`);
});

/**
 * Tab activation listener - update icon for current tab
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  const enabled = await Storage.getToggleState(activeInfo.tabId);
  await updateIcon(activeInfo.tabId, enabled, tab.url);
});

/**
 * Page load complete listener - update icon after reload
 */
browser.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame

  // Update icon based on current state and domain
  const enabled = await Storage.getToggleState(details.tabId);
  await updateIcon(details.tabId, enabled, details.url);
  console.log(`[ImmoScan24] Updated icon after page load for tab ${details.tabId}`);
});

/**
 * Alarm listener - handle both refresh and captcha reminder alarms
 */
browser.alarms.onAlarm.addListener(async (alarm) => {
  // Handle page refresh alarms
  if (alarm.name.startsWith('immoscan24-tab-')) {
    const tabId = parseInt(alarm.name.replace('immoscan24-tab-', ''));
    console.log(`[ImmoScan24] Refresh alarm fired for tab ${tabId}`);

    try {
      const tab = await browser.tabs.get(tabId);
      const enabled = await Storage.getToggleState(tabId);

      if (enabled && isImmoScout24Domain(tab.url)) {
        console.log(`[ImmoScan24] Reloading tab ${tabId}`);
        await browser.tabs.reload(tabId);
      } else {
        await deleteAlarm(tabId);
      }
    } catch (error) {
      console.log(`[ImmoScan24] Tab ${tabId} no longer exists, cleaning up alarm`);
      await browser.alarms.clear(alarm.name);
    }
  }

  // Handle captcha reminder alarms
  else if (alarm.name.startsWith('immoscan24-captcha-')) {
    const tabId = parseInt(alarm.name.replace('immoscan24-captcha-', ''));
    console.log(`[ImmoScan24] Captcha reminder alarm fired for tab ${tabId}`);

    try {
      const tab = await browser.tabs.get(tabId);
      const settings = await Storage.getSettings();

      // Ask content script if captcha is still present
      const response = await browser.tabs.sendMessage(tabId, {
        type: 'CHECK_CAPTCHA_STILL_PRESENT',
        captchaSelectors: settings.captchaSelectors
      });

      if (response && response.stillPresent) {
        console.log(`[ImmoScan24] Captcha still present on tab ${tabId}, playing reminder sound`);

        // Play captcha sound again
        if (settings.captchaSoundEnabled) {
          const audio = new Audio();
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEgxGnt7zw3coBS5/yvLIczwLEl2w6u2lURAMRqTi78NoFgU9j9ryzXAjBCx9yvHbgzoKF2a78d6VPAoSV6vh7adQEAxMp+TwtGkcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi779qgRwsKT6fl8blpGwY8mNv0z3YhBSh9zPLaizsKGGS56+qZTAwNVrHq77FYFQpDmt/twoQtBS2E0PLUgjEHHGy989+XPA0PWKvl7KdTEg==';
          try {
            await audio.play();
          } catch (error) {
            console.error('[ImmoScan24] Failed to play captcha reminder sound:', error);
          }
        }
      } else {
        console.log(`[ImmoScan24] Captcha resolved on tab ${tabId}, stopping reminders`);
        await deleteCaptchaAlarm(tabId);
      }
    } catch (error) {
      console.log(`[ImmoScan24] Tab ${tabId} no longer exists, cleaning up captcha alarm`);
      await browser.alarms.clear(alarm.name);
    }
  }
});

/**
 * Extension initialization
 */
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[ImmoScan24] Extension installed, initializing defaults');
    Storage.saveSettings(DEFAULT_SETTINGS);
  }
});

console.log('[ImmoScan24] Background script loaded');
