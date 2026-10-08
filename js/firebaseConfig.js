/**
 * Firebase Realtime Database & Firestore Cloud Sync Manager
 * Guaranteed Auto-Connect to user's Firebase Realtime DB:
 * https://kyoto-trip-2026-46dc0-default-rtdb.asia-southeast1.firebasedatabase.app
 */

window.FIREBASE_CONFIG_DEFAULT = {
  projectId: 'kyoto-trip-2026-46dc0',
  databaseURL: 'https://kyoto-trip-2026-46dc0-default-rtdb.asia-southeast1.firebasedatabase.app'
};

class FirebaseStorageManager {
  constructor() {
    this.rtdbRef = null;
    this.db = null;
    this.docRef = null;
    this.isInitialized = false;
    this.syncEnabled = false; // Default to FALSE: protect cloud DB from local edits
    this.mode = 'rtdb'; // 'rtdb' or 'firestore'
    this.lastError = null;
    this.cloudReady = false;
    this.cloudBaseline = null;
    this.pendingWrites = Promise.resolve();
    this.onConflict = null;
  }

  // Initialize Firebase with given config or default config
  init(customConfig) {
    if (typeof firebase === 'undefined') {
      console.log('📱 Local Storage Mode (Firebase SDK not loaded).');
      return false;
    }
    const config = customConfig || window.FIREBASE_CONFIG_DEFAULT || this.getSavedConfig();
    
    if (!config || (!config.projectId && !config.databaseURL)) {
      console.log('📱 Pure Local Storage Mode Active. Local edits will NOT affect cloud DB.');
      this.isInitialized = false;
      this.syncEnabled = false;
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
          this.syncEnabled = true;
          this.cloudReady = false;
          this.cloudBaseline = null;
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
        this.syncEnabled = true;
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
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  // Subscribe before allowing any writes. Never seed an empty cloud automatically.
  subscribeRealtime(onDataReceived) {
    if (!this.isInitialized || !this.rtdbRef) return null;
    this.rtdbRef.off('value');
    const onValue = (snapshot) => {
      const cloudData = snapshot.val();
      this.cloudBaseline = cloudData;
      this.cloudReady = true;
      if (cloudData && typeof cloudData === 'object' && onDataReceived) {
        onDataReceived(cloudData);
      } else {
        console.warn('Firebase cloud node is empty; automatic upload is disabled.');
      }
    };
    const onError = (error) => {
      this.cloudReady = false;
      this.lastError = error.message;
      console.error('Firebase realtime sync failed:', error);
    };
    this.rtdbRef.on('value', onValue, onError);
    return () => this.rtdbRef.off('value', onValue);
  }

  // A transaction prevents a stale tab from silently replacing newer cloud data.
  // If another device has written since our last snapshot, abort rather than overwrite.
  saveDataToCloud(data) {
    if (!this.isInitialized || !this.rtdbRef || !this.cloudReady) {
      console.warn('Cloud not ready: changes kept locally, not uploaded.');
      return Promise.resolve(false);
    }
    const requestedData = JSON.parse(JSON.stringify(data));
    const expected = JSON.stringify(this.cloudBaseline);
    const perform = async () => {
      try {
        const result = await this.rtdbRef.transaction(
          (current) => JSON.stringify(current) === expected ? requestedData : undefined,
          undefined,
          false
        );
        if (!result.committed) {
          this.lastError = '雲端資料已由其他裝置更新，這次儲存已停止以避免覆蓋。';
          console.warn(this.lastError);
          if (this.onConflict) this.onConflict(this.lastError);
          return false;
        }
        this.cloudBaseline = result.snapshot.val();
        this.lastError = null;
        return true;
      } catch (error) {
        this.lastError = error.message;
        console.error('Firebase save failed:', error);
        return false;
      }
    };
    this.pendingWrites = this.pendingWrites.then(perform, perform);
    return this.pendingWrites;
  }

}

window.FirebaseManager = new FirebaseStorageManager();
