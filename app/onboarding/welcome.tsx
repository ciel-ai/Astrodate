import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top White Section */}
        <View style={styles.topSection}>
          <Image 
            source={require('@/assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>
            <Text style={styles.appNameStart}>Astro</Text>
            <Text style={styles.appNameEnd}>Date</Text>
          </Text>
        </View>

        {/* Bottom Section with Deep Purple Gradient */}
        <LinearGradient 
          colors={['#1A0B2E', '#2D1B4E', '#4A2C5A']} 
          style={styles.bottomSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.bottomContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome</Text>
              <Text style={styles.descriptionText}>Find someone who aligns with your stars — not just your vibes,</Text>
              <Text style={styles.descriptionText2}>Get into the app and explore the matches that are made in cosmos - powered by your zodiac</Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.signUpButton}
                onPress={() => router.push('/onboarding/signup')}
                activeOpacity={0.8}
              >
                <Text style={styles.signUpButtonText}>Sign Up</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={() => router.push('/onboarding/login')}
                activeOpacity={0.8}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT < 700 ? 40 : 60,
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appNameStart: {
    color: '#000000',
  },
  appNameEnd: {
    color: '#A855F7',
  },
  bottomSection: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 40,
    paddingBottom: 40,
    minHeight: SCREEN_HEIGHT * 0.55,
    flex: 2,
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 8,
    opacity: 0.9,
  },
  descriptionText2: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 32,
    opacity: 0.9,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  loginButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signUpButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});