import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const helpTopics = [
  {
    id: 1,
    title: 'Finding Love',
    subtitle: 'Your guide to matching, messaging, and dating',
    icon: 'favorite',
    iconColor: '#EC4899',
  },
  {
    id: 2,
    title: 'Your Profile',
    subtitle: 'Helping you put your best self forward',
    icon: 'person',
    iconColor: '#7C3AED',
  },
  {
    id: 3,
    title: 'Staying Safe & Secure',
    subtitle: 'Keeping you and our community safe',
    icon: 'shield',
    iconColor: '#4ADE80',
  },
  {
    id: 4,
    title: 'Astro Features',
    subtitle: 'Learn about astrology-based matching',
    icon: 'auto-awesome',
    iconColor: '#FFD700',
  },
];

const popularTopics = [
  {
    id: 1,
    title: 'Troubleshooting Tips & Current Bugs',
    icon: 'bug-report',
  },
  {
    id: 2,
    title: 'Our Safety Features',
    icon: 'security',
  },
  {
    id: 3,
    title: 'Verifying with Your ID',
    icon: 'verified-user',
  },
  {
    id: 4,
    title: 'Understanding Compatibility Scores',
    icon: 'insights',
  },
  {
    id: 5,
    title: 'Managing Your Subscription',
    icon: 'workspace-premium',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'help' | 'notifications'>('help');
  
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help Hub</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'help' && styles.tabActive]}
          onPress={() => setActiveTab('help')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'help' && styles.tabTextActive]}>
            Get Help
          </Text>
          {activeTab === 'help' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Support Updates
          </Text>
          {activeTab === 'notifications' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {activeTab === 'help' ? (
          <>
            {/* Search Section */}
            <View style={styles.searchSection}>
              <Text style={styles.searchTitle}>How can we help?</Text>
              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={24} color="#7C3AED" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for help..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    activeOpacity={0.7}>
                    <MaterialIcons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Explore by Topic */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Explore by Topic</Text>
              <View style={styles.topicsGrid}>
                {helpTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={styles.topicCard}
                    activeOpacity={0.8}>
                    <View style={styles.topicCardContent}>
                      <View style={[styles.topicIconContainer, { backgroundColor: `${topic.iconColor}20` }]}>
                        <MaterialIcons name={topic.icon as any} size={28} color={topic.iconColor} />
                      </View>
                      <View style={styles.topicTextContainer}>
                        <Text style={styles.topicTitle}>{topic.title}</Text>
                        <Text style={styles.topicSubtitle}>{topic.subtitle}</Text>
                      </View>
                      <View style={styles.topicArrow}>
                        <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Popular Topics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Topics</Text>
              <View style={styles.popularTopicsList}>
                {popularTopics.map((topic, index) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.popularTopicItem,
                      index === popularTopics.length - 1 && styles.popularTopicItemLast,
                    ]}
                    activeOpacity={0.7}>
                    <View style={styles.popularTopicLeft}>
                      <View style={styles.popularTopicIconContainer}>
                        <MaterialIcons name={topic.icon as any} size={22} color="#7C3AED" />
                      </View>
                      <Text style={styles.popularTopicText}>{topic.title}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Support Chat */}
            <View style={styles.supportSection}>
              <View style={styles.supportContent}>
                <Text style={styles.supportTitle}>Still have a question?</Text>
                <Text style={styles.supportSubtitle}>Initiate a support chat</Text>
              </View>
              <TouchableOpacity style={styles.chatButton} activeOpacity={0.8}>
                <MaterialIcons name="chat-bubble" size={20} color="#FFFFFF" />
                <Text style={styles.chatButtonText}>Start Chat</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Support Updates Tab Content */
          <View style={styles.notificationsContent}>
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
              <Text style={styles.emptyStateTitle}>No Support Updates</Text>
              <Text style={styles.emptyStateText}>
                You're all caught up! Updates from your support chats will appear here.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    // Active state handled by indicator
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#7C3AED',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  searchSection: {
    marginBottom: 32,
  },
  searchTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 12,
  },
  searchIcon: {
    // Icon styling
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  topicsGrid: {
    gap: 16,
  },
  topicCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  topicCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  topicIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicTextContainer: {
    flex: 1,
    gap: 4,
  },
  topicTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  topicSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  topicArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularTopicsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  popularTopicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  popularTopicItemLast: {
    borderBottomWidth: 0,
  },
  popularTopicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  popularTopicIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularTopicText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  supportSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  supportContent: {
    flex: 1,
    gap: 4,
  },
  supportTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  supportSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '400',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  notificationsContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 40,
  },
});

