import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);
    // TODO: send to crash reporting (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>Please restart the app</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false })}
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
  container: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#1A0B2E', padding:24 },
  title: { color:'#E0D4FF', fontSize:20, fontWeight:'700', marginBottom:8 },
  subtitle: { color:'#9B72CF', fontSize:14, marginBottom:24 },
  btn: { backgroundColor:'#7C3AED', paddingHorizontal:24, paddingVertical:12, borderRadius:20 },
  btnText: { color:'#fff', fontWeight:'700' },
});

// In app/_layout.tsx, wrap GestureHandlerRootView:
// <ErrorBoundary>
//   <GestureHandlerRootView ...>
//     ...
//   </GestureHandlerRootView>
// </ErrorBoundary>