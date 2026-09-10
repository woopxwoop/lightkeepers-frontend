/**
 * Render research `answer_markdown` with entity slots and cite superscripts.
 * See `$lib/research-types` for token forms and asset helpers.
 * Entity slots are hydrated to ResearchEntityMention by ResearchAnswer.
 */

import { artifactIconUrl, assetUrl } from "$lib/asset-urls";
import {
  artifactSetByKey,
  ensureEquipmentData,
  weaponIconSrc,
} from "$lib/equipment-data";
import { renderPatchNoteBody } from "$lib/patch-notes";
import type { ResearchCitation, ResearchEntity } from "$lib/research-types";
import { getCharacterPortrait } from "$lib/utils";

const ENTITY_TOKEN_RE = /\[\[(?!cite:)([^\]]+)\]\]/gi;
/** Single id or comma cluster: `[[cite:2297]]` / `[[cite:2297, 2300]]`. */
const CITE_TOKEN_RE = /\[\[cite:(\d+(?:\s*,\s*\d+)*)\]\]/gi;
const LEGACY_CITE_RE = /\[(?!\[)(\d+(?:\s*,\s*\d+)*)\]/g;
const ENTITY_PLACEHOLDER = (i: number) => `\uE000${i}\uE001`;
const ENTITY_PLACEHOLDER_RE = /\uE000(\d+)\uE001/g;
const CITE_PLACEHOLDER = (i: number) => `\uE010${i}\uE011`;
const CITE_PLACEHOLDER_RE = /\uE010(\d+)\uE011/g;

/** Load weapon/artifact tables for entity chip icons (call from UI `$effect`). */
export function preloadEntityIconData(): Promise<void> {
  return ensureEquipmentData().catch(() => {
    /* chip icons retry when equipmentVersion bumps */
  });
}

export function citationShortLabel(cite: ResearchCitation): string {
  const parts = [cite.publisher];
  if (cite.heading_path) {
    const leaf =
      cite.heading_path.split(">").pop()?.trim() ?? cite.heading_path.trim();
    if (leaf) parts.push(leaf);
  } else if (cite.title) {
    parts.push(cite.title);
  }
  return parts.filter(Boolean).join(" · ");
}

/** Footnotes in markdown appearance order, then any extras from `citations[]`. */
export function orderCitationsForDisplay(
  citations: ResearchCitation[],
  markdown: string,
  extraText: string[] = [],
): ResearchCitation[] {
  const byId = new Map(citations.map((c) => [c.id, c]));
  const ordered: ResearchCitation[] = [];
  const seen = new Set<number>();
  const allowed = new Set(citations.map((c) => c.id));
  const blob = [markdown, ...extraText].join("\n");
  let normalized = normalizeLegacyCiteTokens(blob, allowed);
  normalized = normalizeCiteClusters(normalized, allowed);

  for (const match of normalized.matchAll(/\[\[cite:(\d+)\]\]/gi)) {
    const id = Number(match[1]);
    if (seen.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    seen.add(id);
    ordered.push(row);
  }

  for (const cite of citations) {
    if (seen.has(cite.id)) continue;
    seen.add(cite.id);
    ordered.push(cite);
  }
  return ordered;
}

export function entityIconUrl(entity: ResearchEntity): string | null {
  if (entity.icon) {
    const fromIcon = assetUrl(entity.icon);
    if (fromIcon) return fromIcon;
  }
  if (entity.type === "character" && entity.name_id) {
    return getCharacterPortrait(entity.name_id);
  }
  if (entity.type === "weapon" && entity.weapon_key) {
    return weaponIconSrc(entity.weapon_key);
  }
  if (entity.type === "artifact_set" && entity.set_key) {
    const set = artifactSetByKey.get(entity.set_key);
    return set?.icon ? artifactIconUrl(set.icon) : null;
  }
  return null;
}

export function entityHref(entity: ResearchEntity): string | null {
  if (!entity.name_id) return null;
  const base = `/characters/${encodeURIComponent(entity.name_id)}`;
  if (entity.kit_ref) return `${base}#kit-${entity.kit_ref}`;
  if (
    entity.type === "character" ||
    entity.type === "constellation" ||
    entity.type === "skill" ||
    entity.type === "passive"
  ) {
    return base;
  }
  return null;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Attribute used by ResearchAnswer to mount ResearchEntityMention. */
export const RESEARCH_ENTITY_SLOT_ATTR = "data-research-entity-key";

/**
 * Empty slot marker for one entity (agent-validated).
 * ResearchAnswer hydrates these into ResearchEntityMention (tooltips).
 */
export function renderEntityChip(entity: ResearchEntity): string {
  return `<span class="research-entity-slot" ${RESEARCH_ENTITY_SLOT_ATTR}="${escapeAttr(entity.key)}"></span>`;
}

function renderCiteSuperscript(
  citeId: number,
  displayNum: number,
  anchorPrefix = "",
): string {
  const anchor = `${anchorPrefix}research-cite-${citeId}`;
  return `<sup class="research-cite"><a href="#${escapeAttr(anchor)}" title="Source ${displayNum}">${displayNum}</a></sup>`;
}

/** Only allow http(s) citation links from agent-supplied URLs. */
export function safeExternalHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    /* invalid */
  }
  return null;
}

export type RenderResearchAnswerOptions = {
  /** Prefix for `#…research-cite-{id}` anchors (unique per answer instance). */
  citeAnchorPrefix?: string;
  /**
   * Shared cite → footnote number map (so body + comparison panel stay in sync).
   * When omitted, numbers are assigned in first-seen order within this string.
   */
  citeDisplayNum?: Map<number, number>;
};

function normalizeCiteClusters(
  md: string,
  allowed: Set<number>,
): string {
  return md.replace(CITE_TOKEN_RE, (full, body: string) => {
    const tokens = body.split(",").map((part: string) => {
      const trimmed = part.trim();
      const id = Number(trimmed);
      if (Number.isFinite(id) && allowed.has(id)) return `[[cite:${id}]]`;
      return trimmed ? `[cite:${trimmed}]` : "";
    });
    return tokens.join("");
  });
}

function normalizeLegacyCiteTokens(
  md: string,
  allowed: Set<number>,
): string {
  return md.replace(LEGACY_CITE_RE, (full, body: string) =>
    body
      .split(",")
      .map((part: string) => {
        const trimmed = part.trim();
        const id = Number(trimmed);
        if (!Number.isFinite(id) || !allowed.has(id)) {
          return trimmed ? `[${trimmed}]` : full;
        }
        return `[[cite:${id}]]`;
      })
      .join(""),
  );
}

/**
 * Markdown → HTML with `[[cite:…]]` superscripts and `[[entity]]` chips.
 */
export function renderResearchAnswer(
  md: string,
  entities: ResearchEntity[] = [],
  citations: ResearchCitation[] = [],
  options: RenderResearchAnswerOptions = {},
): string {
  const citeAnchorPrefix = options.citeAnchorPrefix ?? "";
  const sharedCiteNums = options.citeDisplayNum;
  const byKey = new Map(entities.map((e) => [e.key, e]));
  const citeIds = new Set(citations.map((c) => c.id));
  const entityChips: string[] = [];
  const citeChips: string[] = [];
  const citeDisplayNum = sharedCiteNums ?? new Map<number, number>();
  let nextCiteNum =
    sharedCiteNums && sharedCiteNums.size > 0
      ? Math.max(...sharedCiteNums.values())
      : 0;

  // Match single-id tokens after splitting clusters.
  const singleCiteRe = /\[\[cite:(\d+)\]\]/gi;

  let normalized = normalizeLegacyCiteTokens(md, citeIds);
  normalized = normalizeCiteClusters(normalized, citeIds);

  let withCitePlaceholders = normalized.replace(singleCiteRe, (_full, idStr: string) => {
    const id = Number(idStr);
    if (!citeIds.has(id)) return "";
    if (!citeDisplayNum.has(id)) {
      nextCiteNum += 1;
      citeDisplayNum.set(id, nextCiteNum);
    }
    const i = citeChips.length;
    citeChips.push(
      renderCiteSuperscript(id, citeDisplayNum.get(id)!, citeAnchorPrefix),
    );
    return CITE_PLACEHOLDER(i);
  });

  withCitePlaceholders = withCitePlaceholders.replace(
    ENTITY_TOKEN_RE,
    (_full, key: string) => {
      const ent = byKey.get(key);
      if (!ent) {
        return key.includes(":") ? key.split(":").slice(1).join(":") : key;
      }
      const i = entityChips.length;
      entityChips.push(renderEntityChip(ent));
      return ENTITY_PLACEHOLDER(i);
    },
  );

  let html = renderPatchNoteBody(withCitePlaceholders);
  html = html.replace(
    CITE_PLACEHOLDER_RE,
    (_full, idx: string) => citeChips[Number(idx)] ?? "",
  );
  html = html.replace(
    ENTITY_PLACEHOLDER_RE,
    (_full, idx: string) => entityChips[Number(idx)] ?? "",
  );
  return html;
}

/**
 * Inline fragment (labels, bullets): same tokens, no wrapping `<p>` blocks.
 */
export function renderResearchInline(
  text: string,
  entities: ResearchEntity[] = [],
  citations: ResearchCitation[] = [],
  options: RenderResearchAnswerOptions = {},
): string {
  const html = renderResearchAnswer(text, entities, citations, options).trim();
  if (!html) return "";
  return html
    .replace(/^<p>/i, "")
    .replace(/<\/p>$/i, "")
    .replace(/<\/p>\s*<p>/gi, " ");
}
