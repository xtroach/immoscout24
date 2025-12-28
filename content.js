/**
 * ImmoScan24 - Content Script
 * Handles DOM scanning and monitoring
 */

let isMonitoring = false;
let captchaObserver = null;
let captchaCheckTimeout = null;

/**
 * Check if current page is on ImmoScout24 domain
 */
function isImmoScout24Domain() {
  return window.location.href.includes('immobilienscout24.de');
}

/**
 * Scan page for expose links and extract IDs
 */
async function scanForExposeLinks() {
  // Note: Captcha detection is now handled by MutationObserver
  // No need to check here - the observer will catch it

  const exposeIds = [];

  // Find all links with href containing "/expose/"
  const links = document.querySelectorAll('a[href*="/expose/"]');

  links.forEach(link => {
    const href = link.getAttribute('href');
    const match = href.match(/\/expose\/(\d+)/);
    if (match) {
      exposeIds.push(match[1]);
    }
  });

  const uniqueIds = [...new Set(exposeIds)];
  console.log(`[ImmoScan24 Content] Found ${uniqueIds.length} expose links`);

  // Send IDs to background for processing
  if (uniqueIds.length > 0) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'NEW_IDS_FOUND',
        ids: uniqueIds
      });

      if (response.processed > 0) {
        console.log(`[ImmoScan24 Content] ${response.processed} new IDs processed`);
      } else if (response.skipped) {
        console.log(`[ImmoScan24 Content] Scan skipped due to time condition`);
      } else {
        console.log(`[ImmoScan24 Content] No new IDs found`);
      }
    } catch (error) {
      console.error('[ImmoScan24 Content] Failed to send IDs to background:', error);
    }
  }
}

/**
 * Start monitoring - scan page when enabled
 */
async function startMonitoring() {
  console.log('[ImmoScan24 Content] startMonitoring() called');

  if (!isImmoScout24Domain()) {
    console.log('[ImmoScan24 Content] Not on IS24 domain, aborting');
    return;
  }

  if (isMonitoring) {
    console.log('[ImmoScan24 Content] Already monitoring, aborting');
    return;
  }

  isMonitoring = true;
  console.log('[ImmoScan24 Content] Monitoring started');

  // Show visual indicator
  showIndicator(true);

  // Get settings for captcha monitoring
  try {
    const settingsResponse = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const settings = settingsResponse?.settings;

    if (settings) {
      // Start continuous captcha monitoring
      await startCaptchaMonitoring(settings.captchaSelectors, settings.captchaSoundEnabled);
    }
  } catch (error) {
    console.error('[ImmoScan24 Content] Failed to get settings for captcha monitoring:', error);
  }

  // Scan page for expose links
  await scanForExposeLinks();

  console.log('[ImmoScan24 Content] Monitoring active - page will be refreshed by background alarms');
}

/**
 * Stop monitoring
 */
function stopMonitoring() {
  if (!isMonitoring) return;

  isMonitoring = false;
  console.log('[ImmoScan24 Content] Monitoring stopped');

  // Hide visual indicator
  showIndicator(false);

  // Stop captcha monitoring
  stopCaptchaMonitoring();
}

/**
 * Show/hide visual indicator
 */
function showIndicator(show) {
  const indicatorId = 'immoscan24-indicator';
  const existingIndicator = document.getElementById(indicatorId);

  if (existingIndicator) {
    existingIndicator.remove();
  }

  if (show) {
    const indicator = document.createElement('div');
    indicator.id = indicatorId;
    indicator.textContent = 'ImmoScan24 Active';

    Object.assign(indicator.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#4CAF50',
      color: 'white',
      padding: '10px 16px',
      borderRadius: '4px',
      zIndex: '999999',
      fontSize: '14px',
      fontWeight: 'bold',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(indicator);
  }
}

/**
 * Initialize content script
 */
async function initialize() {
  if (!isImmoScout24Domain()) {
    console.log('[ImmoScan24 Content] Not on ImmoScout24 domain');
    return;
  }

  // Check if extension is enabled for this tab
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    if (response && response.enabled) {
      startMonitoring();
    }
  } catch (error) {
    console.error('[ImmoScan24 Content] Failed to get initial state:', error);
  }
}

/**
 * Check if captcha is present on page
 */
function checkForCaptcha(captchaSelectors) {
  if (!captchaSelectors || captchaSelectors.length === 0) {
    return null;
  }

  for (const selector of captchaSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log('[ImmoScan24 Content] Captcha detected with selector:', selector);
      return selector;
    }
  }

  return null;
}

/**
 * Start continuous captcha monitoring
 */
