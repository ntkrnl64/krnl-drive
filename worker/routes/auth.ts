import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  verifyPassword,
  hashPassword,
  generateTOTPSecret,
  verifyTOTP,
  buildTOTPUri,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "../crypto.ts";
import {
  getUserByUsername,
  getUserById,
  createSession,
  getSession,
  deleteSession,
  promoteSession,
  getUnusedRecoveryCodes,
  markRecoveryCodeUsed,
  saveRecoveryCodes,
  saveChallenge,
  consumeChallenge,
  getPasskeysByUser,
  getPasskeyByCredentialId,
  savePasskey,
  updatePasskeyCounter,
  deletePasskey,
} from "../db.ts";
import { SESSION_COOKIE } from "../middleware.ts";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Env, HonoCtxVars } from "../types.ts";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

const auth = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

// POST /api/auth/guest — auto-login as guest (no password required)
auth.post("/guest", async (c) => {
  const user = await getUserByUsername(c.env.DB, "guest");
  if (!user || user.disabled || user.role !== "guest")
    return c.json({ user: null });
  const token = await createSession(c.env.DB, user.id, false);
  setSessionCookie(c, token);
  const { password_hash: _, totp_secret: __, ...safeUser } = user;
  return c.json({ user: safeUser });
});

// POST /api/auth/login
auth.post("/login", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password?: string;
  }>();
  if (!username) return c.json({ error: "Missing credentials" }, 400);

  const user = await getUserByUsername(c.env.DB, username);
  if (!user || user.disabled)
    return c.json({ error: "Invalid credentials" }, 401);

  if (user.password_hash === null) {
    if (password) return c.json({ error: "Invalid credentials" }, 401);
  } else {
    if (!password) return c.json({ error: "Invalid credentials" }, 401);
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);
  }

  if (user.totp_enabled) {
    const pendingToken = await createSession(c.env.DB, user.id, true);
    setSessionCookie(c, pendingToken);
    return c.json({ requiresTwoFactor: true, methods: ["totp", "recovery"] });
  }

  const token = await createSession(c.env.DB, user.id, false);
  setSessionCookie(c, token);
  const { password_hash: _, totp_secret: __, ...safeUser } = user;
  return c.json({ user: safeUser });
});

// POST /api/auth/verify-totp
auth.post("/verify-totp", async (c) => {
  const cookieToken = getCookie(c, SESSION_COOKIE);
  if (!cookieToken) return c.json({ error: "No session" }, 401);

  const session = await getSession(c.env.DB, cookieToken);
  if (!session || !session.pending_2fa)
    return c.json({ error: "Invalid session" }, 401);

  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "Missing code" }, 400);

  const baseUser = await getUserById(c.env.DB, session.user_id);
  if (!baseUser) return c.json({ error: "User not found" }, 404);

  const fullUser = await getUserByUsername(c.env.DB, baseUser.username);
  if (!fullUser?.totp_secret)
    return c.json({ error: "TOTP not configured" }, 400);

  const valid = await verifyTOTP(fullUser.totp_secret, code.replace(/\s/g, ""));
  if (!valid) return c.json({ error: "Invalid code" }, 401);

  await promoteSession(c.env.DB, cookieToken);
  const { password_hash: _, totp_secret: __, ...safeUser } = fullUser;
  return c.json({ user: safeUser });
});

// POST /api/auth/verify-recovery
auth.post("/verify-recovery", async (c) => {
  const cookieToken = getCookie(c, SESSION_COOKIE);
  if (!cookieToken) return c.json({ error: "No session" }, 401);

  const session = await getSession(c.env.DB, cookieToken);
  if (!session || !session.pending_2fa)
    return c.json({ error: "Invalid session" }, 401);

  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "Missing code" }, 400);

  const codes = await getUnusedRecoveryCodes(c.env.DB, session.user_id);
  let matchId: string | null = null;
  for (const rc of codes) {
    if (await verifyRecoveryCode(code, rc.code_hash)) {
      matchId = rc.id;
      break;
    }
  }
  if (!matchId) return c.json({ error: "Invalid recovery code" }, 401);

  await markRecoveryCodeUsed(c.env.DB, matchId);
  await promoteSession(c.env.DB, cookieToken);

  const user = await getUserById(c.env.DB, session.user_id);
  return c.json({ user });
});

// POST /api/auth/logout
auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await deleteSession(c.env.DB, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// GET /api/auth/me
auth.get("/me", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ user: null });

  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa) return c.json({ user: null });

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user || user.disabled) return c.json({ user: null });

  return c.json({ user });
});

