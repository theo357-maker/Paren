// Service Worker principal unique - CS La Colombe Parent v3.0
const CACHE_NAME = 'cs-lacolombe-v3.0';
const APP_VERSION = '3.0.0';

// Événement d'installation
self.addEventListener('install', (event) => {
  console.log('🔧 Installation Service Worker v3.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        'index.html',
        'manifest.json',
        'icon-192x192.png',
        '/icon-512x512.png'
         'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'

      ]);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Événement d'activation
self.addEventListener('activate', (event) => {
  console.log('🚀 Activation Service Worker v3.0');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`🗑️ Suppression cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendre contrôle immédiatement
      self.clients.claim()
    ])
  );
});

// ============================================
// NOTIFICATIONS PUSH - GESTION SIMPLIFIÉE
// ============================================

// Événement push (notification reçue)
self.addEventListener('push', (event) => {
  console.log('📨 Notification push reçue');
  
  try {
    let notificationData = {};
    
    // Essayer de parser les données
    if (event.data) {
      try {
        notificationData = event.data.json();
      } catch (e) {
        // Si ce n'est pas du JSON, traiter comme texte
        const text = event.data.text();
        notificationData = {
          title: 'CS La Colombe',
          body: text || 'Nouvelle notification',
          data: {}
        };
      }
    } else {
      // Données par défaut
      notificationData = {
        title: 'CS La Colombe',
        body: 'Nouvelle mise à jour disponible',
        data: {}
      };
    }
    
    console.log('Données notification:', notificationData);
    
    // Options de notification
    const options = {
      body: notificationData.body || 'Nouvelle notification',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: notificationData.data || {},
      tag: notificationData.tag || 'general',
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [
        {
          action: 'view',
          title: '👁️ Voir'
        },
        {
          action: 'dismiss',
          title: '❌ Fermer'
        }
      ]
    };
    
    // Afficher la notification
    event.waitUntil(
      self.registration.showNotification(
        notificationData.title || 'CS La Colombe',
        options
      ).then(() => {
        console.log('✅ Notification affichée avec succès');
      })
    );
    
  } catch (error) {
    console.error('❌ Erreur dans push event:', error);
    
    // Notification de secours en cas d'erreur
    event.waitUntil(
      self.registration.showNotification('CS La Colombe', {
        body: 'Nouvelle notification disponible',
        icon: '/icon-192x192.png'
      })
    );
  }
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Notification cliquée:', event.notification.tag);
  
  // Fermer la notification
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  // Gestion des actions
  if (action === 'dismiss') {
    console.log('Notification fermée par utilisateur');
    return;
  }
  
  // Ouvrir/focus l'application
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Chercher une fenêtre ouverte
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          
          // Envoyer les données de notification
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: notificationData,
            timestamp: Date.now()
          });
          
          return;
        }
      }
      
      // Ouvrir une nouvelle fenêtre si aucune n'est ouverte
      return self.clients.openWindow('/').then((newClient) => {
        if (newClient) {
          // Envoyer les données après un délai
          setTimeout(() => {
            newClient.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: notificationData
            });
          }, 1000);
        }
      });
    })
  );
});

// ============================================
// COMMUNICATION AVEC LA PAGE
// ============================================

// Messages depuis la page
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  console.log(`📩 Message reçu: ${type}`);
  
  switch (type) {
    case 'SAVE_PARENT_DATA':
      // Sauvegarder les données parent pour les notifications hors ligne
      saveParentData(data);
      break;
      
    case 'PING':
      // Répondre au ping pour confirmer que le SW est actif
      event.ports[0]?.postMessage({
        type: 'PONG',
        timestamp: Date.now(),
        version: APP_VERSION
      });
      break;
      
    case 'TEST_NOTIFICATION':
      // Tester une notification
      self.registration.showNotification('Test Notification', {
        body: 'Ceci est un test de notification push',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png'
      });
      break;
  }
});

// Sauvegarder les données parent
function saveParentData(parentData) {
  console.log('💾 Sauvegarde données parent');
  
  // Stocker dans IndexedDB (simplifié)
  const request = indexedDB.open('ParentAppCache', 1);
  
  request.onupgradeneeded = function(event) {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('parent')) {
      db.createObjectStore('parent', { keyPath: 'id' });
    }
  };
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['parent'], 'readwrite');
    const store = transaction.objectStore('parent');
    
    store.put({
      id: 'current',
      ...parentData,
      savedAt: new Date().toISOString()
    });
  };
}

// ============================================
// GESTION DU CACHE (simplifiée)
// ============================================

self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Ignorer les requêtes Firebase et autres APIs
  if (request.url.includes('firebase') || 
      request.url.includes('googleapis') ||
      request.url.includes('cloudinary')) {
    return;
  }
  
  // Stratégie: Network First pour le HTML, Cache First pour les assets
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Mettre en cache la nouvelle version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Retourner depuis le cache si hors ligne
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
  } else {
    // Cache First pour les autres ressources
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request).then(response => {
            // Mettre en cache les nouvelles ressources
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          }).catch(() => {
            // Fallback pour les images
            if (request.destination === 'image') {
              return caches.match('/icon-192x192.png');
            }
            return new Response('Ressource non disponible hors ligne');
          });
        })
    );
  }
});

console.log('✅ Service Worker chargé - Version ' + APP_VERSION);
