import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MessageTimestampProps {
  timestamp: Date;
  isRead?: boolean;
  // showTicks: only true for my own messages (sender side)
  showTicks?: boolean;
}

export function MessageTimestamp({ timestamp, isRead, showTicks }: MessageTimestampProps) {
  const formatMessageTime = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <View style={styles.row}>
      <Text style={styles.messageTime}>{formatMessageTime(timestamp)}</Text>
      {showTicks && (
        // Single tick = sent (optimistic already handled in MessageBubble)
        // Double tick grey = delivered, double tick purple = read
        <Text style={[styles.tick, isRead ? styles.tickRead : styles.tickSent]}>
          {isRead ? '✓✓' : '✓'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  tick: {
    fontSize: 12,
    fontWeight: '600',
  },
  tickSent: {
    color: 'rgba(255,255,255,0.45)',
  },
  tickRead: {
    color: '#C084FC', // purple-400 — matches brand
  },
});