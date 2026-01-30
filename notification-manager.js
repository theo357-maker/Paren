// notification-manager.js - Gestionnaire centralisé des notifications
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.isInitialized = false;
    this.realTimeListeners = {};
    this.notificationCallbacks = [];
  }
  
  // Initialiser le gestionnaire
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔔 Initialisation Notification Manager');
    
    // Charger les notifications sauvegardées
    this.loadSavedNotifications();
    
    // Initialiser Firebase Notifications
    if (window.firebaseNotifications && window.currentParent) {
      await window.firebaseNotifications.initialize(window.currentParent.matricule);
    }
    
    // Configurer les écouteurs en temps réel
    this.setupRealTimeListeners();
    
    // Vérifier les notifications périodiquement
    this.startPeriodicChecks();
    
    this.isInitialized = true;
    console.log('✅ Notification Manager initialisé');
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
    } catch (error) {
      console.error('❌ Erreur chargement notifications:', error);
      this.notifications = [];
    }
  }
  
  // Sauvegarder les notifications
  saveNotifications() {
    try {
      // Garder seulement les 100 dernières notifications
      if (this.notifications.length > 100) {
        this.notifications = this.notifications.slice(0, 100);
      }
      
      localStorage.setItem('app_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('❌ Erreur sauvegarde notifications:', error);
    }
  }
  
  // Configurer les écouteurs en temps réel
  setupRealTimeListeners() {
    if (!window.currentParent || !window.childrenList) return;
    
    console.log('👂 Configuration écouteurs temps réel');
    
    const parentMatricule = window.currentParent.matricule;
    
    // Écouter les changements dans les collections pertinentes
    this.setupFirestoreListener('incidents', 'incidents', (doc) => {
      const incident = doc.data();
      const child = window.childrenList.find(c => c.matricule === incident.studentMatricule);
      
      if (child) {
        this.addNotification({
          type: 'incidents',
          title: '⚠️ Incident signalé',
          body: `${child.fullName}: ${incident.type || 'Incident'}`,
          data: {
            page: 'presence-incidents',
            childId: child.matricule,
            incidentId: doc.id
          },
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // Configurer un écouteur Firestore
  async setupFirestoreListener(collectionName, type, callback) {
    try {
      const { getFirestore, collection, onSnapshot, query, where } = await import(
        'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'
      );
      
      const db = getFirestore();
      
      // Construire la requête selon le type
      let firestoreQuery;
      
      if (type === 'incidents' && window.childrenList) {
        // Écouter les incidents pour tous les enfants
        const childIds = window.childrenList.map(c => c.matricule);
        firestoreQuery = query(
          collection(db, collectionName),
          where('studentMatricule', 'in', childIds.slice(0, 10)) // Firebase limite à 10
        );
      }
      
      if (firestoreQuery) {
        const unsubscribe = onSnapshot(firestoreQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              callback(change.doc);
            }
          });
        });
        
        this.realTimeListeners[type] = unsubscribe;
      }
      
    } catch (error) {
      console.error(`❌ Erreur écouteur ${type}:`, error);
    }
  }
  
  // Démarrer les vérifications périodiques
  startPeriodicChecks() {
    // Vérifier toutes les 5 minutes
    setInterval(() => {
      this.checkForNewData();
    }, 5 * 60 * 1000);
    
    // Vérifier quand on revient en ligne
    window.addEventListener('online', () => {
      this.checkForNewData();
    });
    
    // Première vérification
    setTimeout(() => this.checkForNewData(), 10000);
  }
  
  // Vérifier les nouvelles données
  async checkForNewData() {
    if (!window.currentParent || !window.childrenList) return;
    
    console.log('🔍 Vérification nouvelles données');
    
    try {
      // Vérifier les nouvelles notes
      await this.checkNewGrades();
      
      // Vérifier les nouveaux incidents
      await this.checkNewIncidents();
      
      // Vérifier les nouveaux devoirs
      await this.checkNewHomework();
      
      // Vérifier les nouvelles présences
      await this.checkNewPresences();
      
    } catch (error) {
      console.error('❌ Erreur vérification données:', error);
    }
  }
  
  // Vérifier les nouvelles notes
  async checkNewGrades() {
    for (const child of window.childrenList) {
      if (child.type === 'secondary') {
        const lastCheck = this.getLastCheck('grades', child.matricule);
        
        // Simuler une vérification
        // En réalité, vous feriez une requête Firestore
        
        this.updateLastCheck('grades', child.matricule);
      }
    }
  }
  
  // Vérifier les nouveaux incidents
  async checkNewIncidents() {
    for (const child of window.childrenList) {
      const lastCheck = this.getLastCheck('incidents', child.matricule);
      this.updateLastCheck('incidents', child.matricule);
    }
  }
  
  // Vérifier les nouveaux devoirs
  async checkNewHomework() {
    for (const child of window.childrenList) {
      if (child.type === 'secondary') {
        const lastCheck = this.getLastCheck('homework', child.matricule);
        this.updateLastCheck('homework', child.matricule);
      }
    }
  }
  
  // Vérifier les nouvelles présences
  async checkNewPresences() {
    for (const child of window.childrenList) {
      const lastCheck = this.getLastCheck('presence', child.matricule);
      this.updateLastCheck('presence', child.matricule);
    }
  }
  
  // Ajouter une notification
  addNotification(notification) {
    // Générer un ID unique
    notification.id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    notification.read = false;
    
    // Ajouter au début de la liste
    this.notifications.unshift(notification);
    
    // Incrémenter le compteur de non lus
    this.unreadCount++;
    
    // Sauvegarder
    this.saveNotifications();
    
    // Mettre à jour le badge
    this.updateBadge();
    
    // Afficher une notification système
    if (Notification.permission === 'granted') {
      this.showSystemNotification(notification);
    }
    
    // Appeler les callbacks
    this.notificationCallbacks.forEach(callback => {
      callback(notification);
    });
    
    console.log('📝 Notification ajoutée:', notification.type);
  }
  
  // Afficher une notification système
  showSystemNotification(notification) {
    const notif = new Notification(notification.title, {
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: notification.type,
      data: notification.data,
      requireInteraction: true
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
  
  // Mettre à jour le badge
  updateBadge() {
    // Mettre à jour le badge PWA
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(this.unreadCount).catch(console.error);
    }
    
    // Mettre à jour le compteur dans l'interface
    const countElement = document.getElementById('notification-count');
    if (countElement) {
      if (this.unreadCount > 0) {
        countElement.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
        countElement.classList.remove('hidden');
      } else {
        countElement.classList.add('hidden');
      }
    }
    
    // Mettre à jour le titre
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = this.unreadCount > 0 ? `(${this.unreadCount}) ${baseTitle}` : baseTitle;
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
  }
  
  // Obtenir les notifications filtrées
  getNotifications(filter = 'all') {
    if (filter === 'all') {
      return this.notifications;
    }
    
    return this.notifications.filter(n => n.type === filter);
  }
  
  // Gestion du temps de vérification
  getLastCheck(type, id) {
    const key = `last_check_${type}_${id}`;
    const timestamp = localStorage.getItem(key);
    return timestamp ? parseInt(timestamp) : 0;
  }
  
  updateLastCheck(type, id) {
    const key = `last_check_${type}_${id}`;
    localStorage.setItem(key, Date.now().toString());
  }
  
  // S'abonner aux nouvelles notifications
  subscribe(callback) {
    this.notificationCallbacks.push(callback);
    
    // Retourner une fonction de désabonnement
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }
  
  // Tester le système
  test() {
    console.log('🧪 Test système notifications');
    
    this.addNotification({
      type: 'test',
      title: '✅ Test Notification',
      body: 'Le système de notifications fonctionne correctement !',
      data: {
        page: 'dashboard',
        test: true
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
      realTimeListeners: Object.keys(this.realTimeListeners).length,
      callbacks: this.notificationCallbacks.length
    };
  }
}

// Créer et exporter une instance unique
const notificationManager = new NotificationManager();

// Initialiser automatiquement au chargement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    notificationManager.initialize();
  }, 2000);
});

// Exporter pour usage global
window.notificationManager = notificationManager;