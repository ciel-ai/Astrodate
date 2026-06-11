import IonIcons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EdgeInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CircularProgress } from './CircularProgress';
import {
  formatHobby,
  getDynamicBio,
  getInterestIcon,
  getLookingForText,
  getPromptsForProfile,
  getTagsForProfile,
  getZodiacSymbol,
  resolvePhotoSource,
} from '../utils/profileHelpers';
import type { Profile } from '../utils/profileHelpers';

// Re-export Profile so FeedScreen can still import from one place
export type { Profile };

// ── Constants shared with FeedScreen ─────────────────────────────────────────
// These mirror the module-level constants in FeedScreen.tsx.
// TODO(Step 8): move constants to utils/feedTypes.ts and import from there.
import { Dimensions } from 'react-native';
const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');

// ── Props ─────────────────────────────────────────────────────────────────────
interface ProfileCardProps {
  profile: Profile;
  insets: EdgeInsets;
  parallaxScrollRef: React.RefObject<Animated.ScrollView>;
  navigateToDetails: () => void;
  onRouteToDetails: (profile: Profile) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProfileCard({
  profile,
  insets,
  parallaxScrollRef,
  navigateToDetails,
  onRouteToDetails,
}: ProfileCardProps) {
  const profilePhotos =
    profile.photos && profile.photos.length > 0
      ? profile.photos
      : profile.image
      ? [profile.image]
      : [require('@/assets/images/avatar-placeholder.png')];

  const compatibilityScore =
    profile.compatibility !== undefined ? Math.round(profile.compatibility) : 85;

  const tag1 = `${getZodiacSymbol(profile.western_sign)} ${profile.western_sign || 'Aries'}`;
  const tag2 = `✨ ${profile.introvert_extrovert || 'Spiritual'}`;
  const tag3 = `❤️ ${getLookingForText(profile.looking_for)}`;

  const prompts = getPromptsForProfile(profile);
  const rawInterests =
    profile.hobbies && profile.hobbies.length > 0
      ? profile.hobbies.map(formatHobby)
      : profile.interests && profile.interests.length > 0
      ? profile.interests.map(formatHobby)
      : ['Travel', 'Music', 'Coffee', 'Astrology'];

  let cosmicMatchDesc = `You and ${profile.name} share moderate cosmic connection.`;
  if (compatibilityScore >= 80) {
    cosmicMatchDesc = `You and ${profile.name} share strong emotional compatibility.`;
  } else if (compatibilityScore >= 60) {
    cosmicMatchDesc = `You and ${profile.name} share good cosmic harmony.`;
  }

  return (
    <View style={cardStyles.profileContentWrapper}>
      <View style={cardStyles.profileCardContainer}>
        <View style={cardStyles.cardWrapper}>
          {/* Front of Card */}
          <Animated.View style={[cardStyles.cardFace, cardStyles.cardFront, { zIndex: 2 }]}>
            <View style={cardStyles.profileCard}>
              <Animated.ScrollView
                ref={parallaxScrollRef}
                showsVerticalScrollIndicator={false}
                bounces={true}
                style={{ flex: 1 }}
                contentContainerStyle={cardStyles.profileCardScrollContent}
              >
                {/* Primary Photo with Overlayed Info */}
                <View style={cardStyles.mockupPhotoContainerFull}>
                  <Image
                    source={resolvePhotoSource(profilePhotos[0])}
                    style={cardStyles.mockupImage}
                    contentFit="cover"
                  />

                  <LinearGradient
                    colors={['transparent', 'rgba(13, 6, 24, 0.6)', '#0D0618']}
                    style={cardStyles.mockupPhotoOverlay}
                  >
                    <View style={cardStyles.mockupPhotoOverlayContent}>
                      {/* Name and Age Row with details arrow */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={cardStyles.mockupNameRow}>
                            <Text style={cardStyles.mockupNameText}>{profile.name}</Text>
                            {profile.age && <Text style={cardStyles.mockupAgeText}>, {profile.age}</Text>}
                            <MaterialIcons name="verified" size={20} color="#3B82F6" style={{ marginLeft: 6, alignSelf: 'center' }} />
                          </View>

                          {/* Location and Active Row */}
                          <View style={cardStyles.mockupLocationRow}>
                            <Text style={cardStyles.mockupLocationText}>
                              {profile.location || 'Chennai'}
                            </Text>
                            <Text style={cardStyles.mockupDotSeparator}>·</Text>
                            <View style={cardStyles.activeDot} />
                            <Text style={cardStyles.activeText}>Active today</Text>
                          </View>
                        </View>

                        {/* Up Arrow Details Button */}
                        <TouchableOpacity
                          style={cardStyles.upArrowButton}
                          onPress={navigateToDetails}
                          activeOpacity={0.7}
                        >
                          <IonIcons name="arrow-up" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>

                      {/* Badges Row */}
                      <View style={cardStyles.newTagsRow}>
                        <View style={[cardStyles.newTag, cardStyles.purpleTag]}>
                          <Text style={cardStyles.newTagText}>{tag1}</Text>
                        </View>
                        <View style={[cardStyles.newTag, cardStyles.purpleTag]}>
                          <Text style={cardStyles.newTagText}>{tag2}</Text>
                        </View>
                        <View style={[cardStyles.newTag, cardStyles.pinkTag]}>
                          <Text style={cardStyles.newTagText}>{tag3}</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Compatibility Match Pill overlay */}
                  <View style={[cardStyles.mockupMatchPillOverlay, { top: insets.top + 72 }]}>
                    <Text style={cardStyles.mockupMatchPillText}>
                      ✦ {compatibilityScore}% Match
                    </Text>
                  </View>
                </View>

                {/* Prompts, Photos, and Cosmic Match/About/Interests cards */}
                <View style={[cardStyles.mockupFlowContainer, { marginTop: 16 }]}>
                  {/* Cosmic Match Card */}
                  <View style={cardStyles.newCosmicMatchCard}>
                    <View style={cardStyles.cosmicLeftCol}>
                      <CircularProgress
                        percentage={compatibilityScore}
                        label=""
                        size={66}
                        strokeWidth={5}
                        color="#A855F7"
                        innerBackgroundColor="rgba(20, 8, 32, 0.6)"
                        textColor="#FFFFFF"
                      />
                    </View>
                    <View style={cardStyles.cosmicCenterCol}>
                      <Text style={cardStyles.cosmicMatchTitle}>Cosmic Match</Text>
                      <Text style={cardStyles.cosmicMatchDesc}>{cosmicMatchDesc}</Text>
                    </View>
                    <View style={cardStyles.cosmicRightCol}>
                      <LottieView
                        source={require('@/assets/images/robot-says-hello.json')}
                        autoPlay
                        loop
                        style={[cardStyles.cosmicLottie, { backgroundColor: 'transparent' }]}
                      />
                    </View>
                  </View>

                  {/* About & Interests Cards (Side-by-Side) */}
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%', alignItems: 'stretch' }}>
                    {/* About Card */}
                    <View style={[cardStyles.aboutCardHalf, { flex: 1 }]}>
                      <View style={cardStyles.newCardHeader}>
                        <IonIcons name="person" size={16} color="#C084FC" style={{ marginRight: 6 }} />
                        <Text style={cardStyles.newCardHeaderText}>About {profile.name.split(' ')[0] || profile.name}</Text>
                      </View>
                      <Text style={cardStyles.aboutBodyFullWidth} numberOfLines={5}>
                        {getDynamicBio(profile)}
                      </Text>
                      <TouchableOpacity
                        style={cardStyles.newMoreButtonHalf}
                        onPress={() => onRouteToDetails(profile)}
                      >
                        <Text style={cardStyles.newMoreButtonText}>More {'>'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Interests Card */}
                    <View style={[cardStyles.interestsCardHalf, { flex: 1 }]}>
                      <View style={cardStyles.newCardHeader}>
                        <IonIcons name="star" size={16} color="#C084FC" style={{ marginRight: 6 }} />
                        <Text style={cardStyles.newCardHeaderText}>Interests</Text>
                      </View>
                      <View style={cardStyles.interestsWrapRow}>
                        {rawInterests.slice(0, 4).map((interest, idx) => (
                          <View key={idx} style={cardStyles.newInterestItemChip}>
                            <MaterialIcons
                              name={getInterestIcon(interest) as any}
                              size={12}
                              color="#C084FC"
                              style={{ marginRight: 2 }}
                            />
                            <Text style={cardStyles.newInterestItemText}>{interest}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Photo 2 */}
                  <View style={cardStyles.mockupPhotoContainer}>
                    <Image source={resolvePhotoSource(profilePhotos[1 % profilePhotos.length])} style={cardStyles.mockupImage} contentFit="cover" />
                  </View>
                  {/* Prompt 1 */}
                  <View style={cardStyles.mockupPromptCard}>
                    <Text style={cardStyles.mockupPromptQuestion}>{prompts[0].question}</Text>
                    <Text style={cardStyles.mockupPromptAnswer}>{prompts[0].answer}</Text>
                  </View>

                  {/* Photo 3 */}
                  <View style={cardStyles.mockupPhotoContainer}>
                    <Image source={resolvePhotoSource(profilePhotos[2 % profilePhotos.length])} style={cardStyles.mockupImage} contentFit="cover" />
                  </View>
                  {/* Prompt 2 */}
                  <View style={cardStyles.mockupPromptCard}>
                    <Text style={cardStyles.mockupPromptQuestion}>{prompts[1].question}</Text>
                    <Text style={cardStyles.mockupPromptAnswer}>{prompts[1].answer}</Text>
                  </View>

                  {/* Photo 4 */}
                  <View style={cardStyles.mockupPhotoContainer}>
                    <Image source={resolvePhotoSource(profilePhotos[3 % profilePhotos.length])} style={cardStyles.mockupImage} contentFit="cover" />
                  </View>
                  {/* Prompt 3 */}
                  <View style={cardStyles.mockupPromptCard}>
                    <Text style={cardStyles.mockupPromptQuestion}>{prompts[2].question}</Text>
                    <Text style={cardStyles.mockupPromptAnswer}>{prompts[2].answer}</Text>
                  </View>

                  {/* Photo 5 */}
                  <View style={cardStyles.mockupPhotoContainer}>
                    <Image source={resolvePhotoSource(profilePhotos[4 % profilePhotos.length])} style={cardStyles.mockupImage} contentFit="cover" />
                  </View>
                  {/* Prompt 4 */}
                  <View style={cardStyles.mockupPromptCard}>
                    <Text style={cardStyles.mockupPromptQuestion}>{prompts[3].question}</Text>
                    <Text style={cardStyles.mockupPromptAnswer}>{prompts[3].answer}</Text>
                  </View>

                  {/* Photo 6 */}
                  <View style={cardStyles.mockupPhotoContainer}>
                    <Image source={resolvePhotoSource(profilePhotos[5 % profilePhotos.length])} style={cardStyles.mockupImage} contentFit="cover" />
                  </View>
                  {/* Prompt 5 */}
                  <View style={cardStyles.mockupPromptCard}>
                    <Text style={cardStyles.mockupPromptQuestion}>{prompts[4].question}</Text>
                    <Text style={cardStyles.mockupPromptAnswer}>{prompts[4].answer}</Text>
                  </View>
                </View>

                {/* Spacer bottom */}
                <View style={{ height: 240 }} />
              </Animated.ScrollView>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// ── Co-located card styles ────────────────────────────────────────────────────
export const cardStyles = StyleSheet.create({
  // Wrapper / container
  profileContentWrapper: {
    width: '100%',
    height: '100%',
  },
  profileCardContainer: {
    width: STATIC_WIDTH,
    height: STATIC_HEIGHT,
    position: 'relative',
    alignSelf: 'center',
  },
  cardWrapper: {
    width: STATIC_WIDTH,
    height: STATIC_HEIGHT,
  },
  cardFace: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    zIndex: 2,
  },
  profileCard: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0D0618',
  },
  profileCardScrollContent: {
    flexGrow: 1,
    backgroundColor: '#0D0618',
  },

  // Primary photo section
  mockupPhotoContainerFull: {
    width: '100%',
    height: STATIC_HEIGHT * 0.65,
    position: 'relative',
    backgroundColor: '#000000',
  },
  mockupImage: {
    width: '100%',
    height: '100%',
  },
  mockupPhotoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 40,
  },
  mockupPhotoOverlayContent: {
    gap: 8,
  },

  // Name / location
  mockupNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mockupNameText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  mockupAgeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '400',
  },
  mockupLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  mockupLocationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  mockupDotSeparator: {
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 8,
    fontSize: 16,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  activeText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },

  // Up arrow
  upArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.6)',
  },

  // Tags / badges
  newTagsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    marginBottom: 14,
  },
  newTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  purpleTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  pinkTag: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderColor: 'rgba(236, 72, 153, 0.45)',
  },
  newTagText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Match pill
  mockupMatchPillOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  mockupMatchPillText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },

  // Flow container
  mockupFlowContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // Cosmic Match card
  newCosmicMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cosmicLeftCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cosmicCenterCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  cosmicMatchTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  cosmicMatchDesc: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  cosmicRightCol: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cosmicLottie: {
    width: 60,
    height: 60,
  },

  // About & Interests
  aboutCardHalf: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    position: 'relative',
    minHeight: 180,
  },
  newCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  newCardHeaderText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '700',
  },
  aboutBodyFullWidth: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 24,
  },
  newMoreButtonHalf: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  newMoreButtonText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },
  interestsCardHalf: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 180,
  },
  interestsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  newInterestItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  newInterestItemText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Album photos
  mockupPhotoContainer: {
    width: '100%',
    height: STATIC_HEIGHT * 0.45,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },

  // Prompt cards
  mockupPromptCard: {
    backgroundColor: '#1A0B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  mockupPromptQuestion: {
    color: '#EC4899',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mockupPromptAnswer: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
});
