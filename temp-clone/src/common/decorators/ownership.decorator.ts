import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export interface OwnershipMetadata {
  /**
   * The name of the service to use for ownership check
   * e.g., 'EventsService', 'PostsService'
   */
  serviceName: string;

  /**
   * The method name in the service to check ownership
   * Should return a boolean
   * e.g., 'isOwner'
   */
  methodName: string;

  /**
   * The route param name containing the resource ID
   * e.g., 'id', 'eventId'
   */
  idParam: string;
}

/**
 * Decorator to mark a route as requiring ownership verification
 * Usage:
 * @RequireOwnership({ serviceName: 'EventsService', methodName: 'isOwner', idParam: 'id' })
 */
export const RequireOwnership = (metadata: OwnershipMetadata) =>
  SetMetadata(OWNERSHIP_KEY, metadata);
