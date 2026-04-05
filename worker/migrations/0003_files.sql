-- Migration 0003: Files and folders

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'file' | 'folder'
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  r2_key TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
