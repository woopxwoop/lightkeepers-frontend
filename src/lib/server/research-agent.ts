/**
 * Server-side proxy to the lightkeepers-agent research API.
 * Bearer token stays on the server — never sent to the browser.
 */

import { env } from "$env/dynamic/private";
import type { ResearchRequest, ResearchResponse } from "$lib/research-types";
import { readBoundedResponseBody } from "$lib/server/team-config";

/** Gemini + retrieval can be slow over a tunnel. Covers headers + body. */
const RESEARCH_TIMEOUT_MS = 120_000;
/** Cap agent JSON so a runaway payload cannot blow the proxy. */
const MAX_RESEARCH_BODY_BYTES = 2 * 1024 * 1024;

const CONFIDENCE = new Set(["high", "medium", "low", "none"]);

export class ResearchAgentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResearchAgentError";
    this.status = status;
  }
}

function isSafeCiteId(id: unknown): id is number {
  return Number.isSafeInteger(id) && id >= 0;
}

function sanitizeCiteIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isSafeCiteId);
}

function sanitizeNestedCiteIds(row: unknown): void {
  if (!row || typeof row !== "object") return;
  const o = row as Record<string, unknown>;
  if (!("citation_ids" in o)) return;
  const ids = sanitizeCiteIds(o.citation_ids);
  if (ids) o.citation_ids = ids;
  else delete o.citation_ids;
}

function parseResearchResponse(raw: unknown): ResearchResponse {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ResearchAgentError(
      502,
      "Research agent returned an invalid response object.",
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.answer_markdown !== "string") {
    throw new ResearchAgentError(
      502,
      "Research agent response missing answer_markdown.",
    );
  }
  if (!Array.isArray(o.citations)) {
    throw new ResearchAgentError(
      502,
      "Research agent response missing citations array.",
    );
  }
  if (typeof o.thin_corpus !== "boolean") {
    throw new ResearchAgentError(
      502,
      "Research agent response missing thin_corpus.",
    );
  }
  if (typeof o.confidence !== "string" || !CONFIDENCE.has(o.confidence)) {
    throw new ResearchAgentError(
      502,
      "Research agent response has invalid confidence.",
    );
  }
  o.citations = o.citations.filter(
    (c) => c && typeof c === "object" && isSafeCiteId((c as { id: unknown }).id),
  );
  for (const key of [
    "disagreements",
    "teams",
    "weapon_ranks",
    "artifact_ranks",
    "er_targets",
  ] as const) {
    const list = o[key];
    if (!Array.isArray(list)) continue;
    for (const row of list) sanitizeNestedCiteIds(row);
  }
  sanitizeNestedCiteIds(o.rotation);
  return o as ResearchResponse;
}

export async function fetchResearch(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  const baseUrl = env.RESEARCH_AGENT_URL?.replace(/\/$/, "");
  const token = env.RESEARCH_API_TOKEN;
  if (!baseUrl || !token) {
    throw new ResearchAgentError(
      503,
      "Research agent is not configured (RESEARCH_AGENT_URL / RESEARCH_API_TOKEN).",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const buf = await readBoundedResponseBody(
      res,
      MAX_RESEARCH_BODY_BYTES,
      controller.signal,
    );
    if (!buf) {
      throw new ResearchAgentError(
        502,
        "Research agent response was too large.",
      );
    }
    const text = buf.toString("utf-8").trim();

    if (!res.ok) {
      let detail = text;
      try {
        const payload = JSON.parse(detail) as { detail?: string };
        if (typeof payload.detail === "string" && payload.detail) {
          detail = payload.detail;
        }
      } catch {
        // keep raw text
      }
      throw new ResearchAgentError(
        res.status,
        detail || `Research agent returned HTTP ${res.status}.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ResearchAgentError(
        502,
        "Research agent returned invalid JSON.",
      );
    }
    return parseResearchResponse(parsed);
  } catch (err) {
    if (err instanceof ResearchAgentError) throw err;
    if (
      (err instanceof Error && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError")
    ) {
      throw new ResearchAgentError(502, "Research agent request timed out.");
    }
    console.error("[research-agent] unexpected error", err);
    throw new ResearchAgentError(502, "Could not reach the research agent.");
  } finally {
    clearTimeout(timer);
  }
}
