import { useCallback } from 'react';
import { useMovieActions } from '@/context/MovieContext';
import { useTierListActions } from '@/context/TierListContext';
import { resetOnboardingTips } from '@/components/OnboardingTips';
import { clearPersistedProfileImages } from '@/services/profile-images';
import { resetSmartNotifications } from '@/services/smart-notifications';
import { useUserProfile } from '@/hooks/use-user-profile';
import { clearDiscoverSession } from '@/services/discover-session';

export const useResetUserData = () => {
  const { clearAllMovieData } = useMovieActions();
  const { clearAllTierLists } = useTierListActions();
  const { resetProfile } = useUserProfile();

  return useCallback(async () => {
    await Promise.all([
      clearAllMovieData(),
      clearAllTierLists(),
      resetOnboardingTips(),
      resetSmartNotifications(),
      clearDiscoverSession(),
      Promise.resolve(clearPersistedProfileImages()),
    ]);

    // Resetting the profile last flips onboardingCompleted and redirects only
    // after the other user-owned data has been cleared.
    await resetProfile();
  }, [clearAllMovieData, clearAllTierLists, resetProfile]);
};
