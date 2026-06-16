import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications/build/Notifications.types';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

const DEVICE_ID_KEY = '@astrodate_push_device_id';
const EXPO_TOKEN_KEY = '@astrodate_expo_push_token';

type NotificationPayload = {
  type?: string;
  chat_id?: string;
  match_id?: string;
  sender_id?: string;
};

type NotificationPreferenceInput = {
  new_matches_enabled?: boolean;
  new_messages_enabled?: boolean;
  marketing_enabled?: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // show banner even when app is in foreground
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function syncPushTokenForCurrentUser(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) return;

  const permission = await getNotificationPermission();
  if (!permission) {
    await deactivateCurrentDevicePushToken();
    return;
  }

  const token = await getExpoPushToken();
  if (!token) return;

  const deviceId = await getStableDeviceId();
  await AsyncStorage.setItem(EXPO_TOKEN_KEY, token);

  const { error } = await supabase.rpc('register_push_token', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
    p_device_id: deviceId,
  });

  if (error) {
    console.warn('[notifications] push token registration failed:', error.message);
  }
}

export async function deactivateCurrentDevicePushToken(): Promise<void> {
  try {
    const [deviceId, token] = await Promise.all([
      AsyncStorage.getItem(DEVICE_ID_KEY),
      AsyncStorage.getItem(EXPO_TOKEN_KEY),
    ]);

    const { data } = await supabase.auth.getUser();
    if (!data?.user?.id) return;

    const { error } = await supabase.rpc('revoke_push_token', {
      p_expo_push_token: token,
      p_device_id: deviceId,
    });

    if (error) {
      console.warn('[notifications] push token revoke failed:', error.message);
      return;
    }

    await AsyncStorage.removeItem(EXPO_TOKEN_KEY);
  } catch (error) {
    console.warn(
      '[notifications] push token revoke threw:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function syncNotificationPreferences(
  preferences: NotificationPreferenceInput
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) return;

  const { error } = await supabase.rpc('update_notification_preferences', {
    p_new_matches_enabled: preferences.new_matches_enabled ?? null,
    p_new_messages_enabled: preferences.new_messages_enabled ?? null,
    p_marketing_enabled: preferences.marketing_enabled ?? null,
  });

  if (error) {
    console.warn('[notifications] preference sync failed:', error.message);
  }
}

export async function drainPendingPushNotifications(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) return;

  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: { batch_size: 25 },
  });

  if (error) {
    console.warn('[notifications] push queue drain failed:', error.message);
  }
}

export function setupNotificationListeners(): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification: Notification) => {
    console.log('[notifications] foreground notification received:', notification.request.identifier);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response: NotificationResponse) => {
    const payload = response.notification.request.content.data as NotificationPayload;
    openNotificationDestination(payload);
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response: NotificationResponse | null) => {
      if (!response) return;
      const payload = response.notification.request.content.data as NotificationPayload;
      openNotificationDestination(payload);
    })
    .catch((error: unknown) => {
      console.warn(
        '[notifications] initial notification response failed:',
        error instanceof Error ? error.message : String(error)
      );
    });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function syncPushOnAppActive(): Promise<void> {
  if (AppState.currentState !== 'active') return;
  await syncPushTokenForCurrentUser();
  await drainPendingPushNotifications();
}

async function getNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;

    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return tokenResult.data;
  } catch (error) {
    console.warn(
      '[notifications] Expo push token unavailable:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function getStableDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const next = `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function openNotificationDestination(payload: NotificationPayload): void {
  if (!payload) return;

  // DB sends 'new_message' and 'new_match' — match both forms for safety
  const isMessage = payload.type === 'new_message' || payload.type === 'message';
  const isMatch   = payload.type === 'new_match'   || payload.type === 'match';

  if ((isMessage || isMatch) && (payload.chat_id || payload.sender_id)) {
    router.push({
      pathname: '/chat/[id]',
      params: { id: (payload.chat_id || payload.sender_id) as string },
    });
  }
}