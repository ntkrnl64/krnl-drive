-- Migration 0004: Chunked upload sessions

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  parent_id TEXT REFERENCES files(id),
  total_size INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL DEFAULT 5242880,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks TEXT NOT NULL DEFAULT '[]',
  r2_key TEXT NOT NULL,
  r2_upload_id TEXT,
  parts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
