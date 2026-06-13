import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../lib/useNetworkStatus';

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  
  if (!isOffline) return null;
  
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#E53E3E', // Red-600 color for error
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
