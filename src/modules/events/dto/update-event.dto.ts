import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

/**
 * DTO for updating an event
 * All fields are optional (partial update)
 */
export class UpdateEventDto extends PartialType(CreateEventDto) {}
