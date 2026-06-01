import React, { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { MessageTimestamp } from './MessageTimestamp';

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  avatar?: { uri: string };
}

function MessageBubbleComponent({ message, currentUserId, avatar }: MessageBubbleProps) {
  const isMyMessage = message.senderId === currentUserId;
  console.log('[Chat] render MessageBubble', message.id);

  return (
    <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer]}>
      {!isMyMessage && avatar && <Image source={avatar} style={styles.messageAvatar} />}
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
        <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.theirMessageText]}>
          {message.text}
        </Text>
        <View style={styles.messageFooter}>
          <MessageTimestamp timestamp={message.timestamp} isRead={isMyMessage && message.isRead} />
        </View>
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.timestamp.getTime() === nextProps.message.timestamp.getTime() &&
    prevProps.message.isRead === nextProps.message.isRead &&
    prevProps.currentUserId === nextProps.currentUserId
  );
});

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#A855F7',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#31214A',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
});