import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { requireAdmin, SESSION_COOKIE } from '../middleware.ts';
import { listUsers, getSettings, setSetting, createSession } from '../db.ts';
import { hashPassword, randomId } from '../crypto.ts';
import type { Env, HonoCtxVars } from '../types.ts';

const admin = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

// GET /api/admin/users
admin.get('/users', requireAdmin, async (c) => {
  const users = await listUsers(c.env.DB);
  return c.json({ users });
});

// POST /api/admin/users
admin.post('/users', requireAdmin, async (c) => {
  const { username, password, role } = await c.req.json<{
    username: string;
    password: string;
    role?: string;
  }>();

  if (!username?.trim()) return c.json({ error: 'Username is required' }, 400);

  const validRoles = ['admin', 'user', 'guest'];
  const userRole = validRoles.includes(role ?? '') ? role! : 'user';

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username=?')
    .bind(username.trim()).first<{ id: string }>();
  if (existing) return c.json({ error: 'Username already exists' }, 409);

  const id = randomId();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, username.trim(), passwordHash, userRole, 0, 0, now, now).run();

  const user = await c.env.DB.prepare(
    'SELECT id,username,role,disabled,totp_enabled,created_at,updated_at FROM users WHERE id=?'
  ).bind(id).first();

  return c.json({ user }, 201);
});

// PATCH /api/admin/users/:id
admin.patch('/users/:id', requireAdmin, async (c) => {
  const currentAdmin = c.get('user');
  const { id } = c.req.param();

  const target = await c.env.DB.prepare(
    'SELECT id,username,role FROM users WHERE id=?'
  ).bind(id).first<{ id: string; username: string; role: string }>();
  if (!target) return c.json({ error: 'User not found' }, 404);

  const body = await c.req.json<{
    username?: string;
    password?: string;
    role?: string;
    disabled?: boolean;
    root_folder_id?: string | null;
    avatar_url?: string | null;
  }>();

  const sets: string[] = [];
  const vals: unknown[] = [];
  const validRoles = ['admin', 'user', 'guest'];

  if (body.username !== undefined) {
    const trimmed = body.username.trim();
    if (!trimmed) return c.json({ error: 'Username cannot be empty' }, 400);
    // Check uniqueness
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username=? AND id!=?')
      .bind(trimmed, id).first<{ id: string }>();
    if (existing) return c.json({ error: 'Username already taken' }, 409);
    sets.push('username=?'); vals.push(trimmed);
  }

  if (body.password !== undefined) {
    sets.push('password_hash=?');
    vals.push(body.password ? await hashPassword(body.password) : null);
  }

  if (body.role !== undefined) {
    if (!validRoles.includes(body.role)) return c.json({ error: 'Invalid role' }, 400);
    // Prevent demoting self
    if (id === currentAdmin.id && body.role !== 'admin') {
      return c.json({ error: 'Cannot change your own role' }, 400);
    }
    sets.push('role=?'); vals.push(body.role);
  }

  if (body.disabled !== undefined) {
    if (id === currentAdmin.id) return c.json({ error: 'Cannot disable yourself' }, 400);
    sets.push('disabled=?'); vals.push(body.disabled ? 1 : 0);
  }

  if ('root_folder_id' in body) {
    sets.push('root_folder_id=?'); vals.push(body.root_folder_id ?? null);
  }

  if ('avatar_url' in body) {
    sets.push('avatar_url=?'); vals.push(body.avatar_url ?? null);
  }

  if (sets.length === 0) return c.json({ error: 'No updates provided' }, 400);

  sets.push('updated_at=?');
  vals.push(Date.now());
  vals.push(id);

  await c.env.DB.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();

  const updated = await c.env.DB.prepare(
    'SELECT id,username,role,disabled,totp_enabled,created_at,updated_at FROM users WHERE id=?'
  ).bind(id).first();

  return c.json({ user: updated });
});

// DELETE /api/admin/users/:id
admin.delete('/users/:id', requireAdmin, async (c) => {
  const currentAdmin = c.get('user');
  const { id } = c.req.param();

  if (id === currentAdmin.id) return c.json({ error: 'Cannot delete yourself' }, 400);

  const target = await c.env.DB.prepare('SELECT id,username FROM users WHERE id=?')
    .bind(id).first<{ id: string; username: string }>();
  if (!target) return c.json({ error: 'User not found' }, 404);

  // Prevent deleting built-in accounts
  if (target.username === 'admin' || target.username === 'guest') {
    return c.json({ error: 'Cannot delete built-in accounts' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run();
  return c.json({ ok: true });
});

// POST /api/admin/users/:id/force-login
admin.post('/users/:id/force-login', requireAdmin, async (c) => {
  const { id } = c.req.param();

  const target = await c.env.DB.prepare('SELECT id, username, disabled FROM users WHERE id=?')
    .bind(id).first<{ id: string; username: string; disabled: number }>();
  
  if (!target) return c.json({ error: 'User not found' }, 404);
  if (target.disabled) return c.json({ error: 'User is disabled' }, 400);

  const token = await createSession(c.env.DB, target.id, false);
  
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({ ok: true });
});

// GET /api/admin/settings
admin.get('/settings', requireAdmin, async (c) => {
  const settings = await getSettings(c.env.DB);
  return c.json({ settings });
});

// PATCH /api/admin/settings
admin.patch('/settings', requireAdmin, async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const allowedKeys = [
    'default_share_expiry_hours',
    'default_max_views',
    'default_max_downloads',
    'site_name',
    'site_icon_url',
    'allow_registration',
    'guest_can_download',
    'chunk_size',
  ];

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key)) {
      await setSetting(c.env.DB, key, String(value));
    }
  }

  const settings = await getSettings(c.env.DB);
  return c.json({ settings });
});

// GET /api/admin/stats
admin.get('/stats', requireAdmin, async (c) => {
  const [users, files, shares, uploadSessions] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users'),
    c.env.DB.prepare('SELECT COUNT(*) as count, SUM(size) as totalSize FROM files WHERE type=\'file\''),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM shares'),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM upload_sessions WHERE status=\'pending\''),
  ]);

  return c.json({
    users: (users.results[0] as { count: number }).count,
    files: (files.results[0] as { count: number }).count,
    totalSize: (files.results[0] as { totalSize: number | null }).totalSize ?? 0,
    shares: (shares.results[0] as { count: number }).count,
    activeUploads: (uploadSessions.results[0] as { count: number }).count,
  });
});

export default admin;
