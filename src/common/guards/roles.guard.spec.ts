import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

/**
 * Proves server-side role enforcement (scope §4.2):
 * a Sub Admin must NOT reach a Super-Admin-only route.
 */
describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  const contextFor = (userRole?: Role): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: userRole ? { id: 'x', role: userRole } : undefined }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows any authenticated user when no @Roles is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(Role.CONSUMER))).toBe(true);
  });

  it('allows a user whose role matches', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPER_ADMIN]);
    expect(guard.canActivate(contextFor(Role.SUPER_ADMIN))).toBe(true);
  });

  it('REJECTS a Sub Admin on a Super-Admin-only route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPER_ADMIN]);
    expect(() => guard.canActivate(contextFor(Role.SUB_ADMIN))).toThrow(
      ForbiddenException,
    );
  });

  it('REJECTS an unauthenticated request on a role-protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUB_ADMIN]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
