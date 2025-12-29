import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

// Extend Express Request to include our custom property
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use existing request ID from header or generate a new one
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || uuidv4();
    
    // Attach to request for use in application
    req.requestId = requestId;
    
    // Set response header
    res.setHeader(REQUEST_ID_HEADER, requestId);
    
    next();
  }
}
