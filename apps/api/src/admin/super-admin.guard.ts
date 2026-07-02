import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Allows only platform super-admins. Use alongside `JwtAuthGuard`, which
 * populates `req.user` (including `platformRole`).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.platformRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super-admin access required');
    }
    return true;
  }
}
