import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { derivedAstroScore, type SynastryDetail, type AshtakootaDetail } from '@/lib/synastry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCORE_COLOR = (score: number): string =>
  score >= 8 ? '#F59E0B' : score >= 6 ? '#A78BFA' : score >= 4 ? '#60A5FA' : '#9CA3AF';

const SCORE_LABEL = (score: number): string =>
  score >= 8 ? 'Aligned' : score >= 6 ? 'Room to grow' : score >= 4 ? 'Developing' : 'Challenging';

// ─── PlanetIcon ───────────────────────────────────────────────────────────────

interface PlanetIconProps {
  emoji: string;
  gradientColors: [string, string];
  locked?: boolean;
}

function PlanetIcon({ emoji, gradientColors, locked }: PlanetIconProps) {
  return (
    <View style={styles.iconWrapper}>
      <LinearGradient
        colors={locked ? ['#2D1B69', '#1E1040'] : gradientColors}
        style={styles.iconGradient}
      >
        <Text style={{ fontSize: 22 }}>{locked ? '🔒' : emoji}</Text>
      </LinearGradient>
    </View>
  );
}

// ─── PlanetCard (unlocked) ────────────────────────────────────────────────────

interface UnlockedPlanetCardProps {
  label: string;
  subtitle: string;
  description: string;
  score: number;
  emoji: string;
  gradientColors: [string, string];
}

function UnlockedPlanetCard({
  label,
  subtitle,
  description,
  score,
  emoji,
  gradientColors,
}: UnlockedPlanetCardProps) {
  const color = SCORE_COLOR(score);
  const alignmentLabel = SCORE_LABEL(score);
  const barWidth = `${(score / 10) * 100}%` as any;

  return (
    <View style={styles.planetCard}>
      <PlanetIcon emoji={emoji} gradientColors={gradientColors} />

      {/* Middle: label + description */}
      <View style={styles.planetCardMiddle}>
        <Text style={styles.planetLabel}>{label}</Text>
        <Text style={[styles.planetSubtitle, { color }]}>{subtitle}</Text>
        <Text style={styles.planetDescription}>{description}</Text>

        {/* Score bar */}
        <View style={styles.barTrack}>
          <LinearGradient
            colors={[color, color + '88']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: barWidth }]}
          />
        </View>
      </View>

      {/* Right: score + label */}
      <View style={styles.planetCardRight}>
        <Text style={[styles.scoreText, { color }]}>
          {score.toFixed(1)}
          <Text style={styles.scoreDenominator}> / 10</Text>
        </Text>
        <Text style={[styles.alignmentLabel, { color }]}>{alignmentLabel}</Text>
        <Text style={{ fontSize: 14, marginTop: 6, color: 'rgba(255,255,255,0.3)' }}>✦</Text>
      </View>
    </View>
  );
}

// ─── PlanetCard (locked) ──────────────────────────────────────────────────────

interface LockedPlanetCardProps {
  label: string;
  subtitle: string;
  description: string;
  emoji: string;
}

function LockedPlanetCard({ label, subtitle, description, emoji }: LockedPlanetCardProps) {
  return (
    <View style={[styles.planetCard, styles.planetCardLocked]}>
      <PlanetIcon emoji={emoji} gradientColors={['#2D1B69', '#1E1040']} locked />

      {/* Middle */}
      <View style={styles.planetCardMiddle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.planetLabel}>{label}</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>🔒 Premium</Text>
          </View>
        </View>
        <Text style={[styles.planetSubtitle, { color: '#A78BFA' }]}>{subtitle}</Text>
        <Text style={styles.planetDescription}>{description}</Text>
      </View>

      {/* Right: locked */}
      <View style={styles.planetCardRight}>
        <View style={styles.lockedBadge}>
          <Text style={styles.lockedBadgeText}>🔒</Text>
          <Text style={styles.lockedBadgeText}>Locked</Text>
        </View>
      </View>
    </View>
  );
}

