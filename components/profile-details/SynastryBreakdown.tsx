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
import { derivedAstroScore, type SynastryDetail, type AshtakootaDetail } from '@/lib/synastry';

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

// ─── AshtakootaRow (internal) ─────────────────────────────────────────────────
// Shows one of the 8 Vedic kootas as a compact row with a small fill bar.
const KOOTA_META: Record<keyof Omit<AshtakootaDetail, 'total_points' | 'received_points'>, { label: string; emoji: string; maxPts: number }> = {
  varna:   { label: 'Varna',   emoji: '🧬', maxPts: 1  },
  vasya:   { label: 'Vasya',   emoji: '🤝', maxPts: 2  },
  tara:    { label: 'Tara',    emoji: '⭐', maxPts: 3  },
  yoni:    { label: 'Yoni',    emoji: '🌀', maxPts: 4  },
  maitri:  { label: 'Maitri',  emoji: '💙', maxPts: 5  },
  gan:     { label: 'Gana',    emoji: '🔥', maxPts: 6  },
  bhakoot: { label: 'Bhakoot', emoji: '🌙', maxPts: 7  },
  nadi:    { label: 'Nadi',    emoji: '💓', maxPts: 8  },
};

function AshtakootaRow({ kootaKey, score }: { kootaKey: string; score: { received_points: number; total_points: number } }) {
  const meta = KOOTA_META[kootaKey as keyof typeof KOOTA_META];
  if (!meta) return null;
  const pct = (score.received_points / meta.maxPts) * 100;
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <Text style={{ fontSize: 14, width: 22 }}>{meta.emoji}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, width: 56 }}>{meta.label}</Text>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 2, backgroundColor: color }} />
      </View>
      <Text style={{ color, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' }}>
        {score.received_points}/{meta.maxPts}
      </Text>
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

  // Teaser labels shown on locked bars so non-premium users get a hint of
  // what's behind the paywall without seeing the real number.
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

  // Build the Ashtakoota koota list from detail if available
  const hasAshtakoota = isPremium && detail.ashtakoota_detail != null && detail.ashtakoota_score != null;
  const kootaKeys = ['varna', 'vasya', 'tara', 'yoni', 'maitri', 'gan', 'bhakoot', 'nadi'] as const;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      {/* ── Section header with composite score ring ── */}
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

      {/* ── Compatibility summary text ── */}
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

      {/* ── Compatibility badges ── */}
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

      {/* ── Western planet bars ── */}
      {/* Sun & Moon: always visible to everyone */}
      <PlanetBar label="Sun"  emoji="☀️" score={detail.sun_score}  locked={false} />
      <PlanetBar label="Moon" emoji="🌙" score={detail.moon_score} locked={false} />

      {/* Venus, Mars, Mercury: AstroX only */}
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

      {/* ── Dominant element match ── */}
      {detail.dominant_element_match && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 }}
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

      {/* ── Vedic Ashtakoota section (AstroX only, shown when data is ready) ── */}
      {isPremium && (
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, flex: 1 }}>
              🪔 Vedic Ashtakoota
            </Text>
            {detail.ashtakoota_score != null ? (
              <View style={{
                backgroundColor: 'rgba(139,92,246,0.2)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.5)',
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
                <Text style={{ color: '#c4b5fd', fontWeight: '800', fontSize: 14 }}>
                  {detail.ashtakoota_score} / 36
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: 'rgba(100,100,100,0.2)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Computing…</Text>
              </View>
            )}
          </View>

          {hasAshtakoota ? (
            <>
              {kootaKeys.map((key) => {
                const kootaScore = (detail.ashtakoota_detail as any)?.[key];
                if (!kootaScore) return null;
                return <AshtakootaRow key={key} kootaKey={key} score={kootaScore} />;
              })}
              {/* Ashtakoota interpretation */}
              <View style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: 'rgba(139,92,246,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.25)',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18 }}>
                  {detail.ashtakoota_score! >= 28
                    ? '✦ Exceptional match — 28+ gunas indicates deep harmony, highly auspicious for a long-term relationship.'
                    : detail.ashtakoota_score! >= 18
                    ? '✦ Good compatibility — 18+ gunas is the traditional threshold for a balanced, compatible match.'
                    : '✦ Some differences exist — compatibility can still be built with understanding and effort.'}
                </Text>
              </View>
            </>
          ) : detail.ashtakoota_score == null ? (
            // Still computing — show placeholder rows
            <View style={{ opacity: 0.4 }}>
              {kootaKeys.map((key) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ width: 22, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <View style={{ width: 56, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                </View>
              ))}
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                Vedic chart analysis in progress — check back shortly
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Upgrade card — shown only to non-premium users ── */}
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
            colors={['rgba(139,92,246,0.15)', 'rgba(96,165,250,0.12)']}
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
              🔒 Venus, Mars & Mercury scores are hidden
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                lineHeight: 17,
                marginBottom: 4,
              }}
            >
              Upgrade to AstroX to reveal the full Deep Synastry — including
              Venus (romance), Mars (drive), Mercury (communication) and the
              complete 36-guna Vedic Ashtakoota score.
            </Text>
            <View
              style={{
                marginTop: 10,
                alignSelf: 'flex-start',
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  Unlock with AstroX ✦
                </Text>
              </LinearGradient>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default SynastryBreakdown;