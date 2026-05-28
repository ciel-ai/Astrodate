/* eslint-disable @typescript-eslint/no-explicit-any */

const ownedChannels = new Set<any>();

export function trackRealtimeChannel<T>(channel: T): T {
  if (channel) {
    ownedChannels.add(channel);
  }
  return channel;
}

export function releaseRealtimeChannel(client: any, channel: any) {
  if (!channel) return;
  ownedChannels.delete(channel);
  void client.removeChannel(channel);
}

export function releaseRealtimeChannels(client: any, channels: any[]) {
  channels.forEach((channel) => releaseRealtimeChannel(client, channel));
}

export function releaseRealtimeChannelsByTopicPrefix(client: any, topicPrefix: string) {
  const channels: any[] = client.getChannels();
  for (const channel of channels) {
    if (channel?.topic?.includes(topicPrefix)) {
      releaseRealtimeChannel(client, channel);
    }
  }
}

export function releaseAllOwnedRealtimeChannels(client: any) {
  for (const channel of Array.from(ownedChannels)) {
    releaseRealtimeChannel(client, channel);
  }
}