import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AstrologyInsightsProps {
  strengths: string[];
  challenges: string[];
  loveStyle: string;
}

export default function AstrologyInsights({
  strengths,
  challenges,
  loveStyle,
}: AstrologyInsightsProps) {
  if (!strengths.length && !challenges.length && !loveStyle) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={16} color="#D8B4FE" />
        <View>
          <Text style={styles.title}>Astrology Insights</Text>
          <Text style={styles.subtitle}>Based on your cosmic blueprint</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.topRow}>
          {/* Strengths */}
          <View style={styles.column}>
            <View style={styles.columnHeader}>
              <Ionicons name="star" size={14} color="#34D399" />
              <Text style={styles.columnTitle}>Strengths</Text>
            </View>
            {strengths.map((item, index) => (
              <View key={`strength-${index}`} style={styles.listItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#34D399" />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Challenges */}
          <View style={styles.column}>
            <View style={styles.columnHeader}>
              <Ionicons name="warning" size={14} color="#FBBF24" />
              <Text style={styles.columnTitle}>Challenges</Text>
            </View>
            {challenges.map((item, index) => (
              <View key={`challenge-${index}`} style={styles.listItem}>
                <Ionicons name="ellipse-outline" size={14} color="#FBBF24" />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Love Style */}
        {loveStyle ? (
          <LinearGradient
            colors={['rgba(168, 85, 247, 0.1)', 'rgba(74, 44, 90, 0.3)']}
            style={styles.loveStyleCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.loveStyleContent}>
              <View style={styles.loveStyleHeaderRow}>
                <Ionicons name="heart" size={14} color="#F472B6" />
                <Text style={styles.loveStyleTitle}>Love Style</Text>
              </View>
              <Text style={styles.loveStyleText}>{loveStyle}</Text>
            </View>
            {/* Note: In a real app we'd place the planet image background here */}
          </LinearGradient>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  listText: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    flex: 1,
  },
  loveStyleCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  loveStyleContent: {
    flex: 1,
    zIndex: 1,
  },
  loveStyleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  loveStyleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F472B6',
  },
  loveStyleText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
    opacity: 0.9,
  },
});
