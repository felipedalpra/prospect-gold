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

/* -------------------------------------------------------------------------- */
/*  Inbound WhatsApp                                                           */
/*  The user's own instance posts here when a lead replies. It carries no       */
/*  session, so the secret in the path is what identifies the account — the     */
/*  same shape as the beacon above, and for the same reason.                    */
/* -------------------------------------------------------------------------- */

type InboundHit = { phone: string; body: string };

/**
 * Every provider invented its own envelope. Rather than ask the user which one
 * they run — they often don't know — we read all three shapes and take the
 * first that yields a number and some text.
 */
type Bag = Record<string, unknown>;

function bag(v: unknown): Bag {
  return v !== null && typeof v === "object" ? (v as Bag) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function readInbound(payload: unknown): InboundHit | null {
  const p = bag(payload);

  // Evolution / Uazapi: a messages.upsert envelope around a Baileys message.
  const data = bag(p["data"] ?? p);
  const key = bag(data["key"]);
  const jid = str(key["remoteJid"]);
  if (jid) {
    // Our own outgoing messages echo back through the same hook.
    if (key["fromMe"] === true) return null;
    // Groups are not leads.
    if (jid.includes("@g.us")) return null;

    const msg = bag(data["message"]);
    const body =
      str(msg["conversation"]) ||
      str(bag(msg["extendedTextMessage"])["text"]) ||
      str(bag(msg["imageMessage"])["caption"]) ||
      str(data["body"]);
    if (!body) return null;
    return { phone: jid.split("@")[0] ?? "", body };
  }

  // Z-API: a flat payload with the number at the top level.
  const phone = str(p["phone"]);
  if (phone && p["fromMe"] !== true) {
    const body = str(bag(p["text"])["message"]) || str(p["message"]) || str(p["body"]);
    if (!body) return null;
    return { phone, body };
  }

  return null;
}

async function recordInbound(url: URL, request: Request): Promise<Response> {
  const token = decodeURIComponent(url.pathname.slice("/api/wa/".length));
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

  // Providers retry anything that is not a 2xx, so a payload we cannot use —
  // a status callback, a group message, our own echo — still answers 200.
  const ok = new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
  if (!token || !base || !key) return ok;

  try {
    const hit = readInbound(await request.json());
    if (!hit) return ok;

    await fetch(`${base}/rest/v1/rpc/record_inbound_message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token, p_phone: hit.phone, p_body: hit.body }),
    });
  } catch {
    // A malformed webhook must never make the provider mark us as broken.
  }
  return ok;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/t/")) return await recordVisit(url, request);
      if (url.pathname.startsWith("/api/wa/") && request.method === "POST") {
        return await recordInbound(url, request);
      }
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
