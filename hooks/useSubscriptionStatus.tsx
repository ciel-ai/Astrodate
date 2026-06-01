import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getMembershipOrFree, type MembershipSummary } from '@/lib/subscription';

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

  const fetchMembership = async () => {
    setIsLoading(true);
    const data = await getMembershipOrFree();
    setMembership(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMembership();
  }, []);

  return (
    <SubscriptionContext.Provider value={{ membership, isLoading, refetch: fetchMembership }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionStatus = () => useContext(SubscriptionContext);
