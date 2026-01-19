/**
 * Shared Message Patterns for TCP Microservices Communication
 */

// ============================================
// AUTH SERVICE PATTERNS
// ============================================
export const AUTH_SERVICE_PATTERNS = {
  // Auth operations
  LOGIN: 'auth.login',
  VALIDATE_TOKEN: 'auth.validate-token',
  REFRESH_TOKEN: 'auth.refresh-token',
  SIGNUP: 'auth.signup',
  GET_USER: 'auth.get-user',
} as const;

// ============================================
// EVENTS SERVICE PATTERNS
// ============================================
export const EVENTS_SERVICE_PATTERNS = {
  // Event CRUD operations
  CREATE_EVENT: 'events.create',
  GET_EVENT: 'events.get',
  LIST_EVENTS: 'events.list',
  UPDATE_EVENT: 'events.update',
  DELETE_EVENT: 'events.delete',
  APPROVE_EVENT: 'events.approve',
  REJECT_EVENT: 'events.reject',
} as const;

// ============================================
// SERVICE CONSTANTS
// ============================================
export const MICROSERVICE_TRANSPORT = {
  AUTH_SERVICE: 'AUTH_SERVICE',
  EVENTS_SERVICE: 'EVENTS_SERVICE',
} as const;
