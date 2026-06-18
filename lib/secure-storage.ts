import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// SecureStore is native-only; fall back to AsyncStorage on web/Expo Go.
const isWeb = Platform.OS === 'web';

function getSecureStore() {
  if (isWeb) return null;
  try {
    return require('expo-secure-store');
  } catch (e) {
    console.warn('[secure-storage] expo-secure-store not available in this environment, using AsyncStorage fallback:', e);
    return null;
  }
}

/**
 * Read a value from SecureStore (native) or AsyncStorage (web/Expo Go fallback).
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    return AsyncStorage.getItem(key);
  }

  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;

    // One-time migration: promote legacy plaintext value to SecureStore.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      try {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
      } catch (writeErr) {
        console.warn('[secure-storage] Migration write failed:', writeErr);
      }
      return legacy;
    }
  } catch (e) {
    console.warn('[secure-storage] SecureStore read failed, falling back:', e);
    return AsyncStorage.getItem(key);
  }

  return null;
}

/**
 * Write a value to SecureStore (native) or AsyncStorage (web/Expo Go fallback).
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('[secure-storage] SecureStore write failed, falling back:', e);
    await AsyncStorage.setItem(key, value);
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    await AsyncStorage.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn('[secure-storage] SecureStore delete failed, falling back:', e);
    await AsyncStorage.removeItem(key);
  }
}
