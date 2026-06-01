import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, Platform, StyleSheet } from 'react-native';
import { EmptyChatState } from './EmptyChatState';
import { MessageBubble } from './MessageBubble';

type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
};

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  avatar?: { uri: string };
  icebreaker?: string | null;
  icebreakerDismissed?: boolean;
  onUseIcebreaker: () => void;
  onDismissIcebreaker: () => void;
  contentContainerStyle?: any;
  onAtBottomChange?: (isAtBottom: boolean) => void;
}

export interface MessageListRef {
  scrollToBottom: () => void;
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(({
  messages,
  currentUserId,
  avatar,
  icebreaker,
  icebreakerDismissed,
  onUseIcebreaker,
  onDismissIcebreaker,
  contentContainerStyle,
  onAtBottomChange,
}, ref) => {
  const flatListRef = useRef<FlatList>(null);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      flatListRef.current?.scrollToEnd({ animated: true });
    },
  }));

  const handleScroll = useCallback((event: any) => {
    if (!onAtBottomChange) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    onAtBottomChange(distanceFromBottom < 80);
  }, [onAtBottomChange]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      currentUserId={currentUserId}
      avatar={avatar}
    />
  ), [currentUserId, avatar]);

  const keyExtractor = useCallback((item: Message) => `msg-${item.id}`, []);

  const ListEmptyComponent = useMemo(() => (
    <EmptyChatState
      icebreaker={icebreaker}
      dismissed={icebreakerDismissed}
      onUseIcebreaker={onUseIcebreaker}
      onDismissIcebreaker={onDismissIcebreaker}
    />
  ), [icebreaker, icebreakerDismissed, onUseIcebreaker, onDismissIcebreaker]);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={messages.length === 0 ? ListEmptyComponent : null}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      removeClippedSubviews={Platform.OS === 'android'}
      onScroll={onAtBottomChange ? handleScroll : undefined}
      scrollEventThrottle={onAtBottomChange ? 100 : undefined}
      overScrollMode="never"
      style={styles.container}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0B2E',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#1A0B2E',
  },
});