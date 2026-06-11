import dotenv from 'dotenv';

// Load .env file before any other imports use process.env.
// At runtime, ensure a .env (or .env.test for tests) file is present
// with all required variables, otherwise startup will throw.
dotenv.config();

/**
 * Typed environment configuration for BlazeWatch Backend.
 * Validates all required environment variables at startup.
 * Throws a descriptive error if any required variable is missing or invalid.
 */

interface EnvConfig {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_NAME: string;
  APP_URL: string;

  // Database (SQLite)
  DB_PATH: string;

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;

  // JWT
  JWT_SECRET: string;
  JWT_TTL: number; // minutes
  JWT_REFRESH_TTL: number; // minutes

  // Twilio
  TWILIO_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  FIREFIGHTER_PHONE_NUMBER: string;

  // Socket.IO
  SOCKETIO_CORS_ORIGIN: string;
  SOCKETIO_PORT: number;

  // Fire Detection Thresholds
  SMOKE_THRESHOLD_WARNING: number;
  SMOKE_THRESHOLD_DANGER: number;
  SENSOR_OFFLINE_THRESHOLD_SECONDS: number;

  // IoT
  SENSOR_API_KEY: string;
  MQTT_HOST: string;
  MQTT_PORT: number;
  MQTT_TOPIC_PREFIX: string;
}

/**
 * Reads a required string environment variable.
 * Throws if the variable is absent or empty.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Reads an optional string environment variable, returning a default when absent.
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Reads an environment variable and parses it as an integer.
 * Falls back to `defaultValue` when the variable is absent.
 * Throws if the value is present but not a valid integer.
 */
function requireEnvInt(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be an integer, got: ${value}`,
    );
  }
  return parsed;
}

// ── Validate NODE_ENV ──────────────────────────────────────────────────────────
const nodeEnv = optionalEnv('NODE_ENV', 'development');
if (!['development', 'production', 'test'].includes(nodeEnv)) {
  throw new Error(
    `NODE_ENV must be one of: development, production, test. Got: ${nodeEnv}`,
  );
}

// ── Validate JWT_SECRET strength ───────────────────────────────────────────────
const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

export const env: EnvConfig = {
  // Application
  NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
  PORT: requireEnvInt('PORT', 3000),
  APP_NAME: optionalEnv('APP_NAME', 'BlazeWatch'),
  APP_URL: optionalEnv('APP_URL', 'http://localhost:3000'),

  // Database
  DB_PATH: optionalEnv('DB_PATH', './data/blazewatch.sqlite'),

  // Redis
  REDIS_HOST: optionalEnv('REDIS_HOST', 'localhost'),
  REDIS_PORT: requireEnvInt('REDIS_PORT', 6379),

  // JWT
  JWT_SECRET: jwtSecret,
  JWT_TTL: requireEnvInt('JWT_TTL', 15),
  JWT_REFRESH_TTL: requireEnvInt('JWT_REFRESH_TTL', 10080),

  // Twilio — required (no defaults for secrets)
  TWILIO_SID: requireEnv('TWILIO_SID'),
  TWILIO_AUTH_TOKEN: requireEnv('TWILIO_AUTH_TOKEN'),
  TWILIO_FROM_NUMBER: requireEnv('TWILIO_FROM_NUMBER'),
  FIREFIGHTER_PHONE_NUMBER: requireEnv('FIREFIGHTER_PHONE_NUMBER'),

  // Socket.IO
  SOCKETIO_CORS_ORIGIN: optionalEnv('SOCKETIO_CORS_ORIGIN', 'http://localhost:5173'),
  SOCKETIO_PORT: requireEnvInt('SOCKETIO_PORT', 8080),

  // Fire Detection Thresholds
  SMOKE_THRESHOLD_WARNING: requireEnvInt('SMOKE_THRESHOLD_WARNING', 300),
  SMOKE_THRESHOLD_DANGER: requireEnvInt('SMOKE_THRESHOLD_DANGER', 600),
  SENSOR_OFFLINE_THRESHOLD_SECONDS: requireEnvInt('SENSOR_OFFLINE_THRESHOLD_SECONDS', 60),

  // IoT
  SENSOR_API_KEY: requireEnv('SENSOR_API_KEY'),
  MQTT_HOST: optionalEnv('MQTT_HOST', 'localhost'),
  MQTT_PORT: requireEnvInt('MQTT_PORT', 1883),
  MQTT_TOPIC_PREFIX: optionalEnv('MQTT_TOPIC_PREFIX', 'blazewatch/sensors'),
};
