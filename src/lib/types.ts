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
};

export type LeadSite = {
  template: string;
  content: SiteSection;
  published: boolean;
  url?: string;
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
  website?: string;
  phone?: string;
  instagram?: string;
  address: string;
  score: number;
  reasons: ScoreReason[];
  stage: Stage;
  campaignId?: string;
  site?: LeadSite;
  message?: { tone: string; channel: string; text: string };
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
