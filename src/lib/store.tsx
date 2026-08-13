import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Campaign, Lead, Profile, Stage } from "./types";
import { generateMessage, generateSiteContent, seedDemo, slugify } from "./mock";

type State = {
  leads: Lead[];
  campaigns: Campaign[];
  profile: Profile;
  credits: number;
};

const DEFAULT_PROFILE: Profile = {
  name: "Felipe Dalpra",
  email: "felipe@leadforge.app",
  sells: "Sites",
  targets: ["Dentistas"],
  location: "Porto Alegre, RS",
  onboarded: false,
  plan: "Growth",
};

const KEY = "leadforge_state_v1";

function initialState(): State {
  const { leads, campaigns } = seedDemo();
  return { leads, campaigns, profile: DEFAULT_PROFILE, credits: 842 };
}

type Ctx = {
  state: State;
  addLeads: (leads: Lead[], campaignId?: string) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  moveLead: (id: string, stage: Stage) => void;
  buildSite: (id: string) => void;
  publishSite: (id: string) => void;
  writeMessage: (id: string, tone: "Direta" | "Consultiva" | "Casual", channel: "WhatsApp" | "Email") => string;
  createCampaign: (c: Omit<Campaign, "id" | "createdAt" | "leadIds">, leads: Lead[]) => Campaign;
  spend: (n: number) => void;
  setProfile: (p: Partial<Profile>) => void;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => initialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw) as State);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const touch = useCallback((id: string, text: string) => {
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) =>
        l.id === id ? { ...l, activities: [{ at: new Date().toISOString(), text }, ...l.activities] } : l,
      ),
    }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      addLeads: (leads, campaignId) =>
        setState((s) => {
          const existing = new Set(s.leads.map((l) => l.name + l.city));
          const fresh = leads.filter((l) => !existing.has(l.name + l.city)).map((l) => ({ ...l, campaignId }));
          return { ...s, leads: [...fresh, ...s.leads], credits: Math.max(0, s.credits - fresh.length) };
        }),
      updateLead: (id, patch) =>
        setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      moveLead: (id, stage) =>
        setState((s) => ({
          ...s,
          leads: s.leads.map((l) =>
            l.id === id
              ? { ...l, stage, activities: [{ at: new Date().toISOString(), text: `Movido para ${stage}` }, ...l.activities] }
              : l,
          ),
        })),
      buildSite: (id) =>
        setState((s) => ({
          ...s,
          credits: Math.max(0, s.credits - 5),
          leads: s.leads.map((l) => {
            if (l.id !== id) return l;
            const gen = generateSiteContent(l);
            return {
              ...l,
              stage: l.stage === "Novo" || l.stage === "Qualificado" ? "Site criado" : l.stage,
              site: { ...gen, published: false, createdAt: new Date().toISOString() },
              activities: [{ at: new Date().toISOString(), text: "Site demo gerado pela IA" }, ...l.activities],
            };
          }),
        })),
      publishSite: (id) =>
        setState((s) => ({
          ...s,
          leads: s.leads.map((l) =>
            l.id === id && l.site
              ? {
                  ...l,
                  site: { ...l.site, published: true, url: `${slugify(l.name)}.demo.leadforge.app` },
                  activities: [{ at: new Date().toISOString(), text: "Site publicado" }, ...l.activities],
                }
              : l,
          ),
        })),
      writeMessage: (id, tone, channel) => {
        const lead = state.leads.find((l) => l.id === id);
        if (!lead) return "";
        const text = generateMessage(lead, tone, channel);
        setState((s) => ({
          ...s,
          credits: Math.max(0, s.credits - 1),
          leads: s.leads.map((l) => (l.id === id ? { ...l, message: { tone, channel, text } } : l)),
        }));
        return text;
      },
      createCampaign: (c, leads) => {
        const campaign: Campaign = {
          ...c,
          id: `camp_${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
          leadIds: leads.map((l) => l.id),
        };
        setState((s) => ({
          ...s,
          campaigns: [campaign, ...s.campaigns],
          leads: [...leads.map((l) => ({ ...l, campaignId: campaign.id })), ...s.leads],
          credits: Math.max(0, s.credits - leads.length * 2),
        }));
        return campaign;
      },
      spend: (n) => setState((s) => ({ ...s, credits: Math.max(0, s.credits - n) })),
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      reset: () => setState(initialState()),
      touch,
    }),
    [state, touch],
  );

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
