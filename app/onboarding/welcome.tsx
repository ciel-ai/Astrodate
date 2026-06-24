import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background Illustration */}
      <Image
        source={require('@/assets/images/get_started_bg.png')}
        style={styles.bgIllustration}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Spacer keeps the card anchored to the bottom */}
        <View />

        {/* Bottom Section containing the Glassmorphism Card and Button */}
        <View style={styles.bottomSection}>
          <BlurView
            intensity={60}
            tint="dark"
            style={styles.glassCard}
          >
            <Text style={styles.cardHeaderStar}>✦</Text>

            <Text style={styles.cardTitle}>
              Find Your{'\n'}
              <Text style={styles.cardTitleHighlight}>Cosmic Match</Text>
            </Text>

            {/* Star Divider with fading lines */}
            <View style={styles.dividerContainer}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.25)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
              <Text style={styles.dividerStar}>✦</Text>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dividerLine}
              />
            </View>

            <Text style={styles.cardSubtitle}>
              Connect with people whose{'\n'}
              energy aligns with yours.{'\n'}
              Powered by zodiac compatibility.
            </Text>
          </BlurView>

          {/* Get Started Button */}
          <TouchableOpacity
            onPress={() => router.push('/onboarding/signup')}
            activeOpacity={0.85}
            style={styles.buttonWrapper}
          >
            <LinearGradient
              colors={['#A855F7', '#6366F1']}
              style={styles.getStartedButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.getStartedButtonText}>✦ Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04020b', // deep cosmic black background
  },
  bgIllustration: {
    position: 'absolute',
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    top: -SCREEN_HEIGHT * 0.04, // shifted down to original spacious position
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bottomSection: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
  },
  glassCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(13, 6, 28, 0.7)', // translucent dark purple matching mockup card
    overflow: 'hidden',
  },
  cardHeaderStar: {
    color: '#A855F7',
    fontSize: 16,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
  },
  cardTitleHighlight: {
    color: '#A855F7', // bright vibrant purple matching the mockup
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%', // smaller divider matching mockup
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerStar: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
    marginHorizontal: 10,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#CBD5E1', // softer off-white for premium text contrast
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.85,
    paddingHorizontal: 10,
  },
  buttonWrapper: {
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 30,
    shadowColor: '#A855F7',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  getStartedButton: {
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
