import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { deactivateCurrentDevicePushToken } from '@/lib/notifications';
import { deleteSecureItem } from '@/lib/secure-storage';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { showAlert } = useAuthAlert();
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    showAlert('Delete Account', 'This action is permanent and cannot be undone. Are you absolutely sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error('Not authenticated');

            // Deactivate push token first before account deletion
            await deactivateCurrentDevicePushToken().catch(console.warn);

            const { data: fnData, error } = await supabase.functions.invoke('delete-user-account', {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });

            if (error) {
              // Extract detailed error from response context if available
              let errMsg = error.message || 'Failed to delete account';
              if (error.context) {
                try {
                  const errBody = await error.context.json?.() || error.context;
                  if (errBody?.error) errMsg = errBody.error;
                  console.error('Edge function error detail:', JSON.stringify(errBody));
                } catch {}
              }
              console.error('Delete account error:', error, 'Details:', errMsg);
              throw new Error(errMsg);
            }
            await deleteSecureItem('userBasicDetails').catch(() => {});
            await deleteSecureItem('userBirthDetails').catch(() => {});
            await supabase.auth.signOut();
            // Auth listener will handle redirection
          } catch (err: any) {
            console.error('Delete account error full:', err);
            showAlert('Error', err.message || 'Failed to delete account. Please try again later.');
            setLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <MaterialIcons name="warning" size={64} color="#F87171" style={styles.icon} />
          
          <Text style={styles.title}>Are you sure?</Text>
          
          <Text style={styles.description}>
            Deleting your account will permanently erase all your data, including matches, messages, and photos. This action cannot be undone.
          </Text>

          <TouchableOpacity 
            style={[styles.deleteButton, loading && styles.disabledButton]} 
            onPress={handleDelete}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityLabel="Permanently delete my account"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a0d2e' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  deleteButton: {
    backgroundColor: '#F87171',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
