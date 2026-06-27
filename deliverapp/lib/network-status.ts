/**
 * Network Status Service
 * Handles online/offline detection and provides connectivity status
 */

// Conditional import for @react-native-community/netinfo
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo');
} catch (error) {
  console.warn('@react-native-community/netinfo not available, using fallback');
}

type NetworkStatus = 'online' | 'offline' | 'unknown';

type NetworkStatusCallback = (status: NetworkStatus) => void;

class NetworkStatusService {
  private static instance: NetworkStatusService;
  private status: NetworkStatus = 'unknown';
  private listeners: Set<NetworkStatusCallback> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): NetworkStatusService {
    if (!NetworkStatusService.instance) {
      NetworkStatusService.instance = new NetworkStatusService();
    }
    return NetworkStatusService.instance;
  }

  private async init() {
    if (!NetInfo) {
      // Fallback: assume online if NetInfo is not available
      this.status = 'online';
      return;
    }

    // Get initial network status
    const state = await NetInfo.fetch();
    this.updateStatus(state.isConnected ?? false);

    // Subscribe to network status changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: any) => {
      this.updateStatus(state.isConnected ?? false);
    });
  }

  private updateStatus(isConnected: boolean) {
    const newStatus: NetworkStatus = isConnected ? 'online' : 'offline';
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.status));
  }

  public getStatus(): NetworkStatus {
    return this.status;
  }

  public isOnline(): boolean {
    return this.status === 'online';
  }

  public isOffline(): boolean {
    return this.status === 'offline';
  }

  public subscribe(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);
    // Immediately call with current status
    callback(this.status);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async checkConnection(): Promise<boolean> {
    if (!NetInfo) {
      return this.status === 'online';
    }
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected ?? false;
    this.updateStatus(isConnected);
    return isConnected;
  }

  public destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const networkStatus = NetworkStatusService.getInstance();

// Import React for the hook
import React from 'react';

// Hook-friendly functions
export const useNetworkStatus = () => {
  const [status, setStatus] = React.useState<NetworkStatus>('unknown');

  React.useEffect(() => {
    const unsubscribe = networkStatus.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isUnknown: status === 'unknown',
  };
};

export default networkStatus;
