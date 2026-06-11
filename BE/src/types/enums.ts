/**
 * Enum definitions for BlazeWatch Backend.
 * Using const enums (string) for runtime safety and DB compatibility.
 */

export enum SensorType {
  SMOKE = 'smoke',
  WATER_FLOW = 'water_flow',
  COMBINED = 'combined',
}

export enum SensorStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

export enum Classification {
  NORMAL = 'normal',
  WARNING = 'warning',
  DANGER = 'danger',
}

export enum IncidentStatus {
  WARNING = 'warning',
  DANGER = 'danger',
  ACKNOWLEDGED = 'acknowledged',
  EVACUATION_STARTED = 'evacuation_started',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  DISMISSED = 'dismissed',
  NORMAL = 'normal',
}

export enum IncidentSeverity {
  WARNING = 'warning',
  DANGER = 'danger',
}

export enum NotificationType {
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum SmsStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNDELIVERED = 'undelivered',
}
