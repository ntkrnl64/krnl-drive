import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { PrismError } from "@siiway/prism";
import {
  buildPrismClient,
  isPrismConfigured,
  loadPrismConfig,
} from "../prism.ts";
import {
  consumePrismOAuthState,
  createSession,
  getUserByPrismSub,
  getUserByUsername,
  savePrismOAuthState,
  setUserPrismSub,
} from "../db.ts";
import { randomId } from "../crypto.ts";
import { SESSION_COOKIE, optionalAuth, requireAuth } from "../middleware.ts";
import type { Env, HonoCtxVars } from "../types.ts";

const prism = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

// POST /api/auth/prism/start  — begin OAuth flow (anonymous or to link a logged-in user)
prism.post("/start", optionalAuth, async (c) => {
  const cfg = await loadPrismConfig(c.env.DB);
  if (!isPrismConfigured(cfg)) {
    return c.json({ error: "Prism authentication is not configured" }, 400);
  }

  const body = await c.req
    .json<{ redirectTo?: string; link?: boolean }>()
    .catch(() => ({}) as { redirectTo?: string; link?: boolean });

  const sessionUser = c.get("user");
  const linkUserId = body.link && sessionUser ? sessionUser.id : null;

  const client = buildPrismClient(cfg, c.env);
  const { url, pkce } = await client.createAuthorizationUrl();

  // Validate redirect_to is a same-origin path to prevent open redirect
  let redirectTo: string | null = null;
  if (typeof body.redirectTo === "string" && body.redirectTo.startsWith("/")) {
    redirectTo = body.redirectTo;
  }

  await savePrismOAuthState(
    c.env.DB,
    pkce.state,
    pkce.codeVerifier,
    redirectTo,
    linkUserId,
  );

  return c.json({ url });
});

// GET /api/auth/prism/callback?code=...&state=...
//   The OAuth provider redirects the user's browser here. We exchange the
//   code, find/create a local user, set the session cookie, then 302 to "/"
//   (or the originally requested path).
prism.get("/callback", async (c) => {
  const cfg = await loadPrismConfig(c.env.DB);
  if (!isPrismConfigured(cfg)) {
    return c.redirect("/login?error=prism_not_configured", 302);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const errParam = c.req.query("error");

  if (errParam) {
    return c.redirect(`/login?error=${encodeURIComponent(errParam)}`, 302);
  }
  if (!code || !state) {
    return c.redirect("/login?error=prism_invalid_callback", 302);
  }

  const stored = await consumePrismOAuthState(c.env.DB, state);
  if (!stored) {
    return c.redirect("/login?error=prism_state_expired", 302);
  }

  const client = buildPrismClient(cfg, c.env);

  let tokens;
  let info;
  try {
    tokens = await client.exchangeCode(code, stored.code_verifier);
    info = await client.getUserInfo(tokens.access_token);
  } catch (err) {
    const msg =
      err instanceof PrismError
        ? err.message
        : err instanceof Error
          ? err.message
          : "exchange failed";
    return c.redirect(
      `/login?error=${encodeURIComponent("prism_" + msg)}`,
      302,
    );
  }

  const sub = info.sub;
  const prismUsername = info.preferred_username || info.name || "";
  const localUsername = (prismUsername || `prism_${sub.slice(0, 8)}`)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 64);

  // Linking flow: a logged-in user explicitly linking their Prism account.
  if (stored.link_user_id) {
    // Make sure this Prism sub isn't already attached to a different user.
    const claimed = await getUserByPrismSub(c.env.DB, sub);
    if (claimed && claimed.id !== stored.link_user_id) {
      return c.redirect("/settings?error=prism_already_linked", 302);
    }
    await setUserPrismSub(c.env.DB, stored.link_user_id, sub);
    return c.redirect(stored.redirect_to ?? "/settings?prism=linked", 302);
  }

  // Login flow: find existing user by sub, then by username, else auto-provision
  let user = await getUserByPrismSub(c.env.DB, sub);

  if (!user && prismUsername) {
    const existing = await getUserByUsername(c.env.DB, prismUsername);
    if (existing && !existing.prism_sub) {
      await setUserPrismSub(c.env.DB, existing.id, sub);
      user = await getUserByPrismSub(c.env.DB, sub);
    }
  }

  if (!user && cfg.autoProvision) {
    const id = randomId();
    const now = Date.now();
    let attemptUsername = localUsername || `prism_${sub.slice(0, 8)}`;
    let attempt = 0;
    // Resolve username collisions by suffixing
    while (await getUserByUsername(c.env.DB, attemptUsername)) {
      attempt += 1;
      attemptUsername = `${localUsername}_${attempt}`;
      if (attempt > 20) break;
    }
    await c.env.DB.prepare(
      "INSERT INTO users (id,username,password_hash,role,disabled,totp_enabled,prism_sub,auth_source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(id, attemptUsername, null, "user", 0, 0, sub, "prism", now, now)
      .run();
    user = await getUserByPrismSub(c.env.DB, sub);
  }

  if (!user) {
    return c.redirect("/login?error=prism_no_account", 302);
  }
  if (user.disabled) {
    return c.redirect("/login?error=account_disabled", 302);
  }

  const sessionToken = await createSession(c.env.DB, user.id, false);
  setSessionCookie(c, sessionToken);

  return c.redirect(stored.redirect_to ?? "/", 302);
});

// POST /api/auth/prism/unlink — remove the Prism link from the current user.
prism.post("/unlink", requireAuth, async (c) => {
  const user = c.get("user");
  await setUserPrismSub(c.env.DB, user.id, null);
  return c.json({ ok: true });
});

export default prism;
