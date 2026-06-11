import type { SensorReading } from '../types/domain.types';

/**
 * Incident Service — STUB
 *
 * This file is a minimal stub created for Task 4 (IoT Sensor Data Ingestion).
 * Full implementation (incident state machine, notifications, etc.) will be
 * provided in Task 5 (Incident Management).
 *
 * All methods are no-ops. The function signatures are intentionally compatible
 * with the final implementation so no call-site changes will be required.
 */

/**
 * Evaluate a sensor reading and create/update an incident if necessary.
 * Called by `sensorProcessingService` after a non-duplicate reading is persisted.
 *
 * @param reading - The persisted SensorReading record
 */
async function evaluateSensorReading(_reading: SensorReading): Promise<void> {
  // Stub — full implementation in Task 5
}

export const incidentService = {
  evaluateSensorReading,
};
