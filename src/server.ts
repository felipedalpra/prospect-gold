import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Demo-page beacon                                                           */
/*  The generated sites are hosted elsewhere (Netlify), so they report back to */
/*  this origin. This runs before the router because the framework version in  */
/*  use has no server-route API, and a beacon must answer with a real image.   */
/* -------------------------------------------------------------------------- */

// 1x1 transparent GIF.
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

const BEACON_HEADERS = {
  "content-type": "image/gif",
  "cache-control": "no-store, no-cache, must-revalidate",
  "access-control-allow-origin": "*",
} as const;

async function recordVisit(url: URL, request: Request): Promise<Response> {
  const slug = decodeURIComponent(url.pathname.slice("/t/".length)).replace(/\.gif$/, "");
  const kind = url.searchParams.get("k") ?? "view";
  const seconds = Number(url.searchParams.get("s") ?? 0);

  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

  if (slug && base && key) {
    try {
      await fetch(`${base}/rest/v1/rpc/record_site_visit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: key,
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          p_slug: slug,
          p_kind: kind,
          p_referrer: request.headers.get("referer") ?? url.searchParams.get("r") ?? "",
          p_seconds: Number.isFinite(seconds) ? Math.round(seconds) : 0,
        }),
      });
    } catch {
      // A dropped beacon must never break the page it was fired from.
    }
  }

  return new Response(PIXEL, { headers: BEACON_HEADERS });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/t/")) return await recordVisit(url, request);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
