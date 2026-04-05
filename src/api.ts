import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import type { FileItem, Share, User, Passkey, SiteConfig } from "./types.ts";

const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = (await res.json()) as { error?: string } & T;
  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    req<{ user?: User; requiresTwoFactor?: boolean; methods?: string[] }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    ),

  verifyTotp: (code: string) =>
    req<{ user: User }>("/auth/verify-totp", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  verifyRecovery: (code: string) =>
    req<{ user: User }>("/auth/verify-recovery", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () => req<{ user: User | null }>("/auth/me"),

  guestLogin: () =>
    req<{ user: User | null }>("/auth/guest", { method: "POST" }),

  updateMe: (updates: {
    defaultShareTitle?: string | null;
    defaultShareDescription?: string | null;
    avatarUrl?: string | null;
  }) =>
    req<{ user: User }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  setupTotp: () =>
    req<{ secret: string; uri: string }>("/auth/totp/setup", {
      method: "POST",
    }),

  verifyTotpSetup: (code: string) =>
    req<{ recoveryCodes: string[] }>("/auth/totp/verify-setup", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  disableTotp: (code: string) =>
    req<{ ok: boolean }>("/auth/totp/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  regenerateRecoveryCodes: () =>
    req<{ codes: string[] }>("/auth/recovery-codes/regenerate", {
      method: "POST",
    }),

  // Passkeys
  passkeyRegisterBegin: () =>
    req<{ options: unknown; challengeId: string }>(
      "/auth/passkey/register/begin",
      { method: "POST" },
    ),

  passkeyRegisterComplete: (
    challengeId: string,
    response: RegistrationResponseJSON,
    name: string,
  ) =>
    req<{ ok: boolean }>("/auth/passkey/register/complete", {
      method: "POST",
      body: JSON.stringify({ challengeId, response, name }),
    }),

  passkeyAuthBegin: (username?: string) =>
    req<{ options: unknown; challengeId: string }>(
      "/auth/passkey/authenticate/begin",
      {
        method: "POST",
        body: JSON.stringify({ username }),
      },
    ),

  passkeyAuthComplete: (
    challengeId: string,
    response: AuthenticationResponseJSON,
  ) =>
    req<{ user: User }>("/auth/passkey/authenticate/complete", {
      method: "POST",
      body: JSON.stringify({ challengeId, response }),
    }),

  listPasskeys: () => req<{ passkeys: Passkey[] }>("/auth/passkeys"),

  deletePasskey: (id: string) =>
    req<{ ok: boolean }>(`/auth/passkeys/${id}`, { method: "DELETE" }),
};

// ─── Files ────────────────────────────────────────────────────────────────────
export const filesApi = {
  list: (parentId: string | null) =>
    req<{ items: FileItem[]; effectiveRoot: string | null }>(
      `/files?parentId=${parentId ?? "null"}`,
    ),

  get: (id: string) => req<{ item: FileItem }>(`/files/${id}`),

  breadcrumb: (id: string) =>
    req<{ breadcrumb: { id: string; name: string }[] }>(
      `/files/${id}/breadcrumb`,
    ),

  createFolder: (name: string, parentId: string | null) =>
    req<{ item: FileItem }>("/files/folder", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    }),

  rename: (id: string, name: string) =>
    req<{ item: FileItem }>(`/files/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  move: (id: string, parentId: string | null) =>
    req<{ item: FileItem }>(`/files/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId }),
    }),

  copy: (id: string, parentId: string | null) =>
    req<{ item: FileItem }>(`/files/${id}/copy`, {
      method: "POST",
      body: JSON.stringify({ parentId }),
    }),

  delete: (id: string) =>
    req<{ ok: boolean }>(`/files/${id}`, { method: "DELETE" }),

  downloadUrl: (id: string) => `${BASE}/files/${id}/download`,
};

// ─── Chunked Upload ───────────────────────────────────────────────────────────
export interface UploadProgress {
  progress: number; // 0-100
  sessionId: string;
}

export interface PendingSession {
  sessionId: string;
  filename: string;
  parentId: string | null;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: number;
}

export async function listPendingUploads(): Promise<PendingSession[]> {
  const res = await req<{ sessions: PendingSession[] }>("/upload/pending");
  return res.sessions;
}

