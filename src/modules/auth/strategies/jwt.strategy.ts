import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '../../../common/types/jwt-payload';

/**
 * Validates the Bearer JWT on protected routes and shapes request.user.
 * An expired token fails here → enforces session timeout.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') || '',
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Invalid token');
    }
    return { id: payload.sub, role: payload.role };
  }
}
