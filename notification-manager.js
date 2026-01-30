// notification-manager.js - Gestionnaire centralisé avec badges
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.isInitialized = false;
    this.badgeInterval = null;
    this.lastBadgeUpdate = 0;
  }
  
  // Initialiser le gestionnaire
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔔 Initialisation Notification Manager avec badges');
    
    // 1. Charger les notifications sauvegardées
    this.loadSavedNotifications();
    
    // 2. Initialiser Firebase Notifications
    if (window.firebaseNotifications && window.currentParent) {
      await window.firebaseNotifications.initialize(window.currentParent.matricule);
    }
    
    // 3. Configurer le badge en temps réel
    this.setupRealTimeBadge();
    
    // 4. Synchroniser le badge périodiquement
    this.startBadgeSync();
    
    this.isInitialized = true;
    console.log('✅ Notification Manager initialisé avec badges');
  }
  
  // Configurer le badge en temps réel
  setupRealTimeBadge() {
    // Écouter les messages du Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'BACKGROUND_NOTIFICATION') {
          this.handleBackgroundNotification(event.data.data);
        }
        
        if (event.data.type === 'BADGE_UPDATED') {
          this.updateBadge(event.data.count);
        }
      });
    }
    
    // Mettre à jour le badge quand l'app reprend le focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncBadge();
      }
    });
  }
  
  // Démarrer la synchronisation du badge
  startBadgeSync() {
    // Synchroniser toutes les 30 secondes
    this.badgeInterval = setInterval(() => {
      this.syncBadge();
    }, 30000);
    
    // Synchroniser au démarrage
    setTimeout(() => this.syncBadge(), 5000);
  }
  
  // Synchroniser le badge avec le backend
  async syncBadge() {
    if (!window.currentParent || !navigator.onLine) return;
    
    try {
      const { getFirestore, collection, query, where, getDocs } = await import(
        'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'
      );
      
      const db = getFirestore();
      const parentMatricule = window.currentParent.matricule;
      
      // Vérifier les nouvelles notifications non lues
      let totalUnread = 0;
      
      // 1. Incidents non lus
      for (const child of window.childrenList) {
        const incidentsQuery = query(
          collection(db, 'incidents'),
          where('studentMatricule', '==', child.matricule)
        );
        const incidentsSnap = await getDocs(incidentsQuery);
        totalUnread += incidentsSnap.size;
      }
      
      // 2. Notes non lues (pour le secondaire)
      for (const child of window.childrenList) {
        if (child.type === 'secondary') {
          const gradesQuery = query(
            collection(db, 'published_grades'),
            where('className', '==', child.class)
          );
          const gradesSnap = await getDocs(gradesQuery);
          totalUnread += gradesSnap.size;
        }
      }
      
      // 3. Devoirs non lus
      for (const child of window.childrenList) {
        if (child.type === 'secondary') {
          const homeworkQuery = query(
            collection(db, 'homework'),
            where('className', '==', child.class)
          );
          const homeworkSnap = await getDocs(homeworkQuery);
          totalUnread += homeworkSnap.size;
        }
      }
      
      // 4. Communiqués non lus
      const communiquesQuery = query(
        collection(db, 'parent_communique_relations'),
        where('parentId', '==', parentMatricule)
      );
      const communiquesSnap = await getDocs(communiquesQuery);
      totalUnread += communiquesSnap.size;
      
      // Mettre à jour le badge avec le total
      this.updateBadge(totalUnread);
      
      this.lastBadgeUpdate = Date.now();
      
    } catch (error) {
      console.error('❌ Erreur synchronisation badge:', error);
    }
  }
  
  // Gérer les notifications arrière-plan
  handleBackgroundNotification(notificationData) {
    // Ajouter la notification
    this.addNotification({
      type: notificationData.type || 'general',
      title: notificationData.title || 'Notification',
      body: notificationData.body || 'Nouvelle notification',
      data: notificationData.data || {},
      timestamp: notificationData.timestamp || new Date().toISOString()
    });
    
    // Mettre à jour le badge
    this.updateBadge(1);
  }
  
  // Ajouter une notification
  addNotification(notification) {
    // Générer un ID unique
    notification.id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    notification.read = false;
    
    // Ajouter au début de la liste
    this.notifications.unshift(notification);
    
    // Limiter à 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
    
    // Incrémenter le compteur
    this.unreadCount++;
    
    // Sauvegarder
    this.saveNotifications();
    
    // Mettre à jour le badge PWA
    this.updateAppBadge();
    
    // Afficher notification système si app ouverte
    if (Notification.permission === 'granted' && !document.hidden) {
      this.showSystemNotification(notification);
    }
    
    console.log('📝 Notification ajoutée:', notification.type);
    
    return notification;
  }
  
  // Mettre à jour le badge PWA
  async updateAppBadge() {
    if (!('setAppBadge' in navigator)) {
      console.log('⚠️ Badges PWA non supportés');
      return;
    }
    
    try {
      if (this.unreadCount > 0) {
        await navigator.setAppBadge(this.unreadCount);
        console.log(`✅ Badge PWA mis à jour: ${this.unreadCount}`);
      } else {
        await navigator.clearAppBadge();
        console.log('✅ Badge PWA effacé');
      }
    } catch (error) {
      console.error('❌ Erreur badge PWA:', error);
    }
  }
  
  // Mettre à jour le badge (méthode unifiée)
  updateBadge(count = null) {
    if (count !== null) {
      this.unreadCount = count;
    }
    
    // 1. Mettre à jour le badge PWA
    this.updateAppBadge();
    
    // 2. Mettre à jour l'interface
    const countElement = document.getElementById('notification-count');
    if (countElement) {
      if (this.unreadCount > 0) {
        countElement.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
        countElement.classList.remove('hidden');
        
        // Animation
        countElement.style.animation = 'pulse 1s';
        setTimeout(() => countElement.style.animation = '', 1000);
      } else {
        countElement.classList.add('hidden');
      }
    }
    
    // 3. Mettre à jour le titre
    this.updateDocumentTitle();
    
    // 4. Sauvegarder l'état
    localStorage.setItem('notification_badge_count', this.unreadCount.toString());
  }
  
  // Mettre à jour le titre du document
  updateDocumentTitle() {
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = this.unreadCount > 0 ? `(${this.unreadCount}) ${baseTitle}` : baseTitle;
  }
  
  // Charger les notifications sauvegardées
  loadSavedNotifications() {
    try {
      const saved = localStorage.getItem('app_notifications');
      if (saved) {
        this.notifications = JSON.parse(saved);
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.updateBadge();
      }
      
      // Charger le compteur de badge sauvegardé
      const badgeCount = localStorage.getItem('notification_badge_count');
      if (badgeCount) {
        this.unreadCount = parseInt(badgeCount);
      }
    } catch (error) {
      console.error('❌ Erreur chargement notifications:', error);
      this.notifications = [];
      this.unreadCount = 0;
    }
  }
  
  // Sauvegarder les notifications
  saveNotifications() {
    try {
      localStorage.setItem('app_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('❌ Erreur sauvegarde notifications:', error);
    }
  }
  
  // Afficher une notification système
  showSystemNotification(notification) {
    const notif = new Notification(notification.title, {
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: notification.type,
      data: notification.data,
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
    
    notif.onclick = () => {
      window.focus();
      notif.close();
      
      // Naviguer vers la page appropriée
      if (notification.data?.page) {
        const link = document.querySelector(`[data-page="${notification.data.page}"]`);
        if (link) {
          link.click();
          
          // Sélectionner l'enfant si spécifié
          if (notification.data.childId) {
            setTimeout(() => {
              const selector = document.getElementById(`${notification.data.page}-child-selector`);
              if (selector) {
                selector.value = notification.data.childId;
                selector.dispatchEvent(new Event('change'));
              }
            }, 500);
          }
        }
      }
    };
    
    return notif;
  }
  
  // Marquer comme lu
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.saveNotifications();
      this.updateBadge();
      return true;
    }
    
    return false;
  }
  
  // Marquer toutes comme lues
  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    
    this.unreadCount = 0;
    this.saveNotifications();
    this.updateBadge();
    
    // Effacer le badge PWA
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge();
    }
  }
  
  // Effacer toutes les notifications
  clearAllNotifications() {
    this.notifications = [];
    this.unreadCount = 0;
    this.saveNotifications();
    this.updateBadge();
    
    localStorage.removeItem('app_notifications');
  }
  
  // Obtenir les notifications filtrées
  getNotifications(filter = 'all') {
    if (filter === 'all') {
      return this.notifications;
    }
    
    return this.notifications.filter(n => n.type === filter);
  }
  
  // Tester le système
  test() {
    console.log('🧪 Test système notifications avec badges');
    
    this.addNotification({
      type: 'test',
      title: '✅ Test complet',
      body: 'Notifications et badges fonctionnent !',
      data: {
        page: 'dashboard',
        test: true,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
  
  // Obtenir le statut
  getStatus() {
    return {
      initialized: this.isInitialized,
      notificationsCount: this.notifications.length,
      unreadCount: this.unreadCount,
      badgeSupported: 'setAppBadge' in navigator,
      lastBadgeUpdate: this.lastBadgeUpdate
    };
  }
}

// Créer et exporter une instance unique
const notificationManager = new NotificationManager();

// Initialiser automatiquement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    notificationManager.initialize();
  }, 2000);
});

// Exporter
window.notificationManager = notificationManager;