export async function uploadFile(
  file: File,
  parentId: string | null,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
  resumeSession?: PendingSession,
): Promise<FileItem> {
  // Use simple upload for files < 10 MB (not resumable)
  if (!resumeSession && file.size < 10 * 1024 * 1024) {
    const formData = new FormData();
    formData.append("file", file);
    if (parentId) formData.append("parentId", parentId);
    const res = await fetch(`${BASE}/files/simple-upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
      signal,
    });
    const data = (await res.json()) as { item?: FileItem; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.item!;
  }

  let sessionId: string;
  let chunkSize: number;
  let totalChunks: number;
  let alreadyUploaded: Set<number>;

  if (resumeSession) {
    sessionId = resumeSession.sessionId;
    chunkSize = resumeSession.chunkSize;
    totalChunks = resumeSession.totalChunks;
    alreadyUploaded = new Set(resumeSession.uploadedChunks);
  } else {
    const initRes = await req<{
      sessionId: string;
      chunkSize: number;
      totalChunks: number;
    }>("/upload/init", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        parentId,
        size: file.size,
        mimeType: file.type,
      }),
    });
    sessionId = initRes.sessionId;
    chunkSize = initRes.chunkSize;
    totalChunks = initRes.totalChunks;
    alreadyUploaded = new Set<number>();
  }

  let uploaded = alreadyUploaded.size;
  onProgress?.({
    progress: Math.round((uploaded / totalChunks) * 100),
    sessionId,
  });

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error("Upload cancelled");
    if (alreadyUploaded.has(i)) continue; // Skip already-uploaded chunks

    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const res = await fetch(`${BASE}/upload/${sessionId}/chunk/${i}`, {
      method: "PUT",
      credentials: "include",
      body: chunk,
      signal,
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      throw new Error(d.error ?? "Chunk upload failed");
    }

    uploaded++;
    onProgress?.({
      progress: Math.round((uploaded / totalChunks) * 100),
      sessionId,
    });
  }

  const completeRes = await req<{ file: FileItem }>(
    `/upload/${sessionId}/complete`,
    { method: "POST" },
  );
  return completeRes.file;
}

export async function cancelUpload(sessionId: string): Promise<void> {
  await req(`/upload/${sessionId}`, { method: "DELETE" }).catch(() => {});
}

// ─── Shares ───────────────────────────────────────────────────────────────────
export const sharesApi = {
  list: (fileId?: string) =>
    req<{ shares: (Share & { file_name?: string })[] }>(
      `/shares${fileId ? `?fileId=${fileId}` : ""}`,
    ),

  create: (
    fileId: string,
    opts: {
      customTitle?: string | null;
      customDescription?: string | null;
      expiresIn?: number | null;
      maxViews?: number | null;
      maxDownloads?: number | null;
    },
  ) =>
    req<{ share: Share; shareUrl: string; downloadUrl: string }>("/shares", {
      method: "POST",
      body: JSON.stringify({ fileId, ...opts }),
    }),

  update: (
    id: string,
    opts: {
      customTitle?: string | null;
      customDescription?: string | null;
      expiresAt?: number | null;
      maxViews?: number | null;
      maxDownloads?: number | null;
    },
  ) =>
    req<{ share: Share }>(`/shares/${id}`, {
      method: "PATCH",
      body: JSON.stringify(opts),
    }),

  delete: (id: string) =>
    req<{ ok: boolean }>(`/shares/${id}`, { method: "DELETE" }),

  // Public
  getPublic: (token: string) =>
    req<{
      share: Share;
      file: FileItem;
      display: { title: string; description: string };
    }>(`/share/${token}`),

  downloadUrl: (token: string) => `${BASE}/share/${token}/download`,

  browse: (token: string, folderId?: string) =>
    req<{ items: FileItem[] }>(
      `/share/${token}/browse${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ""}`,
    ),

  fileDownloadUrl: (token: string, fileId: string) =>
    `${BASE}/share/${token}/file/${encodeURIComponent(fileId)}/download`,
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => req<{ users: User[] }>("/admin/users"),

  createUser: (username: string, password: string, role: string) =>
    req<{ user: User }>("/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, password, role }),
    }),

  updateUser: (
    id: string,
    updates: {
      username?: string;
      password?: string;
      role?: string;
      disabled?: boolean;
      root_folder_id?: string | null;
      avatar_url?: string | null;
    },
  ) =>
    req<{ user: User }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteUser: (id: string) =>
    req<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),

  forceLogin: (id: string) =>
    req<{ ok: boolean }>(`/admin/users/${id}/force-login`, { method: "POST" }),

  getSettings: () =>
    req<{ settings: Record<string, string> }>("/admin/settings"),

  updateSettings: (settings: Record<string, string>) =>
    req<{ settings: Record<string, string> }>("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),

  getStats: () =>
    req<{
      users: number;
      files: number;
      totalSize: number;
      shares: number;
      activeUploads: number;
    }>("/admin/stats"),
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initApi = {
  status: () =>
    fetch("/api/init/status").then(
      (r) => r.json() as Promise<{ initialized: boolean }>,
    ),
  setup: (adminUsername: string, adminPassword: string, enableGuest: boolean) =>
    req<{ ok: boolean }>("/init/setup", {
      method: "POST",
      body: JSON.stringify({ adminUsername, adminPassword, enableGuest }),
    }),
};

// ─── Config ───────────────────────────────────────────────────────────────────
export const getConfig = () => req<SiteConfig>("/config");

// ─── Utilities ────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}
