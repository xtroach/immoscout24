/**
 * ImmoScan24 - Popup Script
 */

let currentTab = null;

/**
 * Check if URL is on ImmoScout24 domain
 */
function isImmoScout24Domain(url) {
  return url && url.includes('immobilienscout24.de');
}

/**
 * Update UI based on current state
 */
async function updateUI() {
  const statusText = document.getElementById('status-text');
  const toggleBtn = document.getElementById('toggle-btn');
  const warning = document.getElementById('not-is24-warning');

  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  // Check if on IS24 domain
  if (!isImmoScout24Domain(currentTab.url)) {
    warning.style.display = 'block';
    toggleBtn.disabled = true;
    statusText.textContent = 'Not available';
    statusText.className = 'status-text disabled';
    return;
  }

  warning.style.display = 'none';
  toggleBtn.disabled = false;

  // Get current state from background
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_STATE',
      tabId: currentTab.id
    });

    const enabled = response && response.enabled;

    if (enabled) {
      statusText.textContent = 'Active';
      statusText.className = 'status-text enabled';
      toggleBtn.textContent = 'Stop';
      toggleBtn.className = 'toggle-btn stop';
    } else {
      statusText.textContent = 'Disabled';
      statusText.className = 'status-text disabled';
      toggleBtn.textContent = 'Start';
      toggleBtn.className = 'toggle-btn start';
    }
  } catch (error) {
    console.error('[ImmoScan24 Popup] Error getting state:', error);
  }
}

/**
 * Toggle monitoring
 */
async function toggleMonitoring() {
  if (!currentTab || !isImmoScout24Domain(currentTab.url)) {
    return;
  }

  const toggleBtn = document.getElementById('toggle-btn');
  toggleBtn.disabled = true;

  try {
    // Send toggle message to background - it handles everything
    await browser.runtime.sendMessage({
      type: 'TOGGLE',
      tabId: currentTab.id
    });

    // Update UI to reflect new state
    await updateUI();
  } catch (error) {
    console.error('[ImmoScan24 Popup] Error toggling:', error);
  } finally {
    toggleBtn.disabled = false;
  }
}

/**
 * Open settings page
 */
function openSettings() {
  browser.runtime.openOptionsPage();
  window.close();
}

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  await updateUI();

  // Add event listeners
  document.getElementById('toggle-btn').addEventListener('click', toggleMonitoring);
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
});