// ─── CosmicInsight ────────────────────────────────────────────────────────────

function CosmicInsight({ summary }: { summary: string }) {
  return (
    <LinearGradient
      colors={['rgba(139,92,246,0.18)', 'rgba(79,70,229,0.10)']}
      style={styles.cosmicCard}
    >
      {/* Glow orb */}
      <View style={styles.cosmicOrbWrapper}>
        <LinearGradient
          colors={['#7C3AED', '#EC4899']}
          style={styles.cosmicOrb}
        />
        <View style={styles.cosmicOrbInner}>
          <Text style={{ fontSize: 22 }}>💕</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.cosmicTitle}>✨ Cosmic Insight</Text>
        <Text style={styles.cosmicText}>{summary}</Text>
      </View>
    </LinearGradient>
  );
}

// ─── AstroScore Ring ──────────────────────────────────────────────────────────

function AstroScoreRing({ score }: { score: number }) {
  const ringColor: [string, string] =
    score >= 75 ? ['#F59E0B', '#EC4899'] : score >= 50 ? ['#8B5CF6', '#EC4899'] : ['#6B7280', '#4B5563'];

  return (
    <View style={styles.scoreRingWrapper}>
      <LinearGradient colors={ringColor} style={styles.scoreRingGradient}>
        <View style={styles.scoreRingInner}>
          <Text style={styles.scoreRingNumber}>{score}</Text>
          <Text style={styles.scoreRingLabel}>AstroScore</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Upgrade Banner ───────────────────────────────────────────────────────────

function UpgradeBanner({ onPress }: { onPress: () => void }) {
  return (
    <LinearGradient
      colors={['rgba(30,16,64,0.97)', 'rgba(45,27,105,0.97)']}
      style={styles.upgradeBanner}
    >
      {/* Lock icon circle */}
      <View style={styles.upgradeLockCircle}>
        <LinearGradient colors={['#7C3AED', '#4C1D95']} style={styles.upgradeLockGradient}>
          <Text style={{ fontSize: 20 }}>🔒</Text>
        </LinearGradient>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.upgradeBannerTitle}>Unlock Premium Synastry Insights</Text>

        {/* Planet pills */}
        <View style={styles.planetPills}>
          <View style={[styles.planetPill, { backgroundColor: 'rgba(236,72,153,0.25)' }]}>
            <Text style={{ fontSize: 12 }}>💕</Text>
            <Text style={[styles.planetPillLabel, { color: '#F472B6' }]}>Venus</Text>
            <Text style={styles.planetPillSub}>Romance</Text>
          </View>
          <View style={[styles.planetPill, { backgroundColor: 'rgba(239,68,68,0.25)' }]}>
            <Text style={{ fontSize: 12 }}>🔥</Text>
            <Text style={[styles.planetPillLabel, { color: '#F87171' }]}>Mars</Text>
            <Text style={styles.planetPillSub}>Chemistry</Text>
          </View>
          <View style={[styles.planetPill, { backgroundColor: 'rgba(139,92,246,0.25)' }]}>
            <Text style={{ fontSize: 12 }}>☿</Text>
            <Text style={[styles.planetPillLabel, { color: '#A78BFA' }]}>Mercury</Text>
            <Text style={styles.planetPillSub}>Communication</Text>
          </View>
        </View>

        <Text style={styles.upgradeBannerSub}>
          Get the full 36-guna Vedic matching and advanced relationship analysis.
        </Text>
      </View>

      {/* CTA button */}
      <TouchableOpacity onPress={onPress} style={styles.upgradeButtonWrapper}>
        <LinearGradient
          colors={['#7C3AED', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.upgradeButton}
        >
          <Text style={styles.upgradeButtonText}>Unlock with AstroX ✦</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ─── AshtakootaRow ────────────────────────────────────────────────────────────

const KOOTA_META: Record<string, { label: string; emoji: string; maxPts: number }> = {
  varna:   { label: 'Varna',   emoji: '🧬', maxPts: 1 },
  vasya:   { label: 'Vasya',   emoji: '🤝', maxPts: 2 },
  tara:    { label: 'Tara',    emoji: '⭐', maxPts: 3 },
  yoni:    { label: 'Yoni',    emoji: '🌀', maxPts: 4 },
  maitri:  { label: 'Maitri',  emoji: '💙', maxPts: 5 },
  gan:     { label: 'Gana',    emoji: '🔥', maxPts: 6 },
  bhakoot: { label: 'Bhakoot', emoji: '🌙', maxPts: 7 },
  nadi:    { label: 'Nadi',    emoji: '💓', maxPts: 8 },
};

function AshtakootaRow({ kootaKey, score }: { kootaKey: string; score: { received_points: number; total_points: number } }) {
  const meta = KOOTA_META[kootaKey];
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

// ─── SynastryBreakdown (main) ─────────────────────────────────────────────────

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
        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 12 }}>
          Reading your charts…
        </Text>
      </View>
    );
  }

  if (!detail) return null;

  const compositeScore = derivedAstroScore(detail);
  const kootaKeys = ['varna', 'vasya', 'tara', 'yoni', 'maitri', 'gan', 'bhakoot', 'nadi'] as const;
  const hasAshtakoota = isPremium && detail.ashtakoota_detail != null && detail.ashtakoota_score != null;

  // Cosmic insight text (fallback to compatibility_summary)
  const cosmicText =
    detail.compatibility_summary ||
    'Your connection carries powerful potential for growth. Your core energies align well, while emotional and communication patterns offer opportunities to deepen the bond.';

  return (
    <View style={styles.container}>

      {/* ── Header: title + AstroScore ring ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>✨ Deep Synastry</Text>
          <Text style={styles.headerSubtitle}>
            {detail.compatibility_summary
              ? detail.compatibility_summary.split('.')[0] + '.'
              : 'Challenging match — significant karmic contrasts that invite deep understanding and growth.'}
          </Text>
        </View>
        <AstroScoreRing score={compositeScore} />
      </View>

      {/* ── Sun (always unlocked) ── */}
      <UnlockedPlanetCard
        label="Sun"
        subtitle="Vitality & Purpose"
        description={
          detail.sun_score >= 7
            ? 'Strong alignment in goals and life direction.'
            : detail.sun_score >= 5
            ? 'Some common ground in your life paths.'
            : 'Different directions — a chance to learn.'
        }
        score={detail.sun_score}
        emoji="☀️"
        gradientColors={['#F59E0B', '#D97706']}
      />

      {/* ── Moon (always unlocked) ── */}
      <UnlockedPlanetCard
        label="Moon"
        subtitle="Emotions & Security"
        description={
          detail.moon_score >= 7
            ? 'Deep emotional resonance and mutual nurturing.'
            : detail.moon_score >= 5
            ? 'Emotional connection is developing beautifully.'
            : 'Different emotional needs — patience is key.'
        }
        score={detail.moon_score}
        emoji="🌙"
        gradientColors={['#6D28D9', '#4C1D95']}
      />

      {/* ── Venus (locked for non-premium) ── */}
      {isPremium ? (
        <UnlockedPlanetCard
          label="Venus"
          subtitle="Love & Romance"
          description="Your romantic energies and attraction patterns."
          score={detail.venus_score}
          emoji="💕"
          gradientColors={['#EC4899', '#BE185D']}
        />
      ) : (
        <LockedPlanetCard
          label="Venus"
          subtitle="Love & Romance"
          description="Unlock to see your romance compatibility."
          emoji="💕"
        />
      )}

      {/* ── Mars (locked for non-premium) ── */}
      {isPremium ? (
        <UnlockedPlanetCard
          label="Mars"
          subtitle="Passion & Drive"
          description="Your shared passion, drive and physical chemistry."
          score={detail.mars_score}
          emoji="🔥"
          gradientColors={['#EF4444', '#B91C1C']}
        />
      ) : (
        <LockedPlanetCard
          label="Mars"
          subtitle="Passion & Drive"
          description="Unlock to see your passion and chemistry."
          emoji="🔥"
        />
      )}

      {/* ── Mercury (locked for non-premium) ── */}
      {isPremium ? (
        <UnlockedPlanetCard
          label="Mercury"
          subtitle="Communication & Intellect"
          description="How your minds and communication styles connect."
          score={detail.mercury_score}
          emoji="☿"
          gradientColors={['#10B981', '#065F46']}
        />
      ) : (
        <LockedPlanetCard
          label="Mercury"
          subtitle="Communication & Intellect"
          description="Unlock to see your communication style and understanding."
          emoji="☿"
        />
      )}

      {/* ── Cosmic Insight ── */}
      <CosmicInsight summary={cosmicText} />

      {/* ── Vedic Ashtakoota (premium only) ── */}
      {isPremium && (
        <View style={styles.ashtakootaSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, flex: 1 }}>
              🪔 Vedic Ashtakoota
            </Text>
            {detail.ashtakoota_score != null ? (
              <View style={styles.ashtakootaScoreBadge}>
                <Text style={{ color: '#c4b5fd', fontWeight: '800', fontSize: 14 }}>
                  {detail.ashtakoota_score} / 36
                </Text>
              </View>
            ) : (
              <View style={styles.ashtakootaScoreBadgeEmpty}>
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
              <View style={styles.ashtakootaInterpretation}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 18 }}>
                  {detail.ashtakoota_score! >= 28
                    ? '✦ Exceptional match — 28+ gunas indicates deep harmony, highly auspicious.'
                    : detail.ashtakoota_score! >= 18
                    ? '✦ Good compatibility — 18+ gunas is the traditional threshold for a balanced match.'
                    : '✦ Some differences exist — compatibility can be built with understanding and effort.'}
                </Text>
              </View>
            </>
          ) : detail.ashtakoota_score == null ? (
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

      {/* ── Upgrade Banner (non-premium only) ── */}
      {!isPremium && <UpgradeBanner onPress={onUpgradePress} />}
    </View>
  );
});

