import { createServerFn } from "@tanstack/react-start";
import type { SiteAudit } from "../types";

/**
 * Reads the lead's CURRENT site through Google's PageSpeed Insights. A seller
 * arguing "your site takes 8 seconds to load and scores 34/100" closes far more
 * than one arguing "I made you a nicer page" — and the numbers are Google's,
 * not ours.
 *
 * The API answers without a key at a low quota, which is enough for one lead at
 * a time; a key raises the ceiling and is optional in Configurações.
 */
export type AuditInput = { url: string; apiKey?: string | undefined };

type PsiResponse = {
  lighthouseResult?: {
    categories?: { performance?: { score?: number } };
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      viewport?: { score?: number };
    };
    finalUrl?: string;
  };
  error?: { message?: string };
};

export const auditSite = createServerFn({ method: "POST" })
  .validator((d: AuditInput) => d)
  .handler(async ({ data }): Promise<SiteAudit> => {
    const target = data.url.trim();
    if (!target) throw new Error("Este lead não tem site para analisar.");
    const url = /^https?:\/\//.test(target) ? target : `https://${target}`;

    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "mobile");
    endpoint.searchParams.set("category", "performance");
    if (data.apiKey) endpoint.searchParams.set("key", data.apiKey);

    const res = await fetch(endpoint);
    const json = (await res.json()) as PsiResponse;
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "Limite do PageSpeed atingido. Tente de novo em alguns minutos ou configure uma chave do Google."
          : (json.error?.message ?? `PageSpeed falhou (${res.status}).`),
      );
    }

    const lh = json.lighthouseResult;
    const lcpMs = lh?.audits?.["largest-contentful-paint"]?.numericValue ?? 0;
    return {
      performance: Math.round((lh?.categories?.performance?.score ?? 0) * 100),
      lcp: Math.round((lcpMs / 1000) * 10) / 10,
      mobile: (lh?.audits?.viewport?.score ?? 0) >= 1,
      https: (lh?.finalUrl ?? url).startsWith("https://"),
      url,
      checkedAt: new Date().toISOString(),
    };
  });
