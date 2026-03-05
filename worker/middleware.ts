import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession, getUserById } from './db.ts';
import type { Env, HonoCtxVars } from './types.ts';

export const SESSION_COOKIE = 'krnl-session';

export async function requireAuth(c: Context<{ Bindings: Env; Variables: HonoCtxVars }>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const session = await getSession(c.env.DB, token);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  if (session.pending_2fa) return c.json({ error: 'Two-factor authentication required', code: 'REQUIRES_2FA' }, 401);

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user || user.disabled) return c.json({ error: 'Unauthorized' }, 401);

  c.set('user', user);
  c.set('session', session);
  await next();
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: HonoCtxVars }>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa) return c.json({ error: 'Unauthorized' }, 401);

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user || user.disabled) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  c.set('user', user);
  c.set('session', session);
  await next();
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: HonoCtxVars }>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const session = await getSession(c.env.DB, token);
    if (session && !session.pending_2fa) {
      const user = await getUserById(c.env.DB, session.user_id);
      if (user && !user.disabled) {
        c.set('user', user);
        c.set('session', session);
      }
    }
  }
  await next();
}
