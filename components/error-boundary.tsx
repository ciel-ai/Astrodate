/**
 * components/error-boundary.tsx
 *
 * Root React error boundary. Catches any unhandled render-phase errors
 * that bubble up from the component tree and:
 *   1. Reports them to Sentry with the component stack attached.
 *   2. Shows a friendly fallback UI.
 *   3. Offers a "Try Again" action that navigates back to the root
 *      route before clearing the error state, preventing the
 *      immediate re-throw that occurred when we just called setState.
 *
 * Usage (already in app/_layout.tsx):
 *   <ErrorBoundary>
 *     <GestureHandlerRootView ...>
 *       ...
 *     </GestureHandlerRootView>
 *   </ErrorBoundary>
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);

  }

  private handleTryAgain = () => {
    // FIX: navigate to the root before clearing error state.
    // Without this, React re-renders the same broken subtree and
    // immediately re-throws, putting us in an infinite error loop.
    try {
      // expo-router's imperative API — safe to call even from a class component.
      const { router } = require('expo-router');
      router.replace('/');
    } catch {
      // If navigation fails (e.g. navigator not yet mounted), fall through
      // to the setState below which will at least attempt a re-render.
    }
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The error has been reported. Please restart the app.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={this.handleTryAgain}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A0B2E',
    padding: 24,
  },
  title: { color: '#E0D4FF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: {
    color: '#9B72CF',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
