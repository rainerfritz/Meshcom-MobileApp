type SyncCallback = (deviceId: string) => Promise<void>;

class TimeSyncManager {
  private static instance: TimeSyncManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncFn: SyncCallback | null = null;
  private deviceId: string | null = null;

  private constructor() {}

  static getInstance() {
    if (!TimeSyncManager.instance) {
      TimeSyncManager.instance = new TimeSyncManager();
    }
    return TimeSyncManager.instance;
  }

  initialize(syncFn: SyncCallback) {
    this.syncFn = syncFn;
  }

  startSync(deviceId: string, intervalMs: number = 60000) {
  if (this.isSyncing || !this.syncFn) return;
  this.isSyncing = true;
  this.deviceId = deviceId;

  // Immediate sync before the interval starts
  this.syncFn(deviceId).catch((err) =>
    console.error("TimeSyncManager: initial sync error", err)
  );

  // Regular interval sync
  this.syncInterval = setInterval(() => {
    if (!this.deviceId) return;
    this.syncFn!(this.deviceId).catch((err) =>
      console.error("TimeSyncManager: interval sync error", err)
    );
  }, intervalMs);
}

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isSyncing = false;
    this.deviceId = null;
  }

  isRunning() {
    return this.isSyncing;
  }
}

export default TimeSyncManager;
