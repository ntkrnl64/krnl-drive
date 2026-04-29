export type PreviewType = "image" | "video" | "audio" | "pdf" | "text" | null;

// Extension → preview type. Used as a fallback when the stored mime_type is
// missing, generic (application/octet-stream), or browsers disagree on what
// audio/video container an extension implies (.ogg in particular is ambiguous
// between audio and video — we treat it as audio because the vast majority of
// .ogg files in the wild are Vorbis/Opus audio).
const EXT_TO_TYPE: Record<string, PreviewType> = {
  // Image
  jpg: "image",
  jpeg: "image",
  jpe: "image",
  png: "image",
  apng: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  dib: "image",
  ico: "image",
  cur: "image",
  tif: "image",
  tiff: "image",
  heic: "image",
  heif: "image",
  jfif: "image",

  // Audio (note: .ogg → audio; .ogv → video)
  mp3: "audio",
  wav: "audio",
  wave: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  weba: "audio",
  mid: "audio",
  midi: "audio",
  aiff: "audio",
  aif: "audio",

  // Video
  mp4: "video",
  m4v: "video",
  webm: "video",
  ogv: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  "3gp": "video",
  "3g2": "video",

  // PDF
  pdf: "pdf",
};

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "rst",
  "log",
  "csv",
  "tsv",
  "json",
  "json5",
  "jsonc",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "cfg",
  "env",
  "properties",
  // HTML / SVG go to text — see SCRIPT_RISKY below
  "html",
  "htm",
  "xhtml",
  "svg",
  "css",
  "scss",
  "sass",
  "less",
  "styl",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "vue",
  "svelte",
  "py",
  "pyi",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "kts",
  "scala",
  "c",
  "h",
  "cc",
  "cpp",
  "cxx",
  "hh",
  "hpp",
  "hxx",
  "cs",
  "php",
  "swift",
  "m",
  "mm",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "psm1",
  "bat",
  "cmd",
  "sql",
  "graphql",
  "gql",
  "proto",
  "lua",
  "perl",
  "pl",
  "r",
  "dart",
  "ex",
  "exs",
  "erl",
  "tex",
  "diff",
  "patch",
  "lock",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "dockerfile",
  "makefile",
  "cmake",
  "srt",
  "vtt",
  "sub",
]);

// Mime types and extensions that the browser would otherwise render as a live
// document (running embedded scripts, fetching subresources, etc.). We force
// these to render as plain text so a malicious upload can't execute scripts in
// our origin even if a user opens the inline preview.
const SCRIPT_RISKY_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/svg+xml",
  "text/xml",
  "application/xml",
]);
const SCRIPT_RISKY_EXTS = new Set(["html", "htm", "xhtml", "svg", "svgz"]);

function getExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function isScriptRisky(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  const m = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (SCRIPT_RISKY_MIMES.has(m)) return true;
  return SCRIPT_RISKY_EXTS.has(getExt(filename));
}

export function getPreviewType(
  mimeType: string | null | undefined,
  filename: string,
): PreviewType {
  // 1. Anything that could execute scripts in our origin → render as text.
  if (isScriptRisky(mimeType, filename)) return "text";

  const m = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  const ext = getExt(filename);
  const base = filename.toLowerCase();

  // 2. MIME-based detection (trustworthy when present).
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m === "application/ogg") return EXT_TO_TYPE[ext] ?? "audio";
  if (m.startsWith("text/")) return "text";
  if (
    m === "application/json" ||
    m === "application/javascript" ||
    m === "application/ecmascript" ||
    m === "application/x-yaml" ||
    m === "application/x-sh" ||
    m === "application/x-toml"
  ) {
    return "text";
  }

  // 3. Extension fallback (covers missing or generic application/octet-stream).
  if (ext && EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
  if (ext && TEXT_EXTENSIONS.has(ext)) return "text";
  if (base === "dockerfile" || base === "makefile") return "text";

  return null;
}

export function isPreviewable(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  return getPreviewType(mimeType, filename) !== null;
}
