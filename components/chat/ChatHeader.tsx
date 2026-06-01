import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TypingIndicator } from './TypingIndicator';

interface User {
  name: string;
  avatar: { uri: string };
  isOnline: boolean;
}

interface ChatHeaderProps {
  user: User;
  isOtherUserTyping: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  onBackPress: () => void;
  onMenuPress: () => void;
}

export function ChatHeader({ user, isOtherUserTyping, connectionStatus, onBackPress, onMenuPress }: ChatHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBackPress} activeOpacity={0.7}>
        <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={styles.headerContent}>
        <View style={styles.avatarContainer}>
          <Image source={user.avatar} style={styles.headerAvatar} />
          {user.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{user.name}</Text>
          {isOtherUserTyping ? (
            <TypingIndicator />
          ) : connectionStatus === 'disconnected' ? (
            <Text style={styles.connectionWarning}>⚠️ Reconnecting...</Text>
          ) : user.isOnline ? (
            <Text style={styles.onlineStatus}>Online</Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity style={styles.moreButton} onPress={onMenuPress} activeOpacity={0.7}>
        <MaterialIcons name="more-vert" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1A0B2E',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  onlineStatus: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  connectionWarning: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});