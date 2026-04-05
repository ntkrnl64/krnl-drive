-- Migration 0006: Settings and default values

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings VALUES ('default_share_expiry_hours', '168');
INSERT OR IGNORE INTO settings VALUES ('default_max_views', '0');
INSERT OR IGNORE INTO settings VALUES ('default_max_downloads', '0');
INSERT OR IGNORE INTO settings VALUES ('default_share_title', '');
INSERT OR IGNORE INTO settings VALUES ('default_share_description', '');
INSERT OR IGNORE INTO settings VALUES ('site_name', 'KRNL Drive');
INSERT OR IGNORE INTO settings VALUES ('allow_registration', '0');
INSERT OR IGNORE INTO settings VALUES ('guest_can_download', '1');
INSERT OR IGNORE INTO settings VALUES ('chunk_size', '5242880');
