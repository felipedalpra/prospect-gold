import { supabase } from "./supabase";
import type {
  Campaign,
  Integration,
  Lead,
  LeadSite,
  Profile,
  Provider,
  ScoreReason,
  SiteSection,
  Stage,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Row shapes                                                                 */
/* -------------------------------------------------------------------------- */

type LeadRow = {
  id: string;
  campaign_id: string | null;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviews: number;
  has_website: boolean;
  website: string | null;
  phone: string | null;
  instagram: string | null;
  address: string;
  place_id: string | null;
  score: number;
  reasons: ScoreReason[];
  stage: string;
  message: Lead["message"] | null;
  activities: { at: string; text: string }[];
  created_at: string;
};

type SiteRow = {
  id: string;
  lead_id: string;
  slug: string;
  template: string;
  content: SiteSection;
  html: string;
  published: boolean;
  url: string | null;
  deploy_meta: Record<string, unknown>;
  created_at: string;
};

/* -------------------------------------------------------------------------- */
/*  Mappers                                                                    */
/* -------------------------------------------------------------------------- */

function toSite(row: SiteRow): LeadSite {
  return {
    id: row.id,
    template: row.template,
    content: row.content,
    html: row.html,
    slug: row.slug,
    published: row.published,
    url: row.url ?? undefined,
    netlifySiteId: (row.deploy_meta?.["netlifySiteId"] as string | undefined) ?? undefined,
    createdAt: row.created_at,
  };
}

function toLead(row: LeadRow, site?: SiteRow | undefined): Lead {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    rating: Number(row.rating),
    reviews: row.reviews,
    hasWebsite: row.has_website,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    instagram: row.instagram ?? undefined,
    address: row.address,
    placeId: row.place_id ?? undefined,
    score: row.score,
    reasons: row.reasons ?? [],
    stage: row.stage as Stage,
    campaignId: row.campaign_id ?? undefined,
    site: site ? toSite(site) : undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
    activities: row.activities ?? [],
  };
}

function leadInsert(lead: Lead, userId: string, campaignId?: string) {
  return {
    user_id: userId,
    campaign_id: campaignId ?? lead.campaignId ?? null,
    name: lead.name,
    category: lead.category,
    city: lead.city,
    rating: lead.rating,
    reviews: lead.reviews,
    has_website: lead.hasWebsite,
    website: lead.website ?? null,
    phone: lead.phone ?? null,
    instagram: lead.instagram ?? null,
    address: lead.address,
    place_id: lead.placeId ?? null,
    score: lead.score,
    reasons: lead.reasons,
    stage: lead.stage,
    activities: lead.activities,
  };
}

/** Only the columns the UI is allowed to patch, mapped to snake_case. */
function leadPatch(patch: Partial<Lead>) {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out["name"] = patch.name;
  if (patch.phone !== undefined) out["phone"] = patch.phone ?? null;
  if (patch.instagram !== undefined) out["instagram"] = patch.instagram ?? null;
  if (patch.website !== undefined) out["website"] = patch.website ?? null;
  if (patch.stage !== undefined) out["stage"] = patch.stage;
  if (patch.score !== undefined) out["score"] = patch.score;
  if (patch.message !== undefined) out["message"] = patch.message ?? null;
  if (patch.activities !== undefined) out["activities"] = patch.activities;
  if (patch.campaignId !== undefined) out["campaign_id"] = patch.campaignId ?? null;
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchLeads(): Promise<Lead[]> {
  const [{ data: leads, error }, { data: sites, error: siteError }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("sites").select("*"),
  ]);
  if (error) throw error;
  if (siteError) throw siteError;

  const byLead = new Map((sites as SiteRow[] | null)?.map((s) => [s.lead_id, s]) ?? []);
  return ((leads as LeadRow[] | null) ?? []).map((row) => toLead(row, byLead.get(row.id)));
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, niche, location, created_at, leads(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    (data as
      | {
          id: string;
          name: string;
          niche: string;
          location: string;
          created_at: string;
          leads: { id: string }[];
        }[]
      | null) ?? []
  ).map((c) => ({
    id: c.id,
    name: c.name,
    niche: c.niche,
    location: c.location,
    createdAt: c.created_at,
    leadIds: c.leads?.map((l) => l.id) ?? [],
  }));
}

