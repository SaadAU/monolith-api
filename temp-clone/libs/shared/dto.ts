/**
 * Shared DTOs for Microservice Communication
 */

// ============================================
// AUTH SERVICE DTOs
// ============================================

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface SignupRequestDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: AuthUserDto;
}

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  isActive: boolean;
  phone?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidateTokenRequestDto {
  token: string;
}

export interface ValidateTokenResponseDto {
  valid: boolean;
  userId?: string;
  email?: string;
  orgId?: string;
  role?: string;
  error?: string;
}

export interface GetUserRequestDto {
  userId: string;
}

// ============================================
// EVENTS SERVICE DTOs
// ============================================

export interface CreateEventRequestDto {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  maxAttendees?: number;
  isVirtual?: boolean;
  virtualUrl?: string;
  orgId: string;
  createdById: string;
}

export interface EventResponseDto {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  maxAttendees?: number;
  isVirtual: boolean;
  virtualUrl?: string;
  status:
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'completed';
  rejectionReason?: string;
  orgId: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ListEventsRequestDto {
  orgId: string;
  skip?: number;
  take?: number;
  status?: string;
  search?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListEventsResponseDto {
  items: EventResponseDto[];
  total: number;
  skip: number;
  take: number;
}

export interface UpdateEventRequestDto {
  id: string;
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  maxAttendees?: number;
  isVirtual?: boolean;
  virtualUrl?: string;
  updatedById: string;
}

export interface DeleteEventRequestDto {
  id: string;
  deletedById: string;
}

export interface ApproveEventRequestDto {
  id: string;
  approvedById: string;
}

export interface RejectEventRequestDto {
  id: string;
  rejectionReason: string;
  rejectedById: string;
}

// ============================================
// ERROR RESPONSE DTO
// ============================================

export interface MicroserviceErrorDto {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
}
