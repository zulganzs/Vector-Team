/**
 * Notification Service — STUB
 *
 * This file is a minimal stub created for Task 5 (Fire Classification & Incident Management).
 * Full implementation with Twilio SMS dispatch and BullMQ queuing will be provided in Task 6.
 *
 * All methods are no-ops to prevent circular dependency errors.
 * The function signatures are intentionally compatible with the final implementation
 * so no call-site changes will be required.
 */

import type { Incident } from '../types/domain.types';

/**
 * Dispatch an SMS notification for a DANGER incident.
 * Full implementation (BullMQ + Twilio) provided in Task 6.
 */
async function dispatchSmsForIncident(_incident: Incident): Promise<void> {
  // Stub — full implementation in Task 6
}

export const notificationService = {
  dispatchSmsForIncident,
};