// PATCH /api/auth/me
auth.patch("/me", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user || user.disabled) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{
    defaultShareTitle?: string | null;
    defaultShareDescription?: string | null;
    avatarUrl?: string | null;
  }>();
  const sets: string[] = [];
  const setVals: unknown[] = [];
  if ("defaultShareTitle" in body) {
    sets.push("default_share_title=?");
    setVals.push(body.defaultShareTitle ?? null);
  }
  if ("defaultShareDescription" in body) {
    sets.push("default_share_description=?");
    setVals.push(body.defaultShareDescription ?? null);
  }
  if ("avatarUrl" in body) {
    sets.push("avatar_url=?");
    setVals.push(body.avatarUrl ?? null);
  }

  if (sets.length > 0) {
    sets.push("updated_at=?");
    setVals.push(Date.now());
    setVals.push(user.id);
    await c.env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`)
      .bind(...setVals)
      .run();
  }

  const updatedUser = await getUserById(c.env.DB, user.id);
  return c.json({ user: updatedUser });
});

// POST /api/auth/change-password
auth.post("/change-password", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();
  const hash = newPassword ? await hashPassword(newPassword) : null;

  const fullUser = await (async () => {
    const u = await getUserById(c.env.DB, session.user_id);
    if (!u) return null;
    return getUserByUsername(c.env.DB, u.username);
  })();
  if (!fullUser) return c.json({ error: "User not found" }, 404);

  if (fullUser.password_hash) {
    const valid = await verifyPassword(currentPassword, fullUser.password_hash);
    if (!valid) return c.json({ error: "Current password is incorrect" }, 401);
  }

  await c.env.DB.prepare(
    "UPDATE users SET password_hash=?,updated_at=? WHERE id=?",
  )
    .bind(hash, Date.now(), session.user_id)
    .run();

  return c.json({ ok: true });
});

// ─── TOTP Setup ──────────────────────────────────────────────────────────────

// POST /api/auth/totp/setup
auth.post("/totp/setup", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user) return c.json({ error: "User not found" }, 404);

  const secret = generateTOTPSecret();
  const uri = buildTOTPUri(secret, user.username);

  // Store temporarily
  await c.env.DB.prepare("UPDATE users SET totp_secret=? WHERE id=?")
    .bind(secret, user.id)
    .run();

  return c.json({ secret, uri });
});

// POST /api/auth/totp/verify-setup
auth.post("/totp/verify-setup", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const { code } = await c.req.json<{ code: string }>();
  const fullUser = await (async () => {
    const u = await getUserById(c.env.DB, session.user_id);
    if (!u) return null;
    return getUserByUsername(c.env.DB, u.username);
  })();
  if (!fullUser?.totp_secret) return c.json({ error: "TOTP not set up" }, 400);

  const valid = await verifyTOTP(fullUser.totp_secret, code.replace(/\s/g, ""));
  if (!valid) return c.json({ error: "Invalid code" }, 401);

  await c.env.DB.prepare(
    "UPDATE users SET totp_enabled=1,updated_at=? WHERE id=?",
  )
    .bind(Date.now(), session.user_id)
    .run();

  // Generate recovery codes
  const plainCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = generateRecoveryCode();
    plainCodes.push(code);
    hashes.push(await hashRecoveryCode(code));
  }
  await saveRecoveryCodes(c.env.DB, session.user_id, hashes);

  return c.json({ recoveryCodes: plainCodes });
});

// POST /api/auth/totp/disable
auth.post("/totp/disable", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const { code } = await c.req.json<{ code: string }>();
  const fullUser = await (async () => {
    const u = await getUserById(c.env.DB, session.user_id);
    if (!u) return null;
    return getUserByUsername(c.env.DB, u.username);
  })();
  if (!fullUser?.totp_secret) return c.json({ error: "TOTP not enabled" }, 400);

  const valid = await verifyTOTP(fullUser.totp_secret, code.replace(/\s/g, ""));
  if (!valid) return c.json({ error: "Invalid code" }, 401);

  await c.env.DB.prepare(
    "UPDATE users SET totp_enabled=0,totp_secret=NULL,updated_at=? WHERE id=?",
  )
    .bind(Date.now(), session.user_id)
    .run();
  await c.env.DB.prepare("DELETE FROM recovery_codes WHERE user_id=?")
    .bind(session.user_id)
    .run();

  return c.json({ ok: true });
});

// POST /api/auth/recovery-codes/regenerate
auth.post("/recovery-codes/regenerate", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const plainCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = generateRecoveryCode();
    plainCodes.push(code);
    hashes.push(await hashRecoveryCode(code));
  }
  await saveRecoveryCodes(c.env.DB, session.user_id, hashes);

  return c.json({ codes: plainCodes });
});

// ─── Passkeys ────────────────────────────────────────────────────────────────

// POST /api/auth/passkey/register/begin
auth.post("/passkey/register/begin", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const user = await getUserById(c.env.DB, session.user_id);
  if (!user) return c.json({ error: "User not found" }, 404);

  const existingPasskeys = await getPasskeysByUser(c.env.DB, user.id);
  const options = await generateRegistrationOptions({
    rpName: "KRNL Drive",
    rpID: new URL(c.env.ORIGIN).hostname,
    userID: new TextEncoder().encode(
      user.id,
    ) as unknown as Uint8Array<ArrayBuffer>,
    userName: user.username,
    userDisplayName: user.username,
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.credential_id,
      transports: pk.transports
        ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const challengeId = await saveChallenge(
    c.env.DB,
    user.id,
    options.challenge,
    "register",
  );
  return c.json({ options, challengeId });
});

// POST /api/auth/passkey/register/complete
auth.post("/passkey/register/complete", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const { challengeId, response, name } = await c.req.json<{
    challengeId: string;
    response: unknown;
    name?: string;
  }>();
  const challengeData = await consumeChallenge(c.env.DB, challengeId);
  if (!challengeData || challengeData.user_id !== session.user_id)
    return c.json({ error: "Invalid challenge" }, 400);

  const origin = c.env.ORIGIN;
  const rpID = new URL(origin).hostname;

  try {
    const verification = await verifyRegistrationResponse({
      response: response as Parameters<
        typeof verifyRegistrationResponse
      >[0]["response"],
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: "Verification failed" }, 400);
    }

    const { credential } = verification.registrationInfo;
    const transports = (response as { response?: { transports?: string[] } })
      .response?.transports;

    await savePasskey(
      c.env.DB,
      session.user_id,
      credential.id,
      Buffer.from(credential.publicKey).toString("base64"),
      credential.counter,
      name || "Passkey",
      transports ? JSON.stringify(transports) : null,
    );

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: "Verification failed" }, 400);
  }
});

// POST /api/auth/passkey/authenticate/begin
auth.post("/passkey/authenticate/begin", async (c) => {
  const { username } = await c.req
    .json<{ username?: string }>()
    .catch(() => ({ username: undefined }));

  let userId: string | null = null;
  let allowCredentials: {
    id: string;
    transports?: AuthenticatorTransportFuture[];
  }[] = [];

  if (username) {
    const user = await getUserByUsername(c.env.DB, username);
    if (user && !user.disabled) {
      userId = user.id;
      const passkeys = await getPasskeysByUser(c.env.DB, user.id);
      allowCredentials = passkeys.map((pk) => ({
        id: pk.credential_id,
        transports: pk.transports
          ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
          : undefined,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: new URL(c.env.ORIGIN).hostname,
    allowCredentials,
    userVerification: "preferred",
  });

  const challengeId = await saveChallenge(
    c.env.DB,
    userId,
    options.challenge,
    "authenticate",
  );
  return c.json({ options, challengeId });
});

// POST /api/auth/passkey/authenticate/complete
auth.post("/passkey/authenticate/complete", async (c) => {
  const { challengeId, response } = await c.req.json<{
    challengeId: string;
    response: unknown;
  }>();
  const challengeData = await consumeChallenge(c.env.DB, challengeId);
  if (!challengeData) return c.json({ error: "Invalid challenge" }, 400);

  const credentialId = (response as { id: string }).id;
  const passkey = await getPasskeyByCredentialId(c.env.DB, credentialId);
  if (!passkey) return c.json({ error: "Passkey not found" }, 404);

  // Verify the user isn't disabled
  const user = await getUserById(c.env.DB, passkey.user_id);
  if (!user || user.disabled) return c.json({ error: "Unauthorized" }, 401);

  const origin = c.env.ORIGIN;
  const rpID = new URL(origin).hostname;

  try {
    const verification = await verifyAuthenticationResponse({
      response: response as Parameters<
        typeof verifyAuthenticationResponse
      >[0]["response"],
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, "base64"),
        counter: passkey.counter,
        transports: passkey.transports
          ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });

    if (!verification.verified)
      return c.json({ error: "Verification failed" }, 401);
    await updatePasskeyCounter(
      c.env.DB,
      passkey.id,
      verification.authenticationInfo.newCounter,
    );

    const sessionToken = await createSession(c.env.DB, passkey.user_id, false);
    setSessionCookie(c, sessionToken);

    return c.json({ user });
  } catch (e) {
    return c.json({ error: "Verification failed" }, 401);
  }
});

// GET /api/auth/passkeys
auth.get("/passkeys", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const passkeys = await getPasskeysByUser(c.env.DB, session.user_id);
  return c.json({
    passkeys: passkeys.map(({ public_key: _, ...pk }) => pk),
  });
});

// DELETE /api/auth/passkeys/:id
auth.delete("/passkeys/:id", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const session = await getSession(c.env.DB, token);
  if (!session || session.pending_2fa)
    return c.json({ error: "Unauthorized" }, 401);

  const { id } = c.req.param();
  const passkey = await c.env.DB.prepare(
    "SELECT * FROM passkeys WHERE id=? AND user_id=?",
  )
    .bind(id, session.user_id)
    .first<{ id: string }>();
  if (!passkey) return c.json({ error: "Not found" }, 404);

  await deletePasskey(c.env.DB, id);
  return c.json({ ok: true });
});

export default auth;
