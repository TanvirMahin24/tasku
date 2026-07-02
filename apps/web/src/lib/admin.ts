import { api } from './api';
import type {
  AdminUserDto,
  BanUserDto,
  FeatureDef,
  FeatureMap,
  FeatureOverrideDto,
  PlatformRole,
  SetFeatureOverrideDto,
} from '@tasku/types';

// ---------------------------------------------------------------------------
// Platform administration (super-admin only) + current-user feature map.
// ---------------------------------------------------------------------------

/** Shape returned by GET /admin/features. */
export interface AdminFeaturesConfig {
  catalog: FeatureDef[];
  overrides: FeatureOverrideDto[];
}

export const adminApi = {
  users: () => api.get<AdminUserDto[]>('/admin/users').then((r) => r.data),
  setRole: (id: string, platformRole: PlatformRole) =>
    api
      .patch<AdminUserDto>(`/admin/users/${id}/role`, { platformRole })
      .then((r) => r.data),
  ban: (id: string, reason?: string) =>
    api
      .post<AdminUserDto>(`/admin/users/${id}/ban`, { reason } satisfies BanUserDto)
      .then((r) => r.data),
  unban: (id: string) =>
    api.post<AdminUserDto>(`/admin/users/${id}/unban`).then((r) => r.data),
  featuresConfig: () =>
    api.get<AdminFeaturesConfig>('/admin/features').then((r) => r.data),
  setOverride: (dto: SetFeatureOverrideDto) =>
    api.put<FeatureOverrideDto>('/admin/features', dto).then((r) => r.data),
  removeOverride: (id: string) =>
    api.delete<void>(`/admin/features/${id}`).then((r) => r.data),
};

export const meApi = {
  features: () => api.get<FeatureMap>('/me/features').then((r) => r.data),
};
