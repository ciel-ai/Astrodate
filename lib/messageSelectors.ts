type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
  isOptimistic?: boolean;
  isFailed?: boolean;
};

/**
 * Get messages sorted by timestamp (oldest first)
 */
export const selectSortedMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

/**
 * Get messages grouped by date
 */
export const selectMessagesGroupedByDate = (messages: Message[]): Record<string, Message[]> => {
  const sorted = selectSortedMessages(messages);
  const grouped: Record<string, Message[]> = {};

  sorted.forEach((message) => {
    const dateKey = message.timestamp.toDateString();
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(message);
  });

  return grouped;
};

/**
 * Get optimistic (pending) messages
 */
export const selectPendingMessages = (messages: Message[]): Message[] => {
  return messages.filter((msg) => msg.isOptimistic);
};

/**
 * Get failed messages
 */
export const selectFailedMessages = (messages: Message[]): Message[] => {
  return messages.filter((msg) => msg.isFailed);
};

/**
 * Get messages from a specific sender
 */
export const selectMessagesBySender = (messages: Message[], senderId: string): Message[] => {
  return messages.filter((msg) => msg.senderId === senderId);
};

/**
 * Get unread messages
 */
export const selectUnreadMessages = (messages: Message[], currentUserId: string): Message[] => {
  return messages.filter((msg) => msg.senderId !== currentUserId && !msg.isRead);
};

/**
 * Get message count
 */
export const selectMessageCount = (messages: Message[]): number => {
  return messages.length;
};

/**
 * Get last message
 */
export const selectLastMessage = (messages: Message[]): Message | null => {
  if (messages.length === 0) return null;
  const sorted = selectSortedMessages(messages);
  return sorted[sorted.length - 1];
};
