import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      // isInternetReachable can be null on initial load, so we treat false explicitly as offline
      setIsOffline(!(state.isConnected && (state.isInternetReachable === true || state.isInternetReachable === null)));
    });
    return unsub;
  }, []);
  
  return { isOffline };
}
