import twilio, { Twilio } from 'twilio';
import { env } from './env';

/**
 * Twilio SDK client for BlazeWatch.
 *
 * - Authenticated via TWILIO_SID and TWILIO_AUTH_TOKEN env vars
 * - Used by NotificationService to dispatch SMS alerts to firefighters
 */
const twilioClient: Twilio = twilio(env.TWILIO_SID, env.TWILIO_AUTH_TOKEN);

export { twilioClient };
