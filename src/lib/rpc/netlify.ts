import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";

const API = "https://api.netlify.com/api/v1";

export type PublishInput = {
  apiKey: string;
  /** Preferred subdomain, e.g. "clinica-sorriso". */
  slug: string;
  html: string;
  /** Reuse an existing Netlify site when republishing. */
  siteId?: string | undefined;
};

export type PublishResult = { url: string; siteId: string; deployId: string };

async function netlify(apiKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error("Token do Netlify inválido.");
    throw new Error(`Netlify falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

async function createSite(apiKey: string, slug: string): Promise<{ id: string }> {
  // Subdomains are global across Netlify, so a plain slug usually collides.
  // Try the clean name first, then fall back to suffixed attempts.
  const candidates = [
    slug,
    `${slug}-${Math.random().toString(36).slice(2, 7)}`,
    `${slug}-${Math.random().toString(36).slice(2, 9)}`,
  ];

  let lastError: unknown;
  for (const name of candidates) {
    const res = await fetch(`${API}/sites`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return (await res.json()) as { id: string };
    if (res.status === 401) throw new Error("Token do Netlify inválido.");
    lastError = await res.text();
  }
  throw new Error(`Não foi possível criar o site no Netlify: ${String(lastError).slice(0, 300)}`);
}

export const publishSite = createServerFn({ method: "POST" })
  .validator((d: PublishInput) => d)
  .handler(async ({ data }): Promise<PublishResult> => {
    const { apiKey, slug, html } = data;
    if (!apiKey) throw new Error("Token do Netlify não configurado.");
    if (!html) throw new Error("Este lead ainda não tem um site gerado.");

    const siteId = data.siteId ?? (await createSite(apiKey, slug)).id;

    // Netlify's digest deploy: declare the files by SHA1, upload only what it
    // asks for, then wait for the deploy to go live.
    const sha = createHash("sha1").update(html, "utf8").digest("hex");

    const deployRes = await netlify(apiKey, `/sites/${siteId}/deploys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: { "/index.html": sha } }),
    });
    const deploy = (await deployRes.json()) as {
      id: string;
      required: string[];
      ssl_url?: string;
      url?: string;
    };

    if (deploy.required?.includes(sha)) {
      await netlify(apiKey, `/deploys/${deploy.id}/files/index.html`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: html,
      });
    }

    // Poll until live so the link we hand the user actually resolves.
    let url = deploy.ssl_url ?? deploy.url ?? "";
    for (let i = 0; i < 20; i++) {
      const statusRes = await netlify(apiKey, `/deploys/${deploy.id}`);
      const status = (await statusRes.json()) as {
        state: string;
        ssl_url?: string;
        url?: string;
        error_message?: string;
      };
      url = status.ssl_url ?? status.url ?? url;
      if (status.state === "ready") break;
      if (status.state === "error") {
        throw new Error(`Deploy falhou no Netlify: ${status.error_message ?? "erro desconhecido"}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!url) throw new Error("O Netlify não devolveu a URL do site publicado.");
    return { url, siteId, deployId: deploy.id };
  });
