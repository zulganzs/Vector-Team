import dotenv from 'dotenv';

// Load environment variables before any module that reads `env`
dotenv.config();

import mqtt from 'mqtt';

import { env } from './config/env';
import { sensorDataSchema } from './schemas/sensorDataSchema';
import { sensorProcessingService } from './services/sensorProcessingService';

/**
 * MQTT Subscriber — BlazeWatch IoT Sensor Listener
 *
 * Connects to the Eclipse Mosquitto broker and subscribes to
 * `blazewatch/sensors/+` (QoS 1) to receive data from all sensors.
 *
 * Topic format:  blazewatch/sensors/{sensor_code}
 *
 * On each message:
 * 1. Parse the JSON payload
 * 2. Inject the `sensor_id` from the topic's last segment if not present
 * 3. Validate with `sensorDataSchema`
 * 4. Delegate to `sensorProcessingService.processReading`
 *
 * Reconnect strategy: exponential backoff (1 s, 2 s, 4 s … capped at 30 s).
 */

const BROKER_URL = `mqtt://${env.MQTT_HOST}:${env.MQTT_PORT}`;
const SUBSCRIBE_TOPIC = `${env.MQTT_TOPIC_PREFIX}/+`;

// Backoff state
let reconnectAttempts = 0;
const MAX_BACKOFF_MS = 30_000;

function backoffMs(): number {
  return Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_BACKOFF_MS);
}

console.log(`[MQTT] Connecting to broker: ${BROKER_URL}`);
console.log(`[MQTT] Subscribe topic: ${SUBSCRIBE_TOPIC}`);

let client: mqtt.MqttClient;

function connect(): void {
  client = mqtt.connect(BROKER_URL, {
    clientId: `blazewatch-subscriber-${Date.now()}`,
    clean: true,
    reconnectPeriod: 0, // We manage reconnect manually for exponential backoff
    connectTimeout: 10_000,
  });

  // ── Connected ──────────────────────────────────────────────────────────────
  client.on('connect', () => {
    reconnectAttempts = 0;
    console.log(`[MQTT] Connected to ${BROKER_URL}`);

    client.subscribe(SUBSCRIBE_TOPIC, { qos: 1 }, (err, granted) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err.message);
        return;
      }
      const grantedList = granted ?? [];
      console.log('[MQTT] Subscribed:', grantedList.map((g) => `${g.topic} (QoS ${g.qos})`).join(', '));
    });
  });

  // ── Message received ───────────────────────────────────────────────────────
  client.on('message', (topic: string, messageBuffer: Buffer) => {
    const rawMessage = messageBuffer.toString('utf8');

    // Extract sensor_code from the last topic segment: blazewatch/sensors/{sensor_code}
    const topicSegments = topic.split('/');
    const sensorCodeFromTopic = topicSegments[topicSegments.length - 1];

    let rawPayload: Record<string, unknown>;
    try {
      rawPayload = JSON.parse(rawMessage) as Record<string, unknown>;
    } catch {
      console.error(`[MQTT] Failed to parse JSON from topic '${topic}':`, rawMessage);
      return;
    }

    // Inject sensor_id from topic if not present in payload
    if (!rawPayload.sensor_id) {
      rawPayload.sensor_id = sensorCodeFromTopic;
    }

    // Validate payload
    const result = sensorDataSchema.safeParse(rawPayload);
    if (!result.success) {
      console.error(
        `[MQTT] Validation failed for topic '${topic}':`,
        result.error.flatten().fieldErrors,
      );
      return;
    }

    // Process the validated reading (fire-and-forget, errors are caught internally)
    sensorProcessingService
      .processReading(result.data)
      .then(({ reading, classification, is_duplicate }) => {
        console.log(
          `[MQTT] Processed reading — sensor: ${sensorCodeFromTopic}, ` +
          `classification: ${classification}, duplicate: ${is_duplicate}, ` +
          `id: ${reading.id}`,
        );
      })
      .catch((err: Error) => {
        console.error(`[MQTT] Error processing reading from '${topic}':`, err.message);
      });
  });

  // ── Error handling ─────────────────────────────────────────────────────────
  client.on('error', (err: Error) => {
    console.error('[MQTT] Client error:', err.message);
    scheduleReconnect();
  });

  // ── Disconnect / close ────────────────────────────────────────────────────
  client.on('close', () => {
    console.warn('[MQTT] Connection closed.');
    scheduleReconnect();
  });

  client.on('offline', () => {
    console.warn('[MQTT] Client went offline.');
  });
}

/**
 * Schedule a reconnect with exponential backoff.
 * Guards against scheduling multiple reconnects by ending the current client first.
 */
function scheduleReconnect(): void {
  const delay = backoffMs();
  reconnectAttempts += 1;
  console.log(`[MQTT] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})…`);

  setTimeout(() => {
    try {
      // Remove all listeners to avoid stacking handlers on the old client
      client.removeAllListeners();
      client.end(true);
    } catch {
      // Ignore errors when ending the old client
    }
    connect();
  }, delay);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
connect();

// ── Graceful shutdown ──────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('[MQTT] Received SIGINT — shutting down gracefully…');
  client.end(false, {}, () => {
    console.log('[MQTT] Disconnected. Exiting.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('[MQTT] Received SIGTERM — shutting down gracefully…');
  client.end(false, {}, () => {
    console.log('[MQTT] Disconnected. Exiting.');
    process.exit(0);
  });
});
