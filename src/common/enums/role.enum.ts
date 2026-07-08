/**
 * The three roles in the platform (scope PDF §2.3, §4.1).
 * - CONSUMER: mobile app user (OTP login)
 * - SUB_ADMIN: day-to-day operations (web, password login)
 * - SUPER_ADMIN: full platform control (web, password login)
 */
export enum Role {
  CONSUMER = 'consumer',
  SUB_ADMIN = 'sub_admin',
  SUPER_ADMIN = 'super_admin',
}
