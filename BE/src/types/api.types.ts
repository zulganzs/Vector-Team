/**
 * API request/response types for BlazeWatch Backend.
 * Standard response format for all endpoints.
 */

/** Generic success response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
  errors?: Record<string, string[]>;
  meta?: PaginationMeta;
}

/** Pagination metadata returned with paginated responses */
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/** Generic paginated response */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

/** POST /auth/login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /sensors/data request body */
export interface SensorDataPayload {
  sensor_id: string;
  zone_id: string;
  smoke_value: number;
  water_flow?: number;
  timestamp: string;
}

/** JWT payload attached to req.user after auth middleware */
export interface JwtPayload {
  sub: string;   // user ID (JWT standard claim)
  id: string;    // convenience alias for sub, set by authMiddleware
  role: string;  // user role name
  jti: string;   // JWT ID for blacklisting
  iat: number;
  exp: number;
}

/** Pagination query parameters */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}
