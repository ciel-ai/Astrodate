import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getMembershipOrFree, type MembershipSummary } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';

type SubscriptionContextType = {
  membership: MembershipSummary | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  membership: null,
  isLoading: true,
  refetch: async () => {},
});

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchMembership = async () => {
    setIsLoading(true);
    const data = await getMembershipOrFree();
    setMembership(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMembership();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Realtime: re-fetch when the subscription row is updated (e.g. after Razorpay payment)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('sub-' + userId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_subscriptions',
        filter: 'user_id=eq.' + userId,
      }, () => void fetchMembership())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return (
    <SubscriptionContext.Provider value={{ membership, isLoading, refetch: fetchMembership }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionStatus = () => useContext(SubscriptionContext);
