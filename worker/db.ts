import { hashPassword, randomId, randomToken } from './crypto.ts';
import type { User, UserFull, Session, FileItem, Share, UploadSession, Passkey } from './types.ts';

// ─── Init ────────────────────────────────────────────────────────────────────

export async function ensureDefaultUsers(db: D1Database): Promise<void> {
  const count = await db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (count && count.c > 0) return;

  const now = Date.now();
  const adminHash = await hashPassword('admin');
  const guestHash = await hashPassword('guest');

  await db.batch([
    db.prepare(
      'INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(randomId(), 'admin', adminHash, 'admin', 0, 0, now, now),
    db.prepare(
      'INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(randomId(), 'guest', guestHash, 'guest', 0, 0, now, now),
  ]);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  return db.prepare(
    'SELECT id,username,role,disabled,totp_enabled,default_share_title,default_share_description,avatar_url,root_folder_id,created_at,updated_at FROM users WHERE id=?'
  ).bind(id).first<User>();
}

export async function getUserByUsername(db: D1Database, username: string): Promise<UserFull | null> {
  return db.prepare(
    'SELECT id,username,password_hash,role,disabled,totp_enabled,totp_secret,default_share_title,default_share_description,avatar_url,root_folder_id,created_at,updated_at FROM users WHERE username=?'
  ).bind(username).first<UserFull>();
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare(
    'SELECT id,username,role,disabled,totp_enabled,default_share_title,default_share_description,avatar_url,root_folder_id,created_at,updated_at FROM users ORDER BY created_at ASC'
  ).all<User>();
  return results;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PENDING_2FA_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function createSession(db: D1Database, userId: string, pending2fa = false): Promise<string> {
  const id = randomToken(32);
  const now = Date.now();
  const ttl = pending2fa ? PENDING_2FA_TTL_MS : SESSION_TTL_MS;
  await db.prepare(
    'INSERT INTO sessions (id,user_id,pending_2fa,expires_at,created_at) VALUES (?,?,?,?,?)'
  ).bind(id, userId, pending2fa ? 1 : 0, now + ttl, now).run();
  return id;
}

export async function getSession(db: D1Database, token: string): Promise<Session | null> {
  const session = await db.prepare(
    'SELECT * FROM sessions WHERE id=? AND expires_at>?'
  ).bind(token, Date.now()).first<Session>();
  return session ?? null;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id=?').bind(token).run();
}

export async function promoteSession(db: D1Database, token: string): Promise<void> {
  const now = Date.now();
  await db.prepare(
    'UPDATE sessions SET pending_2fa=0, expires_at=? WHERE id=?'
  ).bind(now + SESSION_TTL_MS, token).run();
}

export async function cleanExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run();
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key,value FROM settings').all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r: { key: string; value: string }) => [r.key, r.value]));
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').bind(key, value).run();
}

// ─── Files ───────────────────────────────────────────────────────────────────

export async function getFile(db: D1Database, id: string): Promise<FileItem | null> {
  return db.prepare('SELECT * FROM files WHERE id=?').bind(id).first<FileItem>();
}

export async function listFiles(db: D1Database, parentId: string | null): Promise<FileItem[]> {
  const { results } = parentId === null
    ? await db.prepare('SELECT * FROM files WHERE parent_id IS NULL ORDER BY type DESC, name ASC').all<FileItem>()
    : await db.prepare('SELECT * FROM files WHERE parent_id=? ORDER BY type DESC, name ASC').bind(parentId).all<FileItem>();
  return results;
}

export async function createFolder(
  db: D1Database, name: string, parentId: string | null, ownerId: string
): Promise<FileItem> {
  const id = randomId();
  const now = Date.now();
  await db.prepare(
    'INSERT INTO files (id,name,parent_id,type,size,r2_key,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, name, parentId, 'folder', 0, null, ownerId, now, now).run();
  return (await getFile(db, id))!;
}

export async function createFile(
  db: D1Database,
  name: string,
  parentId: string | null,
  ownerId: string,
  size: number,
  mimeType: string | null,
  r2Key: string
): Promise<FileItem> {
  const id = randomId();
  const now = Date.now();
  await db.prepare(
    'INSERT INTO files (id,name,parent_id,type,size,mime_type,r2_key,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, name, parentId, 'file', size, mimeType, r2Key, ownerId, now, now).run();
  return (await getFile(db, id))!;
}

export async function updateFile(
  db: D1Database, id: string, updates: { name?: string; parent_id?: string | null }
): Promise<void> {
  const parts: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { parts.push('name=?'); values.push(updates.name); }
  if ('parent_id' in updates) { parts.push('parent_id=?'); values.push(updates.parent_id); }
  parts.push('updated_at=?');
  values.push(Date.now());
  values.push(id);
  await db.prepare(`UPDATE files SET ${parts.join(',')} WHERE id=?`).bind(...values).run();
}

export async function deleteFileRecord(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM files WHERE id=?').bind(id).run();
}

// ─── Shares ──────────────────────────────────────────────────────────────────

export async function createShare(
  db: D1Database,
  fileId: string,
  createdBy: string,
  customTitle: string | null,
  customDescription: string | null,
  expiresAt: number | null,
  maxViews: number | null,
  maxDownloads: number | null
): Promise<Share> {
  const id = randomId();
  const token = randomToken(20);
  const now = Date.now();
  await db.prepare(
    'INSERT INTO shares (id,file_id,token,created_by,custom_title,custom_description,expires_at,max_views,max_downloads,view_count,download_count,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, fileId, token, createdBy, customTitle, customDescription, expiresAt, maxViews, maxDownloads, 0, 0, now).run();
  return (await db.prepare('SELECT * FROM shares WHERE id=?').bind(id).first<Share>())!;
}

export async function getShareByToken(db: D1Database, token: string): Promise<Share | null> {
  return db.prepare('SELECT * FROM shares WHERE token=?').bind(token).first<Share>();
}

export async function getShareById(db: D1Database, id: string): Promise<Share | null> {
  return db.prepare('SELECT * FROM shares WHERE id=?').bind(id).first<Share>();
}

export async function listSharesByFile(db: D1Database, fileId: string): Promise<Share[]> {
  const { results } = await db.prepare('SELECT * FROM shares WHERE file_id=? ORDER BY created_at DESC').bind(fileId).all<Share>();
  return results;
}

export async function listAllShares(db: D1Database, userId: string, role: string): Promise<(Share & { file_name: string })[]> {
  const { results } = role === 'admin'
    ? await db.prepare('SELECT shares.*, files.name as file_name FROM shares JOIN files ON shares.file_id = files.id ORDER BY shares.created_at DESC').all<Share & { file_name: string }>()
    : await db.prepare('SELECT shares.*, files.name as file_name FROM shares JOIN files ON shares.file_id = files.id WHERE shares.created_by=? ORDER BY shares.created_at DESC').bind(userId).all<Share & { file_name: string }>();
  return results;
}

export async function incrementShareView(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE shares SET view_count=view_count+1 WHERE id=?').bind(id).run();
}

export async function incrementShareDownload(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE shares SET download_count=download_count+1 WHERE id=?').bind(id).run();
}

export async function deleteShare(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM shares WHERE id=?').bind(id).run();
}

// Returns true if childId equals ancestorId, or if childId is a descendant of ancestorId.
export async function isDescendantOf(db: D1Database, childId: string, ancestorId: string): Promise<boolean> {
  if (childId === ancestorId) return true;
  let current = childId;
  for (let i = 0; i < 64; i++) {
    const row = await db.prepare('SELECT parent_id FROM files WHERE id=?').bind(current).first<{ parent_id: string | null }>();
    if (!row || row.parent_id === null) return false;
    if (row.parent_id === ancestorId) return true;
    current = row.parent_id;
  }
  return false;
}

// ─── Upload sessions ─────────────────────────────────────────────────────────

export async function createUploadSession(
  db: D1Database,
  userId: string,
  filename: string,
  parentId: string | null,
  totalSize: number,
  chunkSize: number,
  r2Key: string
): Promise<UploadSession> {
  const id = randomId();
  const now = Date.now();
  const totalChunks = Math.ceil(totalSize / chunkSize);
  await db.prepare(
    `INSERT INTO upload_sessions
     (id,user_id,filename,parent_id,total_size,chunk_size,total_chunks,uploaded_chunks,r2_key,r2_upload_id,parts,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, userId, filename, parentId, totalSize, chunkSize, totalChunks, '[]', r2Key, null, '[]', 'pending', now, now).run();
  return (await getUploadSession(db, id))!;
}

export async function getUploadSession(db: D1Database, id: string): Promise<UploadSession | null> {
  return db.prepare('SELECT * FROM upload_sessions WHERE id=?').bind(id).first<UploadSession>();
}

export async function updateUploadSession(
  db: D1Database, id: string,
  updates: Partial<Pick<UploadSession, 'uploaded_chunks' | 'r2_upload_id' | 'parts' | 'status'>>
): Promise<void> {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    parts.push(`${k}=?`);
    values.push(v);
  }
  parts.push('updated_at=?');
  values.push(Date.now());
  values.push(id);
  await db.prepare(`UPDATE upload_sessions SET ${parts.join(',')} WHERE id=?`).bind(...values).run();
}

export async function deleteUploadSession(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM upload_sessions WHERE id=?').bind(id).run();
}

// ─── Passkeys ────────────────────────────────────────────────────────────────

export async function getPasskeysByUser(db: D1Database, userId: string): Promise<Passkey[]> {
  const { results } = await db.prepare('SELECT * FROM passkeys WHERE user_id=?').bind(userId).all<Passkey>();
  return results;
}

export async function getPasskeyByCredentialId(db: D1Database, credentialId: string): Promise<Passkey | null> {
  return db.prepare('SELECT * FROM passkeys WHERE credential_id=?').bind(credentialId).first<Passkey>();
}

export async function savePasskey(
  db: D1Database,
  userId: string,
  credentialId: string,
  publicKey: string,
  counter: number,
  name: string,
  transports: string | null
): Promise<Passkey> {
  const id = randomId();
  const now = Date.now();
  await db.prepare(
    'INSERT INTO passkeys (id,user_id,credential_id,public_key,counter,name,transports,created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, userId, credentialId, publicKey, counter, name, transports, now).run();
  return (await db.prepare('SELECT * FROM passkeys WHERE id=?').bind(id).first<Passkey>())!;
}

export async function updatePasskeyCounter(db: D1Database, id: string, counter: number): Promise<void> {
  await db.prepare('UPDATE passkeys SET counter=?, last_used_at=? WHERE id=?').bind(counter, Date.now(), id).run();
}

export async function deletePasskey(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM passkeys WHERE id=?').bind(id).run();
}

// ─── WebAuthn challenges ─────────────────────────────────────────────────────

export async function saveChallenge(
  db: D1Database, userId: string | null, challenge: string, type: 'register' | 'authenticate'
): Promise<string> {
  const id = randomId();
  await db.prepare(
    'INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)'
  ).bind(id, userId, challenge, type, Date.now() + 5 * 60 * 1000).run();
  return id;
}

export async function consumeChallenge(
  db: D1Database, id: string
): Promise<{ challenge: string; user_id: string | null; type: string } | null> {
  const row = await db.prepare(
    'SELECT challenge,user_id,type FROM webauthn_challenges WHERE id=? AND expires_at>?'
  ).bind(id, Date.now()).first<{ challenge: string; user_id: string | null; type: string }>();
  if (row) await db.prepare('DELETE FROM webauthn_challenges WHERE id=?').bind(id).run();
  return row ?? null;
}

// ─── Recovery codes ──────────────────────────────────────────────────────────

export async function saveRecoveryCodes(
  db: D1Database, userId: string, hashes: string[]
): Promise<void> {
  await db.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId).run();
  const now = Date.now();
  const stmts = hashes.map(hash =>
    db.prepare('INSERT INTO recovery_codes (id,user_id,code_hash,used,created_at) VALUES (?,?,?,?,?)')
      .bind(randomId(), userId, hash, 0, now)
  );
  if (stmts.length > 0) await db.batch(stmts);
}

export async function getUnusedRecoveryCodes(
  db: D1Database, userId: string
): Promise<Array<{ id: string; code_hash: string }>> {
  const { results } = await db.prepare(
    'SELECT id,code_hash FROM recovery_codes WHERE user_id=? AND used=0'
  ).bind(userId).all<{ id: string; code_hash: string }>();
  return results;
}

export async function markRecoveryCodeUsed(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE recovery_codes SET used=1 WHERE id=?').bind(id).run();
}
