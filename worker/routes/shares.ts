import { Hono } from 'hono';
import { requireAuth } from '../middleware.ts';
import {
  createShare, getShareByToken, getShareById, listAllShares, listSharesByFile,
  deleteShare, incrementShareView, incrementShareDownload, getFile, getSettings
} from '../db.ts';
import type { Env, HonoCtxVars } from '../types.ts';

const shares = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

// GET /api/shares
shares.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const fileId = c.req.query('fileId');

  if (fileId) {
    const list = await listSharesByFile(c.env.DB, fileId);
    return c.json({ shares: list });
  }

  const list = await listAllShares(c.env.DB, user.id, user.role);
  return c.json({ shares: list });
});

// POST /api/shares
shares.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role === 'guest') return c.json({ error: 'Forbidden' }, 403);

  const { fileId, customTitle, customDescription, expiresIn, maxViews, maxDownloads } = await c.req.json<{
    fileId: string;
    customTitle?: string | null;
    customDescription?: string | null;
    expiresIn?: number | null;
    maxViews?: number | null;
    maxDownloads?: number | null;
  }>();

  if (!fileId) return c.json({ error: 'fileId is required' }, 400);

  const file = await getFile(c.env.DB, fileId);
  if (!file) return c.json({ error: 'File not found' }, 404);

  const settings = await getSettings(c.env.DB);
  const defaultExpiryHours = parseInt(settings.default_share_expiry_hours ?? '168');
  const defaultMaxViews = parseInt(settings.default_max_views ?? '0');
  const defaultMaxDownloads = parseInt(settings.default_max_downloads ?? '0');

  const expiresAt = expiresIn !== undefined
    ? (expiresIn === null || expiresIn === 0 ? null : Date.now() + expiresIn * 1000)
    : (defaultExpiryHours === 0 ? null : Date.now() + defaultExpiryHours * 3600 * 1000);

  const finalMaxViews = maxViews !== undefined
    ? (maxViews === 0 ? null : maxViews)
    : (defaultMaxViews === 0 ? null : defaultMaxViews);

  const finalMaxDownloads = maxDownloads !== undefined
    ? (maxDownloads === 0 ? null : maxDownloads)
    : (defaultMaxDownloads === 0 ? null : defaultMaxDownloads);

  const share = await createShare(
    c.env.DB, fileId, user.id, customTitle ?? null, customDescription ?? null, expiresAt, finalMaxViews, finalMaxDownloads
  );

  const origin = c.env.ORIGIN;
  return c.json({
    share,
    shareUrl: `${origin}/share/${share.token}`,
    downloadUrl: `${origin}/api/share/${share.token}/download`,
  }, 201);
});

// PATCH /api/shares/:id
shares.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const share = await getShareById(c.env.DB, c.req.param('id')!);
  if (!share) return c.json({ error: 'Not found' }, 404);
  if (user.role !== 'admin' && share.created_by !== user.id) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{
    customTitle?: string | null;
    customDescription?: string | null;
    expiresAt?: number | null;
    maxViews?: number | null;
    maxDownloads?: number | null;
  }>();
  const sets: string[] = [];
  const setVals: unknown[] = [];
  if ('customTitle' in body) { sets.push('custom_title=?'); setVals.push(body.customTitle ?? null); }
  if ('customDescription' in body) { sets.push('custom_description=?'); setVals.push(body.customDescription ?? null); }
  if ('expiresAt' in body) { sets.push('expires_at=?'); setVals.push(body.expiresAt ?? null); }
  if ('maxViews' in body) { sets.push('max_views=?'); setVals.push(body.maxViews ?? null); }
  if ('maxDownloads' in body) { sets.push('max_downloads=?'); setVals.push(body.maxDownloads ?? null); }

  if (sets.length > 0) {
    setVals.push(share.id);
    await c.env.DB.prepare(`UPDATE shares SET ${sets.join(',')} WHERE id=?`).bind(...setVals).run();
  }

  const updated = await getShareById(c.env.DB, share.id);
  return c.json({ share: updated });
});

// DELETE /api/shares/:id
shares.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const share = await getShareById(c.env.DB, c.req.param('id')!);
  if (!share) return c.json({ error: 'Not found' }, 404);
  if (user.role !== 'admin' && share.created_by !== user.id) return c.json({ error: 'Forbidden' }, 403);

  await deleteShare(c.env.DB, share.id);
  return c.json({ ok: true });
});

export default shares;
