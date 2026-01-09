/**
 * Auth Module Public API
 * 
 * This module is responsible for authentication and authorization.
 * 
 * Public Exports:
 * - AuthModule: NestJS module for dependency injection
 * - AuthService: Service for authentication operations
 * - Guards: JwtAuthGuard, RolesGuard for protecting routes
 * - Decorators: CurrentUser, Roles for route handlers
 * - DTOs: For external API consumption
 * 
 * Internal (not exported):
 * - AuthController: HTTP endpoints (internal to module)
 * - Strategies: Passport strategies (internal to module)
 * 
 * Module Boundaries:
 * - This module handles all authentication and authorization
 * - Provides guards and decorators for route protection
 * - Other modules use guards/decorators, not AuthService directly
 */

export * from './auth.module';
export * from './services/auth.service';
export * from './guards';
export * from './decorators';
export * from './dto';