export default SynastryBreakdown;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
    marginBottom: 6,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 19,
  },

  // AstroScore ring
  scoreRingWrapper: {
    width: 72,
    height: 72,
  },
  scoreRingGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#0F0A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  scoreRingLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Planet cards
  planetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 12,
  },
  planetCardLocked: {
    backgroundColor: 'rgba(30,16,64,0.5)',
    borderColor: 'rgba(139,92,246,0.15)',
  },
  planetCardMiddle: {
    flex: 1,
    gap: 3,
  },
  planetCardRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 70,
  },

  // Planet icon
  iconWrapper: {
    width: 52,
    height: 52,
  },
  iconGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Planet text
  planetLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  planetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  planetDescription: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },

  // Bar
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Score
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
  },
  scoreDenominator: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  alignmentLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Premium badge
  premiumBadge: {
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
  },
  premiumBadgeText: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '700',
  },

  // Locked badge
  lockedBadge: {
    alignItems: 'center',
    gap: 2,
  },
  lockedBadgeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },

  // Cosmic insight
  cosmicCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  cosmicOrbWrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cosmicOrb: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    opacity: 0.6,
  },
  cosmicOrbInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.5)',
  },
  cosmicTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  cosmicText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 18,
  },

  // Ashtakoota section
  ashtakootaSection: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  ashtakootaScoreBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ashtakootaScoreBadgeEmpty: {
    backgroundColor: 'rgba(100,100,100,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ashtakootaInterpretation: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },

  // Upgrade banner
  upgradeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  upgradeLockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  upgradeLockGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBannerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  planetPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  planetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planetPillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  planetPillSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
  upgradeBannerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 16,
  },
  upgradeButtonWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  upgradeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});