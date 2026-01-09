/**
 * Users Module Public API
 * 
 * This module is responsible for user management and user-related operations.
 * 
 * Public Exports:
 * - UsersModule: NestJS module for dependency injection
 * - UsersService: Service for user CRUD operations
 * - User: User entity
 * - UserRole: User role enum for RBAC
 * - DTOs: For external API consumption
 * 
 * Internal (not exported):
 * - UsersController: HTTP endpoints (internal to module)
 * 
 * Module Boundaries:
 * - This module owns the User entity
 * - Other modules should use UsersService for user operations
 * - Do NOT directly access the UserRepository from other modules
 */

export * from './users.module';
export * from './entities/user.entity';
export * from './services/users.service';
export * from './dto';
