import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface FloatingActionButtonsProps {
  onPass: () => void;
  onSuperLike: () => void;
  onLike: () => void;
}

export default function FloatingActionButtons({
  onPass,
  onSuperLike,
  onLike,
}: FloatingActionButtonsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPass} activeOpacity={0.8}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
          style={[styles.button, styles.smallButton]}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSuperLike} activeOpacity={0.8}>
        <LinearGradient
          colors={['#A855F7', '#7E22CE']}
          style={[styles.button, styles.largeButton]}
        >
          <Ionicons name="star" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={onLike} activeOpacity={0.8}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
          style={[styles.button, styles.smallButton]}
        >
          <Ionicons name="heart" size={28} color="#34D399" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    zIndex: 100,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  smallButton: {
    width: 60,
    height: 60,
  },
  largeButton: {
    width: 72,
    height: 72,
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
});
