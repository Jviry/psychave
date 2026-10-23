import { useQuery } from '@tanstack/react-query';

import { api, AUTH_MODE } from '../lib/api';
import { useAppStore } from '../stores/useAppStore';
import type { ResidentPsychologist } from '../lib/types';

/**
 * Identity for the psychologist dashboard.
 *
 * - Live mode: the backend's `GET /psychologist-profile/me` is authoritative;
 *   the mock roster and PractitionerSwitcher are hidden.
 * - Mock mode: keep the roster switcher so the verification gate can be tested.
 */
export function useActivePsychologist() {
  const activePsychologistId = useAppStore((state) => state.activePsychologistId);
  const isLive = AUTH_MODE === 'real';

  const rosterQuery = useQuery({
    queryKey: ['roster', 'admin'],
    queryFn: () => api.getRoster(true),
    enabled: !isLive,
  });

  const profileQuery = useQuery({
    queryKey: ['psych-profile', 'me'],
    queryFn: () => api.getMyPsychologistProfile(),
    enabled: isLive,
  });

  const roster = rosterQuery.data ?? [];
  const activePsych: ResidentPsychologist | undefined = isLive
    ? profileQuery.data
    : roster.find((psych) => psych.id === activePsychologistId) ?? roster[0];

  return {
    isLive,
    activePsych,
    isLoading: isLive ? profileQuery.isLoading : rosterQuery.isLoading,
    activePsychologistId: activePsych?.id ?? activePsychologistId,
    showSwitcher: !isLive,
  };
}
