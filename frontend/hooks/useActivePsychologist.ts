import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';

/**
 * Identity for the psychologist dashboard. The authenticated backend profile
 * is the only source of truth; there is no roster switcher or approval state.
 */
export function useActivePsychologist() {
  const profileQuery = useQuery({
    queryKey: ['psych-profile', 'me'],
    queryFn: () => api.getMyPsychologistProfile(),
  });

  return {
    activePsych: profileQuery.data,
    isLoading: profileQuery.isLoading,
  };
}
