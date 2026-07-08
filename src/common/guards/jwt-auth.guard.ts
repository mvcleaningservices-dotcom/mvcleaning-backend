import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Requires a valid JWT. Attach with @UseGuards(JwtAuthGuard).
 * Expired/invalid tokens are rejected (401) — this also enforces the
 * admin "session timeout" (scope §4.2) via the token's expiry.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
