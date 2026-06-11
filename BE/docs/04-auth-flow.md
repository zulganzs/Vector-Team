# Authentication Flow

---

## 1. Authentication Architecture

BlazeWatch menggunakan **Stateless JWT** dengan refresh token rotation:

```
Client                    Server                        Redis
  │                          │                             │
  │── POST /auth/login ──────►│                             │
  │   { email, password }     │── verify bcrypt password    │
  │                          │── check account lockout ───►│
  │                          │── generate JWT (15 min)      │
  │                          │── generate refresh (7 days)  │
  │                          │── store hash(refresh) ──────►│ SET user:{id}:refresh_token
  │◄── { access_token, ───────│                             │
  │     refresh_token, user } │                             │
  │                          │                             │
  │── GET /protected ────────►│                             │
  │   Authorization: Bearer   │── verify JWT signature      │
  │                          │── check jti blacklist ──────►│ GET blazewatch:jwt_blacklist:{jti}
  │◄── { data } ──────────────│                             │
  │                          │                             │
  │── POST /auth/logout ─────►│                             │
  │                          │── blacklist jti ────────────►│ SET blazewatch:jwt_blacklist:{jti}
  │                          │── delete refresh token ─────►│ DEL user:{id}:refresh_token
  │◄── { success: true } ─────│                             │
```

---

## 2. JWT Access Token

| Parameter | Value |
|-----------|-------|
| **Algorithm** | HS256 |
| **TTL** | 15 menit |
| **Secret** | `JWT_SECRET` env var (minimum 64 karakter) |
| **Payload** | `{ sub, role, jti, iat, exp }` |

```typescript
// Payload structure
{
  sub: "uuid-user-id",
  role: "building_manager",
  jti: "uuid-jwt-id",       // unique per token, used for blacklisting
  iat: 1717200000,
  exp: 1717200900            // iat + 15 menit
}
```

---

## 3. Refresh Token

| Parameter | Value |
|-----------|-------|
| **Tipe** | Opaque random token (64 karakter hex) |
| **TTL** | 7 hari |
| **Storage** | Hash SHA-256 di Redis, key: `user:{id}:refresh_token` |
| **Strategy** | One-time use — dirotasi setiap kali refresh |
| **Revocation** | `DEL user:{id}:refresh_token` |

**Rotation Flow:**
```
Client                    Server                   Redis
  │                          │                        │
  │── POST /auth/refresh ────►│                        │
  │   { refresh_token: "abc" }│── SHA256("abc") ──────►│ GET user:{id}:refresh_token
  │                          │◄── stored_hash ─────────│
  │                          │── compare hashes        │
  │                          │── DEL old token ───────►│
  │                          │── generate new pair     │
  │                          │── store new hash ──────►│ SET user:{id}:refresh_token
  │◄── { new access_token, ───│                        │
  │     new refresh_token }   │                        │
```

---

## 4. Account Lockout

| Parameter | Value |
|-----------|-------|
| **Max failures** | 3 kali dalam 15 menit |
| **Lock duration** | 15 menit |
| **Response code** | `423 AUTH_ACCOUNT_LOCKED` |
| **Storage** | `users.failed_login_attempts` + `users.locked_until` di DB |

**Lockout Logic:**
1. Login gagal → `failed_login_attempts++`
2. Jika `failed_login_attempts >= 3` → set `locked_until = NOW + 15min`
3. Login berikutnya → cek `locked_until > NOW` → return `423`
4. Login berhasil → reset `failed_login_attempts = 0`, update `last_login_at`

---

## 5. Role-Based Access Control (RBAC)

### Middleware Chain

```typescript
router.patch('/incidents/:id/dismiss',
  authMiddleware,                                   // verify JWT
  roleMiddleware(['building_manager', 'admin']),    // check role
  incidentController.dismiss
);
```

### Access Control Matrix

| Action | `admin` | `building_manager` | `firefighter` |
|--------|---------|-------------------|---------------|
| Login / Logout | ✅ | ✅ | ✅ |
| View Dashboard | ✅ | ✅ | ✅ |
| View Incidents | ✅ | ✅ | ✅ |
| Dismiss Incident | ✅ | ✅ | ❌ |
| Acknowledge Incident | ✅ | ❌ | ✅ |
| Start Evacuation | ✅ | ✅ | ❌ |
| Mark In Progress | ✅ | ❌ | ✅ |
| Resolve Incident | ✅ | ❌ | ✅ |
| Close Incident | ✅ | ✅ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ |

---

## 6. Sensor API Key Authentication

Untuk IoT devices (bukan user), autentikasi menggunakan **API Key**:

```
Header: X-Sensor-API-Key: <api_key>
```

**Validation:**
1. Extract header `X-Sensor-API-Key`
2. Compute `SHA256(header_value)`
3. Compare dengan `SHA256(SENSOR_API_KEY)` dari env var
4. Match → lanjut; No match → `403 FORBIDDEN`

> API Key disimpan ter-hash untuk menghindari exposure plain-text di environment variable comparison.

---

## 7. Auth Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/v1/auth/login` | None (rate limited 5/min) | Login, dapat JWT + refresh token |
| POST | `/api/v1/auth/logout` | JWT | Blacklist JWT, hapus refresh token |
| POST | `/api/v1/auth/refresh` | Refresh Token | Rotate token pair |
| GET | `/api/v1/auth/me` | JWT | Profile user yang sedang login |

---

## 8. Error Codes Auth

| HTTP Status | Error Code | Deskripsi |
|-------------|-----------|-----------|
| 401 | `AUTH_INVALID_CREDENTIALS` | Email/password salah |
| 401 | `AUTH_TOKEN_MISSING` | Bearer token tidak ada |
| 401 | `AUTH_TOKEN_INVALID` | JWT tidak valid / expired |
| 401 | `AUTH_TOKEN_BLACKLISTED` | Token sudah di-logout |
| 403 | `FORBIDDEN` | Role tidak punya izin |
| 423 | `AUTH_ACCOUNT_LOCKED` | Akun terkunci (3x gagal) |
