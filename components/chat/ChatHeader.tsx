import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type AshtakootaDetail, type SynastryDetail } from '@/lib/synastry';

interface User { name: string; avatar: { uri: string }; isOnline: boolean; }
interface ChatHeaderProps {
  user: User; isOtherUserTyping: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  onBackPress: () => void; onMenuPress: () => void;
  synastryDetail?: SynastryDetail | null; synastryScore?: number | null;
}

const KOOTA_LABELS: { key: keyof AshtakootaDetail; label: string; max: number }[] = [
  { key: 'nadi',    label: 'Nadi',         max: 8 },
  { key: 'bhakoot', label: 'Bhakoot',      max: 7 },
  { key: 'gan',     label: 'Gana',         max: 6 },
  { key: 'maitri',  label: 'Graha Maitri', max: 5 },
  { key: 'yoni',    label: 'Yoni',         max: 4 },
  { key: 'tara',    label: 'Tara',         max: 3 },
  { key: 'vasya',   label: 'Vashya',       max: 2 },
  { key: 'varna',   label: 'Varna',        max: 1 },
];

function ashtakootaLabel(score: number): string {
  if (score >= 32) return 'Exceptional';
  if (score >= 27) return 'Strong';
  if (score >= 24) return 'Good';
  if (score >= 18) return 'Compatible';
  return 'Challenging';
}

function ashtakootaColor(score: number): string {
  if (score >= 32) return '#a78bfa';
  if (score >= 27) return '#8b5cf6';
  if (score >= 24) return '#7c3aed';
  if (score >= 18) return '#6d28d9';
  return '#5b21b6';
}

