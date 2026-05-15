'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStatsSnapshot } from '../hooks/useStatsSnapshot';
import { useYoutubeQuota } from '../hooks/useYoutubeQuota';
import { useSearchStats } from '../hooks/useSearchStats';
import { useQueueOps } from '../hooks/useQueueOps';
import { useSessionsData } from '../hooks/useSessionsData';
import { useSubscriptions } from '../hooks/useSubscriptions';

interface AdminDataContextValue {
  stats: ReturnType<typeof useStatsSnapshot>;
  quota: ReturnType<typeof useYoutubeQuota>;
  searchStats: ReturnType<typeof useSearchStats>;
  queueOps: ReturnType<typeof useQueueOps>;
  sessions: ReturnType<typeof useSessionsData>;
  subscriptions: ReturnType<typeof useSubscriptions>;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const stats = useStatsSnapshot();
  const quota = useYoutubeQuota();
  const searchStats = useSearchStats();
  const queueOps = useQueueOps();
  const sessions = useSessionsData();
  const subscriptions = useSubscriptions();

  return (
    <AdminDataContext.Provider value={{ stats, quota, searchStats, queueOps, sessions, subscriptions }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used within AdminDataProvider');
  return ctx;
}
