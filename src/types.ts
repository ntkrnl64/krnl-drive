export interface User {
  id: string;
  username: string;
  role: "admin" | "user" | "guest";
  disabled: number;
  totp_enabled: number;
  default_share_title?: string | null;
  default_share_description?: string | null;
  avatar_url?: string | null;
  root_folder_id?: string | null;
  created_at: number;
  updated_at: number;
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
  custom_title?: string | null;
  custom_description?: string | null;
  expires_at: number | null;
  max_views: number | null;
  max_downloads: number | null;
  view_count: number;
  download_count: number;
  created_at: number;
}

export interface Passkey {
  id: string;
  user_id: string;
  credential_id: string;
  name: string;
  transports: string | null;
  created_at: number;
  last_used_at: number | null;
}

export interface UploadTask {
  id: string;
  file: File;
  sessionId?: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  parentId: string | null;
}

export interface SiteConfig {
  siteName: string;
  allowRegistration: boolean;
  siteIconUrl: string;
}
