import { supabase } from "./supabase";
import type {
  Alert,
  Campaign,
  Enrichment,
  Enrollment,
  Integration,
  Lead,
  LeadSite,
  OutreachMessage,
  Profile,
  Provider,
  ScoreReason,
  Schedule,
  Sequence,
  SequenceStep,
  SiteAudit,
  SiteSection,
  SiteVariant,
  VisitStats,
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
  images: string[] | null;
  follow_up_at: string | null;
  site_audit: SiteAudit | null;
  score: number;
  reasons: ScoreReason[];
  stage: string;
  message: Lead["message"] | null;
  activities: { at: string; text: string }[];
  created_at: string;
  email: string | null;
  enriched: Enrichment | null;
  engagement: number;
  hot_at: string | null;
  never_contact: boolean;
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
  variants: SiteVariant[] | null;
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
    variants: row.variants ?? [],
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
    images: row.images ?? [],
    followUpAt: row.follow_up_at ?? undefined,
    siteAudit: row.site_audit ?? undefined,
    score: row.score,
    reasons: row.reasons ?? [],
    stage: row.stage as Stage,
    campaignId: row.campaign_id ?? undefined,
    site: site ? toSite(site) : undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
    activities: row.activities ?? [],
    email: row.email ?? undefined,
    engagement: row.engagement ?? 0,
    hotAt: row.hot_at ?? undefined,
    enriched: row.enriched ?? undefined,
    neverContact: row.never_contact ?? false,
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
    images: lead.images ?? [],
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
  if (patch.images !== undefined) out["images"] = patch.images ?? [];
  // `followUpAt` present but undefined means "clear it".
  if ("followUpAt" in patch) out["follow_up_at"] = patch.followUpAt ?? null;
  if (patch.siteAudit !== undefined) out["site_audit"] = patch.siteAudit ?? null;
  if (patch.email !== undefined) out["email"] = patch.email ?? null;
  if (patch.enriched !== undefined) out["enriched"] = patch.enriched ?? {};
  if (patch.neverContact !== undefined) out["never_contact"] = patch.neverContact;
  // `engagement` and `hot_at` are owned by the database triggers, never by the
  // browser — a tab must not be able to talk itself into a hot lead.
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

/** Extra settings that ride along an integration, e.g. the Netlify domain. */
export async function saveIntegrationMeta(
  userId: string,
  provider: Provider,
  meta: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("integrations")
    .update({ meta, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
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

/**
 * Debits credits through a security-definer function. The browser used to read
 * the balance, subtract and write it back, which meant anyone with the console
 * open could hand themselves free runs. Postgres now owns the arithmetic and
 * refuses to go below zero.
 */
export async function spendCredits(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc("spend_credits", { amount });
  if (error) {
    if (/insufficient credits/i.test(error.message)) {
      throw new Error("Créditos insuficientes para esta ação.");
    }
    throw error;
  }
  return data as number;
}

/**
 * Inserts scraped leads, skipping any the user already has. The name/city check
 * below is a cheap prefilter; the unique index on (user_id, place_id) is what
 * actually enforces dedupe, so a concurrent run can't slip a duplicate past us.
 */
export async function insertLeads(
  userId: string,
  leads: Lead[],
  campaignId?: string,
): Promise<Lead[]> {
  if (leads.length === 0) return [];

  const { data: existing } = await supabase.from("leads").select("name, city, place_id");
  const rows = (existing as { name: string; city: string; place_id: string | null }[] | null) ?? [];
  const seen = new Set(rows.map((l) => `${l.name.toLowerCase()}|${l.city.toLowerCase()}`));
  const places = new Set(rows.map((l) => l.place_id).filter(Boolean));
  const fresh = leads.filter(
    (l) =>
      !(l.placeId && places.has(l.placeId)) &&
      !seen.has(`${l.name.toLowerCase()}|${l.city.toLowerCase()}`),
  );
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
  site: {
    template: string;
    content: SiteSection;
    html: string;
    slug: string;
    variants?: SiteVariant[] | undefined;
  },
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
        ...(site.variants ? { variants: site.variants } : {}),
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

/* -------------------------------------------------------------------------- */
/*  Engagement                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rolls the raw beacon rows up per lead. This is the signal that changes how a
 * seller works the list: a business that opened the demo three times is a call
 * to make today, not a message to send someday.
 */
export async function fetchVisitStats(): Promise<Map<string, VisitStats>> {
  const { data, error } = await supabase
    .from("site_visits")
    .select("lead_id, kind, seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return new Map();

  const rows =
    (data as { lead_id: string; kind: string; seconds: number; created_at: string }[] | null) ?? [];
  const out = new Map<string, VisitStats>();
  for (const r of rows) {
    const cur = out.get(r.lead_id) ?? { views: 0, whatsappClicks: 0, seconds: 0 };
    if (r.kind === "view") cur.views++;
    if (r.kind === "whatsapp") cur.whatsappClicks++;
    cur.seconds = Math.max(cur.seconds, r.seconds ?? 0);
    // Rows arrive newest first, so the first one seen per lead is the latest.
    cur.lastAt ??= r.created_at;
    out.set(r.lead_id, cur);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                       */
/*  Campaign work is written down before it runs, so closing the tab pauses it */
/*  instead of losing it.                                                      */
/* -------------------------------------------------------------------------- */

export type JobKind =
  | "site"
  | "publish"
  | "message"
  | "outreach"
  | "followup"
  | "prospect"
  | "audit"
  | "enrich"
  | "rescan";

export type JobRow = {
  id: string;
  campaign_id: string | null;
  lead_id: string | null;
  kind: JobKind;
  status: "pending" | "running" | "done" | "failed";
  error: string | null;
  attempts: number;
  created_at: string;
  /** When the work becomes due. A cadence step is work scheduled for a date. */
  due_at: string;
  payload: Record<string, unknown>;
};

export type NewJob = {
  leadId?: string | undefined;
  kind: JobKind;
  campaignId?: string | undefined;
  /** Omit for "as soon as possible". */
  dueAt?: string | undefined;
  payload?: Record<string, unknown> | undefined;
};

export async function enqueueJobs(userId: string, jobs: NewJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const { error } = await supabase.from("jobs").insert(
    jobs.map((j) => ({
      user_id: userId,
      lead_id: j.leadId ?? null,
      campaign_id: j.campaignId ?? null,
      kind: j.kind,
      due_at: j.dueAt ?? new Date().toISOString(),
      payload: j.payload ?? {},
    })),
  );
  if (error) throw error;
}

/**
 * Only work that is actually due. A follow-up scheduled for Thursday sits in
 * this table all week without a runner ever picking it up.
 */
export async function fetchPendingJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(200);
  if (error) return [];
  return (data as JobRow[] | null) ?? [];
}

/** Everything queued, due or not — the "o que está agendado" view. */
export async function fetchAllJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("due_at", { ascending: true })
    .limit(500);
  if (error) return [];
  return (data as JobRow[] | null) ?? [];
}

export async function markJob(
  id: string,
  status: JobRow["status"],
  error?: string | undefined,
): Promise<void> {
  await supabase
    .from("jobs")
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/** Drops finished work so the queue view stays about what is left to do. */
export async function clearFinishedJobs(): Promise<void> {
  await supabase.from("jobs").delete().in("status", ["done", "failed"]);
}

/* -------------------------------------------------------------------------- */
/*  Sequences — the cadence templates                                          */
/* -------------------------------------------------------------------------- */

type SequenceRow = {
  id: string;
  name: string;
  steps: SequenceStep[];
  active: boolean;
  created_at: string;
};

function toSequence(r: SequenceRow): Sequence {
  return {
    id: r.id,
    name: r.name,
    steps: r.steps ?? [],
    active: r.active,
    createdAt: r.created_at,
  };
}

export async function fetchSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from("sequences")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return [];
  return ((data as SequenceRow[] | null) ?? []).map(toSequence);
}

export async function createSequence(
  userId: string,
  s: { name: string; steps: SequenceStep[] },
): Promise<Sequence> {
  const { data, error } = await supabase
    .from("sequences")
    .insert({ user_id: userId, name: s.name, steps: s.steps })
    .select("*")
    .single();
  if (error) throw error;
  return toSequence(data as SequenceRow);
}

export async function patchSequence(id: string, patch: Partial<Sequence>): Promise<void> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out["name"] = patch.name;
  if (patch.steps !== undefined) out["steps"] = patch.steps;
  if (patch.active !== undefined) out["active"] = patch.active;
  if (Object.keys(out).length === 0) return;
  const { error } = await supabase.from("sequences").update(out).eq("id", id);
  if (error) throw error;
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase.from("sequences").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/*  Enrollments — a lead walking through a cadence                             */
/* -------------------------------------------------------------------------- */

type EnrollmentRow = {
  id: string;
  lead_id: string;
  sequence_id: string;
  step: number;
  status: Enrollment["status"];
  next_at: string;
  stopped_reason: string | null;
};

function toEnrollment(r: EnrollmentRow): Enrollment {
  return {
    id: r.id,
    leadId: r.lead_id,
    sequenceId: r.sequence_id,
    step: r.step,
    status: r.status,
    nextAt: r.next_at,
    stoppedReason: r.stopped_reason ?? undefined,
  };
}

export async function fetchEnrollments(): Promise<Map<string, Enrollment>> {
  const { data, error } = await supabase.from("enrollments").select("*");
  if (error) return new Map();
  return new Map(
    ((data as EnrollmentRow[] | null) ?? []).map((r) => [r.lead_id, toEnrollment(r)] as const),
  );
}

/**
 * Puts a lead into a cadence. Re-enrolling a lead that already finished one
 * restarts it from the top rather than erroring — the seller asked for another
 * run at this business, and the unique index on lead_id makes that an upsert.
 */
export async function enroll(
  userId: string,
  leadId: string,
  sequenceId: string,
): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        user_id: userId,
        lead_id: leadId,
        sequence_id: sequenceId,
        step: 0,
        status: "active",
        next_at: new Date().toISOString(),
        stopped_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return toEnrollment(data as EnrollmentRow);
}

export async function stopEnrollment(leadId: string, reason: string): Promise<void> {
  await supabase
    .from("enrollments")
    .update({ status: "stopped", stopped_reason: reason, updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("status", "active");
}

/** Banks the step just sent and schedules the next one. Postgres owns the maths. */
export async function advanceEnrollment(leadId: string): Promise<void> {
  const { error } = await supabase.rpc("advance_enrollment", { p_lead: leadId });
  if (error) throw error;
}

/** Enrolled leads whose next touch has come due. */
export async function fetchDueEnrollments(): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("status", "active")
    .lte("next_at", new Date().toISOString())
    .order("next_at", { ascending: true })
    .limit(100);
  if (error) return [];
  return ((data as EnrollmentRow[] | null) ?? []).map(toEnrollment);
}

/* -------------------------------------------------------------------------- */
/*  Schedules — prospecting that repeats without the user                      */
/* -------------------------------------------------------------------------- */

type ScheduleRow = {
  id: string;
  name: string;
  niche: string;
  location: string;
  filters: Record<string, unknown>;
  frequency: Schedule["frequency"];
  weekday: number;
  hour: number;
  lead_limit: number;
  min_score: number;
  auto_site: boolean;
  auto_publish: boolean;
  auto_message: boolean;
  sequence_id: string | null;
  active: boolean;
  last_run_at: string | null;
  next_run_at: string;
};

function toSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    name: r.name,
    niche: r.niche,
    location: r.location,
    filters: r.filters ?? {},
    frequency: r.frequency,
    weekday: r.weekday,
    hour: r.hour,
    leadLimit: r.lead_limit,
    minScore: r.min_score,
    autoSite: r.auto_site,
    autoPublish: r.auto_publish,
    autoMessage: r.auto_message,
    sequenceId: r.sequence_id ?? undefined,
    active: r.active,
    lastRunAt: r.last_run_at ?? undefined,
    nextRunAt: r.next_run_at,
  };
}

function scheduleWrite(s: Partial<Schedule>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.name !== undefined) out["name"] = s.name;
  if (s.niche !== undefined) out["niche"] = s.niche;
  if (s.location !== undefined) out["location"] = s.location;
  if (s.filters !== undefined) out["filters"] = s.filters;
  if (s.frequency !== undefined) out["frequency"] = s.frequency;
  if (s.weekday !== undefined) out["weekday"] = s.weekday;
  if (s.hour !== undefined) out["hour"] = s.hour;
  if (s.leadLimit !== undefined) out["lead_limit"] = s.leadLimit;
  if (s.minScore !== undefined) out["min_score"] = s.minScore;
  if (s.autoSite !== undefined) out["auto_site"] = s.autoSite;
  if (s.autoPublish !== undefined) out["auto_publish"] = s.autoPublish;
  if (s.autoMessage !== undefined) out["auto_message"] = s.autoMessage;
  if (s.sequenceId !== undefined) out["sequence_id"] = s.sequenceId ?? null;
  if (s.active !== undefined) out["active"] = s.active;
  if (s.nextRunAt !== undefined) out["next_run_at"] = s.nextRunAt;
  if (s.lastRunAt !== undefined) out["last_run_at"] = s.lastRunAt;
  return out;
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .order("next_run_at", { ascending: true });
  if (error) return [];
  return ((data as ScheduleRow[] | null) ?? []).map(toSchedule);
}

export async function createSchedule(
  userId: string,
  s: Partial<Schedule> & { nextRunAt: string },
): Promise<Schedule> {
  const { data, error } = await supabase
    .from("schedules")
    .insert({ user_id: userId, ...scheduleWrite(s) })
    .select("*")
    .single();
  if (error) throw error;
  return toSchedule(data as ScheduleRow);
}

export async function patchSchedule(id: string, patch: Partial<Schedule>): Promise<void> {
  const out = scheduleWrite(patch);
  if (Object.keys(out).length === 0) return;
  const { error } = await supabase.from("schedules").update(out).eq("id", id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/*  Messages — the conversation, in both directions                            */
/* -------------------------------------------------------------------------- */

type MessageRow = {
  id: string;
  lead_id: string;
  direction: OutreachMessage["direction"];
  channel: OutreachMessage["channel"];
  tone: string;
  variant: string;
  step: number;
  body: string;
  status: OutreachMessage["status"];
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

function toMessage(r: MessageRow): OutreachMessage {
  return {
    id: r.id,
    leadId: r.lead_id,
    direction: r.direction,
    channel: r.channel,
    tone: r.tone,
    variant: r.variant,
    step: r.step,
    body: r.body,
    status: r.status,
    error: r.error ?? undefined,
    createdAt: r.created_at,
    sentAt: r.sent_at ?? undefined,
  };
}

export async function fetchMessages(limit = 500): Promise<OutreachMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data as MessageRow[] | null) ?? []).map(toMessage);
}

export async function logMessage(
  userId: string,
  m: {
    leadId: string;
    direction?: OutreachMessage["direction"] | undefined;
    channel?: OutreachMessage["channel"] | undefined;
    tone?: string | undefined;
    variant?: string | undefined;
    step?: number | undefined;
    body: string;
    status: OutreachMessage["status"];
    providerMessageId?: string | undefined;
    error?: string | undefined;
  },
): Promise<OutreachMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: userId,
      lead_id: m.leadId,
      direction: m.direction ?? "out",
      channel: m.channel ?? "whatsapp",
      tone: m.tone ?? "",
      variant: m.variant ?? "A",
      step: m.step ?? 0,
      body: m.body,
      status: m.status,
      provider_message_id: m.providerMessageId ?? null,
      error: m.error ?? null,
      sent_at: m.status === "sent" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toMessage(data as MessageRow);
}

/* -------------------------------------------------------------------------- */
/*  Alerts — raised by the database, read by whoever opens the app             */
/* -------------------------------------------------------------------------- */

type AlertRow = {
  id: string;
  lead_id: string | null;
  kind: Alert["kind"];
  body: string;
  read: boolean;
  created_at: string;
};

function toAlert(r: AlertRow): Alert {
  return {
    id: r.id,
    leadId: r.lead_id ?? undefined,
    kind: r.kind,
    body: r.body,
    read: r.read,
    createdAt: r.created_at,
  };
}

export async function fetchAlerts(limit = 50): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data as AlertRow[] | null) ?? []).map(toAlert);
}

export async function markAlertsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from("alerts").update({ read: true }).in("id", ids);
}

export async function raiseAlert(
  userId: string,
  a: { leadId?: string | undefined; kind: Alert["kind"]; body: string },
): Promise<void> {
  await supabase
    .from("alerts")
    .insert({ user_id: userId, lead_id: a.leadId ?? null, kind: a.kind, body: a.body });
}

/**
 * Pushes a job into the future without failing it. Used when work comes due
 * outside the sending window: the touch is not lost, it just waits for a
 * civilised hour.
 */
export async function rescheduleJob(id: string, dueAt: string): Promise<void> {
  await supabase
    .from("jobs")
    .update({ status: "pending", due_at: dueAt, updated_at: new Date().toISOString() })
    .eq("id", id);
}
