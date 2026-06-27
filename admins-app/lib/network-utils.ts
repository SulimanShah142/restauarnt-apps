import * as Network from 'expo-network';
import { Alert } from 'react-native';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

// Check network status using Expo Network
export const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected ?? false;
  } catch (error) {
    console.error('[Network] Error checking network status:', error);
    return false;
  }
};

// Show network error alert with ignore option
export const showNetworkErrorAlert = (onIgnore?: () => void): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      '📡 No Internet Connection',
      'Please connect to a network to continue. Some features may not work without internet.',
      [
        {
          text: 'Ignore',
          style: 'cancel',
          onPress: () => {
            if (onIgnore) onIgnore();
            resolve(true); // User chose to ignore
          }
        },
        {
          text: 'Retry',
          onPress: async () => {
            const isOnline = await checkNetworkStatus();
            resolve(isOnline);
          }
        }
      ]
    );
  });
};

// Listen for network changes
export const subscribeToNetworkChanges = (callback: (state: NetworkState) => void) => {
  // Expo Network doesn't support event listeners, so we'll poll every 5 seconds
  const intervalId = setInterval(async () => {
    const state = await checkNetworkStatus();
    callback({
      isConnected: state,
      isInternetReachable: state
    });
  }, 5000);

  // Return unsubscribe function
  return () => clearInterval(intervalId);
};
