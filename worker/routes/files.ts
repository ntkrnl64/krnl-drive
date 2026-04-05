import { Hono } from "hono";
import { requireAuth } from "../middleware.ts";
import {
  listFiles,
  getFile,
  createFolder,
  updateFile,
  deleteFileRecord,
  createFile,
} from "../db.ts";
import type { Env, HonoCtxVars } from "../types.ts";

const files = new Hono<{ Bindings: Env; Variables: HonoCtxVars }>();

// GET /api/files?parentId=xxx
files.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  let parentId = c.req.query("parentId") ?? null;
  if (parentId === "null") parentId = null;
  // Enforce root folder restriction: redirect null to user's root
  if (parentId === null && user.root_folder_id) parentId = user.root_folder_id;
  const items = await listFiles(c.env.DB, parentId);
  return c.json({ items, effectiveRoot: user.root_folder_id ?? null });
});

// GET /api/files/:id
files.get("/:id", requireAuth, async (c) => {
  const file = await getFile(c.env.DB, c.req.param("id")!);
  if (!file) return c.json({ error: "Not found" }, 404);
  return c.json({ item: file });
});

// GET /api/files/:id/breadcrumb
files.get("/:id/breadcrumb", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const trail: { id: string; name: string }[] = [];
  let currentId: string | null = id;

  while (currentId) {
    const file = await getFile(c.env.DB, currentId);
    if (!file) break;
    trail.unshift({ id: file.id, name: file.name });
    currentId = file.parent_id;
  }

  return c.json({ breadcrumb: trail });
});

// POST /api/files/folder
files.post("/folder", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.role === "guest") return c.json({ error: "Forbidden" }, 403);

  const { name, parentId } = await c.req.json<{
    name: string;
    parentId?: string;
  }>();
  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

  if (parentId) {
    const parent = await getFile(c.env.DB, parentId);
    if (!parent || parent.type !== "folder")
      return c.json({ error: "Invalid parent" }, 400);
  }

  const folder = await createFolder(
    c.env.DB,
    name.trim(),
    parentId ?? null,
    user.id,
  );
  return c.json({ item: folder }, 201);
});

// DELETE /api/files/:id
files.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const file = await getFile(c.env.DB, c.req.param("id")!);
  if (!file) return c.json({ error: "Not found" }, 404);

  if (user.role !== "admin" && file.owner_id !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Collect all r2 keys to delete (recursively for folders)
  const r2Keys: string[] = [];
  await collectR2Keys(c.env.DB, file, r2Keys);

  // Delete from DB (CASCADE handles children)
  await deleteFileRecord(c.env.DB, file.id);

  // Delete from R2
  for (const key of r2Keys) {
    await c.env.BUCKET.delete(key).catch(() => {});
  }

  return c.json({ ok: true });
});

async function collectR2Keys(
  db: D1Database,
  file: Awaited<ReturnType<typeof getFile>>,
  keys: string[],
) {
  if (!file) return;
  if (file.type === "file" && file.r2_key) {
    keys.push(file.r2_key);
  } else if (file.type === "folder") {
    const children = await listFiles(db, file.id);
    for (const child of children) {
      await collectR2Keys(db, child, keys);
    }
  }
}

// PATCH /api/files/:id
files.patch("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const file = await getFile(c.env.DB, c.req.param("id")!);
  if (!file) return c.json({ error: "Not found" }, 404);

  if (user.role !== "admin" && file.owner_id !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ name?: string; parentId?: string | null }>();
  const updateObj: { name?: string; parent_id?: string | null } = {};
  if (body.name !== undefined) updateObj.name = body.name.trim();
  if ("parentId" in body) updateObj.parent_id = body.parentId ?? null;

  await updateFile(c.env.DB, file.id, updateObj);
  const updated = await getFile(c.env.DB, file.id);
  return c.json({ item: updated });
});

// GET /api/files/:id/download
files.get("/:id/download", requireAuth, async (c) => {
  const file = await getFile(c.env.DB, c.req.param("id")!);
  if (!file || file.type !== "file" || !file.r2_key)
    return c.json({ error: "Not found" }, 404);

  const obj = await c.env.BUCKET.get(file.r2_key);
  if (!obj) return c.json({ error: "File not found in storage" }, 404);

  const headers = new Headers();
  headers.set(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.name)}"`,
  );
  headers.set("Content-Type", file.mime_type ?? "application/octet-stream");
  headers.set("Content-Length", file.size.toString());
  headers.set("Cache-Control", "no-cache");

  return new Response(obj.body, { headers });
});

// POST /api/files/simple-upload (for small files < 100MB without chunking)
files.post("/simple-upload", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.role === "guest") return c.json({ error: "Forbidden" }, 403);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const parentId = formData.get("parentId") as string | null;

  if (!file) return c.json({ error: "No file provided" }, 400);

  if (parentId) {
    const parent = await getFile(c.env.DB, parentId);
    if (!parent || parent.type !== "folder")
      return c.json({ error: "Invalid parent" }, 400);
  }

  const r2Key = `files/${crypto.randomUUID()}`;
  const arrayBuffer = await file.arrayBuffer();

  await c.env.BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const fileItem = await createFile(
    c.env.DB,
    file.name,
    parentId,
    user.id,
    file.size,
    file.type || null,
    r2Key,
  );

  return c.json({ item: fileItem }, 201);
});

// POST /api/files/:id/copy
files.post("/:id/copy", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.role === "guest") return c.json({ error: "Forbidden" }, 403);

  const fileToCopy = await getFile(c.env.DB, c.req.param("id")!);
  if (!fileToCopy) return c.json({ error: "Not found" }, 404);

  const { parentId } = await c.req.json<{ parentId?: string | null }>();

  if (parentId) {
    const parent = await getFile(c.env.DB, parentId);
    if (!parent || parent.type !== "folder")
      return c.json({ error: "Invalid parent" }, 400);
  }

  // Prevent copying a folder into itself
  let currentParent = parentId;
  while (currentParent) {
    if (currentParent === fileToCopy.id)
      return c.json({ error: "Cannot copy a folder into itself" }, 400);
    const parentFolder = await getFile(c.env.DB, currentParent);
    currentParent = parentFolder?.parent_id ?? null;
  }

  const copyRecursive = async (
    sourceFile: Awaited<ReturnType<typeof getFile>>,
    targetParentId: string | null,
  ): Promise<Awaited<ReturnType<typeof getFile>>> => {
    if (!sourceFile) throw new Error("File not found");

    if (sourceFile.type === "file" && sourceFile.r2_key) {
      const r2Key = `files/${crypto.randomUUID()}`;
      const obj = await c.env.BUCKET.get(sourceFile.r2_key);
      if (obj) {
        await c.env.BUCKET.put(r2Key, obj.body, {
          httpMetadata: obj.httpMetadata,
        });
      }
      return await createFile(
        c.env.DB,
        sourceFile.name,
        targetParentId,
        user.id,
        sourceFile.size,
        sourceFile.mime_type,
        r2Key,
      );
    } else if (sourceFile.type === "folder") {
      const newFolder = await createFolder(
        c.env.DB,
        sourceFile.name,
        targetParentId,
        user.id,
      );
      const children = await listFiles(c.env.DB, sourceFile.id);
      for (const child of children) {
        await copyRecursive(child, newFolder.id);
      }
      return newFolder;
    }
    throw new Error("Invalid file type");
  };

  try {
    const newItem = await copyRecursive(fileToCopy, parentId ?? null);
    return c.json({ item: newItem }, 201);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

export default files;
