// Service Worker UNIFIÉ - Version 5.0 avec badges
const CACHE_NAME = 'cs-lacolombe-v5.0';
const APP_VERSION = '5.0.0';
let badgeCount = 0;

// Import Firebase
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
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('✅ Firebase SW initialisé');
} catch (error) {
  console.error('❌ Erreur Firebase SW:', error);
}

// ============================================
// GESTION DES BADGES
// ============================================
async function updateBadge(count) {
  try {
    const clients = await self.clients.matchAll();
    
    if (clients.length > 0) {
      // Envoyer le nouveau compteur aux clients
      clients.forEach(client => {
        client.postMessage({
          type: 'BADGE_UPDATED',
          count: count,
          timestamp: Date.now()
        });
      });
    }
    
    badgeCount = count;
    
    // Sauvegarder dans IndexedDB
    await saveBadgeCount(count);
    
  } catch (error) {
    console.error('❌ Erreur mise à jour badge:', error);
  }
}

// Sauvegarder le compteur de badge
async function saveBadgeCount(count) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['badges'], 'readwrite');
    const store = tx.objectStore('badges');
    
    await store.put({ id: 'badge_count', count: count, updated: Date.now() });
  } catch (error) {
    console.error('❌ Erreur sauvegarde badge:', error);
  }
}

