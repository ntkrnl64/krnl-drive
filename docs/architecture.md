# Architecture

## Overview

KRNL Drive is a single Cloudflare Worker that serves both the API and the static frontend assets. The frontend is a React SPA compiled by Vite; the backend is a Hono application.

```
Browser
  │
  ├─ GET / (HTML/JS/CSS)  ──► Workers Assets (dist/)
  │
  └─ /api/*              ──► Hono Router (worker/)
                                 │
                         ┌───────┼───────┐
                         ▼       ▼       ▼
                        D1     R2     Env vars
                   (metadata) (files) (ORIGIN)
```

## Directory Structure

```
krnl-drive/
├── worker/                  # Cloudflare Worker (backend)
│   ├── index.ts             # Hono app entry point
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── crypto.ts            # Password hashing, TOTP, WebAuthn utils
│   ├── db.ts                # D1 database helpers
│   ├── middleware.ts         # Auth middleware
│   ├── schema.sql           # D1 schema and seed data
│   └── routes/
│       ├── auth.ts          # Authentication routes
│       ├── files.ts         # File management routes
│       ├── upload.ts        # Chunked upload routes
│       ├── shares.ts        # Share link routes
│       └── admin.ts         # Admin routes
│
├── src/                     # React frontend
│   ├── App.tsx              # Router and theme setup
│   ├── api.ts               # Typed API client
│   ├── types.ts             # Frontend TypeScript interfaces
│   ├── contexts/
│   │   └── AuthContext.tsx  # Auth state provider
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DrivePage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── AdminPage.tsx
│   │   └── SharePage.tsx
│   └── components/
│       ├── Layout.tsx
│       ├── FileList.tsx
│       ├── UploadZone.tsx
│       ├── ShareDialog.tsx
│       └── Dialogs.tsx
│
├── docs/                    # Documentation
├── wrangler.jsonc           # Wrangler configuration
├── worker-configuration.d.ts # Env type declarations
└── tsconfig.worker.json     # Worker TypeScript config
```

## Database Schema

All metadata is stored in a Cloudflare D1 (SQLite) database.

### `users`
Stores user accounts. `password_hash` uses the format `pbkdf2:saltHex:hashHex` (200,000 iterations, SHA-256). `totp_secret` is stored as a base32 string when TOTP is configured.

### `sessions`
HttpOnly session cookies. `pending_2fa = 1` marks sessions that have completed the first auth factor but not yet the second. Pending sessions have a 5-minute TTL; full sessions have a 7-day TTL.

### `files`
Virtual file system using `parent_id` self-reference. Cascade delete propagates through the tree. `r2_key` is null for folders; for files it's a UUID used as the R2 object key.

### `upload_sessions`
Tracks in-progress multipart uploads. `uploaded_chunks` and `parts` are JSON arrays stored as text. `r2_upload_id` is the identifier returned by R2 when the multipart upload is initiated.

### `shares`
Share tokens are random 32-byte base64url strings. `expires_at`, `max_views`, and `max_downloads` are all nullable (null = no limit). Counters are incremented on each public access.

### `passkeys`
WebAuthn credentials. `credential_id` is the base64url credential ID. `public_key` is the credential's COSE-encoded public key stored as base64. `counter` is the WebAuthn signature counter for replay protection.

### `webauthn_challenges`
Short-lived (5-minute) challenges for WebAuthn registration and authentication flows. Consumed (deleted) on use.

### `recovery_codes`
8 single-use codes per user, hashed with PBKDF2. The code itself is never stored — only the hash.

### `settings`
Simple key-value store for site-wide configuration. Editable from the admin panel.

## Authentication Flow

### Password Login (no 2FA)

```
POST /api/auth/login
  │
  ├─ Verify password (PBKDF2)
  ├─ Create session (pending_2fa=0, expires 7 days)
  └─ Set krnl-session cookie → done
```

### Password Login (with TOTP)

```
POST /api/auth/login
  │
  ├─ Verify password
  ├─ Create session (pending_2fa=1, expires 5 min)
  └─ Return { requiresTwoFactor: true }
      │
POST /api/auth/verify-totp  (or verify-recovery)
  │
  ├─ Check pending session cookie
  ├─ Verify TOTP code (±1 window, 30s step)
  └─ Update session: pending_2fa=0, expires 7 days → done
```

### Passkey Login

```
POST /api/auth/passkey/authenticate/begin
  │
  ├─ Generate challenge (stored in webauthn_challenges)
  └─ Return PublicKeyCredentialRequestOptions
      │
POST /api/auth/passkey/authenticate/complete
  │
  ├─ Consume challenge
  ├─ Verify assertion with @simplewebauthn/server
  ├─ Update passkey counter
  ├─ Create session (pending_2fa=0)
  └─ Set cookie → done
```

## Upload Flow

### Simple Upload (< 10 MB)

```
POST /api/files/upload  (multipart/form-data)
  │
  ├─ Read file from form
  ├─ PUT to R2 (single object)
  └─ Insert files row → return FileItem
```

### Chunked Upload (≥ 10 MB)

```
POST /api/upload/init
  │
  ├─ Create upload_sessions row
  ├─ Initiate R2 multipart upload
  └─ Return { uploadId }

For each chunk:
PUT /api/upload/:id/chunk/:index  (raw binary body)
  │
  ├─ Upload part to R2
  ├─ Store ETag in upload_sessions.parts
  └─ Mark chunk index in uploaded_chunks

POST /api/upload/:id/complete
  │
  ├─ Complete R2 multipart upload (assembles parts)
  ├─ Insert files row
  └─ Mark upload_session as 'completed' → return FileItem
```

## Crypto

All crypto uses the **Web Crypto API** (available in the Workers runtime without polyfills, except that `@simplewebauthn/server` requires `nodejs_compat`).

| Operation | Algorithm | Details |
|-----------|-----------|---------|
| Password hashing | PBKDF2-SHA256 | 200,000 iterations, 16-byte salt |
| TOTP | HMAC-SHA1 | RFC 6238, 30s step, ±1 window |
| Recovery codes | PBKDF2-SHA256 | Same as password hashing |
| Session tokens | `crypto.randomUUID` + base64url | 32 random bytes |
| Share tokens | `crypto.getRandomValues` + base64url | 32 random bytes |
| R2 object keys | `crypto.randomUUID` | UUID v4 |

## Frontend Architecture

The frontend is a standard React SPA using:

- **React Router DOM** for client-side routing
- **Fluent UI v9** (`@fluentui/react-components`) for all UI components
- **AuthContext** wrapping the router to provide `user`, `login`, `logout`, `refresh`
- Automatic dark/light theme via `prefers-color-scheme` media query and Fluent UI's `webDarkTheme` / `webLightTheme`

### Route Structure

```
/                 → DrivePage (protected)
/login            → LoginPage (public)
/settings         → SettingsPage (protected)
/admin            → AdminPage (protected + admin role required)
/share/:token     → SharePage (public, no auth)
```

### API Client

All API calls go through `src/api.ts`, which provides typed wrappers:

- `authApi` — login, logout, me, 2FA management, passkeys
- `filesApi` — list, get, createFolder, delete, rename, move, download, simpleUpload
- `sharesApi` — list, create, update, delete, getPublic, downloadUrl
- `adminApi` — users CRUD, settings, stats
- `uploadFile` — auto-selects simple vs chunked based on file size
