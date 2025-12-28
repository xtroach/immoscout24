/**
 * ImmoScan24 - Storage Module
 * Handles persistent data storage for settings, seen IDs, and toggle states
 */

const STORAGE_KEYS = {
  SETTINGS: 'settings',
  SEEN_IDS: 'seenIds',
  LAST_SCAN_TIME: 'lastScanTime',
  TOGGLE_STATES: 'toggleStates'
};

const DEFAULT_SETTINGS = {
  refreshInterval: 60,           // seconds
  maxTimeSinceLastScan: 10,      // minutes
  actionsEnabled: {
    playSound: true,
    sendNotification: true,
    openInTab: false
  },
  autoClickEnabled: false,
  firstClickSelector: '[data-qa="sendButton"]',        // CSS selector for first link to click
  secondClickSelector: '.grid > [type="submit"]',       // CSS selector for second link to click
  clickDelay: 2000,              // milliseconds between clicks
  captchaSelectors: [],          // Array of CSS selectors to detect captcha
  captchaSoundEnabled: true,     // Play different sound when captcha detected
  captchaReminderInterval: 60    // seconds - how often to repeat captcha alert
};

const DEFAULT_DATA = {
  seenIds: [],
  lastScanTime: null
};

const Storage = {
  // Settings management
  async getSettings() {
    const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  },

  async saveSettings(settings) {
    await browser.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...settings }
    });
  },

  async resetSettings() {
    await browser.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
    });
  },

  // Seen IDs management
  async getSeenIds() {
    const result = await browser.storage.local.get(STORAGE_KEYS.SEEN_IDS);
    return result[STORAGE_KEYS.SEEN_IDS] || DEFAULT_DATA.seenIds;
  },

  async addSeenIds(ids) {
    const seenIds = await this.getSeenIds();
    const newIds = ids.filter(id => !seenIds.includes(id));

    if (newIds.length > 0) {
      const updatedIds = [...seenIds, ...newIds];

      // Limit array size to last 10000 IDs
      const limitedIds = updatedIds.length > 10000
        ? updatedIds.slice(-10000)
        : updatedIds;

      await browser.storage.local.set({
        [STORAGE_KEYS.SEEN_IDS]: limitedIds
      });
    }
  },

  async isIdSeen(id) {
    const seenIds = await this.getSeenIds();
    return seenIds.includes(id);
  },

  async clearSeenIds() {
    await browser.storage.local.set({
      [STORAGE_KEYS.SEEN_IDS]: []
    });
  },

  // Last scan time management
  async getLastScanTime() {
    const result = await browser.storage.local.get(STORAGE_KEYS.LAST_SCAN_TIME);
    return result[STORAGE_KEYS.LAST_SCAN_TIME] || DEFAULT_DATA.lastScanTime;
  },

  async updateLastScanTime() {
    await browser.storage.local.set({
      [STORAGE_KEYS.LAST_SCAN_TIME]: Date.now()
    });
  },

  // Toggle state management (per-tab)
  async getToggleState(tabId) {
    const result = await browser.storage.local.get(STORAGE_KEYS.TOGGLE_STATES);
    const toggleStates = result[STORAGE_KEYS.TOGGLE_STATES] || {};
    return toggleStates[tabId] || false;
  },

  async setToggleState(tabId, enabled) {
    const result = await browser.storage.local.get(STORAGE_KEYS.TOGGLE_STATES);
    const toggleStates = result[STORAGE_KEYS.TOGGLE_STATES] || {};
    toggleStates[tabId] = enabled;
    await browser.storage.local.set({
      [STORAGE_KEYS.TOGGLE_STATES]: toggleStates
    });
  },

  async clearToggleState(tabId) {
    const result = await browser.storage.local.get(STORAGE_KEYS.TOGGLE_STATES);
    const toggleStates = result[STORAGE_KEYS.TOGGLE_STATES] || {};
    delete toggleStates[tabId];
    await browser.storage.local.set({
      [STORAGE_KEYS.TOGGLE_STATES]: toggleStates
    });
  },

  // Clear all data
  async clearAll() {
    await browser.storage.local.clear();
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Storage = Storage;
  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
}
