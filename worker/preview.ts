import type { Context } from "hono";
import type { Env, FileItem, HonoCtxVars } from "./types.ts";

// File types that the browser would render as a live document (running
// embedded scripts and fetching subresources from our origin). When a user
// opens the inline-preview URL of one of these, we serve it as text/plain so
// a malicious upload can't execute scripts in our origin's context.
const SCRIPT_RISKY_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/svg+xml",
  "text/xml",
  "application/xml",
]);
const SCRIPT_RISKY_EXTS = new Set(["html", "htm", "xhtml", "svg", "svgz"]);

function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function safeContentType(file: FileItem): string {
  const raw = (file.mime_type ?? "application/octet-stream")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (SCRIPT_RISKY_MIMES.has(raw)) return "text/plain; charset=utf-8";
  if (SCRIPT_RISKY_EXTS.has(getExt(file.name)))
    return "text/plain; charset=utf-8";
  return file.mime_type ?? "application/octet-stream";
}

// Stream an R2-backed file inline (Content-Disposition: inline) with HTTP Range
// support so browsers can seek video/audio.
export async function streamInline(
  c: Context<{ Bindings: Env; Variables: HonoCtxVars }>,
  file: FileItem,
): Promise<Response> {
  if (file.type !== "file" || !file.r2_key) {
    return c.json({ error: "Not found" }, 404);
  }

  const rangeHeader = c.req.header("range");
  let r2Range: R2Range | undefined;
  let status = 200;
  let contentLength = file.size;
  let contentRange: string | undefined;

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m) {
      const startStr = m[1];
      const endStr = m[2];
      let start: number;
      let end: number;
      if (startStr === "" && endStr !== "") {
        // suffix range: last N bytes
        const suffix = parseInt(endStr, 10);
        start = Math.max(0, file.size - suffix);
        end = file.size - 1;
      } else {
        start = startStr ? parseInt(startStr, 10) : 0;
        end = endStr ? parseInt(endStr, 10) : file.size - 1;
      }
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        start >= file.size
      ) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${file.size}` },
        });
      }
      end = Math.min(end, file.size - 1);
      r2Range = { offset: start, length: end - start + 1 };
      status = 206;
      contentLength = end - start + 1;
      contentRange = `bytes ${start}-${end}/${file.size}`;
    }
  }

  const obj = await c.env.BUCKET.get(file.r2_key, { range: r2Range });
  if (!obj) return c.json({ error: "Not found in storage" }, 404);

  const headers = new Headers();
  headers.set(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  headers.set("Content-Type", safeContentType(file));
  headers.set("Content-Length", contentLength.toString());
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  if (contentRange) headers.set("Content-Range", contentRange);

  // Defense-in-depth XSS hardening for inline-served user content:
  //   - sandbox CSP makes the browser treat the response as a unique opaque
  //     origin when rendered as a document, disabling scripts/forms even if
  //     the Content-Type slips through as something executable.
  //   - nosniff blocks the browser from MIME-sniffing risky types out of
  //     bytes that look like HTML.
  //   - SAMEORIGIN on framing keeps the inline preview out of attacker pages.
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");

  return new Response(obj.body, { status, headers });
}
