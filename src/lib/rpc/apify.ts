import { createServerFn } from "@tanstack/react-start";
import { computeScore, type Filters } from "../score";
import type { Lead } from "../types";

/**
 * Apify's Google Maps scraper. We run it synchronously and read the dataset in
 * one call — the actor finishes in well under the 300s sync budget for the
 * result counts this app asks for.
 */
const ACTOR = "compass~crawler-google-places";

export type ScrapeInput = {
  apiKey: string;
  niche: string;
  location: string;
  filters: Filters;
};

type ApifyPlace = {
  title?: string;
  categoryName?: string;
  city?: string;
  state?: string;
  address?: string;
  street?: string;
  totalScore?: number;
  reviewsCount?: number;
  website?: string | null;
  phone?: string | null;
  placeId?: string;
  url?: string;
  additionalInfo?: unknown;
  instagrams?: string[];
};

function pickInstagram(place: ApifyPlace): string | undefined {
  const first = place.instagrams?.[0];
  if (!first) return undefined;
  const handle = first.replace(/\/+$/, "").split("/").pop();
  return handle ? `@${handle}` : undefined;
}

export const scrapeLeads = createServerFn({ method: "POST" })
  .validator((d: ScrapeInput) => d)
  .handler(async ({ data }): Promise<Lead[]> => {
    const { apiKey, niche, location, filters } = data;
    if (!apiKey) throw new Error("Chave da Apify não configurada.");
    if (!niche.trim()) throw new Error("Informe o nicho que quer prospectar.");

    // Ask for more than we need: the filters below discard a large share, and a
    // search that returns 20 places often yields only a handful without a site.
    const requested = Math.min(200, Math.max(filters.limit * 4, 40));

    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [niche],
          locationQuery: location,
          maxCrawledPlacesPerSearch: requested,
          language: "pt-BR",
          skipClosedPlaces: true,
          scrapeContacts: false,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error("Chave da Apify inválida ou sem permissão.");
      }
      throw new Error(`Apify falhou (${res.status}): ${body.slice(0, 300)}`);
    }

    const places = (await res.json()) as ApifyPlace[];
    const now = new Date().toISOString();
    const out: Lead[] = [];

    for (const p of places) {
      const name = p.title?.trim();
      if (!name) continue;

      const hasWebsite = Boolean(p.website);
      const phone = p.phone?.trim() || undefined;
      const instagram = pickInstagram(p);
      const rating = typeof p.totalScore === "number" ? p.totalScore : 0;
      const reviews = typeof p.reviewsCount === "number" ? p.reviewsCount : 0;

      if (filters.noWebsite && hasWebsite) continue;
      if (filters.hasPhone && !phone) continue;
      if (filters.hasInstagram && !instagram) continue;
      if (rating < filters.minRating) continue;
      if (reviews < filters.minReviews) continue;

      const partial = {
        name,
        category: p.categoryName?.trim() || niche,
        city: [p.city, p.state].filter(Boolean).join(", ") || location,
        rating,
        reviews,
        hasWebsite,
        website: p.website ?? undefined,
        phone,
        instagram,
        address: p.street?.trim() || p.address?.trim() || "",
        placeId: p.placeId,
      };

      const { score, reasons } = computeScore(partial);
      out.push({
        id: crypto.randomUUID(),
        ...partial,
        score,
        reasons,
        stage: "Novo",
        createdAt: now,
        activities: [{ at: now, text: "Lead encontrado no Google Maps" }],
      });
    }

    // Rank first, then cut — otherwise the cap would keep whatever Apify
    // happened to return first rather than the best opportunities.
    return out.sort((a, b) => b.score - a.score).slice(0, filters.limit);
  });
