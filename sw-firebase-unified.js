// sw-firebase-unified.js
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb",
  measurementId: "G-TNSG1XFMDZ"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

console.log('🔥 Firebase Messaging SW initialisé avec la clé VAPID correcte');

// GESTION DES NOTIFICATIONS EN ARRIÈRE-PLAN
messaging.onBackgroundMessage((payload) => {
  console.log('📱 [SW] Notification en arrière-plan reçue:', payload);
  
  const notificationTitle = payload.notification?.title || 'CS La Colombe';
  const notificationOptions = {
    body: payload.notification?.body || 'Nouvelle notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.type || 'general',
    renotify: true,
    requireInteraction: true,
    data: payload.data || {},
    silent: false,
    actions: [
      { action: 'view', title: '👁️ Voir' },
      { action: 'dismiss', title: '❌ Fermer' }
    ]
  };
  
  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// GESTION DES CLICS SUR NOTIFICATIONS
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 [SW] Notification cliquée:', event.notification.tag);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  
  // Ouvrir l'application
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Chercher un onglet ouvert
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'FCM_NOTIFICATION_CLICK',
            data: data
          });
          return;
        }
      }
      
      // Ouvrir un nouvel onglet
      return self.clients.openWindow('/');
    })
  );
});

// INSTALLATION DE BASE
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Installation');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 [SW] Activation');
  event.waitUntil(self.clients.claim());
});

console.log('✅ Service Worker Firebase prêt');
