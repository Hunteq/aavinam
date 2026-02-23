/**
 * OfflineIndicator.jsx
 * ─────────────────────────────────────────────────────────────
 * Fixed pill indicator showing current network status.
 *
 * Behavior:
 *  - Online  → green dot "Online" — fades out after 3 seconds
 *  - Offline → red dot "Offline Mode" — stays visible until reconnected
 *  - On reconnect → briefly shows green "Online" then fades
 */

import React, { useState, useEffect, useRef } from 'react';

export default function OfflineIndicator() {
    // Start with current status
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [visible, setVisible] = useState(!navigator.onLine); // Only show on load if offline
    const fadeTimerRef = useRef(null);

    useEffect(() => {
        const showIndicator = () => {
            clearTimeout(fadeTimerRef.current);
            setVisible(true);
        };

        const handleOnline = () => {
            setIsOnline(true);
            showIndicator();
            // Auto-hide "Online" pill after 3 seconds
            fadeTimerRef.current = setTimeout(() => setVisible(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            showIndicator(); // Stay visible — offline pill doesn't auto-hide
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearTimeout(fadeTimerRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className={`offline-indicator ${isOnline ? 'offline-indicator--online' : 'offline-indicator--offline'}`}
            role="status"
            aria-live="polite"
            aria-label={isOnline ? 'Connected to internet' : 'No internet connection — offline mode'}
        >
            <span className="offline-indicator__dot" aria-hidden="true" />
            <span className="offline-indicator__label">
                {isOnline ? 'Online' : 'Offline Mode'}
            </span>
        </div>
    );
}
