importScripts('https://www.gstatic.com/firebasejs/10.5.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.5.2/firebase-messaging-compat.js');

// Replace with your actual Firebase config values
firebase.initializeApp({
  apiKey: 'AIzaSyAKcalfkXz2x54U1vdt_LeuJYjhmfZcN1Q',
  authDomain: 'clinic-management-app-dac9d.firebaseapp.com',
  projectId: 'clinic-management-app-dac9d',
  messagingSenderId: '1003878922611',
  appId: '1:1003878922611:web:5b96dc9422a5eedf4ced06',
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const { title, body } = payload.notification || {};

  self.registration.showNotification(title || 'Clinic Reminder', {
    body: body || 'You have a clinic notification',
    icon: '/vite.svg',
    tag: 'clinic-notification',
    requireInteraction: true,
  });
});