import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { derivedAstroScore, type SynastryDetail } from '@/lib/synastry';

// ─── PlanetBar (internal) ─────────────────────────────────────────────────────
interface PlanetBarProps {
  label: string;
  score: number;
  emoji: string;
  locked: boolean;
  teaserLabel?: string;
}

const SCORE_COLOR = (score: number) =>
  score >= 8
    ? '#f59e0b'
    : score >= 6
    ? '#8b5cf6'
    : score >= 4
    ? '#3b82f6'
    : '#6b7280';

function PlanetBar({ label, score, emoji, locked, teaserLabel }: PlanetBarProps) {
  const barWidth = `${(score / 10) * 100}%` as any;

  if (locked) {
    return (
      <View style={{ marginBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {emoji} {label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>🔒</Text>
            <BlurView
              intensity={18}
              tint="dark"
              style={{ borderRadius: 6, overflow: 'hidden' }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: '700',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                {teaserLabel ?? 'Hidden'}
              </Text>
            </BlurView>
          </View>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{ ...StyleSheet.absoluteFillObject }}
          />
          <View
            style={{
              width: '60%',
              height: '100%',
              backgroundColor: '#8b5cf6',
              borderRadius: 3,
              opacity: 0.3,
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          {emoji} {label}
        </Text>
        <Text
          style={{
            color: SCORE_COLOR(score),
            fontSize: 13,
            fontWeight: '700',
          }}
        >
          {score.toFixed(1)} / 10
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <View
          style={{
            width: barWidth,
            height: '100%',
            borderRadius: 3,
            backgroundColor: SCORE_COLOR(score),
          }}
        />
      </View>
    </View>
  );
}

// ─── SynastryBreakdown ────────────────────────────────────────────────────────
interface SynastryBreakdownProps {
  detail: SynastryDetail | null;
  isLoading: boolean;
  isPremium: boolean;
  onUpgradePress: () => void;
}

const SynastryBreakdown = memo(function SynastryBreakdown({
  detail,
  isLoading,
  isPremium,
  onUpgradePress,
}: SynastryBreakdownProps) {
  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator color="#8b5cf6" />
        <Text
          style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 12 }}
        >
          Reading your charts…
        </Text>
      </View>
    );
  }

  if (!detail) return null;

  const compositeScore = derivedAstroScore(detail);

  const teaserLabels: Record<string, string> = {
    venus_score:
      detail.venus_score >= 7
        ? 'High Passion'
        : detail.venus_score >= 5
        ? 'Warm Energy'
        : 'Gentle Vibes',
    mars_score:
      detail.mars_score >= 7
        ? 'Strong Drive'
        : detail.mars_score >= 5
        ? 'Compatible'
        : 'Laid Back',
    mercury_score:
      detail.mercury_score >= 7
        ? 'Deep Bond'
        : detail.mercury_score >= 5
        ? 'Good Flow'
        : 'Different Styles',
  };

  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      {/* Section header */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
      >
        <Text
          style={{ color: '#fff', fontWeight: '800', fontSize: 18, flex: 1 }}
        >
          ✨ Deep Synastry
        </Text>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 3,
            borderColor:
              compositeScore >= 75
                ? '#f59e0b'
                : compositeScore >= 50
                ? '#8b5cf6'
                : '#6b7280',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
            {compositeScore}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 8 }}>
            AstroScore
          </Text>
        </View>
      </View>

      {detail.compatibility_summary ? (
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 16,
          }}
        >
          {detail.compatibility_summary}
        </Text>
      ) : null}

      {detail.badges && detail.badges.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {detail.badges.map((badge) => (
            <View
              key={badge}
              style={{
                backgroundColor: 'rgba(139,92,246,0.25)',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{ color: '#c4b5fd', fontSize: 12, fontWeight: '600' }}
              >
                ✦ {badge}
              </Text>
            </View>
          ))}
        </View>
      )}

      <PlanetBar
        label="Sun"
        emoji="☀️"
        score={detail.sun_score}
        locked={false}
      />
      <PlanetBar
        label="Moon"
        emoji="🌙"
        score={detail.moon_score}
        locked={false}
      />
      <PlanetBar
        label="Venus"
        emoji="💕"
        score={detail.venus_score}
        locked={!isPremium}
        teaserLabel={teaserLabels.venus_score}
      />
      <PlanetBar
        label="Mars"
        emoji="🔥"
        score={detail.mars_score}
        locked={!isPremium}
        teaserLabel={teaserLabels.mars_score}
      />
      <PlanetBar
        label="Mercury"
        emoji="☿️"
        score={detail.mercury_score}
        locked={!isPremium}
        teaserLabel={teaserLabels.mercury_score}
      />

      {detail.dominant_element_match && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
        >
          <Text style={{ fontSize: 14, marginRight: 6 }}>🌿</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            Matching dominant elements
          </Text>
          <Text
            style={{
              color: '#34d399',
              fontWeight: '700',
              fontSize: 13,
              marginLeft: 'auto',
            }}
          >
            ✓ Aligned
          </Text>
        </View>
      )}

      {!isPremium && (
        <TouchableOpacity
          onPress={onUpgradePress}
          style={{
            marginTop: 18,
            borderRadius: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(139,92,246,0.4)',
          }}
        >
          <LinearGradient
            colors={['rgba(139,92,246,0.15)', 'rgba(236,72,153,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 14 }}
          >
            <Text
              style={{
                color: '#c4b5fd',
                fontWeight: '700',
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              🔒 Your Venus signs show intense passion, but there's a catch…
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              Upgrade to reveal your full Deep Synastry — Venus, Mars, and
              Mercury tell the real story of romantic chemistry and
              communication style.
            </Text>
            <View
              style={{
                marginTop: 10,
                alignSelf: 'flex-start',
                backgroundColor: '#8b5cf6',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}
              >
                Unlock Deep Synastry ✨
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default SynastryBreakdown;
