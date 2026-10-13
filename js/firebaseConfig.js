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
    this.localWritesPending = 0;
    this.conflictDetected = false;
    this.localEditsBeforeReady = false;
    this.lastCloudVersion = null;
    this.status = 'connecting';
    this.onStatusChange = null;
    this.pendingData = null;
    this.writeInFlight = false;
    this.writeBlocked = false;
    this.connected = false;
    this.connectionRef = null;
    this.onDataReceived = null;
    this.cloudRevision = 0;
    this.readSequence = 0;
    this.recoveryKey = 'kyoto_trip_pending_sync_v1';
    try {
      this.writeBlocked = Boolean(localStorage.getItem(this.recoveryKey));
    } catch (_) {
      this.writeBlocked = true;
      this.lastError = '無法讀取待同步記錄，請先匯出本機 JSON 備份。';
    }
  }

  // Initialize Firebase with given config or default config
  init(customConfig) {
    if (this.isInitialized && (this.pendingData || this.writeBlocked || this.writeInFlight)) {
      this.setStatus('failed', '仍有待同步修改，請先備份並處理，不可切換連線。');
      return false;
    }
    if (typeof firebase === 'undefined') {
      this.setStatus('failed', 'Firebase SDK 未載入；本機操作仍可使用。');
      console.log('📱 Local Storage Mode (Firebase SDK not loaded).');
      return false;
    }
    const config = customConfig || window.FIREBASE_CONFIG_DEFAULT || this.getSavedConfig();
    
    if (!config || (!config.projectId && !config.databaseURL)) {
      console.log('📱 Pure Local Storage Mode Active. Local edits will NOT affect cloud DB.');
      this.isInitialized = false;
      this.syncEnabled = false;
      this.setStatus('failed', '缺少 Firebase 連線設定。');
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
          if (this.unsubscribe) this.unsubscribe();
          this.connected = false;
          this.readSequence++;
          this.rtdbRef = rtdb.ref('kyoto_trip_data_v1');
          this.mode = 'rtdb';
          this.isInitialized = true;
          this.syncEnabled = true;
          this.cloudReady = false;
          this.cloudBaseline = null;
          this.lastError = null;
          this.setStatus('connecting', '正在等待首次雲端資料。');
          console.log('🔥 Firebase Realtime Database connected:', dbUrl);
          this.saveConfigLocally(config);
          return true;
        } catch (e) {
          console.warn('🔥 Realtime DB connect warning:', e);
          this.lastError = e.message;
        }
      }

      // Sync stays on RTDB; initializing another backend is not a successful connection.
      this.isInitialized = false;
      this.syncEnabled = false;
      this.setStatus('failed', this.lastError || '無法初始化 Realtime Database。');
      return false;
    } catch (err) {
      console.error('🔥 Firebase Init Error:', err);
      this.setStatus('failed', err.message);
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

  // RTDB may normalize arrays to keyed objects and reorder object keys.
  // Compare semantic JSON content rather than raw JSON serialization.
  canonicalData(value) {
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).sort();
      const normalized = {};
      keys.forEach((key) => {
        const item = this.canonicalData(value[key]);
        if (item !== null) normalized[key] = item;
      });
      return Object.keys(normalized).length ? normalized : null;
    }
    return value == null ? null : value;
  }

  sameData(a, b) {
    return JSON.stringify(this.canonicalData(a)) === JSON.stringify(this.canonicalData(b));
  }

  setStatus(status, message = '') {
    this.status = status;
    this.lastError = message || null;
    if (this.onStatusChange) this.onStatusChange({ status, message });
  }

  markPending() {
    // The data itself remains in the existing app key. This marker survives reload.
    try {
      localStorage.setItem(this.recoveryKey, 'pending');
      return true;
    } catch (_) {
      this.writeBlocked = true;
      this.setStatus('failed', '無法記錄待同步狀態，已停止雲端寫入；請匯出 JSON 備份。');
      return false;
    }
  }

  clearPending() {
    try {
      localStorage.removeItem(this.recoveryKey);
      return true;
    } catch (_) {
      this.writeBlocked = true;
      this.setStatus('failed', '無法更新待同步狀態，請先匯出 JSON 備份。');
      return false;
    }
  }

  applyCloud(data) {
    if (data && typeof data === 'object' && this.onDataReceived) this.onDataReceived(JSON.parse(JSON.stringify(data)));
  }

  // Subscribe before writes; preserve local work until a server read resolves recovery.
  subscribeRealtime(onDataReceived) {
    if (!this.isInitialized || !this.rtdbRef) return null;
    if (this.unsubscribe) this.unsubscribe();
    this.onDataReceived = onDataReceived;
    this.rtdbRef.off('value');
    if (this.connectionRef && this.connectionListener) this.connectionRef.off('value', this.connectionListener);
    this.connectionRef = this.rtdbRef.root.child('.info/connected');
    this.connectionListener = (snapshot) => {
      const wasConnected = this.connected;
      this.connected = snapshot.val() === true;
      if (!this.connected) {
        this.readSequence++;
        this.cloudReady = false;
        this.setStatus(this.pendingData || this.writeInFlight || this.writeBlocked ? 'pending' : 'connecting', '連線中／離線；本機資料保留，尚未確認雲端同步。');
      } else if (!wasConnected) {
        if (this.writeBlocked) this.retryPendingSync();
        else if (!this.writeInFlight && !this.pendingData) this.refreshCloud();
        else this.setStatus(this.writeInFlight || this.pendingData ? 'pending' : 'connecting');
      }
    };
    this.connectionRef.on('value', this.connectionListener);
    const onValue = (snapshot) => {
      this.cloudRevision++;
      const cloudData = snapshot.val();
      this.cloudBaseline = cloudData;
      // RTDB value events include speculative local echoes. Never treat these as an ack.
      if (this.writeBlocked || this.pendingData || this.writeInFlight) return;
      if (!this.connected) return;
      if (!this.cloudReady) {
        this.refreshCloud();
        return;
      }
      try { this.applyCloud(cloudData); }
      catch (error) {
        this.setStatus('failed', '無法保留雲端資料至本機：' + error.message);
        return;
      }
      this.setStatus(this.connected ? 'synced' : 'connecting', cloudData ? '' : '雲端節點為空，未自動上傳本機資料。');
    };
    const onError = (error) => {
      this.readSequence++;
      this.cloudReady = false;
      this.setStatus('failed', '雲端監聽失敗：' + error.message);
    };
    this.rtdbRef.on('value', onValue, onError);
    if (this.writeBlocked) this.setStatus('pending', '有尚未確認的本機修改；請重試確認，或先匯出 JSON 備份。');
    const dataRef = this.rtdbRef;
    const connectionRef = this.connectionRef;
    const connectionListener = this.connectionListener;
    this.unsubscribe = () => {
      dataRef.off('value', onValue);
      connectionRef.off('value', connectionListener);
    };
    return this.unsubscribe;
  }

  async refreshCloud() {
    if (!this.connected || this.writeInFlight || this.pendingData || this.writeBlocked) return false;
    const request = ++this.readSequence;
    try {
      const revision = this.cloudRevision;
      // get() asks the server when connected; re-check state after the async boundary.
      const snapshot = await this.rtdbRef.get();
      if (!this.connected || this.writeInFlight || this.pendingData || this.writeBlocked) return false;
      if (request !== this.readSequence || revision !== this.cloudRevision) return false;
      this.cloudReady = true;
      this.cloudBaseline = snapshot.val();
      this.applyCloud(this.cloudBaseline);
      this.setStatus('synced');
      return true;
    } catch (error) {
      if (request !== this.readSequence || this.writeInFlight || this.pendingData || this.writeBlocked) return false;
      this.setStatus('failed', '無法確認最新雲端資料：' + error.message);
      return false;
    }
  }

  // Recovery only verifies. It NEVER replays a failed/stale whole-document write.
  async retryPendingSync() {
    if (!this.rtdbRef || !this.connected || this.writeInFlight) return false;
    if (!this.writeBlocked) return this.refreshCloud();
    const request = ++this.readSequence;
    this.setStatus('pending', '正在重新確認雲端；不會自動覆蓋雲端資料。');
    try {
      const revision = this.cloudRevision;
      const snapshot = await this.rtdbRef.get();
      if (!this.connected || this.writeInFlight) return false;
      if (request !== this.readSequence || revision !== this.cloudRevision) return false;
      const cloudData = snapshot.val();
      // Do not mistake StorageManager's default-data fallback for recovered edits.
      let localData = this.pendingData;
      if (!localData && window.StorageManager) {
        const raw = localStorage.getItem(window.StorageManager.STORAGE_KEY);
        localData = raw ? JSON.parse(raw) : null;
      }
      if (localData && this.sameData(cloudData, localData)) {
        if (!this.clearPending()) return false;
        this.pendingData = null;
        this.writeBlocked = false;
        this.cloudReady = true;
        this.setStatus('synced');
        return true;
      }
      this.setStatus('failed', '本機修改尚未同步，且與雲端不同。已保留本機資料並停止自動重送；請匯出 JSON 備份後人工確認。');
      return false;
    } catch (error) {
      if (request !== this.readSequence) return false;
      this.setStatus('failed', '重試確認失敗，本機資料保留：' + error.message);
      return false;
    }
  }

  // Explicit user decision only, after a JSON backup. Never writes to Firebase.
  async discardPendingAndLoadCloud() {
    if (!this.connected || !this.rtdbRef || this.writeInFlight) return false;
    const localCopy = this.pendingData;
    const revision = this.cloudRevision;
    const request = ++this.readSequence;
    try {
      const snapshot = await this.rtdbRef.get();
      if (!this.connected || this.writeInFlight || this.pendingData !== localCopy || request !== this.readSequence || revision !== this.cloudRevision) return false;
      const cloudData = snapshot.val();
      if (!cloudData || typeof cloudData !== 'object') {
        this.setStatus('failed', '雲端資料為空；本機資料保留。');
        return false;
      }
      // Persist successfully before clearing the recovery guard.
      this.applyCloud(cloudData);
      if (!this.clearPending()) return false;
      this.pendingData = null;
      this.writeBlocked = false;
      this.cloudReady = true;
      this.cloudBaseline = cloudData;
      this.setStatus('synced');
      return true;
    } catch (error) {
      if (request !== this.readSequence) return false;
      this.setStatus('failed', '載入雲端失敗，本機待同步狀態保留：' + error.message);
      return false;
    }
  }

  // Last-write-wins for new connected edits; coalesce queued edits to the newest copy.
  saveDataToCloud(data) {
    this.pendingData = JSON.parse(JSON.stringify(data));
    if (!this.markPending()) return Promise.resolve(false);
    if (!this.isInitialized || !this.rtdbRef || !this.cloudReady || !this.connected || this.writeBlocked) {
      this.writeBlocked = true;
      this.setStatus('pending', '本機修改已保留，待確認雲端後再處理；不會自動覆蓋雲端。');
      return Promise.resolve(false);
    }
    if (this.writeInFlight) return this.pendingWrites;
    this.writeInFlight = true;
    this.localWritesPending = 1;
    this.setStatus('pending', '正在同步最新本機修改…');
    const perform = async () => {
      try {
        while (this.pendingData) {
          if (this.writeBlocked || !this.connected || !this.cloudReady) {
            this.writeBlocked = true;
            if (this.status !== 'failed') this.setStatus('pending', '連線中斷，本機修改保留；恢復後只重新確認，不自動重送。');
            return false;
          }
          const requestedData = this.pendingData;
          await this.rtdbRef.set(requestedData);
          if (this.pendingData === requestedData) this.pendingData = null;
        }
        if (!this.clearPending()) return false;
        return true;
      } catch (error) {
        this.writeBlocked = true;
        this.setStatus('failed', '儲存失敗，本機修改保留：' + error.message);
        return false;
      } finally {
        this.writeInFlight = false;
        this.localWritesPending = 0;
        if (!this.writeBlocked && !this.pendingData) await this.refreshCloud();
        else this.setStatus(this.status, this.lastError || '本機修改尚待同步。');
      }
    };
    this.pendingWrites = perform();
    return this.pendingWrites;
  }

}

window.FirebaseManager = new FirebaseStorageManager();