// Ouvrir IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NotificationDB', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('badges')) {
        db.createObjectStore('badges', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('read', 'read');
      }
    };
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// ============================================
// GESTION DES NOTIFICATIONS FIREBASE
// ============================================
if (messaging) {
  messaging.onBackgroundMessage(async (payload) => {
    console.log('📱 Notification arrière-plan:', payload);
    
    // Incrémenter le badge
    badgeCount++;
    await updateBadge(badgeCount);
    
    // Préparer les options de notification
    const title = getNotificationTitle(payload);
    const body = getNotificationBody(payload);
    const data = payload.data || {};
    
    const notificationOptions = {
      body: body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: data.type || 'general',
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      data: data,
      actions: [
        {
          action: 'view',
          title: '👁️ Voir',
          icon: '/icon-view-48x48.png'
        },
        {
          action: 'dismiss',
          title: '❌ Fermer',
          icon: '/icon-dismiss-48x48.png'
        }
      ]
    };
    
    // Afficher la notification
    await self.registration.showNotification(title, notificationOptions);
    
    // Sauvegarder la notification
    await saveNotification({
      id: `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title,
      body: body,
      data: data,
      timestamp: Date.now(),
      read: false
    });
  });
}

// Obtenir le titre selon le type
function getNotificationTitle(payload) {
  const data = payload.data || {};
  
  switch (data.type) {
    case 'grades': return '📊 Nouvelle note';
    case 'incidents': return '⚠️ Nouvel incident';
    case 'homework': return '📚 Nouveau devoir';
    case 'presence': return '📅 Mise à jour présence';
    case 'communiques': return '📄 Nouveau communiqué';
    case 'payments': return '💰 Paiement';
    case 'messages': return '📨 Nouveau message';
    default: return payload.notification?.title || 'CS La Colombe';
  }
}

// Obtenir le corps selon le type
function getNotificationBody(payload) {
  const data = payload.data || {};
  const defaultBody = payload.notification?.body || 'Nouvelle notification';
  
  if (data.childName && data.type) {
    switch (data.type) {
      case 'grades': return `${data.childName}: Nouvelle note en ${data.subject || 'une matière'}`;
      case 'incidents': return `${data.childName}: Incident signalé`;
      case 'homework': return `${data.childName}: Nouveau devoir`;
      case 'presence': return `${data.childName}: Mise à jour présence`;
      default: return defaultBody;
    }
  }
  
  return defaultBody;
}

// Sauvegarder une notification
async function saveNotification(notification) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');
    
    await store.put(notification);
  } catch (error) {
    console.error('❌ Erreur sauvegarde notification:', error);
  }
}

// ============================================
// CLIC SUR NOTIFICATION
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Notification cliquée:', event.notification.tag);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  // Action "Fermer"
  if (action === 'dismiss') {
    // Décrémenter le badge
    badgeCount = Math.max(0, badgeCount - 1);
    updateBadge(badgeCount);
    return;
  }
  
  // Ouvrir/focus l'application
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Chercher un onglet ouvert
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          
          // Envoyer les données de la notification
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data,
            badgeCount: badgeCount,
            source: 'background',
            timestamp: Date.now()
          });
          
          // Marquer comme lue dans IndexedDB
          if (data.notificationId) {
            markNotificationAsRead(data.notificationId);
          }
          
          // Décrémenter le badge
          badgeCount = Math.max(0, badgeCount - 1);
          updateBadge(badgeCount);
          
          return;
        }
      }
      
      // Ouvrir un nouvel onglet
      return self.clients.openWindow('/').then((newClient) => {
        if (newClient) {
          // Envoyer les données après chargement
          setTimeout(() => {
            newClient.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: data,
              badgeCount: badgeCount,
              source: 'new_window'
            });
            
            // Marquer comme lue
            if (data.notificationId) {
              markNotificationAsRead(data.notificationId);
            }
            
            // Décrémenter le badge
            badgeCount = Math.max(0, badgeCount - 1);
            updateBadge(badgeCount);
            
          }, 1500);
        }
      });
    })
  );
});

// Marquer une notification comme lue
async function markNotificationAsRead(notificationId) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');
    
    const notification = await store.get(notificationId);
    if (notification) {
      notification.read = true;
      await store.put(notification);
    }
  } catch (error) {
    console.error('❌ Erreur marquage notification:', error);
  }
}

// ============================================
// COMMUNICATION AVEC LA PAGE
// ============================================
self.addEventListener('message', async (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'BACKGROUND_NOTIFICATION':
      // Notification arrière-plan provenant de la page
      await handleBackgroundNotification(data);
      break;
      
    case 'UPDATE_BADGE':
      // Mettre à jour le badge
      if (data.count !== undefined) {
        await updateBadge(data.count);
      }
      break;
      
    case 'GET_BADGE_COUNT':
      // Récupérer le compteur de badge
      event.ports[0]?.postMessage({
        type: 'BADGE_COUNT',
        count: badgeCount,
        timestamp: Date.now()
      });
      break;
      
    case 'TEST_BACKGROUND_NOTIFICATION':
      // Tester les notifications arrière-plan
      await self.registration.showNotification('Test Badge', {
        body: 'Ce test vérifie les badges et notifications',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'test_badge',
        requireInteraction: true,
        data: { type: 'test', badgeTest: true }
      });
      
      // Incrémenter le badge
      badgeCount++;
      await updateBadge(badgeCount);
      break;
      
    case 'CLEAR_BADGE':
      // Effacer le badge
      badgeCount = 0;
      await updateBadge(0);
      break;
  }
});

// Gérer les notifications arrière-plan
async function handleBackgroundNotification(notificationData) {
  // Afficher la notification
  await self.registration.showNotification(
    notificationData.title || 'Notification',
    {
      body: notificationData.body || 'Nouvelle notification',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: notificationData.data?.type || 'general',
      data: notificationData.data || {},
      requireInteraction: true
    }
  );
  
  // Incrémenter le badge
  badgeCount++;
  await updateBadge(badgeCount);
}

// ============================================
// INSTALLATION ET CACHE
// ============================================
self.addEventListener('install', (event) => {
  console.log('🔧 Installation SW v5.0');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll([
          '/',
          'index.html',
          'manifest.json',
          'icon-192x192.png',
          'icon-512x512.png',
          'icon-72x72.png',
          'icon-badge-96x96.png'
        ]);
      }),
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Activation SW v5.0');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Ignorer les APIs externes
  if (request.url.includes('firebase') || 
      request.url.includes('googleapis') ||
      request.url.includes('cloudinary')) {
    return;
  }
  
  // Stratégie Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cachedResponse => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

console.log('✅ Service Worker v5.0 chargé - Badges activés');
