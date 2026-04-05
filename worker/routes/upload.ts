import { Hono } from "hono";
import { requireAuth } from "../middleware.ts";
import {
  createUploadSession,
  getUploadSession,
  updateUploadSession,
  deleteUploadSession,
  createFile,
  getSetting,
} from "../db.ts";
import type { Env, HonoCtxVars } from "../types.ts";

const upload = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/upload/init
upload.post("/init", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.role === "guest") return c.json({ error: "Forbidden" }, 403);

  const { filename, parentId, size, mimeType } = await c.req.json<{
    filename: string;
    parentId?: string | null;
    size: number;
    mimeType?: string;
  }>();

  if (!filename || !size)
    return c.json({ error: "filename and size are required" }, 400);

  const chunkSizeSetting = await getSetting(c.env.DB, "chunk_size");
  const chunkSize = chunkSizeSetting
    ? parseInt(chunkSizeSetting)
    : DEFAULT_CHUNK_SIZE;
  const r2Key = `files/${crypto.randomUUID()}`;

  // Initiate R2 multipart upload
  const multipart = await c.env.BUCKET.createMultipartUpload(r2Key, {
    httpMetadata: { contentType: mimeType || "application/octet-stream" },
    customMetadata: { filename, owner: user.id },
  });

  const session = await createUploadSession(
    c.env.DB,
    user.id,
    filename,
    parentId ?? null,
    size,
    chunkSize,
    r2Key,
  );

  await updateUploadSession(c.env.DB, session.id, {
    r2_upload_id: multipart.uploadId,
  });

  return c.json({
    sessionId: session.id,
    chunkSize,
    totalChunks: session.total_chunks,
  });
});

// GET /api/upload/pending — list resumable sessions for current user
upload.get("/pending", requireAuth, async (c) => {
  const user = c.get("user");
  const rows = await c.env.DB.prepare(
    `SELECT id, filename, parent_id, total_size, chunk_size, total_chunks, uploaded_chunks, status, created_at
     FROM upload_sessions WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all();
  const sessions = (rows.results ?? []).map((r: Record<string, unknown>) => ({
    sessionId: r.id as string,
    filename: r.filename as string,
    parentId: r.parent_id as string | null,
    totalSize: r.total_size as number,
    chunkSize: r.chunk_size as number,
    totalChunks: r.total_chunks as number,
    uploadedChunks: JSON.parse(r.uploaded_chunks as string) as number[],
    createdAt: r.created_at as number,
  }));
  return c.json({ sessions });
});

// PUT /api/upload/:sessionId/chunk/:chunkIndex
upload.put("/:sessionId/chunk/:chunkIndex", requireAuth, async (c) => {
  const user = c.get("user");
  const { sessionId, chunkIndex } = c.req.param();
  const chunkIdx = parseInt(chunkIndex);

  const session = await getUploadSession(c.env.DB, sessionId);
  if (!session) return c.json({ error: "Upload session not found" }, 404);
  if (session.user_id !== user.id) return c.json({ error: "Forbidden" }, 403);
  if (session.status !== "pending")
    return c.json({ error: "Upload already completed or failed" }, 400);
  if (!session.r2_upload_id)
    return c.json({ error: "Upload not initialized" }, 400);

  const uploadedChunks: number[] = JSON.parse(session.uploaded_chunks);
  if (uploadedChunks.includes(chunkIdx)) {
    return c.json({ ok: true, chunkIndex: chunkIdx }); // Already uploaded
  }

  if (chunkIdx < 0 || chunkIdx >= session.total_chunks) {
    return c.json({ error: "Invalid chunk index" }, 400);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: "Empty chunk" }, 400);

  const multipart = c.env.BUCKET.resumeMultipartUpload(
    session.r2_key,
    session.r2_upload_id,
  );
  const part = await multipart.uploadPart(chunkIdx + 1, body); // R2 parts are 1-indexed

  const parts: { partNumber: number; etag: string }[] = JSON.parse(
    session.parts,
  );
  parts.push({ partNumber: chunkIdx + 1, etag: part.etag });
  parts.sort((a, b) => a.partNumber - b.partNumber);

  uploadedChunks.push(chunkIdx);

  await updateUploadSession(c.env.DB, sessionId, {
    uploaded_chunks: JSON.stringify(uploadedChunks),
    parts: JSON.stringify(parts),
  });

  return c.json({ ok: true, chunkIndex: chunkIdx });
});

// GET /api/upload/:sessionId/status
upload.get("/:sessionId/status", requireAuth, async (c) => {
  const user = c.get("user");
  const session = await getUploadSession(c.env.DB, c.req.param("sessionId")!);
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.user_id !== user.id) return c.json({ error: "Forbidden" }, 403);

  const uploadedChunks: number[] = JSON.parse(session.uploaded_chunks);
  return c.json({
    sessionId: session.id,
    status: session.status,
    totalChunks: session.total_chunks,
    uploadedChunks,
    progress: Math.round((uploadedChunks.length / session.total_chunks) * 100),
  });
});

// POST /api/upload/:sessionId/complete
upload.post("/:sessionId/complete", requireAuth, async (c) => {
  const user = c.get("user");
  const session = await getUploadSession(c.env.DB, c.req.param("sessionId")!);
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.user_id !== user.id) return c.json({ error: "Forbidden" }, 403);
  if (session.status !== "pending")
    return c.json({ error: "Upload not in pending state" }, 400);
  if (!session.r2_upload_id)
    return c.json({ error: "Upload not initialized" }, 400);

  const uploadedChunks: number[] = JSON.parse(session.uploaded_chunks);
  if (uploadedChunks.length !== session.total_chunks) {
    return c.json(
      {
        error: `Not all chunks uploaded. Expected ${session.total_chunks}, got ${uploadedChunks.length}`,
      },
      400,
    );
  }

  const parts: { partNumber: number; etag: string }[] = JSON.parse(
    session.parts,
  );
  const multipart = c.env.BUCKET.resumeMultipartUpload(
    session.r2_key,
    session.r2_upload_id,
  );

  try {
    await multipart.complete(parts);
  } catch (e) {
    await updateUploadSession(c.env.DB, session.id, { status: "failed" });
    return c.json({ error: "Failed to complete multipart upload" }, 500);
  }

  // Get the object metadata to confirm size
  const obj = await c.env.BUCKET.head(session.r2_key);
  const size = obj?.size ?? session.total_size;

  // Create file record in DB
  const mimeType = obj?.httpMetadata?.contentType ?? null;
  const fileItem = await createFile(
    c.env.DB,
    session.filename,
    session.parent_id,
    session.user_id,
    size,
    mimeType,
    session.r2_key,
  );

  await updateUploadSession(c.env.DB, session.id, { status: "completed" });
  await deleteUploadSession(c.env.DB, session.id);

  return c.json({ file: fileItem });
});

// DELETE /api/upload/:sessionId (abort)
upload.delete("/:sessionId", requireAuth, async (c) => {
  const user = c.get("user");
  const session = await getUploadSession(c.env.DB, c.req.param("sessionId")!);
  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.user_id !== user.id) return c.json({ error: "Forbidden" }, 403);

  if (session.r2_upload_id && session.status === "pending") {
    const multipart = c.env.BUCKET.resumeMultipartUpload(
      session.r2_key,
      session.r2_upload_id,
    );
    await multipart.abort().catch(() => {});
  }

  await deleteUploadSession(c.env.DB, session.id);
  return c.json({ ok: true });
});

export default upload;
