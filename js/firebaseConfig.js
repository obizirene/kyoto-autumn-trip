/**
 * Firebase Realtime Database & Firestore Cloud Sync Manager
 * Guaranteed Auto-Connect to user's Firebase Realtime DB:
 * https://kyoto-trip-2026-46dc0-default-rtdb.asia-southeast1.firebasedatabase.app
 */

window.FIREBASE_CONFIG_DEFAULT = {
  projectId: "kyoto-trip-2026",
  databaseURL: "https://kyoto-trip-2026-46dc0-default-rtdb.asia-southeast1.firebasedatabase.app"
};

class FirebaseStorageManager {
  constructor() {
    this.rtdbRef = null;
    this.db = null;
    this.docRef = null;
    this.isInitialized = false;
    this.mode = 'rtdb'; // 'rtdb' or 'firestore'
    this.lastError = null;
  }

  // Initialize Firebase with given config or default config
  init(customConfig) {
    if (typeof firebase === 'undefined') {
      console.log('🔥 Firebase SDK not loaded in page. Using local storage mode.');
      return false;
    }
    const config = customConfig || this.getSavedConfig() || window.FIREBASE_CONFIG_DEFAULT;
    
    if (!config || (!config.projectId && !config.databaseURL)) {
      console.log('🔥 Firebase not initialized (No Project ID or DB URL). Using local storage fallback.');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      // 1. Firebase Realtime Database (Primary)
      if (firebase.database && (config.databaseURL || config.projectId)) {
        try {
          const dbUrl = config.databaseURL || `https://${config.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
          const app = firebase.app();
          const rtdb = firebase.database(app, dbUrl);
          this.rtdbRef = rtdb.ref('kyoto_trip_data_v1');
          this.mode = 'rtdb';
          this.isInitialized = true;
          this.lastError = null;
          console.log('🔥 Firebase Realtime Database connected:', dbUrl);
          this.saveConfigLocally(config);
          return true;
        } catch (e) {
          console.warn('🔥 Realtime DB connect warning:', e);
          this.lastError = e.message;
        }
      }

      // 2. Firestore Fallback
      if (firebase.firestore) {
        this.db = firebase.firestore();
        this.docRef = this.db.collection('kyoto_trips').doc('autumn_2026');
        this.mode = 'firestore';
        this.isInitialized = true;
        this.lastError = null;
        console.log('🔥 Firebase Firestore connected successfully!');
        this.saveConfigLocally(config);
        return true;
      }

      return false;
    } catch (err) {
      console.error('🔥 Firebase Init Error:', err);
      this.lastError = err.message;
      return false;
    }
  }

  saveConfigLocally(config) {
    try {
      localStorage.setItem('kyoto_trip_firebase_config', JSON.stringify(config));
    } catch(e) {}
  }

  getSavedConfig() {
    try {
      const saved = localStorage.getItem('kyoto_trip_firebase_config');
      return saved ? JSON.parse(saved) : window.FIREBASE_CONFIG_DEFAULT;
    } catch (e) {
      return window.FIREBASE_CONFIG_DEFAULT;
    }
  }

  // Subscribe to real-time updates from Cloud DB
  subscribeRealtime(onDataReceived) {
    if (!this.isInitialized) return null;

    if (this.mode === 'rtdb' && this.rtdbRef) {
      this.rtdbRef.on('value', (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData && typeof cloudData === 'object') {
          console.log('🔥 Cloud DB data received:', cloudData);
          if (onDataReceived) onDataReceived(cloudData);
        } else {
          console.log('🔥 Cloud DB node is empty. Checking local storage data...');
          const localData = window.StorageManager.loadData();
          if (localData) {
            this.saveDataToCloud(localData);
          }
        }
      }, (error) => {
        console.error('🔥 Realtime DB Permission/Sync Error:', error);
        this.lastError = error.message;
        if (error.code === 'PERMISSION_DENIED') {
          console.warn('⚠️ Firebase Realtime DB 安全規則拒絕存取！請至 Firebase Console 將規則設為 read:true, write:true');
        }
      });
    } else if (this.mode === 'firestore' && this.docRef) {
      this.docRef.onSnapshot((doc) => {
        if (doc.exists) {
          const cloudData = doc.data();
          if (cloudData && onDataReceived) onDataReceived(cloudData);
        } else {
          const localData = window.StorageManager.loadData();
          if (localData) this.saveDataToCloud(localData);
        }
      }, (error) => {
        console.error('🔥 Firestore Error:', error);
        this.lastError = error.message;
      });
    }
  }

  // Save data to Cloud Database
  async saveDataToCloud(data) {
    if (!this.isInitialized) return false;
    try {
      if (this.mode === 'rtdb' && this.rtdbRef) {
        await this.rtdbRef.set(data);
        console.log('🔥 Successfully saved to Firebase Realtime DB cloud!');
        return true;
      } else if (this.mode === 'firestore' && this.docRef) {
        await this.docRef.set(data, { merge: true });
        console.log('🔥 Successfully saved to Firestore cloud!');
        return true;
      }
    } catch (err) {
      console.error('🔥 Save to Cloud DB failed:', err);
      this.lastError = err.message;
      return false;
    }
  }
}

window.FirebaseManager = new FirebaseStorageManager();
