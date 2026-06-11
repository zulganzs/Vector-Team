/**
 * Domain entity interfaces for BlazeWatch Backend.
 *
 * Conventions:
 * - All `id` fields are UUID v4 strings
 * - All timestamps are TEXT ISO 8601 strings (SQLite has no native DATETIME)
 * - Field names use snake_case to match DB column names
 * - Soft deletes use `deleted_at?: string | null`
 */

export interface Role {
  id: string;
  name: 'admin' | 'building_manager' | 'firefighter';
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  role_id: string;
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  last_login_at?: string | null;
  failed_login_attempts: number;
  locked_until?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  building_id: string;
  name: string;
  description?: string | null;
  floor?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sensor {
  id: string;
  zone_id: string;
  sensor_code: string;
  name: string;
  type: 'smoke' | 'water_flow' | 'combined';
  status: 'online' | 'offline' | 'unknown';
  last_seen_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SensorReading {
  id: string;
  sensor_id: string;
  zone_id: string; // denormalized for query performance
  smoke_value: number;
  water_flow?: number | null;
  classification: 'normal' | 'warning' | 'danger';
  is_duplicate: boolean;
  sensor_timestamp: string;
  received_at: string;
  created_at: string;
}

export interface Incident {
  id: string;
  sensor_id: string;
  zone_id: string;
  building_id: string;
  status:
    | 'warning'
    | 'danger'
    | 'acknowledged'
    | 'evacuation_started'
    | 'in_progress'
    | 'resolved'
    | 'closed'
    | 'dismissed'
    | 'normal';
  severity: 'warning' | 'danger';
  smoke_value: number;
  water_flow?: number | null;
  notes?: string | null;
  detected_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentStatus {
  id: string;
  incident_id: string;
  from_status?: string | null;
  to_status: string;
  actor_id?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  incident_id: string;
  type: 'sms' | 'in_app';
  recipient_phone?: string | null;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  retry_count: number;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SMSLog {
  id: string;
  notification_id: string;
  twilio_sid?: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  attempt_number: number;
  error_message?: string | null;
  created_at: string;
}

export interface Evacuation {
  id: string;
  incident_id: string;
  initiated_by: string; // user_id
  zone_id: string;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FirefighterAcknowledgement {
  id: string;
  incident_id: string;
  user_id: string;
  acknowledged_at: string;
  notes?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: string | null; // JSON stringified
  new_values?: string | null; // JSON stringified
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
