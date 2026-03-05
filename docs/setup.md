# Setup & Deployment

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | |
| npm | 9+ | |
| Wrangler | 3+ | `npm install -g wrangler` |
| Cloudflare account | — | Free tier is sufficient |

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create a D1 database

```bash
wrangler d1 create krnl-drive-db
```

The command prints a database ID. Copy it.

### 4. Create an R2 bucket

```bash
wrangler r2 bucket create krnl-drive-bucket
```

### 5. Update wrangler.jsonc

Replace the placeholder values with your actual resource IDs:

```jsonc
{
  "name": "krnl-drive",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "worker/index.ts",
  "assets": { "directory": "./dist" },
  "vars": {
    "ORIGIN": "http://localhost:5173"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "krnl-drive-db",
      "database_id": "<your-database-id>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "krnl-drive-bucket"
    }
  ]
}
```

### 6. Apply the database schema

```bash
wrangler d1 execute krnl-drive-db --file worker/schema.sql
```

This creates all tables and inserts default settings. No user accounts are created — you'll be prompted to create the admin account on first visit.

> The schema uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE`, so it's safe to run multiple times.

### 7. Start the development server

```bash
npm run dev
```

This runs Vite (frontend, port 5173) and `wrangler dev` (worker, port 8787) concurrently. The Vite dev server proxies `/api` requests to the worker.

## Production Deployment

### 1. Build the frontend

```bash
npm run build
```

Vite outputs the compiled frontend to `dist/`. Wrangler serves this via Workers Assets.

### 2. Set the ORIGIN variable

Update `wrangler.jsonc` to set `ORIGIN` to your deployed worker URL or custom domain. This is used for WebAuthn (passkeys) origin validation.

```jsonc
"vars": {
  "ORIGIN": "https://drive.example.com"
}
```

### 3. Apply schema to production D1

```bash
wrangler d1 execute krnl-drive-db --file worker/schema.sql --remote
```

### 4. Deploy

```bash
wrangler deploy
```

## Configuration

All runtime configuration is stored in the `settings` D1 table and editable through the Admin panel.

| Key | Default | Description |
|-----|---------|-------------|
| `site_name` | `KRNL Drive` | Displayed in the UI |
| `allow_registration` | `0` | Allow public user registration |
| `guest_can_download` | `1` | Allow guest users to download files |
| `default_share_expiry_hours` | `168` | Default share link expiry (hours; 0 = no expiry) |
| `default_max_views` | `0` | Default max views per share (0 = unlimited) |
| `default_max_downloads` | `0` | Default max downloads per share (0 = unlimited) |
| `chunk_size` | `5242880` | Chunk size for multipart uploads (bytes) |

## Security Hardening

- Use a strong admin password during the first-run setup wizard.
- Only enable guest access if you want unauthenticated read-only browsing; it can be toggled in the Admin panel at any time.
- Keep `allow_registration` at `0` (default) to prevent self-signup.
- Add a custom domain and enable HTTPS (Cloudflare handles this automatically for `*.workers.dev`).

## Updating the Schema

If a future schema migration is needed, apply it with:

```bash
# Local
wrangler d1 execute krnl-drive-db --file worker/migration-XXX.sql

# Remote
wrangler d1 execute krnl-drive-db --file worker/migration-XXX.sql --remote
```

## Troubleshooting

**Worker returns 500 on first request**

- Ensure the schema has been applied (`wrangler d1 execute krnl-drive-db --file worker/schema.sql`). The `users` and `settings` tables must exist before the worker can serve requests.

**Files fail to upload**
- Verify the R2 bucket binding name in `wrangler.jsonc` matches `BUCKET`.
- Check that `nodejs_compat` compatibility flag is enabled (required for `@simplewebauthn/server`).

**Passkeys don't work locally**
- WebAuthn requires a secure context (HTTPS or `localhost`). Use `localhost` for local dev, not `127.0.0.1`.
- Make sure `ORIGIN` matches the browser origin exactly (including protocol and port).
