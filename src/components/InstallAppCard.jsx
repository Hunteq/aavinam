/**
 * InstallAppCard.jsx
 * ─────────────────────────────────────────────────────────────
 * Custom PWA install prompt card.
 *
 * Shows on every page load (including onboarding) UNLESS:
 *  - App is already installed (standalone mode detected)
 *  - User has previously dismissed it (localStorage flag)
 *
 * The "Install Now" button is enabled only when the browser's
 * beforeinstallprompt event has been captured. Otherwise, it
 * shows a hint message (for iOS / slow-loading browsers).
 */

import React, { useState, useEffect } from 'react';
import { triggerInstallPrompt } from '../pwaInstall';

/** Returns true if the app is already running as an installed PWA */
function isAlreadyInstalled() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true // iOS Safari
    );
}

/** Returns true if user is on iOS (where beforeinstallprompt never fires) */
function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallAppCard() {
    // promptReady: true when beforeinstallprompt has been captured
    const [promptReady, setPromptReady] = useState(
        () => !!window.__deferredPWAPrompt
    );
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Hide permanently if already installed or previously dismissed
        if (isAlreadyInstalled()) return;
        if (localStorage.getItem('pwa_install_dismissed') === 'true') return;

        // Show the card immediately — the Install button will enable when prompt is ready
        setVisible(true);

        // Listen for the browser install prompt becoming available
        const handleInstallAvailable = () => {
            setPromptReady(true);
        };

        // Hide after successful installation
        const handleInstalled = () => {
            setVisible(false);
        };

        document.addEventListener('pwa-install-available', handleInstallAvailable);
        document.addEventListener('pwa-installed', handleInstalled);

        return () => {
            document.removeEventListener('pwa-install-available', handleInstallAvailable);
            document.removeEventListener('pwa-installed', handleInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!promptReady) return;
        const outcome = await triggerInstallPrompt();
        if (outcome === 'accepted') {
            setVisible(false);
        }
    };

    const handleLater = () => {
        localStorage.setItem('pwa_install_dismissed', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    // On iOS, browser never fires beforeinstallprompt.
    // Show iOS-specific "Add to Home Screen" instruction instead.
    const ios = isIOS();

    return (
        <div className="pwa-install-card" role="dialog" aria-label="Install app prompt">
            <div className="pwa-install-card__inner">
                <div className="pwa-install-card__icon">📲</div>
                <div className="pwa-install-card__content">
                    <h3 className="pwa-install-card__title">Install This App</h3>
                    <p className="pwa-install-card__subtitle">
                        {ios
                            ? 'Tap the Share button below and choose "Add to Home Screen" to install'
                            : 'Use offline like a real mobile app \u2022 Fast \u2022 Works without Internet'}
                    </p>
                </div>
            </div>

            <div className="pwa-install-card__actions">
                {ios ? (
                    /* iOS: no button possible, just dismiss */
                    <button
                        className="pwa-install-card__btn pwa-install-card__btn--ghost"
                        onClick={handleLater}
                        aria-label="Dismiss install prompt"
                    >
                        Got it
                    </button>
                ) : (
                    <>
                        <button
                            className={`pwa-install-card__btn pwa-install-card__btn--primary${!promptReady ? ' pwa-install-card__btn--loading' : ''}`}
                            onClick={handleInstall}
                            disabled={!promptReady}
                            aria-label="Install the Aavinam app"
                            title={promptReady ? 'Install app' : 'Preparing install…'}
                        >
                            {promptReady ? 'Install Now' : 'Loading…'}
                        </button>
                        <button
                            className="pwa-install-card__btn pwa-install-card__btn--ghost"
                            onClick={handleLater}
                            aria-label="Dismiss install prompt"
                        >
                            Later
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
