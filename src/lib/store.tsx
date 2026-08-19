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
import { computeScore, slugify, type Filters } from "./score";
import { stageIndex } from "./buckets";
import { scrapeLeads } from "./rpc/apify";
import { generateSite, generateMessage } from "./rpc/llm";
import { publishSite as publishToNetlify } from "./rpc/netlify";
import { auditSite } from "./rpc/audit";
import { renderSiteHtml } from "./site-renderer";
import type {
  Campaign,
  Integration,
  Lead,
  LlmProvider,
  Profile,
  Provider,
  SiteAudit,
  SiteSection,
  Stage,
} from "./types";

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

const COST = { lead: 1, site: 5, message: 1 } as const;

/** What one credit of each action actually costs us in API spend, in USD. */
export const COST_USD = { lead: 0.007, site: 0.06, message: 0.004 } as const;

/** What a queue run accomplished, reported by kind. */
export type QueueResult = { sites: number; published: number; messages: number; failed: number };

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

type Ctx = {
  state: State;
  refresh: () => Promise<void>;

  /** Which API keys are plugged in — the UI blocks actions that would fail. */
  keyFor: (provider: Provider) => string | undefined;
  llmProvider: LlmProvider | null;
  saveKey: (provider: Provider, apiKey: string) => Promise<void>;
  /** Root domain the published demos hang off, e.g. "demos.minhaagencia.com". */
  setPublishDomain: (domain: string) => Promise<void>;
  removeKey: (provider: Provider) => Promise<void>;

  prospect: (niche: string, location: string, filters: Filters) => Promise<Lead[]>;
  buildSite: (id: string) => Promise<void>;
  publishSite: (id: string) => Promise<string>;
  writeMessage: (
    id: string,
    tone: "Direta" | "Consultiva" | "Casual",
    channel: "WhatsApp" | "Email",
  ) => Promise<string>;

  /** Runs PageSpeed on the lead's current site — the sales argument. */
  auditLead: (id: string) => Promise<SiteAudit>;
  /** Opens WhatsApp with the message already typed and logs the touch. */
  sendWhatsApp: (id: string) => Promise<void>;
  /** Schedules the next touch. Cold outreach closes on the 2nd/3rd try. */
  setFollowUp: (id: string, days: number | null) => Promise<void>;
  /** Adds leads from a CSV the user already had. */
  importLeads: (rows: ImportRow[]) => Promise<number>;
  /** Promotes one of the alternative takes to be the site that gets published. */
  chooseVariant: (id: string, index: number) => Promise<void>;

  /** Writes the work down first, so closing the tab pauses instead of losing. */
  enqueue: (
    jobs: { leadId: string; kind: db.JobRow["kind"]; campaignId?: string | undefined }[],
  ) => Promise<void>;
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
        loading: false,
      }));
      return;
    }
    const [raw, campaigns, profile, integrations, visits, queue] = await Promise.all([
      db.fetchLeads(),
      db.fetchCampaigns(),
      db.fetchProfile(user.id),
      db.fetchIntegrations(),
      db.fetchVisitStats(),
      db.fetchPendingJobs(),
    ]);
    // Engagement lives in its own table; it is folded onto the leads here so
    // every screen can show "opened your site" without a second query.
    const leads = raw.map((l) => {
      const v = visits.get(l.id);
      return v ? { ...l, visits: v } : l;
    });
    leadsRef.current = leads;
    setState({
      leads,
      campaigns,
      profile: profile.profile,
      credits: profile.credits,
      integrations,
      queue,
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

      sendWhatsApp: async (id) => {
        const lead = requireLead(id);
        const digits = lead.phone?.replace(/\D/g, "") ?? "";
        if (!digits) throw new Error("Este lead não tem telefone.");
        const number = digits.startsWith("55") ? digits : `55${digits}`;
        const text = lead.message?.text ?? "";
        window.open(
          `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`,
          "_blank",
          "noopener",
        );

        // Opening the chat is the touch: the lead moves on and the next one is
        // scheduled, so nothing depends on the user remembering to do it.
        const stage: Stage =
          stageIndex(lead.stage) >= stageIndex("Contatado") ? lead.stage : "Contatado";
        const followUpAt = lead.followUpAt ?? inDays(3);
        const activities = await db.appendActivity(lead, "Mensagem aberta no WhatsApp");
        await db.patchLead(id, { stage, followUpAt });
        patchLocalLead(id, { stage, followUpAt, activities });
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
        const done: QueueResult = { sites: 0, published: 0, messages: 0, failed: 0 };
        const ctx = ctxRef.current;
        if (!ctx || drainingRef.current) return done;
        drainingRef.current = true;
        setState((st) => ({ ...st, working: true }));
        try {
          // One job per pass, re-read from the database each time: another tab
          // may have finished some, and a crash mid-run leaves the rest intact.
          for (;;) {
            const pending = await db.fetchPendingJobs();
            setState((st) => ({ ...st, queue: pending }));
            const job = pending[0];
            if (!job || !job.lead_id) break;

            await db.markJob(job.id, "running");
            try {
              if (job.kind === "site") {
                await ctx.buildSite(job.lead_id);
                done.sites++;
              }
              if (job.kind === "publish") {
                await ctx.publishSite(job.lead_id);
                done.published++;
              }
              if (job.kind === "message") {
                await ctx.writeMessage(job.lead_id, "Consultiva", "WhatsApp");
                done.messages++;
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
