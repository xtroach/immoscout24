/**
 * ImmoScan24 - Settings Page Script
 */

/**
 * Load settings and populate form
 */
async function loadSettings() {
  try {
    const settings = await Storage.getSettings();

    document.getElementById('refreshInterval').value = settings.refreshInterval;
    document.getElementById('maxTimeSinceLastScan').value = settings.maxTimeSinceLastScan;
    document.getElementById('playSound').checked = settings.actionsEnabled.playSound;
    document.getElementById('sendNotification').checked = settings.actionsEnabled.sendNotification;
    document.getElementById('openInTab').checked = settings.actionsEnabled.openInTab;
    document.getElementById('autoClickEnabled').checked = settings.autoClickEnabled || false;
    document.getElementById('firstClickSelector').value = settings.firstClickSelector || '';
    document.getElementById('secondClickSelector').value = settings.secondClickSelector || '';
    document.getElementById('clickDelay').value = settings.clickDelay || 2000;
    document.getElementById('captchaSoundEnabled').checked = settings.captchaSoundEnabled !== false;
    document.getElementById('captchaSelectors').value = (settings.captchaSelectors || []).join('\n');
    document.getElementById('captchaReminderInterval').value = settings.captchaReminderInterval || 60;

    console.log('[Settings] Loaded:', settings);
  } catch (error) {
    console.error('[Settings] Error loading:', error);
    showStatus('Error loading settings', 'error');
  }
}

/**
 * Load and display statistics
 */
async function loadStats() {
  try {
    const seenIds = await Storage.getSeenIds();
    const lastScanTime = await Storage.getLastScanTime();

    document.getElementById('seen-count').textContent = seenIds.length;

    if (lastScanTime) {
      const date = new Date(lastScanTime);
      const timeAgo = getTimeAgo(lastScanTime);
      document.getElementById('last-scan').textContent = `${date.toLocaleString()} (${timeAgo})`;
    } else {
      document.getElementById('last-scan').textContent = 'Never';
    }
  } catch (error) {
    console.error('[Settings] Error loading stats:', error);
    document.getElementById('seen-count').textContent = 'Error';
    document.getElementById('last-scan').textContent = 'Error';
  }
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

/**
 * Save settings
 */
async function saveSettings(event) {
  event.preventDefault();

  // Parse captcha selectors from textarea (one per line, filter empty lines)
  const captchaSelectorsText = document.getElementById('captchaSelectors').value;
  const captchaSelectors = captchaSelectorsText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const settings = {
    refreshInterval: parseInt(document.getElementById('refreshInterval').value),
    maxTimeSinceLastScan: parseInt(document.getElementById('maxTimeSinceLastScan').value),
    actionsEnabled: {
      playSound: document.getElementById('playSound').checked,
      sendNotification: document.getElementById('sendNotification').checked,
      openInTab: document.getElementById('openInTab').checked
    },
    autoClickEnabled: document.getElementById('autoClickEnabled').checked,
    firstClickSelector: document.getElementById('firstClickSelector').value,
    secondClickSelector: document.getElementById('secondClickSelector').value,
    clickDelay: parseInt(document.getElementById('clickDelay').value),
    captchaSoundEnabled: document.getElementById('captchaSoundEnabled').checked,
    captchaSelectors: captchaSelectors,
    captchaReminderInterval: parseInt(document.getElementById('captchaReminderInterval').value)
  };

  try {
    await Storage.saveSettings(settings);
    showStatus('Settings saved successfully!', 'success');
    console.log('[Settings] Saved:', settings);
  } catch (error) {
    console.error('[Settings] Error saving:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) {
    return;
  }

  try {
    await Storage.resetSettings();
    await loadSettings();
    showStatus('Settings reset to defaults', 'success');
    console.log('[Settings] Reset to defaults');
  } catch (error) {
    console.error('[Settings] Error resetting:', error);
    showStatus('Error resetting settings: ' + error.message, 'error');
  }
}

/**
 * Clear seen IDs database
 */
async function clearSeenIds() {
  if (!confirm('Clear all seen expose IDs? This will make all listings appear as "new" again.')) {
    return;
  }

  try {
    await Storage.clearSeenIds();
    await loadStats();
    showStatus('Seen IDs database cleared', 'success');
    console.log('[Settings] Cleared seen IDs');
  } catch (error) {
    console.error('[Settings] Error clearing IDs:', error);
    showStatus('Error clearing IDs: ' + error.message, 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status-message ' + type;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 5000);
}

/**
 * Initialize settings page
 */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();

  // Refresh stats every 10 seconds
  setInterval(loadStats, 10000);

  document.getElementById('settings-form').addEventListener('submit', saveSettings);
  document.getElementById('reset-btn').addEventListener('click', resetSettings);
  document.getElementById('clear-ids-btn').addEventListener('click', clearSeenIds);
});
