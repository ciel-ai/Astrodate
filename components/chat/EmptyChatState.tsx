import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EmptyChatStateProps {
  icebreaker?: string | null;
  dismissed?: boolean;
  onUseIcebreaker: () => void;
  onDismissIcebreaker: () => void;
}

export function EmptyChatState({ icebreaker, dismissed, onUseIcebreaker, onDismissIcebreaker }: EmptyChatStateProps) {
  if (!icebreaker || dismissed) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>✦ COSMIC ICEBREAKER ✦</Text>
      <TouchableOpacity onPress={onUseIcebreaker} activeOpacity={0.82} style={styles.chip}>
        <Text style={styles.icebreakerText}>"{icebreaker}"</Text>
        <View style={styles.tapButton}>
          <Text style={styles.tapButtonText}>Tap to use this opener ✨</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismissIcebreaker} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }} style={styles.dismissLink}>
        <Text style={styles.dismissText}>dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 20,
    marginTop: 32,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    borderRadius: 16,
    padding: 14,
    maxWidth: '88%',
    alignItems: 'center',
  },
  icebreakerText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tapButton: {
    marginTop: 10,
    backgroundColor: '#8b5cf6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  tapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissLink: {
    marginTop: 8,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
});