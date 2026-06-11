import { z } from 'zod';

/**
 * Validation schema for PATCH /incidents/:id/dismiss.
 */
export const dismissIncidentSchema = z.object({
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional(),
});

export type DismissIncidentInput = z.infer<typeof dismissIncidentSchema>;

/**
 * Generic notes schema — used for acknowledge, resolve, close, etc.
 */
export const incidentNotesSchema = z.object({
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional(),
});

export type IncidentNotesInput = z.infer<typeof incidentNotesSchema>;
