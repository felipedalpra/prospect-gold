export type Stage =
  | "Novo"
  | "Qualificado"
  | "Site criado"
  | "Contatado"
  | "Respondeu"
  | "Reunião"
  | "Proposta"
  | "Venda"
  | "Perdido";

export const STAGES: Stage[] = [
  "Novo",
  "Qualificado",
  "Site criado",
  "Contatado",
  "Respondeu",
  "Reunião",
  "Proposta",
  "Venda",
  "Perdido",
];

export type ScoreReason = { label: string; points: number };

export type SiteSection = {
  headline: string;
  subheadline: string;
  about: string;
  services: string[];
  differentials: string[];
  cta: string;
  accent: string;
  visualStyle?: string | undefined;
};

export type LeadSite = {
  id?: string | undefined;
  template: string;
  content: SiteSection;
  /** Full standalone HTML document rendered from the structured site content. */
  html: string;
  slug: string;
  published: boolean;
  url?: string | undefined;
  /** Set once published, so republishing updates the same Netlify site. */
  netlifySiteId?: string | undefined;
  createdAt: string;
};

export type Lead = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  website?: string | undefined;
  phone?: string | undefined;
  instagram?: string | undefined;
  address: string;
  placeId?: string | undefined;
  score: number;
  reasons: ScoreReason[];
  stage: Stage;
  campaignId?: string | undefined;
  site?: LeadSite | undefined;
  message?: { tone: string; channel: string; text: string } | undefined;
  createdAt: string;
  activities: { at: string; text: string }[];
};

export type Campaign = {
  id: string;
  name: string;
  niche: string;
  location: string;
  createdAt: string;
  leadIds: string[];
};

export type Profile = {
  name: string;
  email: string;
  sells: string;
  targets: string[];
  location: string;
  onboarded: boolean;
  plan: string;
};

/* -------------------------------------------------------------------------- */
/*  Integrations — the user plugs in their own API keys                        */
/* -------------------------------------------------------------------------- */

export type Provider = "apify" | "anthropic" | "openai" | "netlify";

export type Integration = {
  provider: Provider;
  apiKey: string;
  meta: Record<string, unknown>;
};

export type LlmProvider = Extract<Provider, "anthropic" | "openai">;

export const PROVIDER_INFO: Record<
  Provider,
  { label: string; help: string; url: string; placeholder: string; required: boolean }
> = {
  apify: {
    label: "Apify",
    help: "Busca empresas reais no Google Maps. Sem essa chave a prospecção não roda.",
    url: "https://console.apify.com/settings/integrations",
    placeholder: "apify_api_...",
    required: true,
  },
  anthropic: {
    label: "Anthropic (Claude)",
    help: "Escreve o site e a copy de abordagem. Configure Anthropic ou OpenAI.",
    url: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    required: false,
  },
  openai: {
    label: "OpenAI",
    help: "Alternativa ao Claude para gerar site e copy.",
    url: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
    required: false,
  },
  netlify: {
    label: "Netlify",
    help: "Publica os sites gerados em uma URL real para enviar ao lead.",
    url: "https://app.netlify.com/user/applications#personal-access-tokens",
    placeholder: "nfp_...",
    required: false,
  },
};
