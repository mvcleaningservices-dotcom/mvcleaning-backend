import { Role } from '../enums/role.enum';

/**
 * Shape of the signed JWT payload and the request.user object after auth.
 */
export interface JwtPayload {
  sub: string; // user/admin document id
  role: Role;
}

export interface AuthUser {
  id: string;
  role: Role;
}
