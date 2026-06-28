import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Fix for ngrok/tunnel environments
auth.settings.appVerificationDisabledForTesting = false;

// Safe FCM setup
export const requestNotificationPermission = async () => {
  try {
    // Check VAPID key first
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    

    if (!vapidKey) {
      console.error('VITE_FIREBASE_VAPID_KEY is missing in .env');
      return null;
    }

    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(app);

    const token = await getToken(messaging, { vapidKey });
    

    return token || null;
  } catch (err) {
    console.warn('FCM token error:', err.message);
    return null;
  }
};

export const onForegroundMessage = async (callback) => {
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch (err) {
    console.warn('FCM foreground not available:', err.message);
  }
};

export default app;