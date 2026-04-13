/**
 * ============================================================
 * pwaInstall.js — PWA Registration & Event Module
 * ============================================================
 * Responsibilities:
 *  1. Register /service-worker.js on first page load
 *  2. Detect new SW updates → dispatch 'sw-update-available' event
 *  3. Expose triggerSkipWaiting() for the UpdatePrompt component
 *  4. Capture beforeinstallprompt → store + dispatch 'pwa-install-available'
 *  5. Listen for appinstalled → dispatch 'pwa-installed'
 *  6. Request persistent storage to prevent automatic data deletion
 * ============================================================
 */

/** Holds the deferred BeforeInstallPromptEvent for later triggering */
let deferredPrompt = null;

/** Reference to the waiting service worker (for skip-waiting) */
let waitingSW = null;

/**
 * Send SKIP_WAITING message to the waiting SW.
 * Called by UpdatePrompt when the user clicks "Update Now".
 */
export function triggerSkipWaiting() {
    if (waitingSW) {
        waitingSW.postMessage({ type: 'SKIP_WAITING' });
    } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
}

/**
 * Trigger the native install prompt (stored from beforeinstallprompt).
 * Returns the user's choice: 'accepted' or 'dismissed'
 */
export async function triggerInstallPrompt() {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    window.__deferredPWAPrompt = null;
    return outcome;
}

/**
 * Register the Service Worker and wire up all update/install events.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Workers not supported in this browser');
        return;
    }

    navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
            console.log('[PWA] Service Worker registered. Scope:', registration.scope);

            // ── Detect SW updates ──────────────────────────────────
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[PWA] New Service Worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        // A new SW is installed but waiting to activate.
                        // Store reference for skip-waiting later.
                        waitingSW = newWorker;
                        console.log('[PWA] New SW waiting — notifying app');

                        // Dispatch event → UpdatePrompt component will show the banner
                        document.dispatchEvent(
                            new CustomEvent('sw-update-available', { detail: { registration } })
                        );
                    }
                });
            });

            // ── Detect when SW becomes active (after skip-waiting) ─
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SW_ACTIVATED') {
                    console.log('[PWA] SW activated — reloading for fresh content');
                    // Reload will be handled by UpdatePrompt after user clicks Update Now
                }
            });

            // ── Check for existing waiting SW on page load ─────────
            if (registration.waiting && navigator.serviceWorker.controller) {
                waitingSW = registration.waiting;
                document.dispatchEvent(
                    new CustomEvent('sw-update-available', { detail: { registration } })
                );
            }
        })
        .catch((err) => {
            console.error('[PWA] Service Worker registration failed:', err);
        });
}

/**
 * Capture the beforeinstallprompt event before browser shows its own UI.
 * Stores it for later use when user clicks "Install Now" in our custom card.
 */
function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
        // Prevent Chrome 67+ from automatically showing the mini-infobar
        event.preventDefault();
        deferredPrompt = event;
        window.__deferredPWAPrompt = event; // also expose globally for debugging
        console.log('[PWA] beforeinstallprompt captured — showing custom install card');

        // Notify InstallAppCard component
        document.dispatchEvent(new CustomEvent('pwa-install-available'));
    });

    // Fires when the PWA is installed (either via our card or browser UI)
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        window.__deferredPWAPrompt = null;
        console.log('[PWA] App installed successfully!');

        // Notify InstallAppCard to hide itself
        document.dispatchEvent(new CustomEvent('pwa-installed'));
    });
}

/**
 * Request persistent storage from the browser.
 * This prevents IndexedDB, LocalStorage, and Cache data from being 
 * automatically cleared when disk space is low.
 */
async function requestStoragePersistence() {
    if (navigator.storage && navigator.storage.persist) {
        try {
            // First check if already persisted
            const isPersisted = await navigator.storage.persisted();
            if (isPersisted) {
                console.log('[Storage] Already marked as persistent');
                return;
            }

            // Request persistence
            const granted = await navigator.storage.persist();
            if (granted) {
                console.log('[Storage] Persistent storage granted by browser');
            } else {
                console.warn('[Storage] Persistent storage NOT granted. Data might be cleared if disk is low.');
                
                // Note: Most browsers only grant this if the app is "installed" (PWA) 
                // or after user engagement. Browsers like Chrome grant it automatically 
                // if the app is installed.
            }

            // Log current quota for debugging
            if (navigator.storage.estimate) {
                const { usage, quota } = await navigator.storage.estimate();
                const usageMB = (usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (quota / (1024 * 1024)).toFixed(2);
                console.log(`[Storage] Usage: ${usageMB} MB / ${quotaMB} MB`);
            }
        } catch (err) {
            console.error('[Storage] Error requesting persistence:', err);
        }
    }
}

// ── Bootstrap on page load ─────────────────────────────────────
window.addEventListener('load', () => {
    registerServiceWorker();
    setupInstallPrompt();
    requestStoragePersistence();
});