async function startCaptchaMonitoring(captchaSelectors, captchaSoundEnabled) {
  if (!captchaSelectors || captchaSelectors.length === 0) {
    console.log('[ImmoScan24 Content] No captcha selectors configured, skipping monitoring');
    return;
  }

  // Debounced captcha check to avoid excessive notifications
  const debouncedCaptchaCheck = () => {
    // Clear existing timeout
    if (captchaCheckTimeout) {
      clearTimeout(captchaCheckTimeout);
    }

    // Set new timeout
    captchaCheckTimeout = setTimeout(async () => {
      const captchaFound = checkForCaptcha(captchaSelectors);
      if (captchaFound) {
        console.warn('[ImmoScan24 Content] Captcha detected via MutationObserver!');

        // Notify background
        await browser.runtime.sendMessage({
          type: 'CAPTCHA_DETECTED',
          selector: captchaFound,
          playCaptchaSound: captchaSoundEnabled,
          isMainPage: true
        });

        // Stop observing once captcha is detected to avoid spam
        if (captchaObserver) {
          captchaObserver.disconnect();
          captchaObserver = null;
          console.log('[ImmoScan24 Content] Stopped captcha monitoring after detection');
        }
      }
    }, 500); // Wait 500ms after last mutation
  };

  // Create MutationObserver
  captchaObserver = new MutationObserver(() => {
    debouncedCaptchaCheck();
  });

  // Start observing DOM changes
  captchaObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });

  console.log('[ImmoScan24 Content] Started captcha monitoring with MutationObserver');

  // Do initial check
  debouncedCaptchaCheck();
}

/**
 * Stop captcha monitoring
 */
function stopCaptchaMonitoring() {
  if (captchaObserver) {
    captchaObserver.disconnect();
    captchaObserver = null;
    console.log('[ImmoScan24 Content] Stopped captcha monitoring');
  }

  if (captchaCheckTimeout) {
    clearTimeout(captchaCheckTimeout);
    captchaCheckTimeout = null;
  }
}

/**
 * Perform automated clicking sequence
 */
async function performAutoClick(firstSelector, secondSelector, delay, captchaSelectors, captchaSoundEnabled) {
  console.log('[ImmoScan24 Content] Starting auto-click sequence');

  let shouldCloseTab = false;

  // Start continuous captcha monitoring for this tab (if not already monitoring)
  if (!captchaObserver && captchaSelectors && captchaSelectors.length > 0) {
    console.log('[ImmoScan24 Content] Starting captcha monitoring for new tab');
    await startCaptchaMonitoring(captchaSelectors, captchaSoundEnabled);
  }

  // Check for captcha before proceeding
  const initialCaptcha = checkForCaptcha(captchaSelectors);
  if (initialCaptcha) {
    console.warn('[ImmoScan24 Content] Captcha already present, aborting auto-click');
    return;
  }

  if (firstSelector) {
    const firstElement = document.querySelector(firstSelector);
    if (firstElement) {
      console.log('[ImmoScan24 Content] Clicking first element:', firstSelector);
      firstElement.click();

      // Wait before second click
      if (secondSelector) {
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check for captcha again before second click
        const captchaAfterDelay = checkForCaptcha(captchaSelectors);
        if (captchaAfterDelay) {
          console.log('[ImmoScan24 Content] Captcha detected during delay, skipping second click');
          return;
        }

        const secondElement = document.querySelector(secondSelector);
        if (secondElement) {
          console.log('[ImmoScan24 Content] Clicking second element:', secondSelector);
          secondElement.click();

          // Mark tab for auto-close since both clicks succeeded and no captcha
          shouldCloseTab = true;
        } else {
          console.warn('[ImmoScan24 Content] Second element not found:', secondSelector);
        }
      }
    } else {
      console.warn('[ImmoScan24 Content] First element not found:', firstSelector);
    }
  }

  console.log('[ImmoScan24 Content] Auto-click sequence completed, captcha monitoring continues');

  // Auto-close tab if both clicks succeeded
  if (shouldCloseTab) {
    console.log('[ImmoScan24 Content] Auto-click successful, waiting before close...');
    // Wait a bit to ensure click actions complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Final captcha check before closing
    const finalCaptchaCheck = checkForCaptcha(captchaSelectors);
    if (finalCaptchaCheck) {
      console.warn('[ImmoScan24 Content] Captcha appeared after clicks, NOT closing tab');
      return;
    }

    // Request background to close this tab
    console.log('[ImmoScan24 Content] No captcha detected, requesting tab close');
    try {
      await browser.runtime.sendMessage({
        type: 'CLOSE_TAB'
      });
    } catch (error) {
      console.error('[ImmoScan24 Content] Failed to request tab close:', error);
    }
  }
}

/**
 * Message listener
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ImmoScan24 Content] Received message:', message);

  if (message.type === 'ENABLE') {
    console.log('[ImmoScan24 Content] ENABLE message received, calling startMonitoring()');
    startMonitoring();
  } else if (message.type === 'DISABLE') {
    console.log('[ImmoScan24 Content] DISABLE message received, calling stopMonitoring()');
    stopMonitoring();
  } else if (message.type === 'AUTO_CLICK') {
    console.log('[ImmoScan24 Content] AUTO_CLICK message received');
    performAutoClick(
      message.firstSelector,
      message.secondSelector,
      message.delay,
      message.captchaSelectors,
      message.captchaSoundEnabled
    );
  } else if (message.type === 'CHECK_CAPTCHA_STILL_PRESENT') {
    console.log('[ImmoScan24 Content] CHECK_CAPTCHA_STILL_PRESENT message received');
    const captchaFound = checkForCaptcha(message.captchaSelectors);
    sendResponse({ stillPresent: !!captchaFound });
    return true; // Indicates async response
  }
});

/**
 * Initialize on page load
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('[ImmoScan24 Content] Content script loaded');
