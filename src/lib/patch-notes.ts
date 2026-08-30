/**
 * Patch notes parsing / rendering — pure helpers (no Vite glob).
 * Markdown under repo-root `patch-notes/` is the source of truth.
 */

export type PatchNoteMeta = {
  slug: string;
  title: string;
  date: string;
  summary: string;
};

export type PatchNote = PatchNoteMeta & {
  body: string;
};

const NOTE_FILENAME_RE = /^\d{4}-\d{2}-\d{2}-.+\.md$/i;

function parseFrontmatter(raw: string): {
  title: string;
  date: string;
  summary: string;
  body: string;
} {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) {
    throw new Error("patch note missing YAML frontmatter");
  }
  const yaml = match[1]!;
  const body = match[2]!.trim();
  const fields: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  const title = fields.title?.trim();
  const date = fields.date?.trim();
  const summary = fields.summary?.trim();
  if (!title || !date || !summary) {
    throw new Error("patch note frontmatter requires title, date, summary");
  }
  if (!isValidCalendarDate(date)) {
    throw new Error(`patch note date must be a valid YYYY-MM-DD (got ${date})`);
  }
  return { title, date, summary, body };
}

/** YYYY-MM-DD that actually exists on the calendar (rejects 2026-02-31, etc.). */
function isValidCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  if (y == null || m == null || d == null) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Filename `2026-08-11-roster-hotfix.md` → slug `2026-08-11-roster-hotfix`. */
export function slugFromFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  return base.replace(/\.md$/i, "");
}

export function isPatchNoteFilename(filename: string): boolean {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  return NOTE_FILENAME_RE.test(base);
}

export function parsePatchNoteMarkdown(
  filename: string,
  raw: string,
): PatchNote {
  const { title, date, summary, body } = parseFrontmatter(raw);
  return {
    slug: slugFromFilename(filename),
    title,
    date,
    summary,
    body,
  };
}

/**
 * Minimal markdown → HTML for trusted author content (patch notes only).
 * Supports paragraphs, ATX h2/h3, unordered/ordered lists, links, bold, italic, code.
 */
export function renderPatchNoteBody(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const inline = (text: string): string => {
    let s = escapeHtml(text);
    s = s.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>',
    );
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  };

  const isListStart = (line: string) =>
    /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
  const isBlockBoundary = (line: string) =>
    /^#{2,3}\s/.test(line) || isListStart(line);

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(
          `<li>${inline(lines[i]!.replace(/^[-*]\s+/, "").trim())}</li>`,
        );
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const startMatch = /^(\d+)[.)]\s+/.exec(line);
      const start = Number.parseInt(startMatch?.[1] ?? "1", 10);
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i]!)) {
        items.push(
          `<li>${inline(lines[i]!.replace(/^\d+[.)]\s+/, "").trim())}</li>`,
        );
        i += 1;
      }
      const startAttr =
        Number.isSafeInteger(start) && start !== 1 ? ` start="${start}"` : "";
      out.push(`<ol${startAttr}>${items.join("")}</ol>`);
      continue;
    }
    const paras: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !isBlockBoundary(lines[i]!)
    ) {
      paras.push(lines[i]!);
      i += 1;
    }
    out.push(`<p>${inline(paras.join(" ").trim())}</p>`);
  }
  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
