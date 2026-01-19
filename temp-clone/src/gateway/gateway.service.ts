import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_SERVICE_PATTERNS,
  EVENTS_SERVICE_PATTERNS,
  MICROSERVICE_TRANSPORT,
  LoginRequestDto,
  SignupRequestDto,
  CreateEventRequestDto,
  ListEventsRequestDto,
  UpdateEventRequestDto,
  ValidateTokenRequestDto,
  GetUserRequestDto,
} from '../../libs/shared';

/**
 * Gateway Service
 * Acts as a facade for communication with microservices
 */
@Injectable()
export class GatewayService {
  constructor(
    @Inject(MICROSERVICE_TRANSPORT.AUTH_SERVICE)
    private authServiceClient: ClientProxy,
    @Inject(MICROSERVICE_TRANSPORT.EVENTS_SERVICE)
    private eventsServiceClient: ClientProxy,
  ) {}

  // ============================================
  // AUTH SERVICE METHODS
  // ============================================

  async login(loginDto: LoginRequestDto) {
    try {
      return await firstValueFrom(
        this.authServiceClient.send(AUTH_SERVICE_PATTERNS.LOGIN, loginDto),
      );
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Authentication failed',
      );
    }
  }

  async signup(signupDto: SignupRequestDto) {
    try {
      return await firstValueFrom(
        this.authServiceClient.send(AUTH_SERVICE_PATTERNS.SIGNUP, signupDto),
      );
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Registration failed',
      );
    }
  }

  async validateToken(token: string) {
    try {
      const validateDto: ValidateTokenRequestDto = { token };
      return await firstValueFrom(
        this.authServiceClient.send(
          AUTH_SERVICE_PATTERNS.VALIDATE_TOKEN,
          validateDto,
        ),
      );
    } catch {
      throw new BadRequestException('Token validation failed');
    }
  }

  async getUser(userId: string) {
    try {
      const getUserDto: GetUserRequestDto = { userId };
      return await firstValueFrom(
        this.authServiceClient.send(AUTH_SERVICE_PATTERNS.GET_USER, getUserDto),
      );
    } catch {
      throw new BadRequestException('Failed to fetch user');
    }
  }

  // ============================================
  // EVENTS SERVICE METHODS
  // ============================================

  async createEvent(createEventDto: CreateEventRequestDto) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(
          EVENTS_SERVICE_PATTERNS.CREATE_EVENT,
          createEventDto,
        ),
      );
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Failed to create event',
      );
    }
  }

  async getEvent(eventId: string) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(EVENTS_SERVICE_PATTERNS.GET_EVENT, {
          id: eventId,
        }),
      );
    } catch (error) {
      // Check if the error is from the microservice (RPC error)
      if (error && typeof error === 'object') {
        const errObj = error as any;
        // RpcException from microservice comes with statusCode
        if (errObj.statusCode === 404) {
          throw new NotFoundException(errObj.message || 'Event not found');
        }
      }
      throw new BadRequestException('Failed to fetch event');
    }
  }

  async listEvents(listEventsDto: ListEventsRequestDto) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(
          EVENTS_SERVICE_PATTERNS.LIST_EVENTS,
          listEventsDto,
        ),
      );
    } catch {
      throw new BadRequestException('Failed to list events');
    }
  }

  async updateEvent(updateEventDto: UpdateEventRequestDto) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(
          EVENTS_SERVICE_PATTERNS.UPDATE_EVENT,
          updateEventDto,
        ),
      );
    } catch {
      throw new BadRequestException('Failed to update event');
    }
  }

  async deleteEvent(eventId: string, deletedById: string) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(EVENTS_SERVICE_PATTERNS.DELETE_EVENT, {
          id: eventId,
          deletedById,
        }),
      );
    } catch {
      throw new BadRequestException('Failed to delete event');
    }
  }

  async approveEvent(eventId: string, approvedById: string) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(EVENTS_SERVICE_PATTERNS.APPROVE_EVENT, {
          id: eventId,
          approvedById,
        }),
      );
    } catch {
      throw new BadRequestException('Failed to approve event');
    }
  }

  async rejectEvent(
    eventId: string,
    rejectionReason: string,
    rejectedById: string,
  ) {
    try {
      return await firstValueFrom(
        this.eventsServiceClient.send(EVENTS_SERVICE_PATTERNS.REJECT_EVENT, {
          id: eventId,
          rejectionReason,
          rejectedById,
        }),
      );
    } catch {
      throw new BadRequestException('Failed to reject event');
    }
  }
}
