import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthAlert } from '@/lib/auth-alert-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSecureItem } from '@/lib/secure-storage';

// Signal any waiting openAuthSessionAsync to complete with the redirect URL
WebBrowser.maybeCompleteAuthSession();

// Module-level lock to prevent duplicate execution across component remounts (e.g. StrictMode)
let _lastProcessedTime = 0;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code, error, error_description, action, url } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    action?: string;
    url?: string;
  }>();
  const { showAlert } = useAuthAlert();
  
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasProcessed = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const codeVal = Array.isArray(code) ? code[0] : code;
  const errorVal = Array.isArray(error) ? error[0] : error;
  const errorDescriptionVal = Array.isArray(error_description) ? error_description[0] : error_description;
  const actionVal = Array.isArray(action) ? action[0] : action;
  const urlVal = Array.isArray(url) ? url[0] : url;

  useEffect(() => {
    const getIsLinkingFlow = async (parsedAction?: string | null) => {
      try {
        const storedAction = await AsyncStorage.getItem('oauth_flow_action');
        console.log('🔍 [auth/callback] Stored flow action:', storedAction, 'parsed action:', parsedAction);
        return storedAction === 'link' || parsedAction === 'link' || actionVal === 'link';
      } catch (e) {
        console.warn('⚠️ [auth/callback] Error reading oauth_flow_action:', e);
        return parsedAction === 'link' || actionVal === 'link';
      }
    };

    const checkUserAndNavigate = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        if (!userId) {
          console.warn('⚠️ [auth/callback] No user found in session');
          setErrorMsg('No user session could be retrieved.');
          setStatus('error');
          return;
        }

        console.log('🔍 [auth/callback] Checking profile for user:', userId);
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileError) {
          console.error('❌ [auth/callback] Profile lookup error:', profileError);
          // Fallback redirect to onboarding basic details
          router.replace('/onboarding/basic-details');
          return;
        }

        if (profile) {
          console.log('➡️ [auth/callback] Profile exists. Routing to tabs.');
          router.replace('/(tabs)');
        } else {
          console.log('➡️ [auth/callback] Profile does not exist. Routing to onboarding basic-details.');
          router.replace({
            pathname: '/onboarding/basic-details',
            params: {
              prefillEmail: user.email || undefined,
            }
          });
        }
      } catch (err: any) {
        console.error('❌ [auth/callback] Navigation check failed:', err);
        setErrorMsg(err?.message || 'Failed to verify account profiles.');
        setStatus('error');
      }
    };

    const handleLinkSuccess = async (bypassLock = false) => {
      if (!bypassLock) {
        const now = Date.now();
        if (now - _lastProcessedTime < 3000) {
          console.log('⏳ [auth/callback] Skip link: already processed recently');
          return;
        }
        _lastProcessedTime = now;
        hasProcessed.current = true;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      try {
        console.log('🔗 [auth/callback] Processing link identity success...');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        let linkedEmail = userData?.user?.email;
        if (userData?.user?.identities) {
          const googleIdentity = userData.user.identities.find((id: any) => id.provider === 'google');
          if (googleIdentity?.identity_data?.email) {
            linkedEmail = googleIdentity.identity_data.email;
          }
        }

        console.log('✅ [auth/callback] Link successful. Saving email to AsyncStorage:', linkedEmail);
        const storageEmail = linkedEmail || userData?.user?.email || '';
        if (storageEmail) {
          await setSecureItem('oauth_linked_email', storageEmail);
        }

        // Clean up flow action
        await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

        console.log('➡️ [auth/callback] Navigating back to basic-details...');
        router.navigate('/onboarding/basic-details');
      } catch (err: any) {
        console.error('❌ [auth/callback] Error finalizing link identity:', err);
        
        // Clean up flow action on error too
        await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

        const msg = (err?.message || '').toLowerCase();
        const isStaleUser = msg.includes('sub claim') || 
                            msg.includes('user_not_found') || 
                            msg.includes('user not found') ||
                            (err?.status === 400 && msg.includes('jwt'));
        
        if (isStaleUser) {
          showAlert(
            'Session Expired',
            'Your login session is invalid or has expired. Please sign in again.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  try {
                    await supabase.auth.signOut();
                    await AsyncStorage.removeItem('userBasicDetails');
                  } catch (signOutErr) {
                    console.warn('Sign out error:', signOutErr);
                  }
                  router.replace('/onboarding/welcome');
                }
              }
            ]
          );
          return;
        }

        showAlert('Link Failed', err?.message || 'Failed to retrieve linked account details.');
        setErrorMsg(err?.message || 'Failed to link Google identity.');
        setStatus('error');
      }
    };

    const exchangeCode = async (codeValue: string, linkingFlow = false) => {
      const now = Date.now();
      if (now - _lastProcessedTime < 3000) {
        console.log('⏳ [auth/callback] Skip exchange: already processed recently');
        return;
      }
      _lastProcessedTime = now;
      hasProcessed.current = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      try {
        console.log('🔑 [auth/callback] Exchanging code for session... linkingFlow:', linkingFlow);
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(codeValue);
        if (sessionError) throw sessionError;

        console.log('✅ [auth/callback] Session exchange successful:', sessionData.session?.user?.id);
        
        // Clean up flow action after code exchange
        await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

        if (linkingFlow) {
          await handleLinkSuccess(true);
        } else {
          await checkUserAndNavigate();
        }
      } catch (err: any) {
        console.error('❌ [auth/callback] Code exchange failed:', err);
        
        await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

        showAlert('Login Failed', err?.message || 'Failed to exchange authentication code.');
        setErrorMsg(err?.message || 'Verification code exchange failed.');
        setStatus('error');
      }
    };

    const parseAuthUrl = (urlStr: string) => {
      let codeVal: string | null = null;
      let actionValQuery: string | null = null;
      let access_token: string | null = null;
      let refresh_token: string | null = null;
      let errVal: string | null = null;
      let errDescVal: string | null = null;

      // 1. Parse query params
      if (urlStr.includes('?')) {
        const queryStr = urlStr.split('?')[1]?.split('#')[0] || '';
        const pairs = queryStr.split('&');
        for (const pair of pairs) {
          const [k, v] = pair.split('=');
          if (k === 'code' && v) codeVal = decodeURIComponent(v);
          if (k === 'action' && v) actionValQuery = decodeURIComponent(v);
          if (k === 'error' && v) errVal = decodeURIComponent(v);
          if (k === 'error_description' && v) errDescVal = decodeURIComponent(v);
        }
      }

      // 2. Parse hash fragment
      if (urlStr.includes('#')) {
        const hashStr = urlStr.split('#')[1] || '';
        const pairs = hashStr.split('&');
        for (const pair of pairs) {
          const [k, v] = pair.split('=');
          if (k === 'access_token' && v) access_token = decodeURIComponent(v);
          if (k === 'refresh_token' && v) refresh_token = decodeURIComponent(v);
          if (k === 'error' && v) errVal = decodeURIComponent(v);
          if (k === 'error_description' && v) errDescVal = decodeURIComponent(v);
        }
      }

      return { code: codeVal, action: actionValQuery, access_token, refresh_token, error: errVal, error_description: errDescVal };
    };

    const processUrl = async (urlStr: string) => {
      console.log('🔗 [auth/callback] Processing URL:', urlStr);
      const parsed = parseAuthUrl(urlStr);
      const activeLinking = await getIsLinkingFlow(parsed.action);

      if (parsed.error) {
        const now = Date.now();
        if (now - _lastProcessedTime < 3000) return;
        _lastProcessedTime = now;
        hasProcessed.current = true;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        console.error('❌ [auth/callback] OAuth error from URL:', parsed.error, parsed.error_description);
        showAlert('Authentication Failed', parsed.error_description || 'Could not log in. Please try again.');
        setErrorMsg(parsed.error_description || 'Authentication failed.');
        setStatus('error');
        return;
      }

      if (parsed.access_token && parsed.refresh_token) {
        const now = Date.now();
        if (now - _lastProcessedTime < 3000) return;
        _lastProcessedTime = now;
        hasProcessed.current = true;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        try {
          console.log('🔑 [auth/callback] Setting session from hash fragment...');
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          if (sessionError) throw sessionError;

          console.log('✅ [auth/callback] Set session successful');
          
          await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

          if (activeLinking) {
            await handleLinkSuccess(true);
          } else {
            await checkUserAndNavigate();
          }
        } catch (err: any) {
          console.error('❌ [auth/callback] Set session failed:', err);
          
          await AsyncStorage.removeItem('oauth_flow_action').catch(() => {});

          showAlert('Login Failed', err?.message || 'Failed to initialize session.');
          setErrorMsg(err?.message || 'Failed to initialize login session.');
          setStatus('error');
        }
        return;
      }

      if (parsed.code) {
        await exchangeCode(parsed.code, activeLinking);
        return;
      }
    };

    const handleCallback = async () => {
      // Dismiss the browser tab immediately on screen mount
      try {
        WebBrowser.dismissBrowser();
      } catch (e) { console.warn('[WebBrowser] dismissBrowser failed:', e); }

      // Prioritize the custom passed URL parameter (if populated)
      const passedUrl = urlVal ? decodeURIComponent(urlVal) : null;
      if (passedUrl) {
        console.log('🔗 [auth/callback] Found passed URL param, processing:', passedUrl);
        await processUrl(passedUrl);
        return;
      }

      if (errorVal) {
        console.error('❌ [auth/callback] OAuth error from params:', errorVal, errorDescriptionVal);
        showAlert('Authentication Failed', errorDescriptionVal || 'Could not log in. Please try again.');
        setErrorMsg(errorDescriptionVal || 'Authentication failed.');
        setStatus('error');
        return;
      }

      if (codeVal) {
        const linking = await getIsLinkingFlow();
        await exchangeCode(codeVal, linking);
        return;
      }

      // Check if session is already active (Google login might have logged us in in the background)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const now = Date.now();
          if (now - _lastProcessedTime < 3000) {
            console.log('⏳ [auth/callback] Skip active session check: already processed recently');
            return;
          }
          console.log('🔗 [auth/callback] Found active session in background, navigating...');
          const linking = await getIsLinkingFlow();
          if (linking) {
            await handleLinkSuccess(true);
          } else {
            _lastProcessedTime = now;
            hasProcessed.current = true;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            await checkUserAndNavigate();
          }
          return;
        }
      } catch (e) {
        console.warn('⚠️ [auth/callback] Error checking active session:', e);
      }

      // Check initial URL (cold start redirect)
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('auth/callback')) {
          console.log('🔗 [auth/callback] Found callback in initial URL (cold start):', initialUrl);
          await processUrl(initialUrl);
          return;
        }
      } catch (err) {
        console.error('❌ [auth/callback] Error checking initial URL:', err);
      }

      // Wait up to 3 seconds for params or session to populate (handles Expo Router race conditions)
      if (!timeoutRef.current) {
        console.log('⏳ [auth/callback] Deferring error handling in case params/session load in next frames...');
        timeoutRef.current = setTimeout(async () => {
          if (hasProcessed.current) return;
          
          // Final check for session before failing
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            console.log('🔗 [auth/callback] Found session after delay, navigating...');
            const linking = await getIsLinkingFlow();
            if (linking) {
              await handleLinkSuccess(true);
            } else {
              const now = Date.now();
              _lastProcessedTime = now;
              hasProcessed.current = true;
              await checkUserAndNavigate();
            }
            return;
          }

          const now = Date.now();
          if (now - _lastProcessedTime < 3000) {
            return;
          }
          _lastProcessedTime = now;
          hasProcessed.current = true;

          console.error('❌ [auth/callback] Timeout: No code or tokens found in redirect URL');
          setErrorMsg('Authentication timed out. No code or tokens were found in the redirect URL.');
          setStatus('error');
        }, 3000);
      }
    };

    handleCallback();

    // Subscribe to incoming URL events (warm start redirect)
    const subscription = Linking.addEventListener('url', ({ url: incomingUrl }) => {
      if (incomingUrl && incomingUrl.includes('auth/callback')) {
        console.log('🔗 [auth/callback] Warm-start deep link received:', incomingUrl);
        processUrl(incomingUrl);
      }
    });

    return () => {
      subscription.remove();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [codeVal, errorVal, errorDescriptionVal, actionVal, urlVal, router, showAlert]);

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.errorIconContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
        </View>
        <Text style={styles.errorTitle}>Sign In Failed</Text>
        <Text style={styles.errorSubtitle}>
          {errorMsg || 'We encountered an error while verifying your session.'}
        </Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.replace('/onboarding/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Return to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#A855F7" />
      <Text style={styles.loadingText}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04020b',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#EDE8FF',
    fontSize: 16,
    fontWeight: '500',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorTitle: {
    color: '#EDE8FF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorSubtitle: {
    color: '#A89BC2',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


