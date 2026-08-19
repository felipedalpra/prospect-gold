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
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: { imageUrl?: string }[] | null;
  imageCategories?: unknown;
};

/**
 * Google serves photos through a sizing suffix (`=w408-h306-k-no`). We rewrite
 * it to a large crop so the generated landing pages get sharp hero images
 * instead of thumbnails.
 */
function upsize(url: string, width = 1600): string {
  if (!url.startsWith("http")) return url;
  const cut = url.replace(/=[swh]\d+[^=]*$/, "");
  return /googleusercontent|ggpht/.test(cut)
    ? `${cut}=w${width}-h${Math.round(width * 0.66)}-k-no`
    : url;
}

/** Photos of the place, de-duplicated and ordered with the cover first. */
function pickImages(place: ApifyPlace, max = 10): string[] {
  const raw = [
    place.imageUrl ?? "",
    ...(place.imageUrls ?? []),
    ...(place.images ?? []).map((i) => i?.imageUrl ?? ""),
  ].filter((u): u is string => Boolean(u && u.startsWith("http")));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of raw) {
    const big = upsize(url);
    const key = big.split("=")[0] ?? big;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(big);
    if (out.length >= max) break;
  }
  return out;
}

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
          // Real photos of each business — the generated landing pages are built
          // around them instead of generic stock imagery.
          maxImages: 10,
          scrapeImageAuthors: false,
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
        images: pickImages(p),
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

/* -------------------------------------------------------------------------- */
/*  Photos on demand                                                           */
/* -------------------------------------------------------------------------- */

export type PlaceImagesInput = {
  apiKey: string;
  placeId?: string | undefined;
  /** Fallback lookup when no placeId was stored (older leads). */
  query?: string | undefined;
  location?: string | undefined;
};

export type PlaceImagesResult = {
  images: string[];
  /**
   * Why no real photo came back, when that happened. Site generation still
   * succeeds with the curated fallbacks, but the UI has to say so instead of
   * passing a stock page off as the business's own.
   */
  error?: string | undefined;
};

/**
 * Fetches the photos of a single business. Used as a repair path for leads
 * saved before photos were persisted, and for places whose scrape returned
 * none. Never throws — it reports the failure in `error` instead, so a site
 * without real photos still renders with the curated fallbacks.
 */
export const fetchPlaceImages = createServerFn({ method: "POST" })
  .validator((d: PlaceImagesInput) => d)
  .handler(async ({ data }): Promise<PlaceImagesResult> => {
    const { apiKey, placeId, query, location } = data;
    if (!apiKey) return { images: [], error: "Chave da Apify não configurada." };
    if (!placeId && !query) return { images: [], error: "Lead sem identificação no Google Maps." };

    const body: Record<string, unknown> = {
      maxCrawledPlacesPerSearch: 1,
      language: "pt-BR",
      maxImages: 12,
      scrapeImageAuthors: false,
      scrapeContacts: false,
    };
    if (placeId) {
      body["startUrls"] = [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }];
    } else {
      body["searchStringsArray"] = [query];
      if (location) body["locationQuery"] = location;
    }

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        return {
          images: [],
          error:
            res.status === 401 || res.status === 403
              ? "Chave da Apify inválida ou sem permissão."
              : `Apify falhou ao buscar as fotos (${res.status}): ${body.slice(0, 160)}`,
        };
      }
      const places = (await res.json()) as ApifyPlace[];
      const images = places[0] ? pickImages(places[0], 12) : [];
      return images.length > 0
        ? { images }
        : { images: [], error: "O Google Maps não tem fotos deste negócio." };
    } catch (err) {
      return {
        images: [],
        error: `Não foi possível buscar as fotos: ${err instanceof Error ? err.message : "erro de rede"}`,
      };
    }
  });
