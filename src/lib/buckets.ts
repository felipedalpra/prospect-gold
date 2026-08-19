import { STAGES, type Lead, type Stage } from "./types";

/**
 * Where each lead belongs in the app. The sections used to share one flat list,
 * so a lead that already had a site, a published URL and a message sent still
 * sat next to a lead scraped five minutes ago. The funnel buckets below are
 * mutually exclusive, and each screen owns exactly one of them.
 */
export type Bucket = "prospect" | "site" | "outreach";

/** First stage that means the lead has already been approached. */
const OUTREACH_FROM = STAGES.indexOf("Contatado");

export function stageIndex(stage: Stage): number {
  const i = STAGES.indexOf(stage);
  return i === -1 ? 0 : i;
}

export function bucketOf(lead: Lead): Bucket {
  if (lead.stage === "Perdido" || stageIndex(lead.stage) >= OUTREACH_FROM) return "outreach";
  return lead.site ? "site" : "prospect";
}

/** Still to work: no site yet, not approached. */
export const isProspect = (l: Lead): boolean => bucketOf(l) === "prospect";

/** Site generated, not approached yet — ready to send. */
export const isReadyToSend = (l: Lead): boolean => bucketOf(l) === "site";

/** Already approached, in negotiation, won or lost. */
export const isOutreach = (l: Lead): boolean => bucketOf(l) === "outreach";

/** Every generated site, whatever the funnel stage — Sites is an asset library. */
export const hasSite = (l: Lead): boolean => Boolean(l.site);

/** Stages a lead can be in before a site exists — the only ones Leads filters by. */
export const PROSPECT_STAGES: Stage[] = ["Novo", "Qualificado"];

/** Stages that live in the outreach screen. */
export const OUTREACH_STAGES: Stage[] = STAGES.slice(OUTREACH_FROM);
