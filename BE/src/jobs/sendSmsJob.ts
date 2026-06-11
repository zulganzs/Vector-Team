// 1. Node.js built-ins
// (none)

// 2. Third-party libraries
import type { Job } from 'bullmq';

// 3. Internal config
import { twilioClient } from '../config/twilio';
import { env } from '../config/env';

// 4. Services, repositories
import { notificationRepository } from '../repositories/notificationRepository';
import { smsLogRepository } from '../repositories/smsLogRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';

// 5. Types & schemas
import { NotificationStatus, SmsStatus } from '../types/enums';

/**
 * Payload shape for jobs enqueued in the `sms` BullMQ queue.
 */
export interface SendSmsJobData {
  notificationId: string;
  phone: string;
  message: string;
}

/**
 * BullMQ processor function for the `sms` queue.
 *
 * Steps (Task 6.2 / R5.2, R5.3):
 * 1. Fetch the notification record to confirm it is still pending.
 * 2. Call Twilio to send the SMS.
 * 3. Create an `sms_logs` record with Twilio SID, status, and attempt number.
 * 4. Update `notifications.status = sent` and record `sent_at`.
 *
 * On failure:
 * - Creates an `sms_logs` error record.
 * - Increments `notifications.retry_count`.
 * - Re-throws the error so BullMQ can apply the retry/backoff policy.
 *
 * BullMQ provides `job.attemptsMade` (0-indexed) from the outside;
 * we persist `attempt_number` as `job.attemptsMade + 1` (1-indexed).
 */
export async function sendSmsProcessor(job: Job<SendSmsJobData>): Promise<void> {
  const { notificationId, phone, message } = job.data;
  const attemptNumber = job.attemptsMade + 1; // convert to 1-indexed

  console.log(
    `[SendSmsJob] Processing notification ${notificationId}, attempt ${attemptNumber}`,
  );

  // 1. Fetch notification record
  const notification = await notificationRepository.findById(notificationId);
  if (!notification) {
    // Notification was deleted externally — nothing to do, don't retry
    console.warn(
      `[SendSmsJob] Notification ${notificationId} not found — skipping job.`,
    );
    return;
  }

  try {
    // 2. Call Twilio
    const twilioResponse = await twilioClient.messages.create({
      to: phone,
      from: env.TWILIO_FROM_NUMBER,
      body: message,
    });

    console.log(
      `[SendSmsJob] Twilio accepted message SID=${twilioResponse.sid} for notification ${notificationId}`,
    );

    // 3. Create sms_logs record — success
    await smsLogRepository.create({
      notification_id: notificationId,
      twilio_sid: twilioResponse.sid,
      status: SmsStatus.SENT,
      attempt_number: attemptNumber,
      error_message: null,
    });

    // 4. Update notifications.status = sent, record sent_at
    const sentAt = new Date().toISOString();
    await notificationRepository.updateStatus(
      notificationId,
      NotificationStatus.SENT,
      sentAt,
    );

    // Audit log — fire-and-forget
    try {
      await auditLogRepository.create({
        user_id: null,
        action: 'notification.sent',
        entity_type: 'notification',
        entity_id: notificationId,
        old_values: JSON.stringify({ status: notification.status }),
        new_values: JSON.stringify({
          status: NotificationStatus.SENT,
          twilio_sid: twilioResponse.sid,
          sent_at: sentAt,
          attempt_number: attemptNumber,
        }),
        ip_address: null,
        user_agent: null,
      });
    } catch (auditErr) {
      console.warn('[SendSmsJob] Failed to write audit log (sent):', auditErr);
    }

    console.log(
      `[SendSmsJob] Notification ${notificationId} marked as sent (attempt ${attemptNumber}).`,
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error(
      `[SendSmsJob] Twilio error for notification ${notificationId} (attempt ${attemptNumber}): ${errorMessage}`,
    );

    // On failure: create sms_logs error record
    try {
      await smsLogRepository.create({
        notification_id: notificationId,
        twilio_sid: null,
        status: SmsStatus.FAILED,
        attempt_number: attemptNumber,
        error_message: errorMessage,
      });
    } catch (logErr) {
      console.warn('[SendSmsJob] Failed to create sms_logs error record:', logErr);
    }

    // Increment notifications.retry_count
    try {
      await notificationRepository.incrementRetry(notificationId);
    } catch (retryErr) {
      console.warn('[SendSmsJob] Failed to increment retry_count:', retryErr);
    }

    // If this is the last attempt (attemptsMade + 1 === job.opts.attempts),
    // mark the notification as failed permanently.
    const maxAttempts = job.opts?.attempts ?? 3;
    if (attemptNumber >= maxAttempts) {
      try {
        await notificationRepository.updateStatus(
          notificationId,
          NotificationStatus.FAILED,
        );

        // Audit log — fire-and-forget
        try {
          await auditLogRepository.create({
            user_id: null,
            action: 'notification.failed',
            entity_type: 'notification',
            entity_id: notificationId,
            old_values: JSON.stringify({ status: notification.status }),
            new_values: JSON.stringify({
              status: NotificationStatus.FAILED,
              attempt_number: attemptNumber,
              error: errorMessage,
            }),
            ip_address: null,
            user_agent: null,
          });
        } catch (auditErr) {
          console.warn('[SendSmsJob] Failed to write audit log (failed):', auditErr);
        }

        console.error(
          `[SendSmsJob] Notification ${notificationId} permanently failed after ${maxAttempts} attempts.`,
        );
      } catch (updateErr) {
        console.warn(
          '[SendSmsJob] Failed to mark notification as failed:',
          updateErr,
        );
      }
    }

    // Re-throw so BullMQ applies retry/backoff
    throw err;
  }
}
