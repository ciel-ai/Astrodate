import React from 'react';
import { Text } from 'react-native';

interface MessageTimestampProps {
  timestamp: Date;
  isRead?: boolean;
}

export function MessageTimestamp({ timestamp, isRead }: MessageTimestampProps) {
  const formatMessageTime = (date: Date): string => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <>
      <Text style={styles.messageTime}>{formatMessageTime(timestamp)}</Text>
      {isRead && <Text style={styles.readIndicator}>✓✓</Text>}
    </>
  );
}

const styles = {
  messageTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  readIndicator: {
    marginLeft: 2,
  },
};