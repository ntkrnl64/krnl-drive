# API Reference

All API endpoints are under `/api`. Authenticated endpoints require a valid `krnl-session` cookie.

Responses are JSON unless otherwise noted. Error responses have the shape:
```json
{ "error": "Human-readable message" }
```

---

## Authentication

### POST /api/auth/login

Authenticate with username and password.

**Request body:**
```json
{ "username": "admin", "password": "admin" }
```

**Response (no 2FA):**
```json
{ "ok": true }
```

**Response (2FA required):**
```json
{ "requiresTwoFactor": true }
```

Sets `krnl-session` cookie. If `requiresTwoFactor` is true, the session is in `pending_2fa` state and the client must complete 2FA before the session is usable.

---

### POST /api/auth/verify-totp

Complete login with a TOTP code.

**Request body:**
```json
{ "code": "123456" }
```

**Response:** `{ "ok": true }`

---

### POST /api/auth/verify-recovery

Complete login with a recovery code (single-use).

**Request body:**
```json
{ "code": "xxxxx-xxxxx-xxxxx-xxxxx" }
```

**Response:** `{ "ok": true }`

---

### POST /api/auth/logout

Invalidates the current session cookie.

**Response:** `{ "ok": true }`

---

### GET /api/auth/me

Returns the currently authenticated user.

**Response:**
```json
{
  "id": "uuid",
  "username": "admin",
  "role": "admin",
  "totp_enabled": true,
  "created_at": 1700000000000
}
```

---

### POST /api/auth/change-password

**Request body:**
```json
{ "currentPassword": "old", "newPassword": "new" }
```

**Response:** `{ "ok": true }`

---

### TOTP Setup

**POST /api/auth/totp/setup** — Generate a TOTP secret and return the `otpauth://` URI.

**Response:**
```json
{ "uri": "otpauth://totp/KRNL%20Drive:admin?secret=BASE32SECRET&issuer=KRNL%20Drive" }
```

**POST /api/auth/totp/verify-setup** — Verify a TOTP code and enable TOTP.

```json
{ "code": "123456" }
```

**POST /api/auth/totp/disable** — Disable TOTP (requires current password).

```json
{ "password": "current-password" }
```

---

### Recovery Codes

**POST /api/auth/recovery/regenerate** — Generate 8 new recovery codes (invalidates old ones).

**Response:**
```json
{ "codes": ["xxxxx-xxxxx-xxxxx-xxxxx", "..."] }
```

---

### Passkeys (WebAuthn)

**POST /api/auth/passkey/register/begin** — Start passkey registration.

Returns `PublicKeyCredentialCreationOptionsJSON` for `startRegistration()`.

**POST /api/auth/passkey/register/complete** — Finish registration with the credential.

**Request body:** `RegistrationResponseJSON`

**Response:** `{ "ok": true, "passkey": { "id": "uuid", "name": "Passkey", ... } }`

---

**POST /api/auth/passkey/authenticate/begin** — Start passkey authentication (no session required).

**Response:** `PublicKeyCredentialRequestOptionsJSON`

**POST /api/auth/passkey/authenticate/complete** — Finish authentication.

**Request body:** `AuthenticationResponseJSON`

**Response:** `{ "ok": true }`

---

**GET /api/auth/passkeys** — List all passkeys for the current user.

**DELETE /api/auth/passkeys/:id** — Delete a passkey.

---

## Files

### GET /api/files

List files in a directory.

