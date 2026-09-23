import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import * as db from "./db";
import { supabase } from "./supabase";
import { computeScore, defaultFilters, slugify, type Filters } from "./score";
import { stageIndex } from "./buckets";
import { scrapeLeads } from "./rpc/apify";
import { generateSite, generateMessage, generateDiagnostic } from "./rpc/llm";
import { publishSite as publishToNetlify } from "./rpc/netlify";
import { auditSite } from "./rpc/audit";
import { sendWhatsAppMessage, checkWhatsApp, type WaStatus } from "./rpc/whatsapp";
import { enrichLead as enrichLeadRpc } from "./rpc/enrich";
import { publishGithubFile } from "./rpc/github";
import { renderSiteHtml } from "./site-renderer";
import { renderDiagnosticHtml } from "./diagnostic-renderer";
import { computeGmbAudit } from "./gmb";
import { computeDiagnosticScore } from "./diagnostic-score";
import type {
  Alert,
  Campaign,
  Channel,
  DiagnosticContent,
  DiagnosticFindings,
  Enrollment,
  Integration,
  Lead,
  LlmProvider,
  OutreachMessage,
  Profile,
  Provider,
  Schedule,
  Sequence,
  SequenceStep,
  SiteAudit,
  SiteSection,
  Stage,
  Tone,
  WhatsAppSettings,
} from "./types";
import { DEFAULT_SEQUENCE_STEPS, DEFAULT_WHATSAPP_SETTINGS } from "./types";

type State = {
  leads: Lead[];
  campaigns: Campaign[];
  profile: Profile;
  credits: number;
  integrations: Integration[];
  loading: boolean;
  /** Work still to do. Written to the database before it runs. */
  queue: db.JobRow[];
  /** True while this tab is draining the queue. */
  working: boolean;
  /** Cadence templates the user has defined. */
  sequences: Sequence[];
  /** Recurring prospecting runs. */
  schedules: Schedule[];
  /** Raised by the database when a lead engages. */
  alerts: Alert[];
  /** The conversation log, both directions, newest first. */
  messages: OutreachMessage[];
  /** Where each enrolled lead is in its cadence, keyed by lead id. */
  enrollments: Map<string, Enrollment>;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  email: "",
  sells: "Sites",
  targets: [],
  location: "",
  onboarded: false,
  plan: "Free",
};

const COST = { lead: 1, site: 5, message: 1, diagnostic: 5 } as const;

/** What one credit of each action actually costs us in API spend, in USD. */
export const COST_USD = { lead: 0.007, site: 0.06, message: 0.004, diagnostic: 0.03 } as const;

/** What a queue run accomplished, reported by kind. */
export type QueueResult = {
  sites: number;
  published: number;
  messages: number;
  /** Touches actually delivered through the connected instance. */
  sent: number;
  enriched: number;
  prospected: number;
  /** Work that came due outside the sending window and was pushed forward. */
  held: number;
  failed: number;
};

const EMPTY_RESULT: QueueResult = {
  sites: 0,
  published: 0,
  messages: 0,
  sent: 0,
  enriched: 0,
  prospected: 0,
  held: 0,
  failed: 0,
};

export type ImportRow = {
  name: string;
  category?: string | undefined;
  city?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  address?: string | undefined;
};

/** The app's own origin, which the published pages report their visits to. */
/** ISO timestamp N days from now, for follow-up scheduling. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function appOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/* -------------------------------------------------------------------------- */
/*  Sending window                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The next moment it is acceptable to message a business. A cadence step that
 * comes due at 23:40 must not fire at 23:40: nothing burns a number — or a
 * relationship — faster than a sales message at midnight.
 */
function nextSendableAt(settings: WhatsAppSettings, from = new Date()): Date {
  const start = settings.windowStart ?? 8;
  const end = settings.windowEnd ?? 20;
  if (start >= end) return from; // window disabled by an inverted range

  const at = new Date(from);
  if (at.getHours() >= end) {
    at.setDate(at.getDate() + 1);
    at.setHours(start, 0, 0, 0);
  } else if (at.getHours() < start) {
    at.setHours(start, 0, 0, 0);
  }
  return at;
}

function withinWindow(settings: WhatsAppSettings, at = new Date()): boolean {
  const start = settings.windowStart ?? 8;
  const end = settings.windowEnd ?? 20;
  if (start >= end) return true;
  return at.getHours() >= start && at.getHours() < end;
}