export async function fetchProfile(userId: string): Promise<{ profile: Profile; credits: number }> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  const row = data as {
    name: string;
    email: string;
    sells: string;
    targets: string[];
    location: string;
    onboarded: boolean;
    plan: string;
    credits: number;
  };
  return {
    profile: {
      name: row.name,
      email: row.email,
      sells: row.sells,
      targets: row.targets ?? [],
      location: row.location,
      onboarded: row.onboarded,
      plan: row.plan,
    },
    credits: row.credits,
  };
}

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data, error } = await supabase.from("integrations").select("provider, api_key, meta");
  if (error) throw error;
  return (
    (data as { provider: Provider; api_key: string; meta: Record<string, unknown> }[] | null) ?? []
  ).map((r) => ({ provider: r.provider, apiKey: r.api_key, meta: r.meta ?? {} }));
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveIntegration(userId: string, provider: Provider, apiKey: string) {
  const { error } = await supabase
    .from("integrations")
    .upsert({ user_id: userId, provider, api_key: apiKey, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteIntegration(userId: string, provider: Provider) {
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function updateProfile(userId: string, patch: Partial<Profile & { credits: number }>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function spendCredits(userId: string, amount: number) {
  const { data, error } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const next = Math.max(0, (data as { credits: number }).credits - amount);
  await updateProfile(userId, { credits: next });
  return next;
}

/**
 * Inserts scraped leads, skipping any the user already has. The unique index on
 * (user_id, lower(name), lower(city)) is what actually enforces dedupe, so a
 * concurrent run can't slip a duplicate past us.
 */
export async function insertLeads(
  userId: string,
  leads: Lead[],
  campaignId?: string,
): Promise<Lead[]> {
  if (leads.length === 0) return [];

  const { data: existing } = await supabase.from("leads").select("name, city");
  const seen = new Set(
    ((existing as { name: string; city: string }[] | null) ?? []).map(
      (l) => `${l.name.toLowerCase()}|${l.city.toLowerCase()}`,
    ),
  );
  const fresh = leads.filter((l) => !seen.has(`${l.name.toLowerCase()}|${l.city.toLowerCase()}`));
  if (fresh.length === 0) return [];

  const { data, error } = await supabase
    .from("leads")
    .insert(fresh.map((l) => leadInsert(l, userId, campaignId)))
    .select("*");

  // A concurrent run can still trip the unique index; retry row by row so one
  // duplicate doesn't discard the whole batch.
  if (error) return insertLeadsIndividually(userId, fresh, campaignId);
  return ((data as LeadRow[] | null) ?? []).map((row) => toLead(row));
}

async function insertLeadsIndividually(userId: string, leads: Lead[], campaignId?: string) {
  const out: Lead[] = [];
  for (const lead of leads) {
    const { data, error } = await supabase
      .from("leads")
      .insert(leadInsert(lead, userId, campaignId))
      .select("*")
      .single();
    if (error) continue; // duplicate — the user already has this business
    out.push(toLead(data as LeadRow));
  }
  return out;
}

export async function patchLead(id: string, patch: Partial<Lead>): Promise<void> {
  const payload = leadPatch(patch);
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("leads").update(payload).eq("id", id);
  if (error) throw error;
}

export async function appendActivity(lead: Lead, text: string): Promise<Lead["activities"]> {
  const activities = [{ at: new Date().toISOString(), text }, ...lead.activities].slice(0, 100);
  await patchLead(lead.id, { activities });
  return activities;
}

export async function upsertSite(
  userId: string,
  leadId: string,
  site: { template: string; content: SiteSection; html: string; slug: string },
): Promise<LeadSite> {
  const { data, error } = await supabase
    .from("sites")
    .upsert(
      {
        user_id: userId,
        lead_id: leadId,
        slug: site.slug,
        template: site.template,
        content: site.content,
        html: site.html,
      },
      { onConflict: "lead_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return toSite(data as SiteRow);
}

export async function markSitePublished(
  leadId: string,
  url: string,
  deployMeta: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("sites")
    .update({ published: true, url, deploy_meta: deployMeta })
    .eq("lead_id", leadId);
  if (error) throw error;
}

export async function patchSiteContent(leadId: string, content: SiteSection, html?: string) {
  const payload: Record<string, unknown> = { content };
  if (html !== undefined) payload["html"] = html;
  const { error } = await supabase.from("sites").update(payload).eq("lead_id", leadId);
  if (error) throw error;
}

export async function createCampaignRow(
  userId: string,
  c: { name: string; niche: string; location: string },
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ user_id: userId, ...c })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as {
    id: string;
    name: string;
    niche: string;
    location: string;
    created_at: string;
  };
  return { ...row, createdAt: row.created_at, leadIds: [] };
}

/** Public read for the hosted preview route — works without a session. */
export async function fetchPublishedSite(slug: string): Promise<{ html: string } | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("html")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as { html: string } | null) ?? null;
}
