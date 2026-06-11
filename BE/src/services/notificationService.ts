// 1. Node.js built-ins
// (none)

// 2. Third-party libraries
import { Queue } from 'bullmq';

// 3. Internal config
import { db } from '../config/database';
import { redisClient } from '../config/redis';
import { env } from '../config/env';

// 4. Services, repositories
import { notificationRepository } from '../repositories/notificationRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';

// 5. Types & schemas
import type { Incident, Building, Zone } from '../types/domain.types';
import { NotificationStatus, NotificationType } from '../types/enums';

/**
 * BullMQ Queue for SMS dispatch jobs.
 *
 * Named `sms` — consistent with the queue-worker.ts consumer.
 * Uses the shared ioredis client (maxRetriesPerRequest: null is required by BullMQ).
 */
const smsQueue = new Queue('sms', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10s → 30s → 60s
    },
    removeOnComplete: 100, // keep last 100 completed jobs for debugging
    removeOnFail: 200,     // keep last 200 failed jobs
  },
});

/**
 * Build the SMS message body for a DANGER incident.
 *
 * Template (from R5.1):
 *   🚨 BAHAYA KEBAKARAN — {building_name}
 *   Zona    : {zone_name}
 *   Alamat  : {address}
 *   Asap    : {smoke_value} ppm
 *   Aliran  : {water_flow} L/min  (opsional)
 *   Waktu   : {detected_at}
 *   Dashboard: {APP_URL}/incidents/{incident_id}
 */
function buildSmsBody(
  incident: Incident,
  building: Building,
  zone: Zone,
): string {
  const lines: string[] = [
    `🚨 BAHAYA KEBAKARAN — ${building.name}`,
    `Zona    : ${zone.name}`,
    `Alamat  : ${building.address}`,
    `Asap    : ${incident.smoke_value} ppm`,
  ];

  if (incident.water_flow != null) {
    lines.push(`Aliran  : ${incident.water_flow} L/min`);
  }

  lines.push(`Waktu   : ${incident.detected_at}`);
  lines.push(`Dashboard: ${env.APP_URL}/incidents/${incident.id}`);

  return lines.join('\n');
}

/**
 * Dispatch an SMS notification for a DANGER incident.
 *
 * Steps (R5.1 / Task 6.1):
 * 1. Fetch building & zone details from DB.
 * 2. Build SMS message body from template.
 * 3. Create `notifications` record with status `pending`.
 * 4. Enqueue `{ notificationId, phone, message }` to BullMQ `sms` queue.
 * 5. Create AuditLog entry `notification.queued` (fire-and-forget).
 */
async function dispatchSmsForIncident(incident: Incident): Promise<void> {
  // 1. Fetch building & zone details
  const [building, zone] = await Promise.all([
    db<Building>('buildings').where({ id: incident.building_id }).first(),
    db<Zone>('zones').where({ id: incident.zone_id }).first(),
  ]);

  if (!building || !zone) {
    console.error(
      `[NotificationService] Cannot dispatch SMS — building or zone not found for incident ${incident.id}`,
    );
    return;
  }

  // 2. Build SMS message body
  const message = buildSmsBody(incident, building, zone);
  const phone = env.FIREFIGHTER_PHONE_NUMBER;

  // 3. Create notifications record with status `pending`
  const notification = await notificationRepository.create({
    incident_id: incident.id,
    type: NotificationType.SMS,
    recipient_phone: phone,
    message,
    status: NotificationStatus.PENDING,
    retry_count: 0,
    sent_at: null,
  });

  // 4. Enqueue BullMQ job
  await smsQueue.add(
    'send-sms',
    {
      notificationId: notification.id,
      phone,
      message,
    },
    {
      jobId: `sms-${notification.id}`, // deterministic — prevents duplicate enqueue
    },
  );

  console.log(
    `[NotificationService] SMS job enqueued for notification ${notification.id} (incident ${incident.id})`,
  );

  // 5. AuditLog entry — fire-and-forget, must never throw
  try {
    await auditLogRepository.create({
      user_id: null,
      action: 'notification.queued',
      entity_type: 'notification',
      entity_id: notification.id,
      old_values: null,
      new_values: JSON.stringify({
        incident_id: incident.id,
        phone,
        status: NotificationStatus.PENDING,
      }),
      ip_address: null,
      user_agent: null,
    });
  } catch (err) {
    console.warn('[NotificationService] Failed to write audit log:', err);
  }
}

export const notificationService = {
  dispatchSmsForIncident,
  smsQueue,
};
