import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Profile } from '../utils/profileHelpers';

interface MatchModalProps {
  visible: boolean;
  onRequestClose: () => void;
  matchedProfile: Profile | null;
  currentUserPhoto: any;
  matchAstroScore: number | null;
  matchIcebreaker: string | null;
  onSendMessage: () => void;
}

export function MatchModal({
  visible,
  onRequestClose,
  matchedProfile,
  currentUserPhoto,
  matchAstroScore,
  matchIcebreaker,
  onSendMessage,
}: MatchModalProps) {
  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }));
  }, []);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      {matchedProfile && (
        <LinearGradient
          colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.matchOverlay}
        >
          {/* Starfield background */}
          <View style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}>
            {stars.map((star) => (
              <View
                key={`match-star-${star.id}`}
                style={{
                  position: 'absolute',
                  backgroundColor: '#FFFFFF',
                  borderRadius: star.size / 2,
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                }}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.matchBackButton} onPress={onRequestClose}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingTop: 80, // Space for the close button
              paddingBottom: 40,
              paddingHorizontal: 24,
            }}
            style={{ width: '100%' }}
          >
            {/* Match Cards - Redesigned as Planetary Spheres */}
            <View style={styles.matchCardsContainer}>
              {/* Current User Card (Left) */}
              <View style={[styles.matchProfileCard, styles.matchCardLeft, styles.planetarySphere]}>
                <Image
                  source={
                    currentUserPhoto?.thumbnail
                      ? { uri: currentUserPhoto.thumbnail }
                      : typeof currentUserPhoto === 'string'
                      ? { uri: currentUserPhoto }
                      : currentUserPhoto
                  }
                  style={styles.matchProfileImage}
                  contentFit="cover"
                />
              </View>

              {/* Matched User Card (Right) */}
              <View style={[styles.matchProfileCard, styles.matchCardRight, styles.planetarySphere]}>
                <Image
                  source={
                    matchedProfile?.photos?.[0]?.thumbnail
                      ? { uri: matchedProfile.photos[0].thumbnail }
                      : typeof matchedProfile?.image === 'string'
                      ? { uri: matchedProfile?.image }
                      : matchedProfile?.image
                  }
                  style={styles.matchProfileImage}
                  contentFit="cover"
                />
              </View>

              {/* Pink Heart Icon at bottom center of overlapping images */}
              <View style={styles.matchHeartIcon}>
                <MaterialIcons name="favorite" size={44} color="#EC4899" />
              </View>
            </View>

            {/* Match Text */}
            <View style={styles.matchTextContainer}>
              <Text style={[styles.matchTitle, { color: '#FFFFFF' }]}>It's a Match!</Text>
              <Text style={[styles.matchSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                You and {matchedProfile.name} liked each other. Start a conversation!
              </Text>
            </View>

            {/* AstroScore Ring */}
            {matchAstroScore !== null && (
              <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 4,
                    borderColor:
                      matchAstroScore >= 75
                        ? '#f59e0b'
                        : matchAstroScore >= 50
                        ? '#8b5cf6'
                        : '#6b7280',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>
                    {matchAstroScore}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, marginTop: -2 }}>
                    AstroScore
                  </Text>
                </View>
              </View>
            )}

            {/* Icebreaker Suggestion Chip */}
            {matchIcebreaker && (
              <View
                style={{
                  marginHorizontal: 20,
                  marginTop: 12,
                  marginBottom: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  padding: 12,
                  alignSelf: 'stretch',
                }}
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 4,
                    letterSpacing: 0.5,
                  }}
                >
                  ✨ SUGGESTED OPENER
                </Text>
                <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18 }}>
                  {matchIcebreaker}
                </Text>
              </View>
            )}

            {/* Send Message Button */}
            <Pressable
              style={[styles.matchSendButton, { alignSelf: 'stretch', marginHorizontal: 20 }]}
              onPress={onSendMessage}
              android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: false }}
            >
              <MaterialIcons name="chat" size={24} color="#FFFFFF" />
              <Text style={styles.matchSendButtonText}>Send Message</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  matchOverlay: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  matchBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  matchCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
    height: 300,
    position: 'relative',
    zIndex: 1,
    width: '100%',
  },
  matchProfileCard: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  planetarySphere: {
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.7)',
  },
  matchCardLeft: {
    left: '5%',
    transform: [{ rotate: '-10deg' }],
    zIndex: 1,
  },
  matchCardRight: {
    right: '5%',
    transform: [{ rotate: '10deg' }],
    zIndex: 2,
  },
  matchProfileImage: {
    width: '100%',
    height: '100%',
  },
  matchHeartIcon: {
    position: 'absolute',
    bottom: 25,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  matchTextContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    zIndex: 1,
  },
  matchTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  matchSubtitle: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  matchSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A855F7',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    marginHorizontal: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  matchSendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
