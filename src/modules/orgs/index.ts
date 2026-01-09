/**
 * Organizations Module Public API
 *
 * This module is responsible for managing organizations (multi-tenancy).
 *
 * Public Exports:
 * - OrgsModule: NestJS module for dependency injection
 * - OrgsService: Service for organization operations
 * - Org: Organization entity
 * - DTOs: For external API consumption
 *
 * Internal (not exported):
 * - OrgsController: HTTP endpoints (internal to module)
 *
 * Module Boundaries:
 * - This module owns the Org entity (tenant isolation)
 * - All data is scoped by orgId for multi-tenancy
 * - Other modules should use OrgsService for organization operations
 */

export * from './orgs.module';
export * from './entities/org.entity';
export * from './services/orgs.service';
export * from './dto';
