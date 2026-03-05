import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getShareByToken, getFile, incrementShareView, incrementShareDownload, getSettings, listFiles, isDescendantOf } from './db.ts';
import { hashPassword, randomId } from './crypto.ts';
import authRoutes from './routes/auth.ts';
import fileRoutes from './routes/files.ts';
import uploadRoutes from './routes/upload.ts';
import shareRoutes from './routes/shares.ts';
import adminRoutes from './routes/admin.ts';
import type { Env, HonoCtxVars } from './types.ts';

const app = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

// CORS
app.use('/api/*', cors({
  origin: (origin, c) => origin || c.env.ORIGIN,
  credentials: true,
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Init endpoints (public) ──────────────────────────────────────────────────
app.get('/api/init/status', async (c) => {
  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  return c.json({ initialized: (count?.c ?? 0) > 0 });
});

app.post('/api/init/setup', async (c) => {
  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (count && count.c > 0) return c.json({ error: 'Already initialized' }, 409);

  const { adminUsername, adminPassword, enableGuest } = await c.req.json<{
    adminUsername: string; adminPassword: string; enableGuest?: boolean;
  }>();
  if (!adminUsername?.trim()) return c.json({ error: 'Username is required' }, 400);
  if (!adminPassword || adminPassword.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const now = Date.now();
  const adminHash = await hashPassword(adminPassword);
  const stmts = [
    c.env.DB.prepare(
      'INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(randomId(), adminUsername.trim(), adminHash, 'admin', 0, 0, now, now),
  ];

  if (enableGuest) {
    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(randomId(), 'guest', null, 'guest', 0, 0, now, now)
    );
  }

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ─── Authenticated API routes ─────────────────────────────────────────────────
app.route('/api/auth', authRoutes);
app.route('/api/files', fileRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/shares', shareRoutes);
app.route('/api/admin', adminRoutes);

// ─── Public share endpoints ───────────────────────────────────────────────────
// Support both /api/share/:token and /api/share/public/:token
app.get('/api/share/public/:token', (c) =>
  c.redirect(`/api/share/${c.req.param('token')}`, 301));
app.get('/api/share/public/:token/download', (c) =>
  c.redirect(`/api/share/${c.req.param('token')}/download`, 301));

app.get('/api/share/:token', async (c) => {
  const share = await getShareByToken(c.env.DB, c.req.param('token'));
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.expires_at && Date.now() > share.expires_at) return c.json({ error: 'Expired' }, 410);
  if (share.max_views !== null && share.view_count >= share.max_views) return c.json({ error: 'View limit reached' }, 410);

  const file = await getFile(c.env.DB, share.file_id);
  if (!file) return c.json({ error: 'File not found' }, 404);

  // Resolve title, description, and creator info
  const creator = await c.env.DB.prepare(
    'SELECT username, avatar_url, default_share_title, default_share_description FROM users WHERE id=?'
  ).bind(share.created_by).first<{ username: string; avatar_url: string | null; default_share_title: string | null; default_share_description: string | null }>();
  const settings = await getSettings(c.env.DB);

  const title = share.custom_title || creator?.default_share_title || settings.default_share_title || file.name;
  const description = share.custom_description || creator?.default_share_description || settings.default_share_description || '';

  await incrementShareView(c.env.DB, share.id);

  const { r2_key: _, owner_id: __, ...safeFile } = file;
  return c.json({
    share,
    file: safeFile,
    display: { title, description },
    creator: { username: creator?.username ?? '', avatarUrl: creator?.avatar_url ?? null },
  });
});

app.get('/api/share/:token/download', async (c) => {
  const share = await getShareByToken(c.env.DB, c.req.param('token'));
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.expires_at && Date.now() > share.expires_at) return c.json({ error: 'Expired' }, 410);
  if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
    return c.json({ error: 'Download limit reached' }, 410);
  }

  const file = await getFile(c.env.DB, share.file_id);
  if (!file || file.type !== 'file' || !file.r2_key) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.BUCKET.get(file.r2_key);
  if (!obj) return c.json({ error: 'Not found in storage' }, 404);

  await incrementShareDownload(c.env.DB, share.id);

  const headers = new Headers();
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  headers.set('Content-Type', file.mime_type ?? 'application/octet-stream');
  headers.set('Content-Length', file.size.toString());
  return new Response(obj.body, { headers });
});

// GET /api/share/:token/browse?folderId=<id>  — list contents of a shared folder (or subfolder)
app.get('/api/share/:token/browse', async (c) => {
  const share = await getShareByToken(c.env.DB, c.req.param('token'));
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.expires_at && Date.now() > share.expires_at) return c.json({ error: 'Expired' }, 410);
  if (share.max_views !== null && share.view_count >= share.max_views) return c.json({ error: 'View limit reached' }, 410);

  const rootFile = await getFile(c.env.DB, share.file_id);
  if (!rootFile || rootFile.type !== 'folder') return c.json({ error: 'Not a folder share' }, 400);

  const folderId = c.req.query('folderId') ?? share.file_id;
  if (folderId !== share.file_id) {
    const ok = await isDescendantOf(c.env.DB, folderId, share.file_id);
    if (!ok) return c.json({ error: 'Forbidden' }, 403);
  }

  const items = await listFiles(c.env.DB, folderId);
  return c.json({ items: items.map(({ r2_key: _, owner_id: __, ...item }) => item) });
});

// GET /api/share/:token/file/:fileId/download  — download a file inside a shared folder
app.get('/api/share/:token/file/:fileId/download', async (c) => {
  const share = await getShareByToken(c.env.DB, c.req.param('token'));
  if (!share) return c.json({ error: 'Share not found' }, 404);
  if (share.expires_at && Date.now() > share.expires_at) return c.json({ error: 'Expired' }, 410);
  if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
    return c.json({ error: 'Download limit reached' }, 410);
  }

  const rootFile = await getFile(c.env.DB, share.file_id);
  if (!rootFile || rootFile.type !== 'folder') return c.json({ error: 'Not a folder share' }, 400);

  const fileId = c.req.param('fileId')!;
  const ok = await isDescendantOf(c.env.DB, fileId, share.file_id);
  if (!ok) return c.json({ error: 'Forbidden' }, 403);

  const file = await getFile(c.env.DB, fileId);
  if (!file || file.type !== 'file' || !file.r2_key) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.BUCKET.get(file.r2_key);
  if (!obj) return c.json({ error: 'Not found in storage' }, 404);

  await incrementShareDownload(c.env.DB, share.id);

  const headers = new Headers();
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  headers.set('Content-Type', file.mime_type ?? 'application/octet-stream');
  headers.set('Content-Length', file.size.toString());
  return new Response(obj.body, { headers });
});

// Public config (site name, registration enabled)
app.get('/api/config', async (c) => {
  const s = await getSettings(c.env.DB).catch(() => ({} as Record<string, string>));
  return c.json({
    siteName: s.site_name ?? 'KRNL Drive',
    allowRegistration: s.allow_registration === '1',
    siteIconUrl: s.site_icon_url ?? '',
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    // Fall through to Workers Assets (serves SPA index.html for unknown paths)
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Build the frontend first: npm run build', { status: 404 });
  },
};
