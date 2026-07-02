import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlatformRole } from '@tasku/types';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  platformRole?: PlatformRole;
}

/**
 * Extracts the authenticated user (set by JwtStrategy.validate) from the
 * request. Usage: `@CurrentUser() user: AuthUser`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
