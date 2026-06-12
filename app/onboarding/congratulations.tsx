import { router, useNavigation } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CongratulationsScreen() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;

  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }));
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    // Simple fade and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Logo animation
    setTimeout(() => {
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 200);
  }, []);

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjPuIe6xHZB-S1puG0EPAOQSCxNnt2FhsGfQzHkREMKAYUdyjm1bhlM1eHfcB1eEZYuClTwOrN2DATbTsrpLCAED82p_KQNBt-ydBgFHFoNmgzJGnhBlunGUuBhdavsLk0T1fHxN-vjzfZpu8XYBryJI9vbHRqJW3spYF8v9BRKHmKtQUutJljcPgKyq60nSv1DPo-lZL_TEtUkrrRAyk62VmeI3PnbeX7byAbYpMXezZZZR9F8NfonXnGEjvbNYdO3zNO425pIgmF' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      {/* Dark Overlay */}
      <View style={styles.overlay} />

      {/* Starry Background */}
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Top Spacer */}
          <View style={styles.topSpacer} />

          {/* Main Content Area */}
          <Animated.View
            style={[
              styles.mainContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}>
            {/* App Logo in Circle */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [{ scale: logoScaleAnim }],
                },
              ]}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../assets/images/logo-v2.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Success Message */}
            <View style={styles.messageContainer}>
              <Text style={styles.title}>It's Written in the Stars!</Text>
              <Text style={styles.message}>Your profile is complete! You are now ready to discover astrologically compatible matches.</Text>
            </View>
          </Animated.View>

          {/* Bottom Spacer and Button */}
          <View style={styles.bottomContainer}>
            {/* Continue Button */}
            <Animated.View
              style={[
                styles.buttonWrapper,
                {
                  opacity: fadeAnim,
                },
              ]}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
                activeOpacity={0.8}>
                <View style={styles.continueButtonGradient}>
                  <Text style={styles.continueButtonText}>Find Your Cosmic Match</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22101c',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(34, 16, 28, 0.8)',
    zIndex: 1,
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
  },
  safeArea: {
    flex: 1,
    zIndex: 3,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topSpacer: {
    flex: 1,
  },
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(238, 43, 173, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoImage: {
    width: 112,
    height: 112,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 56,
    padding: 12,
  },
  messageContainer: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '400',
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    paddingTop: 40,
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  continueButton: {
    borderRadius: 30,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#ee2bad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#ee2bad',
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.24,
  },
});
