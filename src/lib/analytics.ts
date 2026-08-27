import { STAGES, type Lead, type OutreachMessage, type Stage } from "./types";
import { stageIndex } from "./buckets";

/**
 * The numbers that tell a seller what to do differently tomorrow. Counting how
 * many leads exist in each column says nothing; the conversion BETWEEN columns
 * is the only thing that separates a good niche from a bad one.
 */

export type FunnelStep = {
  stage: Stage;
  /** Leads that reached this stage at any point, not just those sitting in it. */
  reached: number;
  /** Share of the leads that reached the previous stage. */
  rate: number;
};

/**
 * A lead in "Proposta" necessarily passed through "Contatado", so each step
 * counts everyone at or beyond it. Counting only current occupants would show
 * a funnel that widens at the bottom.
 */
export function funnel(leads: Lead[]): FunnelStep[] {
  const live = leads.filter((l) => l.stage !== "Perdido");
  const steps = STAGES.filter((s) => s !== "Perdido");

  let previous = live.length;
  return steps.map((stage) => {
    const reached = live.filter((l) => stageIndex(l.stage) >= stageIndex(stage)).length;
    const rate = previous > 0 ? reached / previous : 0;
    previous = reached;
    return { stage, reached, rate };
  });
}

export type SegmentStat = {
  key: string;
  leads: number;
  contacted: number;
  replied: number;
  won: number;
  /** Replies over leads contacted — the number worth optimising. */
  replyRate: number;
  winRate: number;
};

function statFor(key: string, leads: Lead[]): SegmentStat {
  const contacted = leads.filter((l) => stageIndex(l.stage) >= stageIndex("Contatado")).length;
  const replied = leads.filter((l) => stageIndex(l.stage) >= stageIndex("Respondeu")).length;
  const won = leads.filter((l) => l.stage === "Venda").length;
  return {
    key,
    leads: leads.length,
    contacted,
    replied,
    won,
    replyRate: contacted > 0 ? replied / contacted : 0,
    winRate: contacted > 0 ? won / contacted : 0,
  };
}

/** Which niches and cities actually answer. Drives where to prospect next. */
export function bySegment(leads: Lead[], pick: (l: Lead) => string, min = 3): SegmentStat[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of leads) {
    const key = pick(lead).trim() || "—";
    groups.set(key, [...(groups.get(key) ?? []), lead]);
  }
  return [...groups.entries()]
    .filter(([, ls]) => ls.length >= min)
    .map(([key, ls]) => statFor(key, ls))
    .sort((a, b) => b.replyRate - a.replyRate || b.leads - a.leads);
}

/* -------------------------------------------------------------------------- */
/*  A/B                                                                        */
/* -------------------------------------------------------------------------- */

export type VariantStat = {
  variant: string;
  sent: number;
  replied: number;
  replyRate: number;
  failed: number;
};

/**
 * Reply rate per copy variant. A reply is any inbound message from a lead that
 * received that variant — attribution goes to the last variant sent before the
 * reply landed, which is how a human would read the thread.
 */
export function byVariant(messages: OutreachMessage[]): VariantStat[] {
  const outbound = messages.filter((m) => m.direction === "out");
  const inboundByLead = new Set(messages.filter((m) => m.direction === "in").map((m) => m.leadId));

  // Newest-first input, so the first outbound seen per lead is the last sent.
  const lastVariantByLead = new Map<string, string>();
  for (const m of outbound)
    if (!lastVariantByLead.has(m.leadId)) lastVariantByLead.set(m.leadId, m.variant);

  const groups = new Map<string, { sent: number; failed: number; leads: Set<string> }>();
  for (const m of outbound) {
    const g = groups.get(m.variant) ?? { sent: 0, failed: 0, leads: new Set<string>() };
    if (m.status === "failed") g.failed++;
    else g.sent++;
    g.leads.add(m.leadId);
    groups.set(m.variant, g);
  }

  return [...groups.entries()]
    .map(([variant, g]) => {
      const replied = [...g.leads].filter(
        (leadId) => inboundByLead.has(leadId) && lastVariantByLead.get(leadId) === variant,
      ).length;
      return {
        variant,
        sent: g.sent,
        failed: g.failed,
        replied,
        replyRate: g.sent > 0 ? replied / g.sent : 0,
      };
    })
    .sort((a, b) => b.replyRate - a.replyRate);
}

/* -------------------------------------------------------------------------- */
/*  Priority                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What to work on right now. The static score says how good the prospect looks
 * on paper; engagement says how warm it has become; recency decides between two
 * equally warm ones. A lead that opened the page an hour ago outranks a perfect
 * prospect that has never heard of you.
 */
export function priority(lead: Lead): number {
  if (lead.neverContact) return -1;

  const recency = lead.hotAt
    ? Math.max(0, 30 - (Date.now() - new Date(lead.hotAt).getTime()) / 3600000) // 30h decay
    : 0;
  const overdue = lead.followUpAt && new Date(lead.followUpAt) <= new Date() ? 25 : 0;

  return Math.round(lead.score * 0.4 + lead.engagement * 0.9 + recency + overdue);
}

/** Leads worth a call today, hottest first. */
export function hotList(leads: Lead[], limit = 10): Lead[] {
  return [...leads]
    .filter((l) => l.engagement > 0 && l.stage !== "Venda" && l.stage !== "Perdido")
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, limit);
}
