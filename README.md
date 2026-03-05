# KRNL Drive

A self-hosted file storage and sharing platform built on Cloudflare Workers, D1, and R2.

## Features

- **File management** — Upload, organize, rename, move, and delete files and folders
- **Chunked uploads** — Reliable uploads for large files using R2 Multipart Upload (5 MB chunks, auto-selected for files ≥ 10 MB)
- **Share links** — Generate public share links with optional expiry, view limits, and download limits
- **Account system** — Admin, user, and guest roles; user management from the admin panel
- **Two-factor authentication** — TOTP (authenticator app), passkeys (WebAuthn), and recovery codes
- **Admin panel** — User management, site settings, share defaults, storage stats

## First-Time Setup

On first visit, KRNL Drive shows a setup wizard where you create the administrator account and optionally enable guest access. No default credentials are created — you choose your own on first launch.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `pnpm install -g wrangler`
- A Cloudflare account

### 1. Clone and install

```bash
git clone https://github.com/ntkrnl64/krnl-drive.git
cd krnl-drive
pnpm install
```

### 2. Create Cloudflare resources

```bash
# Create D1 database
wrangler d1 create krnl-drive-db

# Create R2 bucket
wrangler r2 bucket create krnl-drive-bucket
```

Copy the D1 database ID from the output and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    { "binding": "DB", "database_name": "krnl-drive-db", "database_id": "<your-database-id>" }
  ],
  "r2_buckets": [
    { "binding": "BUCKET", "bucket_name": "krnl-drive-bucket" }
  ]
}
```

### 3. Apply the database schema

```bash
wrangler d1 execute krnl-drive-db --file worker/schema.sql --remote
```

### 4. Run locally

```bash
pnpm build
wrangler dev
```

This starts the Vite dev server (frontend) and the Worker (backend) concurrently.

### 5. Deploy

```bash
pnpm build
wrangler deploy
```

## Documentation

- [Setup & Deployment](docs/setup.md)
- [API Reference](docs/api.md)
- [Features Guide](docs/features.md)
- [Architecture](docs/architecture.md)

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Runtime  | Cloudflare Workers                  |
| Router   | Hono                                |
| Database | Cloudflare D1 (SQLite)              |
| Storage  | Cloudflare R2                       |
| Frontend | React + Vite                        |
| UI       | Fluent UI v9                        |
| Auth     | PBKDF2 · TOTP · WebAuthn · Sessions |

## License

Licensed under GNU General Public License v3.0 or later. See [LICENSE](./LICENSE) for details.
