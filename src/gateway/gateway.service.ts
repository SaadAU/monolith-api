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
import {
  applyRetryLogic,
  type RetryConfig,
} from '../common/utils/retry.utility';

/**
 * Gateway Service
 * Acts as a facade for communication with microservices
 * Implements:
 * - Timeout and retry strategy with exponential backoff
 * - Correlation ID propagation across service boundaries
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
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Attaches correlation ID to message payload for microservice tracking
   */
  private attachCorrelationId(payload: any, correlationId?: string): any {
    if (!correlationId) return payload;
    return {
      ...payload,
      correlationId,
    };
  }

  /**
   * Executes a microservice call with retry and timeout
   */
  private async executeServiceCall<T>(
    observable: any,
    serviceName: string,
    errorMessage: string,
    retryConfig?: Partial<RetryConfig>,
  ): Promise<T> {
    try {
      return await firstValueFrom(applyRetryLogic(observable, retryConfig));
    } catch (error) {
      const errorMsg = (error as Error).message || errorMessage;
      console.error(`[${serviceName}] Call failed: ${errorMsg}`);
      throw new BadRequestException(errorMsg);
    }
  }

  // ============================================
  // AUTH SERVICE METHODS
  // ============================================

  async login(loginDto: LoginRequestDto, correlationId?: string) {
    const payload = this.attachCorrelationId(loginDto, correlationId);
    return this.executeServiceCall(
      this.authServiceClient.send(AUTH_SERVICE_PATTERNS.LOGIN, payload),
      'Auth Service',
      'Authentication failed',
    );
  }

  async signup(signupDto: SignupRequestDto, correlationId?: string) {
    const payload = this.attachCorrelationId(signupDto, correlationId);
    return this.executeServiceCall(
      this.authServiceClient.send(AUTH_SERVICE_PATTERNS.SIGNUP, payload),
      'Auth Service',
      'Registration failed',
    );
  }

  async validateToken(token: string, correlationId?: string) {
    const validateDto: ValidateTokenRequestDto = { token };
    const payload = this.attachCorrelationId(validateDto, correlationId);
    return this.executeServiceCall(
      this.authServiceClient.send(
        AUTH_SERVICE_PATTERNS.VALIDATE_TOKEN,
        payload,
      ),
      'Auth Service',
      'Token validation failed',
    );
  }

  async getUser(userId: string, correlationId?: string) {
    const getUserDto: GetUserRequestDto = { userId };
    const payload = this.attachCorrelationId(getUserDto, correlationId);
    return this.executeServiceCall(
      this.authServiceClient.send(AUTH_SERVICE_PATTERNS.GET_USER, payload),
      'Auth Service',
      'Failed to fetch user',
    );
  }

  // ============================================
  // EVENTS SERVICE METHODS
  // ============================================

  async createEvent(
    createEventDto: CreateEventRequestDto,
    correlationId?: string,
  ) {
    const payload = this.attachCorrelationId(createEventDto, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.CREATE_EVENT,
        payload,
      ),
      'Events Service',
      'Failed to create event',
    );
  }

  async getEvent(eventId: string, correlationId?: string) {
    const payload = this.attachCorrelationId({ id: eventId }, correlationId);
    try {
      return await firstValueFrom(
        applyRetryLogic(
          this.eventsServiceClient.send(
            EVENTS_SERVICE_PATTERNS.GET_EVENT,
            payload,
          ),
        ),
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

  async listEvents(
    listEventsDto: ListEventsRequestDto,
    correlationId?: string,
  ) {
    const payload = this.attachCorrelationId(listEventsDto, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.LIST_EVENTS,
        payload,
      ),
      'Events Service',
      'Failed to list events',
    );
  }

  async updateEvent(
    updateEventDto: UpdateEventRequestDto,
    correlationId?: string,
  ) {
    const payload = this.attachCorrelationId(updateEventDto, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.UPDATE_EVENT,
        payload,
      ),
      'Events Service',
      'Failed to update event',
    );
  }

  async deleteEvent(
    eventId: string,
    deletedById: string,
    correlationId?: string,
  ) {
    const deletePayload = { id: eventId, deletedById };
    const payload = this.attachCorrelationId(deletePayload, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.DELETE_EVENT,
        payload,
      ),
      'Events Service',
      'Failed to delete event',
    );
  }

  async approveEvent(
    eventId: string,
    approvedById: string,
    correlationId?: string,
  ) {
    const approvePayload = { id: eventId, approvedById };
    const payload = this.attachCorrelationId(approvePayload, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.APPROVE_EVENT,
        payload,
      ),
      'Events Service',
      'Failed to approve event',
    );
  }

  async rejectEvent(
    eventId: string,
    rejectionReason: string,
    rejectedById: string,
    correlationId?: string,
  ) {
    const rejectPayload = { id: eventId, rejectionReason, rejectedById };
    const payload = this.attachCorrelationId(rejectPayload, correlationId);
    return this.executeServiceCall(
      this.eventsServiceClient.send(
        EVENTS_SERVICE_PATTERNS.REJECT_EVENT,
        payload,
      ),
      'Events Service',
      'Failed to reject event',
    );
  }
}
