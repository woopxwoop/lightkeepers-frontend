/**
 * POST /api/research — dev-only proxy to lightkeepers-agent /v1/research.
 * GET — dev diagnostics (env + agent /health).
 */

import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import {
  E2E_RESEARCH_BUILD_RESPONSE,
  E2E_RESEARCH_RESPONSE,
} from "$lib/e2e/fixtures";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { enforceApiRateLimit } from "$lib/server/rate-limit";
import {
  ResearchAgentError,
  fetchResearch,
} from "$lib/server/research-agent";
import type { ResearchRequest } from "$lib/research-types";

/** SvelteKit `error()` only accepts 400–599. */
function httpErrorStatus(status: number): number {
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 502;
}

export const GET: RequestHandler = async () => {
  if (!dev) error(404, "Not found");

  if (isPlaywrightE2e()) {
    return json({
      configured: true,
      agentUrl: "http://e2e.invalid",
      agent: {
        ok: true,
        geminiConfigured: true,
        deepseekConfigured: true,
        defaultLlmProvider: "gemini",
      },
    });
  }

  const agentUrl = env.RESEARCH_AGENT_URL?.replace(/\/$/, "") ?? null;
  const tokenSet = Boolean(env.RESEARCH_API_TOKEN);

  if (!agentUrl || !tokenSet) {
    return json({
      configured: false,
      agentUrl,
      agent: {
        ok: false,
        error:
          "Set RESEARCH_AGENT_URL and RESEARCH_API_TOKEN in Lightkeepers .env",
      },
    });
  }

  try {
    const res = await fetchWithTimeout(`${agentUrl}/health`, {}, 8_000);
    const body = (await res.json().catch(() => null)) as unknown;
    return json({
      configured: true,
      agentUrl,
      agent: {
        ok: res.ok,
        body,
        geminiConfigured: Boolean(
          body &&
            typeof body === "object" &&
            "gemini_configured" in body &&
            (body as { gemini_configured?: boolean }).gemini_configured,
        ),
        deepseekConfigured: Boolean(
          body &&
            typeof body === "object" &&
            "deepseek_configured" in body &&
            (body as { deepseek_configured?: boolean }).deepseek_configured,
        ),
        defaultLlmProvider:
          body &&
          typeof body === "object" &&
          "default_llm_provider" in body &&
          (body as { default_llm_provider?: string }).default_llm_provider ===
            "deepseek"
            ? "deepseek"
            : "gemini",
      },
    });
  } catch (err) {
    return json({
      configured: true,
      agentUrl,
      agent: {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not reach research agent (is the SSH tunnel up?)",
      },
    });
  }
};

export const POST: RequestHandler = async ({
  request,
  getClientAddress,
}) => {
  if (!dev) error(404, "Not found");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    error(400, "Invalid JSON body");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    error(400, "Request body must be a JSON object");
  }
  const body = raw as ResearchRequest;
  const topic = body.topic === "build" ? "build" : undefined;
  const focusNameIds = Array.isArray(body.focus_name_ids)
    ? body.focus_name_ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];

  if (topic === "build" && focusNameIds.length === 0) {
    error(400, "topic=build requires focus_name_ids");
  }

  const questionRaw =
    typeof body.question === "string" ? body.question.trim() : "";
  const question =
    questionRaw ||
    (topic === "build"
      ? `How should I build ${focusNameIds[0]}?`
      : "");
  if (!question) error(400, "question is required");

  if (isPlaywrightE2e()) {
    const fixture =
      topic === "build"
        ? {
            ...E2E_RESEARCH_BUILD_RESPONSE,
            focus_name_id:
              focusNameIds[0] ?? E2E_RESEARCH_BUILD_RESPONSE.focus_name_id,
          }
        : E2E_RESEARCH_RESPONSE;
    return json(fixture, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  await enforceApiRateLimit({ request, getClientAddress });

  try {
    // General-facts oracle: never forward inventory / personalize.
    const result = await fetchResearch({
      topic,
      question_kind: topic === "build" ? "ask" : (body.question_kind ?? "ask"),
      question,
      focus_name_ids: focusNameIds,
      llm_provider: body.llm_provider,
      mode: body.mode,
      answer_style: body.answer_style,
    });
    return json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ResearchAgentError) {
      console.error("[api/research]", err.status, err.message);
      error(httpErrorStatus(err.status), err.message);
    }
    console.error("[api/research] unexpected error", err);
    const message =
      err instanceof Error ? err.message : "Research proxy failed unexpectedly";
    error(500, message);
  }
};