**Query params:** `parentId` (optional, omit for root)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "photo.jpg",
      "type": "file",
      "size": 1048576,
      "mime_type": "image/jpeg",
      "parent_id": null,
      "owner_id": "uuid",
      "created_at": 1700000000000,
      "updated_at": 1700000000000
    }
  ]
}
```

---

### GET /api/files/:id

Get metadata for a single file or folder.

---

### GET /api/files/:id/breadcrumb

Get the folder path from root to the given folder.

**Response:**
```json
{ "breadcrumb": [{ "id": null, "name": "Home" }, { "id": "uuid", "name": "Documents" }] }
```

---

### POST /api/files/folder

Create a new folder.

**Request body:**
```json
{ "name": "My Folder", "parentId": null }
```

**Response:** The created `FileItem` object.

---

### DELETE /api/files/:id

Delete a file or folder (recursively deletes children and R2 objects).

**Response:** `{ "ok": true }`

---

### PATCH /api/files/:id

Rename or move a file/folder.

**Request body (rename):**
```json
{ "name": "new-name.txt" }
```

**Request body (move):**
```json
{ "parentId": "target-folder-uuid" }
```

Both fields can be combined in one request.

---

### GET /api/files/:id/download

Stream the file content directly from R2.

Response headers include `Content-Type` and `Content-Disposition: attachment`.

---

### POST /api/files/upload

Upload a file (simple, for files < 10 MB). Multipart form data.

**Form fields:**
- `file` — the file
- `parentId` — (optional) target folder ID

**Response:** The created `FileItem` object.

---

## Chunked Uploads

For large files (≥ 10 MB), use the multipart upload flow.

### POST /api/upload/init

Initialize an upload session.

**Request body:**
```json
{
  "filename": "large-video.mp4",
  "totalSize": 524288000,
  "totalChunks": 100,
  "parentId": null
}
```

**Response:**
```json
{ "uploadId": "uuid" }
```

---

### PUT /api/upload/:id/chunk/:index

Upload a single chunk (raw binary body).

- `:index` — zero-based chunk index
- Body: raw binary data (exactly `chunk_size` bytes, except the last chunk)

**Response:** `{ "ok": true, "uploadedChunks": [0, 1, 2] }`

---

### GET /api/upload/:id

Get upload session status.

**Response:**
```json
{
  "id": "uuid",
  "filename": "large-video.mp4",
  "totalChunks": 100,
  "uploadedChunks": [0, 1, 2, 3],
  "status": "pending"
}
```

---

### POST /api/upload/:id/complete

Finalize the upload after all chunks are uploaded. Creates the file record.

**Response:** The created `FileItem` object.

---

### DELETE /api/upload/:id

Abort and clean up an incomplete upload session.

---

## Shares

### GET /api/shares

List shares. Optional query param `fileId` to filter by file.

**Response:**
```json
{
  "shares": [
    {
      "id": "uuid",
      "file_id": "uuid",
      "token": "abc123",
      "expires_at": 1700000000000,
      "max_views": 10,
      "max_downloads": 5,
      "view_count": 2,
      "download_count": 1,
      "created_at": 1700000000000
    }
  ]
}
```

---

### POST /api/shares

Create a new share link.

**Request body:**
```json
{
  "fileId": "uuid",
  "expiresIn": 168,
  "maxViews": 0,
  "maxDownloads": 0
}
```

- `expiresIn` — hours until expiry (0 = no expiry)
- `maxViews` / `maxDownloads` — 0 = unlimited

Omitting these fields uses the site default values from settings.

**Response:** The created share object.

---

### PATCH /api/shares/:id

Update a share's limits.

**Request body:** any subset of `{ expiresIn, maxViews, maxDownloads }`

---

### DELETE /api/shares/:id

Delete a share link.

---

### GET /api/share/:token (public)

Get share info without authentication. Increments `view_count`.

Returns `404` if the token is invalid, expired, or view limit reached.

**Response:**
```json
{
  "share": { ... },
  "file": { "id": "uuid", "name": "photo.jpg", "size": 1048576, ... }
}
```

---

### GET /api/share/:token/download (public)

Stream the file. Increments `download_count`.

Returns `404` if the token is invalid, expired, download limit reached, or the file is a folder.

---

## Admin

All admin endpoints require `role = 'admin'`.

### GET /api/admin/users

List all users.

---

### POST /api/admin/users

Create a user.

**Request body:**
```json
{ "username": "alice", "password": "secret", "role": "user" }
```

---

### PATCH /api/admin/users/:id

Update a user.

**Request body:** any subset of `{ username, password, role, disabled }`

Cannot demote/disable your own account.

---

### DELETE /api/admin/users/:id

Delete a user. Cannot delete built-in accounts (`admin`, `guest`) or your own account.

---

### GET /api/admin/settings

Get all site settings as a key-value object.

---

### PATCH /api/admin/settings

Update site settings.

**Request body:** any subset of the settings keys (see [Setup](setup.md#configuration)).

---

### GET /api/admin/stats

Get usage statistics.

**Response:**
```json
{
  "totalUsers": 3,
  "totalFiles": 142,
  "totalFolders": 12,
  "totalSize": 1073741824,
  "totalShares": 8
}
```

---

## Public Config

### GET /api/config

Returns public site configuration (no auth required).

**Response:**
```json
{ "siteName": "KRNL Drive", "allowRegistration": false }
```
