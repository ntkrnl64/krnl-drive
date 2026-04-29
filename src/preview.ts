export type PreviewType = "image" | "video" | "audio" | "pdf" | "text" | null;

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
  "html",
  "htm",
  "xhtml",
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
]);

export function getPreviewType(
  mimeType: string | null | undefined,
  filename: string,
): PreviewType {
  const m = (mimeType ?? "").toLowerCase();

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("text/")) return "text";
  if (
    m === "application/json" ||
    m === "application/xml" ||
    m === "application/javascript" ||
    m === "application/ecmascript" ||
    m === "application/x-yaml" ||
    m === "application/x-sh" ||
    m === "application/x-toml"
  ) {
    return "text";
  }

  // Fall back to extension when MIME is missing or generic
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
  const base = filename.toLowerCase();
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
