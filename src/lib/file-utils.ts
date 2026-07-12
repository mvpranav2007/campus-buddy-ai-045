import {
  FileText,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  FileType,
  type LucideIcon,
} from "lucide-react";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "txt",
  "zip",
] as const;

export const ALLOWED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export type FileValidationError =
  | { kind: "empty" }
  | { kind: "too_large"; maxBytes: number; actualBytes: number }
  | { kind: "unsupported_type"; ext: string; mime: string };

export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function validateFile(file: File): FileValidationError | null {
  if (file.size === 0) return { kind: "empty" };
  if (file.size > MAX_FILE_BYTES)
    return { kind: "too_large", maxBytes: MAX_FILE_BYTES, actualBytes: file.size };
  const ext = getExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const mimeOk = mime === "" || ALLOWED_MIME_TYPES.includes(mime);
  if (!extOk || !mimeOk) return { kind: "unsupported_type", ext, mime };
  return null;
}

export function formatValidationError(err: FileValidationError): string {
  switch (err.kind) {
    case "empty":
      return "That file is empty.";
    case "too_large":
      return `File is too large (${formatFileSize(err.actualBytes)}). Max size is ${formatFileSize(err.maxBytes)}.`;
    case "unsupported_type":
      return `Unsupported file type “.${err.ext || "unknown"}”. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
}

export function sanitizeFilename(name: string): string {
  // Strip path pieces, replace unsafe chars, collapse repeats, trim leading dots.
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 180) : "file";
}

export function buildStoragePath(
  senderId: string,
  conversationId: string,
  filename: string,
): string {
  const safe = sanitizeFilename(filename);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${senderId}/${conversationId}/${stamp}-${rand}-${safe}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

export function fileIconFor(mime: string | null | undefined, name: string | null | undefined): LucideIcon {
  const m = (mime ?? "").toLowerCase();
  const ext = getExtension(name ?? "");
  if (m.startsWith("image/")) return FileImage;
  if (m === "application/pdf" || ext === "pdf") return FileType;
  if (
    m === "application/msword" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "doc" ||
    ext === "docx"
  )
    return FileText;
  if (
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xls" ||
    ext === "xlsx"
  )
    return FileSpreadsheet;
  if (
    m === "application/vnd.ms-powerpoint" ||
    m === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "ppt" ||
    ext === "pptx"
  )
    return Presentation;
  if (m === "application/zip" || m === "application/x-zip-compressed" || ext === "zip") return FileArchive;
  return FileIcon;
}

export function fileColorFor(mime: string | null | undefined, name: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  const ext = getExtension(name ?? "");
  if (m.startsWith("image/")) return "text-emerald-500";
  if (m === "application/pdf" || ext === "pdf") return "text-red-500";
  if (ext === "doc" || ext === "docx" || m.includes("word")) return "text-blue-500";
  if (ext === "xls" || ext === "xlsx" || m.includes("excel") || m.includes("spreadsheet")) return "text-green-600";
  if (ext === "ppt" || ext === "pptx" || m.includes("powerpoint") || m.includes("presentation")) return "text-orange-500";
  if (ext === "zip" || m.includes("zip")) return "text-amber-500";
  return "text-muted-foreground";
}