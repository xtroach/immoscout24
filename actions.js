/**
 * ImmoScan24 - Actions Module
 * Extensible action system for responding to new listing IDs
 */

const ACTIONS = {
  /**
   * Play sound notification
   */
  playSound: async (data) => {
    console.log('[ImmoScan24 Actions] Playing sound for new IDs:', data.newIds);

    // Noticeable but pleasant notification sound
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YToAAAAgQGBweH+AgIB/eHBgQCAgICAgICAgICAgICAgICAgQGBweH+AgIB/eHBgQCA=';

    try {
      await audio.play();
    } catch (error) {
      console.error('[ImmoScan24 Actions] Failed to play sound:', error);
    }
  },

  /**
   * Send browser notification
   */
  sendNotification: async (data) => {
    console.log('[ImmoScan24 Actions] Sending notification for new IDs:', data.newIds);

    const count = data.newIds.length;
    const message = count === 1
      ? `Found 1 new listing!`
      : `Found ${count} new listings!`;

    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-on-48.png'),
        title: 'ImmoScan24',
        message: message
      });
    } catch (error) {
      console.error('[ImmoScan24 Actions] Failed to send notification:', error);
    }
  },

  openInTab: async (data) => {
    console.log('[ImmoScan24 Actions] Opening new IDs in tabs:', data.newIds);

    const settings = await Storage.getSettings();

    for (const id of data.newIds) {
      const tab = await browser.tabs.create({
        url: `https://www.immobilienscout24.de/expose/${id}`,
        active: false
      });

      // If auto-click is enabled, send message to content script when loaded
      if (settings.autoClickEnabled) {
        const listener = async (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            browser.tabs.onUpdated.removeListener(listener);

            // Send auto-click message to content script
            try {
              await browser.tabs.sendMessage(tab.id, {
                type: 'AUTO_CLICK',
                firstSelector: settings.firstClickSelector,
                secondSelector: settings.secondClickSelector,
                delay: settings.clickDelay,
                captchaSelectors: settings.captchaSelectors || [],
                captchaSoundEnabled: settings.captchaSoundEnabled
              });
              console.log(`[ImmoScan24 Actions] Auto-click message sent to tab ${tab.id}`);
            } catch (error) {
              console.error('[ImmoScan24 Actions] Failed to send auto-click message:', error);
            }
          }
        };

        browser.tabs.onUpdated.addListener(listener);
      }
    }
  }
};

/**
 * Execute all enabled actions for new IDs
 */
async function executeActions(newIds, context) {
  if (newIds.length === 0) return;

  const settings = await Storage.getSettings();

  for (const [actionName, actionFn] of Object.entries(ACTIONS)) {
    if (settings.actionsEnabled && settings.actionsEnabled[actionName]) {
      try {
        await actionFn({ newIds, context });
      } catch (error) {
        console.error(`[ImmoScan24 Actions] Error executing ${actionName}:`, error);
      }
    }
  }
}

// Export for use in background script
if (typeof window !== 'undefined') {
  window.executeActions = executeActions;
  window.ACTIONS = ACTIONS;
}
