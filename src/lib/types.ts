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

/** The distinct page architectures the renderer knows how to build. */
export type SiteLayout = "editorial" | "immersive" | "showcase" | "minimal";

export const SITE_LAYOUTS: SiteLayout[] = ["editorial", "immersive", "showcase", "minimal"];

/** The kinds of section the renderer knows how to build. */
export type SiteBlockKind =
  | "hero"
  | "stats"
  | "services"
  | "gallery"
  | "about"
  | "differentials"
  | "process"
  | "faq"
  | "quote"
  | "cta";

export const SITE_BLOCK_KINDS: SiteBlockKind[] = [
  "hero",
  "stats",
  "services",
  "gallery",
  "about",
  "differentials",
  "process",
  "faq",
  "quote",
  "cta",
];

/**
 * One section of the page. The AI composes an ordered list of these, so two
 * businesses in the same segment get different pages — not the same template
 * with different text.
 */
export type SiteBlock = {
  kind: SiteBlockKind;
  /** Visual treatment within the kind, e.g. hero "split" vs "full". */
  variant?: string | undefined;
  /** Section heading, when the block shows one. */
  title?: string | undefined;
  /** Small label above the heading. */
  eyebrow?: string | undefined;
  /** Rows for blocks that carry their own list (process steps, FAQ). */
  items?: { title: string; text?: string | undefined }[] | undefined;
};

/** Typographic system of the page — a large part of how distinct it feels. */
export type SiteTypeface = "sans" | "serif" | "mixed" | "condensed";

export const SITE_TYPEFACES: SiteTypeface[] = ["sans", "serif", "mixed", "condensed"];

export type SiteSection = {
  headline: string;
  subheadline: string;
  about: string;
  services: string[];
  differentials: string[];
  cta: string;
  accent: string;
  visualStyle?: string | undefined;
  /** Page architecture. Chosen by the AI per segment, never a single default. */
  layout?: SiteLayout | undefined;
  /** Light or dark canvas — part of the per-business visual identity. */
  mode?: "light" | "dark" | undefined;
  /** Second brand colour, used for gradients and accents. */
  secondary?: string | undefined;
  /** How much motion the page uses. */
  motion?: "subtle" | "rich" | undefined;
  /** Real photos of the business (Apify / Google Maps), first is the hero. */
  images?: string[] | undefined;
  /** Logo/avatar URL of the business when one could be resolved. */
  logo?: string | undefined;
  /** Short caption per service card, written by the AI. */
  serviceNotes?: string[] | undefined;
  /** Ordered composition of the page. When absent, a seeded default is used. */
  blocks?: SiteBlock[] | undefined;
  /** Typographic system. When absent, derived from the layout and the seed. */
  typeface?: SiteTypeface | undefined;
  /** Corner language: sharp edges vs soft. */
  shape?: "sharp" | "soft" | "round" | undefined;
};

/** A second take on the same business, so the seller can pick or send both. */
export type SiteVariant = {
  template: string;
  content: SiteSection;
  html: string;
};

/** Lighthouse-style reading of the lead's CURRENT site — the sales argument. */
export type SiteAudit = {
  /** 0-100 performance score from PageSpeed Insights. */
  performance: number;
  /** Largest Contentful Paint, in seconds. */
  lcp: number;
  /** Whether the page declares a mobile viewport. */
  mobile: boolean;
  /** Whether it is served over HTTPS. */
  https: boolean;
  url: string;
  checkedAt: string;
};

/** What the demo page reported back: opens, attention and CTA clicks. */
export type VisitStats = {
  views: number;
  whatsappClicks: number;
  /** Longest single visit, in seconds. */
  seconds: number;
  lastAt?: string | undefined;
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
  /** Alternative takes generated alongside the main page. */
  variants?: SiteVariant[] | undefined;
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
  /** Real photos of the place, scraped from Google Maps. */
  images?: string[] | undefined;
  /** Business logo / profile image when Google exposes one. */
  logo?: string | undefined;
  score: number;
  reasons: ScoreReason[];
  stage: Stage;
  campaignId?: string | undefined;
  site?: LeadSite | undefined;
  message?: { tone: string; channel: string; text: string } | undefined;
  createdAt: string;
  activities: { at: string; text: string }[];
  /** When to touch this lead again. Cold outreach closes on the 2nd/3rd try. */
  followUpAt?: string | undefined;
  /** Audit of the lead's current site, when one was run. */
  siteAudit?: SiteAudit | undefined;
  /** Engagement on the demo page. Filled from site_visits, never persisted. */
  visits?: VisitStats | undefined;
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

export type Provider = "apify" | "anthropic" | "openai" | "netlify" | "google";

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
  google: {
    label: "Google PageSpeed (opcional)",
    help: "Aumenta o limite da análise do site atual do lead. Sem chave funciona, só com cota menor.",
    url: "https://developers.google.com/speed/docs/insights/v5/get-started",
    placeholder: "AIza...",
    required: false,
  },
};
