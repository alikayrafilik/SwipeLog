import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthState } from '@/context/AuthContext';
import { AUTH_ENABLED, CLOUD_SYNC_ENABLED, LOCAL_USER_ID } from '@/constants/features';
import { CloudState, loadCloudState } from '@/services/cloud-state';

interface CloudStateContextValue {
  state: CloudState | null;
  isLoaded: boolean;
  isCloudSyncReady: boolean;
}

interface CloudStateSnapshot extends CloudStateContextValue {
  userId: string | null;
}

const CloudStateContext = createContext<CloudStateContextValue | null>(null);

export function CloudStateProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuthState();
  const [snapshot, setSnapshot] = useState<CloudStateSnapshot>({
    userId: null,
    state: null,
    isLoaded: !CLOUD_SYNC_ENABLED,
    isCloudSyncReady: false,
  });
  const userId = AUTH_ENABLED ? session?.user.id : LOCAL_USER_ID;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    loadCloudState(userId)
      .then((nextState) => {
        if (cancelled) return;
        setSnapshot({
          userId,
          state: nextState,
          isLoaded: true,
          isCloudSyncReady: CLOUD_SYNC_ENABLED,
        });
      })
      .catch((error) => {
        console.error('[CloudState] Failed to load cloud state:', error);
        if (cancelled) return;
        setSnapshot({
          userId,
          state: null,
          isLoaded: true,
          isCloudSyncReady: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo(() => {
    if (!userId) {
      return { state: null, isLoaded: true, isCloudSyncReady: false };
    }

    if (snapshot.userId !== userId) {
      return {
        state: null,
        isLoaded: !CLOUD_SYNC_ENABLED,
        isCloudSyncReady: false,
      };
    }

    return {
      state: snapshot.state,
      isLoaded: snapshot.isLoaded,
      isCloudSyncReady: snapshot.isCloudSyncReady,
    };
  }, [snapshot, userId]);

  return <CloudStateContext.Provider value={value}>{children}</CloudStateContext.Provider>;
}

export function useCloudState() {
  const context = useContext(CloudStateContext);
  if (!context) throw new Error('useCloudState must be used within CloudStateProvider');
  return context;
}