export function ChatHeader({ user, isOtherUserTyping, connectionStatus, onBackPress, onMenuPress, synastryDetail, synastryScore }: ChatHeaderProps) {
  const [synastryExpanded, setSynastryExpanded] = useState(false);

  const getSubtitle = () => {
    if (isOtherUserTyping) return null;
    if (connectionStatus === 'disconnected') return { text: '⚠ Reconnecting...', color: '#F59E0B' };
    if (connectionStatus === 'connecting') return { text: 'Connecting...', color: 'rgba(255,255,255,0.4)' };
    if (user.isOnline) return { text: 'Active now', color: '#10B981' };
    return null;
  };

  const subtitle = getSubtitle();
  const hasAshtakoota = synastryDetail?.ashtakoota_score != null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={onBackPress} activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <MaterialIcons name="arrow-back-ios" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Avatar + name */}
        <TouchableOpacity style={styles.headerContent} activeOpacity={0.8} onPress={onMenuPress}>
          <View style={styles.avatarContainer}>
            <Image source={user.avatar} style={styles.headerAvatar} />
            {user.isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>{user.name}</Text>
            {isOtherUserTyping ? (
              <Text style={styles.typingText}>typing...</Text>
            ) : subtitle ? (
              <Text style={[styles.subtitleText, { color: subtitle.color }]}>{subtitle.text}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onMenuPress}>
          <MaterialIcons name="more-vert" size={22} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* Synastry strip */}
      {synastryDetail && (
        <TouchableOpacity onPress={() => setSynastryExpanded(e => !e)}
          style={styles.synastryStrip} activeOpacity={0.75}>

          {hasAshtakoota ? (
            // ── Ashtakoota pill row ───────────────────────────────────────────
            <View style={styles.synastryPills}>
              {KOOTA_LABELS.slice(0, 3).map(({ key, label }) => {
                const k = synastryDetail.ashtakoota_detail?.[key] as { received_points?: number; total_points?: number } | undefined;
                const got = k?.received_points ?? 0;
                const max = k?.total_points ?? 1;
                return (
                  <View key={label} style={styles.synastryPill}>
                    <Text style={styles.synastryPillText}>
                      {label} {got}/{max}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            // ── Western planet pill row (fallback while Ashtakoota loads) ─────
            <View style={styles.synastryPills}>
              <View style={styles.synastryPill}><Text style={styles.synastryPillText}>🌙 {Math.round(synastryDetail.moon_score)}/10</Text></View>
              <View style={styles.synastryPill}><Text style={styles.synastryPillText}>♀ {Math.round(synastryDetail.venus_score)}/10</Text></View>
              <View style={styles.synastryPill}><Text style={styles.synastryPillText}>♂ {Math.round(synastryDetail.mars_score)}/10</Text></View>
            </View>
          )}

          {/* Score badge */}
          <View style={styles.synastryScoreBadge}>
            {hasAshtakoota ? (
              <Text style={[styles.synastryScoreText, { color: ashtakootaColor(synastryDetail.ashtakoota_score!) }]}>
                ✦ {Math.round(synastryDetail.ashtakoota_score!)}/36
              </Text>
            ) : (
              <Text style={styles.synastryScoreText}>
                ✦ {synastryScore != null ? Math.round(synastryScore) : '—'}
              </Text>
            )}
          </View>

          <MaterialIcons name={synastryExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={14} color="rgba(167,139,250,0.6)" />
        </TouchableOpacity>
      )}

      {/* Expanded section */}
      {synastryExpanded && synastryDetail && (
        <View style={styles.synastryExpanded}>

          {/* ── Ashtakoota section ──────────────────────────────────────────── */}
          {hasAshtakoota && synastryDetail.ashtakoota_detail && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Vedic Compatibility</Text>
                <Text style={[styles.sectionBadge, { color: ashtakootaColor(synastryDetail.ashtakoota_score!) }]}>
                  {ashtakootaLabel(synastryDetail.ashtakoota_score!)} · {Math.round(synastryDetail.ashtakoota_score!)}/36 Gunas
                </Text>
              </View>
              {KOOTA_LABELS.map(({ key, label, max }) => {
                const k = synastryDetail.ashtakoota_detail![key] as { received_points?: number; total_points?: number } | undefined;
                const got = k?.received_points ?? 0;
                const total = k?.total_points ?? max;
                const pct = total > 0 ? (got / total) * 100 : 0;
                return (
                  <View key={label} style={styles.synastryRow}>
                    <Text style={styles.synastryLabel}>{label}</Text>
                    <View style={styles.synastryBarTrack}>
                      <View style={[styles.synastryBarFill, { width: `${Math.min(100, pct)}%` as any }]} />
                    </View>
                    <Text style={styles.synastryScoreSmall}>{got}/{total}</Text>
                  </View>
                );
              })}
              <View style={styles.divider} />
            </>
          )}

          {/* ── Western planets section ─────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Planet Compatibility</Text>
          </View>
          {[
            { emoji: '☀', label: 'Sun',     score: synastryDetail.sun_score },
            { emoji: '🌙', label: 'Moon',    score: synastryDetail.moon_score },
            { emoji: '♀',  label: 'Venus',   score: synastryDetail.venus_score },
            { emoji: '♂',  label: 'Mars',    score: synastryDetail.mars_score },
            { emoji: '☿',  label: 'Mercury', score: synastryDetail.mercury_score },
          ].map(({ emoji, label, score }) => (
            <View key={label} style={styles.synastryRow}>
              <Text style={styles.synastryLabel}>{emoji} {label}</Text>
              <View style={styles.synastryBarTrack}>
                <View style={[styles.synastryBarFill, { width: `${Math.min(100, score * 10)}%` as any }]} />
              </View>
              <Text style={styles.synastryScoreSmall}>{Math.round(score)}/10</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1A0B2E', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', paddingLeft: 6 },
  headerContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 2 },
  avatarContainer: { position: 'relative', marginRight: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.3)' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#1A0B2E' },
  headerText: { flex: 1 },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
  typingText: { color: '#A855F7', fontSize: 12, fontWeight: '500', marginTop: 1 },
  subtitleText: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  actionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  synastryStrip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, gap: 6,
    backgroundColor: 'rgba(139,92,246,0.07)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(139,92,246,0.15)',
  },
  synastryPills: { flexDirection: 'row', gap: 5, flex: 1 },
  synastryPill: { backgroundColor: 'rgba(139,92,246,0.18)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  synastryPillText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  synastryScoreBadge: { backgroundColor: 'rgba(139,92,246,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  synastryScoreText: { fontSize: 12, color: '#c4b5fd', fontWeight: '700' },

  synastryExpanded: { paddingHorizontal: 14, paddingBottom: 10, gap: 7, backgroundColor: 'rgba(139,92,246,0.05)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionBadge: { fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(139,92,246,0.2)', marginVertical: 4 },

  synastryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  synastryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', width: 80 },
  synastryBarTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  synastryBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#8b5cf6' },
  synastryScoreSmall: { fontSize: 11, color: '#a78bfa', width: 36, textAlign: 'right' },
});
