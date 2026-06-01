/* eslint-disable @typescript-eslint/no-explicit-any */
import { releaseRealtimeChannels, releaseRealtimeChannelsByTopicPrefix, safeReleaseExistingChannel } from '@/lib/realtime-channels';

export function removeChatChannelsByTopicPrefix(client: any, topicPrefix: string) {
  releaseRealtimeChannelsByTopicPrefix(client, topicPrefix);
}

export function safeReleaseChatChannel(client: any, exactTopic: string) {
  safeReleaseExistingChannel(client, exactTopic);
}

export function cleanupChatChannels(client: any, channels: any[]) {
  releaseRealtimeChannels(client, channels);
}
