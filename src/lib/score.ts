import type { ScoreReason } from "./types";

export type ScorableLead = {
  hasWebsite: boolean;
  rating: number;
  reviews: number;
  phone?: string | undefined;
  instagram?: string | undefined;
};

/**
 * Opportunity score: how good a prospect this business is for someone selling
 * websites / automation. No website is the single strongest signal — the whole
 * pitch is "you have a great reputation and nowhere to send people".
 */
export function computeScore(lead: ScorableLead): { score: number; reasons: ScoreReason[] } {
  const reasons: ScoreReason[] = [];

  if (!lead.hasWebsite) reasons.push({ label: "Sem site", points: 30 });
  else reasons.push({ label: "Site desatualizado", points: 8 });

  if (lead.rating >= 4.5) reasons.push({ label: "Boa avaliação", points: 15 });
  else if (lead.rating >= 4) reasons.push({ label: "Avaliação razoável", points: 8 });

  if (lead.reviews >= 100) reasons.push({ label: "Muitas avaliações", points: 15 });
  else if (lead.reviews >= 30) reasons.push({ label: "Volume de avaliações", points: 9 });

  if (lead.phone) reasons.push({ label: "Telefone disponível", points: 10 });
  if (lead.instagram) reasons.push({ label: "Instagram ativo", points: 10 });

  reasons.push({ label: "Segmento relevante", points: 10 });

  const score = Math.min(
    100,
    reasons.reduce((a, b) => a + b.points, 0),
  );
  return { score, reasons };
}

export type Filters = {
  noWebsite: boolean;
  hasPhone: boolean;
  hasInstagram: boolean;
  minRating: number;
  minReviews: number;
  limit: number;
};

export const defaultFilters: Filters = {
  noWebsite: true,
  hasPhone: true,
  hasInstagram: false,
  minRating: 4,
  minReviews: 20,
  limit: 20,
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
