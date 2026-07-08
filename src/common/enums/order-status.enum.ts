/**
 * Order lifecycle (scope §3.2.6, §4.4.1).
 * Phase 2 uses PENDING (created, advance unpaid) and CONFIRMED (advance paid).
 * ASSIGNED/IN_PROGRESS/COMPLETED/CANCELLED are driven by the admin in Phase 3.
 */
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
