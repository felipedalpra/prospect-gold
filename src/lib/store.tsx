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
import { useAuth } from "./auth";
import * as db from "./db";
import { slugify, type Filters } from "./score";
import { scrapeLeads } from "./rpc/apify";
import { generateSite, generateMessage } from "./rpc/llm";
import { publishSite as publishToNetlify } from "./rpc/netlify";
import { renderSiteHtml } from "./site-renderer";
import type {
  Campaign,
  Integration,
  Lead,
  LlmProvider,
  Profile,
  Provider,
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

type Ctx = {
  state: State;
  refresh: () => Promise<void>;

  /** Which API keys are plugged in — the UI blocks actions that would fail. */
  keyFor: (provider: Provider) => string | undefined;
  llmProvider: LlmProvider | null;
  saveKey: (provider: Provider, apiKey: string) => Promise<void>;
  removeKey: (provider: Provider) => Promise<void>;

  prospect: (niche: string, location: string, filters: Filters) => Promise<Lead[]>;
  buildSite: (id: string) => Promise<void>;
  publishSite: (id: string) => Promise<string>;
  writeMessage: (
    id: string,
    tone: "Direta" | "Consultiva" | "Casual",
    channel: "WhatsApp" | "Email",
  ) => Promise<string>;

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
      setState((s) => ({ ...s, leads: [], campaigns: [], integrations: [], loading: false }));
      return;
    }
    const [leads, campaigns, profile, integrations] = await Promise.all([
      db.fetchLeads(),
      db.fetchCampaigns(),
      db.fetchProfile(user.id),
      db.fetchIntegrations(),
    ]);
    leadsRef.current = leads;
    setState({
      leads,
      campaigns,
      profile: profile.profile,
      credits: profile.credits,
      integrations,
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
        const credits = await db.spendCredits(uid, saved.length * COST.lead);

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

        const generated = await generateSite({
          data: { provider, apiKey, lead, sells: state.profile.sells },
        });

        // Reuse the slug on regeneration so a published URL stays stable.
        const slug = lead.site?.slug ?? `${slugify(lead.name)}-${lead.id.slice(0, 6)}`;
        const site = await db.upsertSite(uid, id, { ...generated, slug });

        const nextStage: Stage =
          lead.stage === "Novo" || lead.stage === "Qualificado" ? "Site criado" : lead.stage;
        const activities = await db.appendActivity(lead, "Site gerado pela IA");
        await db.patchLead(id, { stage: nextStage });
        const credits = await db.spendCredits(uid, COST.site);

        patchLocalLead(id, { site, stage: nextStage, activities });
        setState((s) => ({ ...s, credits }));
      },

      publishSite: async (id) => {
        const lead = requireLead(id);
        if (!lead.site) throw new Error("Gere o site antes de publicar.");
        const apiKey = keyFor("netlify");
        if (!apiKey) throw new Error("Configure seu token do Netlify em Configurações.");

        const result = await publishToNetlify({
          data: {
            apiKey,
            slug: lead.site.slug,
            html: lead.site.html,
            siteId: lead.site.netlifySiteId,
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
        const credits = await db.spendCredits(uid, COST.message);
        patchLocalLead(id, { message });
        setState((s) => ({ ...s, credits }));
        return text;
      },

      updateLead: async (id, patch) => {
        patchLocalLead(id, patch);
        await db.patchLead(id, patch);
      },

      patchSiteContent: async (id, patch) => {
        const lead = requireLead(id);
        if (!lead.site) return;
        const content = { ...lead.site.content, ...patch };
        const html = renderSiteHtml(lead, content, lead.site.template);
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
