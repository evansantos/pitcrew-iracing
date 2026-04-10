'use client';

import { useEffect, useState } from 'react';

export interface ServiceWorkerState {
  registered: boolean;
  pushEnabled: boolean;
  offlineReady: boolean;
}

/**
 * Registers the service worker and exposes PWA state.
 */
export function useServiceWorker(): ServiceWorkerState & {
  requestPushPermission: () => Promise<boolean>;
  sendTestNotification: (title: string, body: string) => void;
} {
  const [state, setState] = useState<ServiceWorkerState>({
    registered: false,
    pushEnabled: false,
    offlineReady: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        setState((s) => ({ ...s, registered: true, offlineReady: true }));

        if ('Notification' in window) {
          setState((s) => ({
            ...s,
            pushEnabled: Notification.permission === 'granted',
          }));
        }

        return registration;
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  const requestPushPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    if (Notification.permission === 'granted') {
      setState((s) => ({ ...s, pushEnabled: true }));
      return true;
    }

    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setState((s) => ({ ...s, pushEnabled: granted }));
    return granted;
  };

  const sendTestNotification = (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
    });
  };

  return { ...state, requestPushPermission, sendTestNotification };
}
