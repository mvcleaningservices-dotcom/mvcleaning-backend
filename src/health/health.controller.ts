import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Health check — verifies the API is up and reports MongoDB connection state.
 * Used to confirm Phase 0 wiring (app boots + DB connects).
 */
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check() {
    // Mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const dbState = states[this.connection.readyState] ?? 'unknown';

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbState,
    };
  }
}
