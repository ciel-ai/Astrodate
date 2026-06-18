import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function TabScreenFallback({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>This tab ran into a problem</Text>
      <Text style={styles.message} numberOfLines={3}>
        {error.message || 'An unexpected error occurred.'}
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={retry}
        accessibilityLabel="Retry loading this tab"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0618',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  icon: { fontSize: 40 },
  title: {
    color: '#E0D4FF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#9B72CF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
