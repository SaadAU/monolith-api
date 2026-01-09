import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that checks if the authenticated user has the required role(s) to access a route.
 *
 * This guard should be used AFTER JwtAuthGuard to ensure the user is authenticated first.
 *
 * Authentication Flow:
 * 1. JwtAuthGuard validates the JWT token (returns 401 if invalid/missing)
 * 2. RolesGuard checks if user has required role (returns 403 if forbidden)
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from the @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, allow access (route is not role-protected)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get the authenticated user from the request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is present (should be caught by JwtAuthGuard first)
    if (!user) {
      throw new ForbiddenException('Access denied: User not authenticated');
    }

    // Check if the user's role is in the list of required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
