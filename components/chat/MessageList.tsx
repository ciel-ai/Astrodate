import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { EmptyChatState } from './EmptyChatState';
import { MessageBubble } from './MessageBubble';

type Message = {
  id: string; text: string; senderId: string; timestamp: Date;
  isRead?: boolean; isOptimistic?: boolean; isFailed?: boolean;
};

type ListItem =
  | { type: 'message'; data: Message }
  | { type: 'date_divider'; label: string }
  | { type: 'unread_divider' };

interface MessageListProps {
  messages: Message[]; currentUserId: string; avatar?: { uri: string };
  icebreaker?: string | null; icebreakerDismissed?: boolean;
  onUseIcebreaker: () => void; onDismissIcebreaker: () => void;
  contentContainerStyle?: any; onAtBottomChange?: (isAtBottom: boolean) => void;
  onRetry?: (message: Message) => void;
}

export interface MessageListRef {
  scrollToStart: (animated?: boolean) => void;
}

// ─── Date label helper ────────────────────────────────────────────────────────
function getDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function buildListItems(messages: Message[], currentUserId: string): ListItem[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const firstUnreadIdx = sorted.findLastIndex(
    (m) => m.senderId !== currentUserId && !m.isRead
  );

  const items: ListItem[] = [];

  sorted.forEach((msg, i) => {
    items.push({ type: 'message', data: msg });

    if (i === firstUnreadIdx && firstUnreadIdx !== sorted.length - 1) {
      items.push({ type: 'unread_divider' });
    }

    // Date divider — in inverted list the date appears *above* the messages of that day
    // by pushing it *after* we finish processing the messages for that date
    const nextMsg = sorted[i + 1];
    const currentDateLabel = getDateLabel(msg.timestamp);
    const nextDateLabel = nextMsg ? getDateLabel(nextMsg.timestamp) : null;

    if (currentDateLabel !== nextDateLabel) {
      items.push({ type: 'date_divider', label: currentDateLabel });
    }
  });

  return items;
}

// ─── Check if consecutive messages are from same sender ──────────────────────
function isSameGroup(items: ListItem[], idx: number): { top: boolean; bottom: boolean } {
  const current = items[idx];
  if (current.type !== 'message') return { top: false, bottom: false };

  const prev = items[idx - 1];
  const next = items[idx + 1];

  const sameAsPrev = prev?.type === 'message' && prev.data.senderId === current.data.senderId;
  const sameAsNext = next?.type === 'message' && next.data.senderId === current.data.senderId;

  return { top: sameAsPrev, bottom: sameAsNext };
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>((
  { messages, currentUserId, avatar, icebreaker, icebreakerDismissed,
    onUseIcebreaker, onDismissIcebreaker, contentContainerStyle, onAtBottomChange, onRetry },
  ref
) => {
  const flatListRef = useRef<FlatList>(null);

  useImperativeHandle(ref, () => ({
    scrollToStart: (animated = true) => flatListRef.current?.scrollToOffset({ offset: 0, animated }),
  }));

  const handleScroll = useCallback((event: any) => {
    if (!onAtBottomChange) return;
    onAtBottomChange(event.nativeEvent.contentOffset.y < 80);
  }, [onAtBottomChange]);

  const listItems = useMemo(() => buildListItems(messages, currentUserId), [messages, currentUserId]);

  // Instagram-style "Seen": show it under our most recent message, but only
  // while that message is still the latest in the whole thread (it vanishes the
  // moment the other person replies, since their reply becomes the newest item
  // and already implies they saw it). messages are newest-first once sorted.
  const seenMessageId = useMemo(() => {
    if (messages.length === 0) return null;
    const latest = messages.reduce((newest, m) =>
      m.timestamp.getTime() > newest.timestamp.getTime() ? m : newest
    );
    return latest.senderId === currentUserId && latest.isRead ? latest.id : null;
  }, [messages, currentUserId]);

  const renderItem = useCallback(({ item, index }: { item: ListItem; index: number }) => {
    if (item.type === 'date_divider') {
      return (
        <View style={styles.dateDivider}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{item.label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }
    if (item.type === 'unread_divider') {
      return (
        <View style={styles.unreadDivider}>
          <View style={styles.unreadLine} />
          <Text style={styles.unreadText}>New messages</Text>
          <View style={styles.unreadLine} />
        </View>
      );
    }

    const { top: sameAbove, bottom: sameBelow } = isSameGroup(listItems, index);
    const isMyMessage = item.data.senderId === currentUserId;
    // Tighten vertical gap for consecutive same-sender messages
    const marginBottom = sameAbove ? 2 : 8;

    return (
      <View style={[styles.messageItem, { marginBottom }]}>
        <MessageBubble
          message={item.data}
          currentUserId={currentUserId}
          avatar={!sameAbove ? avatar : undefined}
          onRetry={onRetry}
        />
        {item.data.id === seenMessageId && (
          <Text style={styles.seenText}>Seen</Text>
        )}
      </View>
    );
  }, [currentUserId, avatar, onRetry, listItems, seenMessageId]);

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === 'date_divider') return `date-${item.label}-${index}`;
    if (item.type === 'unread_divider') return 'unread_divider';
    return `msg-${item.data.id}`;
  }, []);

  const ListEmptyComponent = useMemo(() => (
    <EmptyChatState icebreaker={icebreaker} dismissed={icebreakerDismissed}
      onUseIcebreaker={onUseIcebreaker} onDismissIcebreaker={onDismissIcebreaker} />
  ), [icebreaker, icebreakerDismissed, onUseIcebreaker, onDismissIcebreaker]);

  return (
    <FlatList
      ref={flatListRef}
      data={listItems}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={messages.length === 0 ? ListEmptyComponent : null}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      removeClippedSubviews={Platform.OS === 'android'}
      onScroll={onAtBottomChange ? handleScroll : undefined}
      scrollEventThrottle={onAtBottomChange ? 80 : undefined}
      overScrollMode="never"
      style={styles.container}
      maxToRenderPerBatch={15}
      windowSize={12}
      initialNumToRender={20}
      inverted
      scrollsToTop={false}
      indicatorStyle="white"
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      showsVerticalScrollIndicator={false}
    />
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#130820' },
  contentContainer: { paddingHorizontal: 12, paddingTop: 32, paddingBottom: 6, backgroundColor: '#130820' },
  messageItem: { marginBottom: 8 },
  seenText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 3,
    marginRight: 4,
  },
  dateDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 16, marginHorizontal: 8, gap: 10,
  },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  dateText: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
    letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 2,
  },
  unreadDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 12, marginHorizontal: 8, gap: 10,
  },
  unreadLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(168,85,247,0.3)' },
  unreadText: {
    fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: '600',
    letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 2,
  },
});