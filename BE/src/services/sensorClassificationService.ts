import { env } from '../config/env';
import { Classification } from '../types/enums';

/**
 * Pure classification service for smoke sensor values.
 *
 * Thresholds are read from environment variables:
 * - `SMOKE_THRESHOLD_WARNING` (default: 300) — inclusive lower bound for WARNING
 * - `SMOKE_THRESHOLD_DANGER`  (default: 600) — exclusive upper bound for WARNING / lower bound for DANGER
 *
 * Classification logic:
 * - smoke_value <  WARNING threshold → NORMAL
 * - smoke_value >= WARNING threshold AND < DANGER threshold → WARNING
 * - smoke_value >= DANGER threshold → DANGER
 */

/**
 * Classify a smoke sensor value into a `Classification` level.
 *
 * @param smokeValue - Raw ADC smoke value (integer 0–4095)
 * @returns `Classification.NORMAL`, `Classification.WARNING`, or `Classification.DANGER`
 */
function classify(smokeValue: number): Classification {
  const warningThreshold = env.SMOKE_THRESHOLD_WARNING;
  const dangerThreshold = env.SMOKE_THRESHOLD_DANGER;

  if (smokeValue >= dangerThreshold) {
    return Classification.DANGER;
  }

  if (smokeValue >= warningThreshold) {
    return Classification.WARNING;
  }

  return Classification.NORMAL;
}

export const sensorClassificationService = {
  classify,
};
