import api from './api';

/**
 * Web Push subscription helper.
 *
 * Server prerequisites (not yet provisioned): a VAPID keypair whose public
 * half is exposed as VITE_VAPID_PUBLIC_KEY (or window.__APP_CONFIG__.VAPID_KEY),
 * plus POST /api/notifications/push-subscriptions on the backend to store
 * endpoints per user. Until both exist the Profile toggle reports the exact
 * missing piece instead of failing silently.
 */

const vapidKey = () =>
  (typeof window !== 'undefined' && window.__APP_CONFIG__?.VAPID_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
  '';

export const pushSupport = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, reason: 'This browser has no service-worker support.' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'This browser does not support Web Push.' };
  }
  if (!vapidKey()) {
    return { supported: false, reason: 'Push server keys are not configured yet (VAPID).' };
  }
  return { supported: true, reason: '' };
};

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = window.atob(raw);
  return Uint8Array.from([...bytes].map((c) => c.charCodeAt(0)));
};

const readyWorker = async () => {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
};

export const pushStatus = async () => {
  const { supported, reason } = pushSupport();
  if (!supported) return { state: 'unsupported', reason };
  if (Notification.permission === 'denied') {
    return { state: 'blocked', reason: 'Notifications are blocked in the browser settings.' };
  }
  const reg = await readyWorker();
  const sub = await reg.pushManager.getSubscription();
  return sub
    ? { state: 'subscribed', reason: '' }
    : { state: 'off', reason: 'Push alerts are off on this device.' };
};

export const subscribePush = async () => {
  const { supported, reason } = pushSupport();
  if (!supported) throw new Error(reason);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  const reg = await readyWorker();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey()),
  });
  // Hand the endpoint to the server; if the endpoint is missing the server
  // answers 404 and the subscription still works locally for testing via DevTools.
  try {
    await api.post('/notifications/push-subscriptions', subscription.toJSON());
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
  }
  return subscription;
};

export const unsubscribePush = async () => {
  const reg = await readyWorker();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await api.delete('/notifications/push-subscriptions', { data: { endpoint: sub.endpoint } });
    } catch (err) {
      /* server cleanup is best-effort */
    }
    await sub.unsubscribe();
  }
};
