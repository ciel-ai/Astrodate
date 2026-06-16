import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// Signal any waiting openAuthSessionAsync to complete with the redirect URL.
// Called at module load so it fires before the component even mounts.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    // Go back to whichever screen triggered the OAuth flow so it can process
    // the result from openAuthSessionAsync.
    if (router.canGoBack()) router.back();
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#1A0B2E' }} />;
}
