// firebase-messaging-sw.js - Service Worker Firebase unique
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

console.log('🔥 Firebase Messaging SW initialisation');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb"
};

// Initialisation Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialisé dans le Service Worker');
  
  const messaging = firebase.messaging();
  
  // ============================================
  // GESTION DES MESSAGES EN ARRIÈRE-PLAN
  // ============================================
  
  messaging.onBackgroundMessage((payload) => {
    console.log('📱 Message en arrière-plan reçu:', payload);
    
    const notificationTitle = payload.notification?.title || 'CS La Colombe';
    const notificationOptions = {
      body: payload.notification?.body || 'Nouvelle notification',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'fcm-background',
      renotify: true,
      requireInteraction: true,
      data: payload.data || {},
      actions: [
        {
          action: 'view',
          title: '👁️ Voir'
        }
      ],
      // Options pour différentes plateformes
      android: {
        channelId: 'high_importance',
        priority: 'high'
      },
      webpush: {
        headers: {
          Urgency: 'high'
        }
      }
    };
    
    // Afficher la notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
  
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

// ============================================
// GESTION DES CLICS SUR NOTIFICATIONS
// ============================================

self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Notification Firebase cliquée');
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  if (action === 'dismiss') {
    return;
  }
  
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
      
      // Ouvrir un nouvel onglet si aucun n'est ouvert
      return self.clients.openWindow('/').then((newClient) => {
        if (newClient) {
          setTimeout(() => {
            newClient.postMessage({
              type: 'FCM_NOTIFICATION_CLICK',
              data: data
            });
          }, 1000);
        }
      });
    })
  );
});