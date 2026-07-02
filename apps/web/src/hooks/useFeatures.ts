import { useQuery } from '@tanstack/react-query';
import type { FeatureKey, FeatureMap } from '@tasku/types';
import { meApi } from '@/lib/admin';
import { qk } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/auth';

/**
 * The effective feature map for the current user (GET /me/features), cached.
 * Only fetched once authenticated.
 */
export function useFeatures() {
  const token = useAuthStore((s) => s.token);
  return useQuery<FeatureMap>({
    queryKey: qk.myFeatures,
    queryFn: meApi.features,
    enabled: !!token,
    staleTime: 60_000,
  });
}

/**
 * Whether a single feature is enabled for the current user. Defaults to `true`
 * while the map is loading or if the key is absent, so nothing flickers off.
 */
export function useFeature(key: FeatureKey): boolean {
  const { data } = useFeatures();
  if (!data) return true;
  return data[key] !== false;
}
