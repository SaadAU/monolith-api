import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Metadata key for storing roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access a route
 *
 * Usage:
 * @Roles(UserRole.ADMIN) - Only admins can access
 * @Roles(UserRole.ADMIN, UserRole.MODERATOR) - Admins and moderators can access
 *
 * @param roles - Array of UserRole values that are allowed
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