/** Next occurrence of a schedule, in the user's own clock. */
function nextRunFor(
  s: Pick<Schedule, "frequency" | "weekday" | "hour">,
  from = new Date(),
): string {
  const at = new Date(from);
  at.setHours(s.hour, 0, 0, 0);
  if (at <= from) at.setDate(at.getDate() + 1);
  if (s.frequency === "weekly") {
    while (at.getDay() !== s.weekday) at.setDate(at.getDate() + 1);
  }
  return at.toISOString();
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One run of a recurring prospecting schedule: find the businesses, keep only
 * the ones worth the API spend, and write down everything that should happen to
 * them. The work itself is queued rather than executed here, so a schedule that
 * finds forty leads doesn't block on forty site generations.
 */
async function runScheduleNow(ctx: Ctx, uid: string, s: Schedule): Promise<number> {
  const filters: Filters = {
    ...defaultFilters,
    ...(s.filters as Partial<Filters>),
    limit: s.leadLimit,
  };

  const found = await ctx.prospect(s.niche, s.location, filters);
  const chosen = found.filter((l) => l.score >= s.minScore);

  const jobs: db.NewJob[] = [];
  for (const lead of chosen) {
    jobs.push({ leadId: lead.id, kind: "enrich" });
    if (s.autoSite) jobs.push({ leadId: lead.id, kind: "site" });
    if (s.autoPublish) jobs.push({ leadId: lead.id, kind: "publish" });
    if (s.autoMessage) {
      // The sequence id rides along so the lead enters its cadence the moment
      // it has a message to send — no second pass, no forgotten leads.
      jobs.push({
        leadId: lead.id,
        kind: "message",
        payload: s.sequenceId ? { sequenceId: s.sequenceId } : {},
      });
    }
  }

  await db.enqueueJobs(uid, jobs);
  await db.patchSchedule(s.id, {
    lastRunAt: new Date().toISOString(),
    nextRunAt: nextRunFor(s),
  });
  await db.raiseAlert(uid, {
    kind: "system",
    body:
      `Agendamento “${s.name}”: ${found.length} negócio(s) novo(s), ` +
      `${chosen.length} acima de ${s.minScore} pontos entraram na esteira.`,
  });

  return chosen.length;
}

type Ctx = {
  state: State;
  refresh: () => Promise<void>;

  /** Which API keys are plugged in — the UI blocks actions that would fail. */
  keyFor: (provider: Provider) => string | undefined;
  llmProvider: LlmProvider | null;
  saveKey: (provider: Provider, apiKey: string) => Promise<void>;
  /** Root domain the published demos hang off, e.g. "demos.minhaagencia.com". */
  setPublishDomain: (domain: string) => Promise<void>;
  githubRepository: string | undefined;
  setGithubRepository: (repository: string) => Promise<void>;
  removeKey: (provider: Provider) => Promise<void>;

  prospect: (niche: string, location: string, filters: Filters) => Promise<Lead[]>;
  buildSite: (id: string) => Promise<void>;
  publishSite: (id: string) => Promise<string>;
  publishGithubSite: (id: string) => Promise<string>;
  buildDiagnostic: (id: string) => Promise<void>;
  publishDiagnostic: (id: string) => Promise<string>;
  writeMessage: (
    id: string,
    tone: "Direta" | "Consultiva" | "Casual",
    channel: "WhatsApp" | "Email",
  ) => Promise<string>;

  /** Runs PageSpeed on the lead's current site — the sales argument. */
  auditLead: (id: string) => Promise<SiteAudit>;
  /**
   * Sends the message. Through the user's own connected instance when there is
   * one, and by opening wa.me otherwise — the manual path never goes away.
   */
  sendWhatsApp: (id: string) => Promise<{ automated: boolean }>;

  /* -- The user's own WhatsApp instance ----------------------------------- */

  whatsapp: WhatsAppSettings;
  /** True once an instance is configured well enough to attempt a send. */
  whatsappReady: boolean;
  saveWhatsApp: (settings: Partial<WhatsAppSettings>, token?: string) => Promise<void>;
  testWhatsApp: () => Promise<WaStatus>;
  /** The URL to paste into the provider's webhook field. */
  webhookUrl: string;

  /* -- Cadence ------------------------------------------------------------ */

  /** Puts a lead into a cadence, sending the first touch straight away. */
  enrollLead: (id: string, sequenceId?: string) => Promise<void>;
  stopCadence: (id: string, reason: string) => Promise<void>;
  createSequence: (name: string, steps: SequenceStep[]) => Promise<Sequence>;
  updateSequence: (id: string, patch: Partial<Sequence>) => Promise<void>;
  removeSequence: (id: string) => Promise<void>;

  /* -- Recurring prospecting ---------------------------------------------- */

  createSchedule: (s: Partial<Schedule>) => Promise<Schedule>;
  updateSchedule: (id: string, patch: Partial<Schedule>) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  /** Runs one schedule immediately, ignoring its clock. */
  runSchedule: (id: string) => Promise<number>;

  /* -- Signal ------------------------------------------------------------- */

  /** Turns due cadence steps and due schedules into queued work. */
  sweep: () => Promise<number>;
  dismissAlerts: (ids: string[]) => Promise<void>;
  /** Reads the lead's own site and the registry for pitch angles. */
  enrich: (id: string) => Promise<void>;
  /** Excludes a lead from every automation, permanently. */
  setNeverContact: (id: string, value: boolean) => Promise<void>;
  /** Schedules the next touch. Cold outreach closes on the 2nd/3rd try. */
  setFollowUp: (id: string, days: number | null) => Promise<void>;
  /** Adds leads from a CSV the user already had. */
  importLeads: (rows: ImportRow[]) => Promise<number>;
  /** Promotes one of the alternative takes to be the site that gets published. */
  chooseVariant: (id: string, index: number) => Promise<void>;

  /** Writes the work down first, so closing the tab pauses instead of losing. */
  enqueue: (jobs: db.NewJob[]) => Promise<void>;
  /** Works through the pending queue, one job at a time. */
  drainQueue: () => Promise<QueueResult>;

  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  patchSiteContent: (id: string, patch: Partial<SiteSection>) => Promise<void>;
  moveLead: (id: string, stage: Stage) => Promise<void>;
  createCampaign: (c: { name: string; niche: string; location: string }) => Promise<Campaign>;
  setProfile: (p: Partial<Profile>) => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [state, setState] = useState<State>({
    leads: [],
    campaigns: [],
    profile: EMPTY_PROFILE,
    credits: 0,
    integrations: [],
    loading: true,
    queue: [],
    working: false,
    sequences: [],
    schedules: [],
    alerts: [],
    messages: [],
    enrollments: new Map(),
  });

  // Mirror of state.leads kept in sync synchronously. Chained actions (scrape →
  // generate → publish → write) run faster than React re-renders, so reading
  // leads off `state` inside one async sequence would see a stale list.
  const leadsRef = useRef<Lead[]>([]);

  const setLeads = useCallback((fn: (prev: Lead[]) => Lead[]) => {
    setState((s) => {
      const leads = fn(s.leads);
      leadsRef.current = leads;
      return { ...s, leads };
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      leadsRef.current = [];
      setState((s) => ({
        ...s,
        leads: [],
        campaigns: [],
        integrations: [],
        queue: [],
        sequences: [],
        schedules: [],
        alerts: [],
        messages: [],
        enrollments: new Map(),
        loading: false,
      }));
      return;
    }
    const [
      raw,
      campaigns,
      profile,
      integrations,
      visits,
      queue,
      sequences,
      schedules,
      alerts,
      messages,
      enrollments,
    ] = await Promise.all([
      db.fetchLeads(),
      db.fetchCampaigns(),
      db.fetchProfile(user.id),
      db.fetchIntegrations(),
      db.fetchVisitStats(),
      db.fetchPendingJobs(),
      db.fetchSequences(),
      db.fetchSchedules(),
      db.fetchAlerts(),
      db.fetchMessages(),
      db.fetchEnrollments(),
    ]);
    // Engagement lives in its own table; it is folded onto the leads here so
    // every screen can show "opened your site" without a second query.
    const leads = raw.map((l) => {
      const v = visits.get(l.id);
      const e = enrollments.get(l.id);
      return v || e ? { ...l, ...(v ? { visits: v } : {}), ...(e ? { enrollment: e } : {}) } : l;
    });
    leadsRef.current = leads;
    setState({
      leads,
      campaigns,
      profile: profile.profile,
      credits: profile.credits,
      integrations,
      queue,
      sequences,
      schedules,
      alerts,
      messages,
      enrollments,
      working: false,
      loading: false,
    });
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  const keyFor = useCallback(
    (provider: Provider) => state.integrations.find((i) => i.provider === provider)?.apiKey,
    [state.integrations],
  );

  // Prefer Claude when both are plugged in; it writes better HTML.
  const llmProvider: LlmProvider | null = keyFor("anthropic")
    ? "anthropic"
    : keyFor("openai")
      ? "openai"
      : null;

  // The user's own instance. Credentials live in `integrations`, everything
  // else — dialect, throttle, sending window — rides in its `meta`.
  const whatsapp = useMemo<WhatsAppSettings>(() => {
    const row = state.integrations.find((i) => i.provider === "whatsapp");
    return { ...DEFAULT_WHATSAPP_SETTINGS, ...((row?.meta ?? {}) as Partial<WhatsAppSettings>) };
  }, [state.integrations]);

  const whatsappToken = keyFor("whatsapp");
  const whatsappReady = Boolean(whatsappToken && whatsapp.baseUrl.trim());

  const patchLocalLead = useCallback(
    (id: string, patch: Partial<Lead>) => {
      setLeads((leads) => leads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    },
    [setLeads],
  );

  // The queue runner calls the very actions defined below it, so it reads them
  // back through a ref instead of closing over a half-built object.
  const ctxRef = useRef<Ctx | null>(null);
  const drainingRef = useRef(false);

  const requireLead = useCallback((id: string) => {
    const lead = leadsRef.current.find((l) => l.id === id);
    if (!lead) throw new Error("Lead não encontrado.");
    return lead;
  }, []);

  const requireLlm = useCallback(() => {
    if (!llmProvider) {
      throw new Error("Configure uma chave da Anthropic ou da OpenAI em Configurações.");
    }
    return { provider: llmProvider, apiKey: keyFor(llmProvider)! };
  }, [llmProvider, keyFor]);

  const value = useMemo<Ctx>(() => {
    const uid = user?.id;

    return {
      state,
      refresh,
      keyFor,
      llmProvider,
      githubRepository: state.integrations.find((i) => i.provider === "github")?.meta[
        "repository"
      ] as string | undefined,

      saveKey: async (provider, apiKey) => {
        if (!uid) throw new Error("Faça login primeiro.");
        await db.saveIntegration(uid, provider, apiKey);
        setState((s) => ({
          ...s,
          integrations: [
            ...s.integrations.filter((i) => i.provider !== provider),
            { provider, apiKey, meta: {} },
          ],
        }));
      },

      setPublishDomain: async (domain) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const meta = { domain: domain.trim() };
        await db.saveIntegrationMeta(uid, "netlify", meta);
        setState((st) => ({
          ...st,
          integrations: st.integrations.map((i) => (i.provider === "netlify" ? { ...i, meta } : i)),
        }));
      },

      setGithubRepository: async (repository) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const current = state.integrations.find((i) => i.provider === "github");
        await db.saveIntegrationMeta(uid, "github", { ...(current?.meta ?? {}), repository });
        setState((st) => ({
          ...st,
          integrations: st.integrations.map((i) =>
            i.provider === "github" ? { ...i, meta: { ...i.meta, repository } } : i,
          ),
        }));
      },

      removeKey: async (provider) => {
        if (!uid) return;
        await db.deleteIntegration(uid, provider);
        setState((s) => ({
          ...s,
          integrations: s.integrations.filter((i) => i.provider !== provider),
        }));
      },

      prospect: async (niche, location, filters) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const apiKey = keyFor("apify");
        if (!apiKey) throw new Error("Configure sua chave da Apify em Configurações.");

        const found = await scrapeLeads({ data: { apiKey, niche, location, filters } });
        if (found.length === 0) return [];

        const campaign = await db.createCampaignRow(uid, {
          name: `${niche} — ${location}`.trim(),
          niche,
          location,
        });
        const saved = await db.insertLeads(uid, found, campaign.id);
        const credits = await db.spendCredits(saved.length * COST.lead);

        setLeads((leads) => [...saved, ...leads]);
        setState((s) => ({
          ...s,
          campaigns: [{ ...campaign, leadIds: saved.map((l) => l.id) }, ...s.campaigns],
          credits,
        }));
        return saved;
      },

      buildSite: async (id) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        const { provider, apiKey } = requireLlm();

        // Reuse the slug on regeneration so a published URL stays stable — and
        // so the visit beacon keeps reporting under the same key.
        const slug = lead.site?.slug ?? `${slugify(lead.name)}-${lead.id.slice(0, 6)}`;

        const generated = await generateSite({
          data: {
            provider,
            apiKey,
            lead,
            sells: state.profile.sells,
            // Repair path for leads saved before photos were persisted.
            apifyKey: keyFor("apify"),
            slug,
            trackUrl: appOrigin(),
            withVariant: true,
          },
        });

        // Photos fetched during generation are written back to the lead, so a
        // regeneration never pays for the same Apify run twice.
        const photos = generated.content.images ?? [];
        const recovered = photos.length > 0 && (lead.images ?? []).length === 0;
        if (recovered) await db.patchLead(id, { images: photos });

        if (generated.photos === "stock") {
          toast.warning(
            generated.photoWarning
              ? `Site gerado com imagens de banco: ${generated.photoWarning}`
              : "Este negócio não tem fotos no Google Maps — o site usa imagens de banco.",
          );
        }

        const site = await db.upsertSite(uid, id, { ...generated, slug });

        const nextStage: Stage =
          lead.stage === "Novo" || lead.stage === "Qualificado" ? "Site criado" : lead.stage;
        const activities = await db.appendActivity(lead, "Site gerado pela IA");
        await db.patchLead(id, { stage: nextStage });
        const credits = await db.spendCredits(COST.site);

        patchLocalLead(id, {
          site,
          stage: nextStage,
          activities,
          ...(recovered ? { images: photos } : {}),
        });
        setState((s) => ({ ...s, credits }));
      },

      publishSite: async (id) => {
        const lead = requireLead(id);
        if (!lead.site) throw new Error("Gere o site antes de publicar.");
        const apiKey = keyFor("netlify");
        if (!apiKey) throw new Error("Configure seu token do Netlify em Configurações.");

        // An optional wildcard domain configured once in Configurações, so the
        // demos land on the seller's own domain instead of a netlify.app one.
        const root = (
          state.integrations.find((i) => i.provider === "netlify")?.meta["domain"] as
            string | undefined
        )?.trim();

        const result = await publishToNetlify({
          data: {
            apiKey,
            slug: lead.site.slug,
            html: lead.site.html,
            siteId: lead.site.netlifySiteId,
            domain: root ? `${lead.site.slug}.${root.replace(/^\.+/, "")}` : undefined,
          },
        });

        await db.markSitePublished(id, result.url, {
          netlifySiteId: result.siteId,
          deployId: result.deployId,
        });
        const activities = await db.appendActivity(lead, `Site publicado em ${result.url}`);
        patchLocalLead(id, {
          site: { ...lead.site, published: true, url: result.url, netlifySiteId: result.siteId },
          activities,
        });
        return result.url;
      },

      publishGithubSite: async (id) => {
        const lead = requireLead(id);
        if (!lead.site) throw new Error("Gere o site antes de publicar.");
        const token = keyFor("github");
        const repository = state.integrations.find((i) => i.provider === "github")?.meta[
          "repository"
        ] as string | undefined;
        if (!token) throw new Error("Conecte o GitHub em Configurações.");
        if (!repository) throw new Error("Selecione um repositório GitHub em Configurações.");

        const result = await publishGithubFile({
          data: {
            token,
            repository,
            file: {
              path: "index.html",
              content: lead.site.html,
              message: `Publica site de ${lead.name}`,
            },
          },
        });
        const activities = await db.appendActivity(lead, `Site enviado para GitHub: ${repository}`);
        patchLocalLead(id, { activities });
        return result.url;
      },

      writeMessage: async (id, tone, channel) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        const { provider, apiKey } = requireLlm();

        const text = await generateMessage({
          data: {
            provider,
            apiKey,
            lead,
            tone,
            channel,
            siteUrl: lead.site?.url ?? "",
            sells: state.profile.sells,
            senderName: state.profile.name,
          },
        });

        const message = { tone, channel, text };
        await db.patchLead(id, { message });
        const credits = await db.spendCredits(COST.message);
        patchLocalLead(id, { message });
        setState((s) => ({ ...s, credits }));
        return text;
      },

      auditLead: async (id) => {
        const lead = requireLead(id);
        if (!lead.website) throw new Error("Este lead não tem site atual para analisar.");
        const audit = await auditSite({
          data: { url: lead.website, apiKey: keyFor("google") },
        });
        await db.patchLead(id, { siteAudit: audit });
        const activities = await db.appendActivity(
          lead,
          `Site atual analisado: ${audit.performance}/100 no PageSpeed`,
        );
        patchLocalLead(id, { siteAudit: audit, activities });
        return audit;
      },

      buildDiagnostic: async (id) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        const { provider, apiKey } = requireLlm();

        // Reusa o slug na regeneração, do mesmo jeito que o site faz — o
        // beacon de visita continua reportando sob a mesma chave.
        const slug = lead.diagnostic?.slug ?? `diagnostico-${slugify(lead.name)}-${lead.id.slice(0, 6)}`;

        const siteAudit = lead.website
          ? (lead.siteAudit ??
            (await auditSite({ data: { url: lead.website, apiKey: keyFor("google") } })))
          : undefined;
        const gmb = computeGmbAudit(lead);
        const findings: DiagnosticFindings = { site: siteAudit, gmb };

        const generated = await generateDiagnostic({ data: { provider, apiKey, lead, findings } });
        const overallScore = computeDiagnosticScore(findings);
        const content: DiagnosticContent = { findings, overallScore, ...generated };
        const html = renderDiagnosticHtml(lead, content, { slug, trackUrl: appOrigin() });

        const diagnostic = await db.upsertDiagnostic(uid, id, { content, html, slug });

        const activities = await db.appendActivity(lead, "Diagnóstico de marketing gerado pela IA");
        const credits = await db.spendCredits(COST.diagnostic);

        // Um audit de PageSpeed rodado agora vale a pena guardar no lead
        // também — a mesma nota fica disponível fora do diagnóstico.
        if (siteAudit && !lead.siteAudit) await db.patchLead(id, { siteAudit });

        patchLocalLead(id, {
          diagnostic,
          activities,
          ...(siteAudit && !lead.siteAudit ? { siteAudit } : {}),
        });
        setState((s) => ({ ...s, credits }));
      },

      publishDiagnostic: async (id) => {
        const lead = requireLead(id);
        if (!lead.diagnostic) throw new Error("Gere o diagnóstico antes de publicar.");
        const apiKey = keyFor("netlify");
        if (!apiKey) throw new Error("Configure seu token do Netlify em Configurações.");

        const result = await publishToNetlify({
          data: {
            apiKey,
            slug: lead.diagnostic.slug,
            html: lead.diagnostic.html,
            siteId: lead.diagnostic.netlifySiteId,
          },
        });

        await db.markDiagnosticPublished(id, result.url, {
          netlifySiteId: result.siteId,
          deployId: result.deployId,
        });
        const activities = await db.appendActivity(lead, `Diagnóstico publicado em ${result.url}`);
        patchLocalLead(id, {
          diagnostic: {
            ...lead.diagnostic,
            published: true,
            url: result.url,
            netlifySiteId: result.siteId,
          },
          activities,
        });
        return result.url;
      },

      whatsapp,
      whatsappReady,
      webhookUrl: whatsapp.webhookToken ? `${appOrigin()}/api/wa/${whatsapp.webhookToken}` : "",

      saveWhatsApp: async (patch, token) => {
        if (!uid) throw new Error("Faça login primeiro.");
        // The webhook secret is minted once and never rotated behind the user's
        // back — the URL is already pasted into their provider's dashboard.
        const meta: WhatsAppSettings = {
          ...whatsapp,
          ...patch,
          webhookToken: whatsapp.webhookToken ?? randomToken(),
        };
        // The row must exist before its meta can be patched, and the token is
        // part of that row, so both writes happen here in order.
        await db.saveIntegration(uid, "whatsapp", token ?? whatsappToken ?? "");
        await db.saveIntegrationMeta(uid, "whatsapp", meta as unknown as Record<string, unknown>);
        setState((s) => ({
          ...s,
          integrations: [
            ...s.integrations.filter((i) => i.provider !== "whatsapp"),
            {
              provider: "whatsapp" as Provider,
              apiKey: token ?? whatsappToken ?? "",
              meta: meta as unknown as Record<string, unknown>,
            },
          ],
        }));
      },

      testWhatsApp: async () => {
        if (!whatsapp.baseUrl.trim()) throw new Error("Informe a Base URL da instância.");
        return checkWhatsApp({
          data: {
            baseUrl: whatsapp.baseUrl,
            instance: whatsapp.instance,
            token: whatsappToken ?? "",
            flavor: whatsapp.flavor,
            clientToken: whatsapp.clientToken,
          },
        });
      },

      sendWhatsApp: async (id) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        if (lead.neverContact) {
          throw new Error("Este lead está marcado como “não contatar”.");
        }
        const digits = lead.phone?.replace(/\D/g, "") ?? "";
        if (!digits) throw new Error("Este lead não tem telefone.");
        const number = digits.startsWith("55") ? digits : `55${digits}`;
        const text = lead.message?.text ?? "";
        if (!text.trim()) throw new Error("Gere a mensagem antes de enviar.");

        const tone = lead.message?.tone ?? "";
        const step = lead.enrollment?.step ?? 0;
        const log = { leadId: id, body: text, tone, variant: tone || "A", step };

        let automated = false;
        if (whatsappReady) {
          try {
            const res = await sendWhatsAppMessage({
              data: {
                baseUrl: whatsapp.baseUrl,
                instance: whatsapp.instance,
                token: whatsappToken ?? "",
                flavor: whatsapp.flavor,
                clientToken: whatsapp.clientToken,
                phone: number,
                text,
              },
            });
            await db.logMessage(uid, { ...log, status: "sent", providerMessageId: res.id });
            automated = true;
          } catch (err) {
            // A failed send is still a fact about this lead; losing it would
            // make the cadence retry blindly and the A/B numbers lie.
            const detail = err instanceof Error ? err.message : "erro no envio";
            await db.logMessage(uid, { ...log, status: "failed", error: detail });
            setState((s) => ({ ...s, messages: s.messages }));
            void refresh();
            throw err;
          }
        } else {
          // No instance connected: the original manual path, unchanged.
          window.open(
            `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
            "_blank",
            "noopener",
          );
          await db.logMessage(uid, { ...log, status: "sent" });
        }

        const stage: Stage =
          stageIndex(lead.stage) >= stageIndex("Contatado") ? lead.stage : "Contatado";
        const activities = await db.appendActivity(
          lead,
          automated ? "Mensagem enviada pela instância conectada" : "Mensagem aberta no WhatsApp",
        );
        await db.patchLead(id, { stage });

        // An enrolled lead gets its next touch from the cadence; a loose one
        // still gets the old three-day nudge so nothing falls through.
        if (lead.enrollment?.status === "active") {
          await db.advanceEnrollment(id);
        } else if (!lead.followUpAt) {
          await db.patchLead(id, { followUpAt: inDays(3) });
        }

        patchLocalLead(id, { stage, activities });
        void refresh();
        return { automated };
      },

      /* -- Cadence --------------------------------------------------------- */

      enrollLead: async (id, sequenceId) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        if (lead.neverContact) throw new Error("Este lead está marcado como “não contatar”.");
        if (!lead.phone) throw new Error("Este lead não tem telefone para uma cadência.");

        // A first cadence should not be a form the user has to fill in before
        // the feature does anything, so one is created on demand.
        let seqId = sequenceId ?? state.sequences.find((s) => s.active)?.id;
        if (!seqId) {
          const created = await db.createSequence(uid, {
            name: "Cadência padrão",
            steps: DEFAULT_SEQUENCE_STEPS,
          });
          seqId = created.id;
          setState((s) => ({ ...s, sequences: [...s.sequences, created] }));
        }

        const enrollment = await db.enroll(uid, id, seqId);
        const activities = await db.appendActivity(lead, "Entrou em cadência de follow-up");
        patchLocalLead(id, { enrollment, activities });
        setState((s) => ({ ...s, enrollments: new Map(s.enrollments).set(id, enrollment) }));

        // Step 0 is due immediately: enrolling is how you start, not how you
        // schedule starting.
        await db.enqueueJobs(uid, [{ leadId: id, kind: "outreach" }]);
        const pending = await db.fetchPendingJobs();
        setState((s) => ({ ...s, queue: pending }));
      },

      stopCadence: async (id, reason) => {
        const lead = requireLead(id);
        await db.stopEnrollment(id, reason);
        const activities = await db.appendActivity(lead, `Cadência interrompida: ${reason}`);
        patchLocalLead(id, {
          activities,
          ...(lead.enrollment
            ? { enrollment: { ...lead.enrollment, status: "stopped" as const } }
            : {}),
        });
      },

      createSequence: async (name, steps) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const created = await db.createSequence(uid, { name, steps });
        setState((s) => ({ ...s, sequences: [...s.sequences, created] }));
        return created;
      },

      updateSequence: async (id, patch) => {
        await db.patchSequence(id, patch);
        setState((s) => ({
          ...s,
          sequences: s.sequences.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        }));
      },

      removeSequence: async (id) => {
        await db.deleteSequence(id);
        setState((s) => ({ ...s, sequences: s.sequences.filter((q) => q.id !== id) }));
      },

      /* -- Recurring prospecting ------------------------------------------- */

      createSchedule: async (s) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const frequency = s.frequency ?? "weekly";
        const weekday = s.weekday ?? 1;
        const hour = s.hour ?? 8;
        const created = await db.createSchedule(uid, {
          ...s,
          frequency,
          weekday,
          hour,
          nextRunAt: nextRunFor({ frequency, weekday, hour }),
        });
        setState((st) => ({ ...st, schedules: [...st.schedules, created] }));
        return created;
      },

      updateSchedule: async (id, patch) => {
        // Changing when it runs must move the next run, or the edit silently
        // does nothing until after the old slot fires.
        const current = state.schedules.find((s) => s.id === id);
        const timingChanged =
          patch.frequency !== undefined || patch.weekday !== undefined || patch.hour !== undefined;
        const full =
          timingChanged && current
            ? {
                ...patch,
                nextRunAt: nextRunFor({
                  frequency: patch.frequency ?? current.frequency,
                  weekday: patch.weekday ?? current.weekday,
                  hour: patch.hour ?? current.hour,
                }),
              }
            : patch;
        await db.patchSchedule(id, full);
        setState((st) => ({
          ...st,
          schedules: st.schedules.map((s) => (s.id === id ? { ...s, ...full } : s)),
        }));
      },

      removeSchedule: async (id) => {
        await db.deleteSchedule(id);
        setState((st) => ({ ...st, schedules: st.schedules.filter((s) => s.id !== id) }));
      },

      runSchedule: async (id) => {
        const ctx = ctxRef.current;
        if (!ctx || !uid) throw new Error("Faça login primeiro.");
        const schedule = state.schedules.find((s) => s.id === id);
        if (!schedule) throw new Error("Agendamento não encontrado.");
        return runScheduleNow(ctx, uid, schedule);
      },

      /* -- Signal ----------------------------------------------------------- */

      sweep: async () => {
        if (!uid) return 0;
        const jobs: db.NewJob[] = [];

        // Due cadence steps.
        const due = await db.fetchDueEnrollments();
        for (const e of due) {
          const lead = leadsRef.current.find((l) => l.id === e.leadId);
          if (!lead || lead.neverContact) continue;
          // A lead that already replied is out of the cadence; the trigger
          // normally stops it, but a manual stage change wouldn't have.
          if (stageIndex(lead.stage) >= stageIndex("Respondeu")) {
            await db.stopEnrollment(e.leadId, "Já respondeu");
            continue;
          }
          jobs.push({ leadId: e.leadId, kind: "followup", payload: { step: e.step } });
        }

        // Due schedules.
        const now = new Date();
        for (const s of state.schedules) {
          if (!s.active || new Date(s.nextRunAt) > now) continue;
          jobs.push({ kind: "prospect", payload: { scheduleId: s.id } });
        }

        if (jobs.length === 0) return 0;
        await db.enqueueJobs(uid, jobs);
        const pending = await db.fetchPendingJobs();
        setState((st) => ({ ...st, queue: pending }));
        return jobs.length;
      },

      dismissAlerts: async (ids) => {
        await db.markAlertsRead(ids);
        setState((s) => ({
          ...s,
          alerts: s.alerts.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a)),
        }));
      },

      enrich: async (id) => {
        const lead = requireLead(id);
        const result = await enrichLeadRpc({
          data: {
            name: lead.name,
            website: lead.website,
            instagram: lead.instagram,
          },
        });
        const { emails, platform, copyrightYear, ...enriched } = result;
        const patch: Partial<Lead> = {
          enriched: {
            ...enriched,
            angles: [
              ...(enriched.angles ?? []),
              ...(platform ? [`Plataforma atual: ${platform}`] : []),
              ...(copyrightYear ? [`Rodapé de ${copyrightYear}`] : []),
            ],
          },
          ...(emails[0] ? { email: emails[0] } : {}),
        };
        await db.patchLead(id, patch);
        const activities = await db.appendActivity(
          lead,
          enriched.cnpj ? `Enriquecido — CNPJ ${enriched.cnpj}` : "Enriquecido a partir do site",
        );
        patchLocalLead(id, { ...patch, activities });
      },

      setNeverContact: async (id, value) => {
        const lead = requireLead(id);
        if (value) await db.stopEnrollment(id, "Marcado como não contatar");
        await db.patchLead(id, { neverContact: value });
        const activities = await db.appendActivity(
          lead,
          value ? "Marcado como não contatar" : "Voltou para as automações",
        );
        patchLocalLead(id, { neverContact: value, activities });
      },

      setFollowUp: async (id, days) => {
        const lead = requireLead(id);
        const followUpAt = days === null ? undefined : inDays(days);
        await db.patchLead(id, { followUpAt });
        const activities = await db.appendActivity(
          lead,
          days === null ? "Follow-up cancelado" : `Follow-up agendado para daqui a ${days} dia(s)`,
        );
        patchLocalLead(id, { followUpAt, activities });
      },

      importLeads: async (rows) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const now = new Date().toISOString();
        const leads: Lead[] = rows
          .filter((r) => r.name?.trim())
          .map((r) => {
            const partial = {
              name: r.name.trim(),
              category: r.category?.trim() || "Importado",
              city: r.city?.trim() || "",
              rating: 0,
              reviews: 0,
              hasWebsite: Boolean(r.website?.trim()),
              website: r.website?.trim() || undefined,
              phone: r.phone?.trim() || undefined,
              address: r.address?.trim() || "",
            };
            const { score, reasons } = computeScore(partial);
            return {
              id: crypto.randomUUID(),
              ...partial,
              score,
              reasons,
              engagement: 0,
              stage: "Novo" as Stage,
              createdAt: now,
              activities: [{ at: now, text: "Lead importado de CSV" }],
            };
          });
        if (leads.length === 0) return 0;
        const saved = await db.insertLeads(uid, leads);
        setLeads((prev) => [...saved, ...prev]);
        return saved.length;
      },

      enqueue: async (jobs) => {
        if (!uid) throw new Error("Faça login primeiro.");
        await db.enqueueJobs(uid, jobs);
        setState((st) => ({ ...st, queue: [...st.queue] }));
        const pending = await db.fetchPendingJobs();
        setState((st) => ({ ...st, queue: pending }));
      },

      drainQueue: async () => {
        const done: QueueResult = { ...EMPTY_RESULT };
        const ctx = ctxRef.current;
        if (!ctx || drainingRef.current) return done;
        drainingRef.current = true;
        setState((st) => ({ ...st, working: true }));

        // Jobs that must not be retried this pass: work held for the sending
        // window would otherwise be picked up again on the very next loop.
        const skip = new Set<string>();
        let lastSendAt = 0;

        try {
          // One job per pass, re-read from the database each time: another tab
          // may have finished some, and a crash mid-run leaves the rest intact.
          for (;;) {
            const pending = await db.fetchPendingJobs();
            setState((st) => ({ ...st, queue: pending }));
            const job = pending.find((j) => !skip.has(j.id));
            if (!job) break;

            const isSend = job.kind === "outreach" || job.kind === "followup";

            // Nobody wants a sales message at 2am, and no instance survives a
            // hundred of them in a minute. Both limits live here, where every
            // automated path has to pass through.
            if (isSend && !withinWindow(whatsapp)) {
              await db.rescheduleJob(job.id, nextSendableAt(whatsapp).toISOString());
              skip.add(job.id);
              done.held++;
              continue;
            }
            if (isSend && whatsappReady) {
              const gap = (whatsapp.throttleSeconds ?? 45) * 1000;
              const wait = lastSendAt + gap - Date.now();
              if (wait > 0) await new Promise((r) => setTimeout(r, wait));
            }

            await db.markJob(job.id, "running");
            try {
              switch (job.kind) {
                case "site":
                  await ctx.buildSite(job.lead_id!);
                  done.sites++;
                  break;

                case "publish":
                  await ctx.publishSite(job.lead_id!);
                  done.published++;
                  break;

                case "message": {
                  await ctx.writeMessage(job.lead_id!, "Consultiva", "WhatsApp");
                  done.messages++;
                  // A schedule that asked for a cadence hands it over here, the
                  // moment there is something to send.
                  const seq = job.payload["sequenceId"] as string | undefined;
                  if (seq) await ctx.enrollLead(job.lead_id!, seq);
                  break;
                }

                case "outreach":
                case "followup": {
                  const lead = leadsRef.current.find((l) => l.id === job.lead_id);
                  const step = (job.payload["step"] as number | undefined) ?? 0;
                  // Each step gets its own tone, which is exactly what makes
                  // the A/B numbers on the dashboard mean anything.
                  const enrollment = lead?.enrollment;
                  const sequence = state.sequences.find((s) => s.id === enrollment?.sequenceId);
                  const plan = sequence?.steps[step] ?? DEFAULT_SEQUENCE_STEPS[step];
                  const tone: Tone = plan?.tone ?? "Consultiva";
                  const channel: Channel = plan?.channel ?? "WhatsApp";

                  await ctx.writeMessage(job.lead_id!, tone, channel);
                  const result = await ctx.sendWhatsApp(job.lead_id!);
                  lastSendAt = Date.now();
                  if (result.automated) done.sent++;
                  break;
                }

                case "prospect": {
                  const id = job.payload["scheduleId"] as string | undefined;
                  const schedule = state.schedules.find((s) => s.id === id);
                  if (schedule) done.prospected += await runScheduleNow(ctx, uid!, schedule);
                  break;
                }

                case "enrich":
                  await ctx.enrich(job.lead_id!);
                  done.enriched++;
                  break;

                case "audit":
                  await ctx.auditLead(job.lead_id!);
                  break;

                case "rescan":
                  // Re-reads the lead's current site so a business that let its
                  // page rot becomes a reason to reach out again.
                  await ctx.auditLead(job.lead_id!);
                  break;
              }
              await db.markJob(job.id, "done");
            } catch (err) {
              done.failed++;
              await db.markJob(job.id, "failed", err instanceof Error ? err.message : "erro");
            }
          }
          await db.clearFinishedJobs();
          setState((st) => ({ ...st, queue: [] }));
          return done;
        } finally {
          drainingRef.current = false;
          setState((st) => ({ ...st, working: false }));
        }
      },

      chooseVariant: async (id, index) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        const chosen = lead.site?.variants?.[index];
        if (!lead.site || !chosen) return;

        // The picked take becomes the main page, and the one it replaces stays
        // available as the alternative — the choice is never one-way.
        const previous = {
          template: lead.site.template,
          content: lead.site.content,
          html: lead.site.html,
        };
        const variants = (lead.site.variants ?? []).map((v, i) => (i === index ? previous : v));
        const site = await db.upsertSite(uid, id, {
          template: chosen.template,
          content: chosen.content,
          html: chosen.html,
          slug: lead.site.slug,
          variants,
        });
        patchLocalLead(id, {
          site: { ...site, published: lead.site.published, url: lead.site.url },
        });
      },

      updateLead: async (id, patch) => {
        patchLocalLead(id, patch);
        await db.patchLead(id, patch);
      },

      patchSiteContent: async (id, patch) => {
        const lead = requireLead(id);
        if (!lead.site) return;
        const content = { ...lead.site.content, ...patch };
        const html = renderSiteHtml(lead, content, lead.site.template, {
          slug: lead.site.slug,
          trackUrl: appOrigin(),
        });
        patchLocalLead(id, { site: { ...lead.site, content, html } });
        await db.patchSiteContent(id, content, html);
      },

      moveLead: async (id, stage) => {
        const lead = requireLead(id);
        const activities = [
          { at: new Date().toISOString(), text: `Movido para ${stage}` },
          ...lead.activities,
        ];
        patchLocalLead(id, { stage, activities });
        await db.patchLead(id, { stage, activities });
      },

      createCampaign: async (c) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const campaign = await db.createCampaignRow(uid, c);
        setState((s) => ({ ...s, campaigns: [campaign, ...s.campaigns] }));
        return campaign;
      },

      setProfile: async (p) => {
        if (!uid) return;
        setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
        await db.updateProfile(uid, p);
      },
    };
  }, [
    state,
    user,
    refresh,
    keyFor,
    llmProvider,
    whatsapp,
    whatsappReady,
    whatsappToken,
    patchLocalLead,
    requireLead,
    requireLlm,
    setLeads,
  ]);

  ctxRef.current = value;

  // Any open tab picks the queue back up. Closing the browser mid-campaign
  // pauses the work; it does not lose it.
  useEffect(() => {
    if (state.loading || state.working || state.queue.length === 0) return;
    void value.drainQueue();
  }, [state.loading, state.working, state.queue.length, value]);

  // The clock behind the automation. Cadence steps and schedules become due
  // against wall time, not against the user clicking anything, so an open tab
  // checks every minute for work that has ripened.
  const sweepRef = useRef(value.sweep);
  sweepRef.current = value.sweep;
  useEffect(() => {
    if (!user || state.loading) return;
    void sweepRef.current();
    const timer = setInterval(() => void sweepRef.current(), 60000);
    return () => clearInterval(timer);
  }, [user, state.loading]);

  // Alerts are raised by Postgres — a page opened at 3am fires the trigger with
  // nobody watching. Subscribing means the seller sees it the moment they are
  // back, and live while they have the app open.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`alerts:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            lead_id: string | null;
            kind: Alert["kind"];
            body: string;
            read: boolean;
            created_at: string;
          };
          const alert: Alert = {
            id: row.id,
            leadId: row.lead_id ?? undefined,
            kind: row.kind,
            body: row.body,
            read: row.read,
            createdAt: row.created_at,
          };
          setState((s) => ({ ...s, alerts: [alert, ...s.alerts].slice(0, 50) }));
          if (alert.kind === "hot") toast.success(alert.body, { duration: 12000 });
          else if (alert.kind === "reply") toast.info(alert.body, { duration: 12000 });
          // The lead itself changed stage and engagement inside the trigger.
          void refresh();
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user, refresh]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useLead(id: string) {
  const { state } = useStore();
  return state.leads.find((l) => l.id === id);
}
