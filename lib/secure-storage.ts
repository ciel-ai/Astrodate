import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore is native-only; fall back to AsyncStorage on web.
const isWeb = Platform.OS === 'web';

/**
 * Read a value from SecureStore (native) or AsyncStorage (web).
 * On first access after migration, transparently moves legacy AsyncStorage
 * values into SecureStore so existing users don't lose their cached data.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);

  const value = await SecureStore.getItemAsync(key);
  if (value !== null) return value;

  // One-time migration: promote legacy plaintext value to SecureStore.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy !== null) {
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  }

  return null;
}

/**
 * Write a value to SecureStore (native) or AsyncStorage (web).
 * SecureStore has a 2 KB per-value limit; ensure callers stay under that.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
