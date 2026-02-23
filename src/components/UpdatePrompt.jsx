/**
 * UpdatePrompt.jsx
 * ─────────────────────────────────────────────────────────────
 * Shows a slim toast banner when a new Service Worker version
 * is waiting to activate. User explicitly triggers the update
 * by clicking "Update Now" — no forced reloads.
 *
 * Flow:
 *  pwaInstall.js → fires 'sw-update-available'
 *  → UpdatePrompt shows banner
 *  → User clicks "Update Now"
 *  → triggerSkipWaiting() → SW activates → page reloads
 */

import React, { useState, useEffect } from 'react';
import { triggerSkipWaiting } from '../pwaInstall';

export default function UpdatePrompt() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleUpdate = () => {
            setVisible(true);
        };

        document.addEventListener('sw-update-available', handleUpdate);
        return () => document.removeEventListener('sw-update-available', handleUpdate);
    }, []);

    const handleUpdate = () => {
        // Tell the waiting SW to skip waiting and take control
        triggerSkipWaiting();
        // After a brief moment, reload to get fresh content from the new SW
        setTimeout(() => window.location.reload(), 400);
    };

    const handleDismiss = () => {
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="pwa-update-prompt" role="status" aria-live="polite">
            <span className="pwa-update-prompt__icon">🔄</span>
            <span className="pwa-update-prompt__text">New version available</span>
            <button
                className="pwa-update-prompt__btn-update"
                onClick={handleUpdate}
                aria-label="Update the app to the latest version"
            >
                Update Now
            </button>
            <button
                className="pwa-update-prompt__btn-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss update notification"
            >
                ✕
            </button>
        </div>
    );
}
