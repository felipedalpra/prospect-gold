import type { GmbAudit } from "./types";

type GmbInput = {
  category: string;
  images: string[] | undefined;
  phone: string | undefined;
  instagram: string | undefined;
};

/**
 * Deriva a completude do perfil do Google a partir do que o scraping do Maps
 * já traz hoje. Horário de funcionamento fica de fora por enquanto — o nome
 * exato do campo no dataset do Apify não foi confirmado (ver spec).
 */
export function computeGmbAudit(lead: GmbInput): GmbAudit {
  const hasCategory = Boolean(lead.category?.trim());
  const photoCount = lead.images?.length ?? 0;
  const hasPhotos = photoCount >= 3;
  const hasPhone = Boolean(lead.phone);
  const hasInstagram = Boolean(lead.instagram);

  const checks = [hasCategory, hasPhotos, hasPhone, hasInstagram];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return { hasCategory, hasPhotos, photoCount, hasPhone, hasInstagram, completeness };
}
