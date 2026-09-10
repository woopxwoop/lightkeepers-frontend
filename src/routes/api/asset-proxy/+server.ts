/**
 * Same-origin proxy for CDN assets so html-to-image can embed them.
 * GET /api/asset-proxy?u=https://api.lightkeepers.moe/...
 */
import { error } from "@sveltejs/kit";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import type { RequestHandler } from "./$types";

const ALLOWED_HOSTS = new Set(["api.lightkeepers.moe"]);

function cancelUpstreamBody(res: Response): void {
  try {
    void res.body?.cancel()?.catch(() => {
      /* ignore async cancel failures; preserve original error path */
    });
  } catch {
    /* ignore sync cancel failures; preserve original error path */
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const raw = url.searchParams.get("u");
  if (!raw) error(400, "Missing u");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    error(400, "Invalid u");
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    error(400, "Host not allowed");
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(target.href, {
      headers: { Accept: "image/*,*/*" },
      redirect: "manual",
    });
  } catch {
    error(502, "Upstream fetch failed");
  }

  if (!upstream.ok) {
    cancelUpstreamBody(upstream);
    error(upstream.status === 404 ? 404 : 502, "Upstream fetch failed");
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const type = contentType.toLowerCase();
  if (!type.startsWith("image/") || type.startsWith("image/svg+xml")) {
    cancelUpstreamBody(upstream);
    error(502, "Upstream is not an image");
  }
  if (!upstream.body) {
    error(502, "Upstream fetch failed");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
