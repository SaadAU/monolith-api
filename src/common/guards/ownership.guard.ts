import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import {
  OWNERSHIP_KEY,
  OwnershipMetadata,
} from '../decorators/ownership.decorator';

/**
 * Generic ownership guard that can be used with any resource
 *
 * This guard checks if the authenticated user owns the resource being accessed.
 * It uses metadata from the @RequireOwnership decorator to determine:
 * - Which service to use for the ownership check
 * - Which method to call on that service
 * - Which route parameter contains the resource ID
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, OwnershipGuard)
 * @RequireOwnership({ serviceName: 'EventsService', methodName: 'isOwner', idParam: 'id' })
 *
 * The service method should have signature:
 * isOwner(resourceId: string, userId: string, orgId: string): Promise<boolean>
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get ownership metadata from decorator
    const ownershipMeta = this.reflector.getAllAndOverride<OwnershipMetadata>(
      OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no ownership metadata, allow access (not ownership-protected)
    if (!ownershipMeta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Get resource ID from route params
    const resourceId = request.params[ownershipMeta.idParam];

    if (!resourceId) {
      throw new NotFoundException('Resource ID not found in request');
    }

    try {
      // Get the service instance
      const service = this.moduleRef.get(ownershipMeta.serviceName, {
        strict: false,
      });

      if (!service) {
        throw new Error(`Service '${ownershipMeta.serviceName}' not found`);
      }

      const method = service[ownershipMeta.methodName];

      if (!method || typeof method !== 'function') {
        throw new Error(
          `Method '${ownershipMeta.methodName}' not found on service '${ownershipMeta.serviceName}'`,
        );
      }

      // Call the ownership check method
      const isOwner = await method.call(
        service,
        resourceId,
        user.id,
        user.orgId,
      );

      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to access this resource',
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // Log unexpected errors and deny access
      console.error('Ownership check failed:', error);
      throw new ForbiddenException('Unable to verify ownership');
    }
  }
}
