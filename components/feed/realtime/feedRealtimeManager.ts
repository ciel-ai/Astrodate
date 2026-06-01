/* eslint-disable @typescript-eslint/no-explicit-any */
import { releaseRealtimeChannel, releaseRealtimeChannelsByTopicPrefix } from '@/lib/realtime-channels';

export function removeFeedChannelsByTopicPrefix(client: any, topicPrefix: string) {
  releaseRealtimeChannelsByTopicPrefix(client, topicPrefix);
}

export function cleanupFeedChannel(client: any, channel: any) {
  releaseRealtimeChannel(client, channel);
}
