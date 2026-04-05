export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ORIGIN: string;
  ASSETS: Fetcher;
}

export interface User {
  id: string;
  username: string;
  role: "admin" | "user" | "guest";
  disabled: number;
  totp_enabled: number;
  default_share_title: string | null;
  default_share_description: string | null;
  avatar_url: string | null;
  root_folder_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserFull extends User {
  password_hash: string | null;
  totp_secret: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  pending_2fa: number;
  expires_at: number;
  created_at: number;
}

export interface FileItem {
  id: string;
  name: string;
  parent_id: string | null;
  type: "file" | "folder";
  size: number;
  mime_type: string | null;
  r2_key: string | null;
  owner_id: string;
  created_at: number;
  updated_at: number;
}

export interface Share {
  id: string;
  file_id: string;
  token: string;
  created_by: string;
  custom_title: string | null;
  custom_description: string | null;
  expires_at: number | null;
  max_views: number | null;
  max_downloads: number | null;
  view_count: number;
  download_count: number;
  created_at: number;
}

export interface UploadSession {
  id: string;
  user_id: string;
  filename: string;
  parent_id: string | null;
  total_size: number;
  chunk_size: number;
  total_chunks: number;
  uploaded_chunks: string;
  r2_key: string;
  r2_upload_id: string | null;
  parts: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Passkey {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  name: string;
  transports: string | null;
  created_at: number;
  last_used_at: number | null;
}

export interface HonoCtxVars {
  user: User;
  session: Session;
}
