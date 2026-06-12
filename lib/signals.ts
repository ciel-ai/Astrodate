import { supabase } from './supabase';

const SIGNAL_COLLECTOR_FUNCTION = 'signal-collector';

// Internal fire-and-forget dispatcher
function fireSignal(targetUserId: string, signalType: string): void {
  supabase.functions
    .invoke(SIGNAL_COLLECTOR_FUNCTION, {
      body: { target_user_id: targetUserId, signal_type: signalType },
    })
    .catch(() => {}); // Never throw — signals are non-critical
}

// Debounce map for view_profile (prevent duplicate fires on same card)
const viewedProfiles = new Set<string>();

export function signalViewProfile(targetUserId: string): void {
  if (!targetUserId || viewedProfiles.has(targetUserId)) return;
  viewedProfiles.add(targetUserId);
  fireSignal(targetUserId, 'view_profile');
}

// Timer map for view_long (fires after 5s of viewing same card)
const viewLongTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function startViewLongTimer(targetUserId: string): void {
  if (!targetUserId || viewLongTimers.has(targetUserId)) return;
  const timer = setTimeout(() => {
    fireSignal(targetUserId, 'view_long');
    viewLongTimers.delete(targetUserId);
  }, 5000);
  viewLongTimers.set(targetUserId, timer);
}

export function stopViewLongTimer(targetUserId: string): void {
  const timer = viewLongTimers.get(targetUserId);
  if (timer) {
    clearTimeout(timer);
    viewLongTimers.delete(targetUserId);
  }
}

export function signalLike(targetUserId: string): void {
  if (!targetUserId) return;
  fireSignal(targetUserId, 'like');
}

export function signalSuperLike(targetUserId: string): void {
  if (!targetUserId) return;
  fireSignal(targetUserId, 'super_like');
}

export function signalDislike(targetUserId: string): void {
  if (!targetUserId) return;
  fireSignal(targetUserId, 'dislike');
}

export function signalMessageSent(targetUserId: string): void {
  if (!targetUserId) return;
  fireSignal(targetUserId, 'message_sent');
}

export function signalMessageReplied(targetUserId: string): void {
  if (!targetUserId) return;
  fireSignal(targetUserId, 'message_replied');
}
