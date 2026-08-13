import type { Campaign, Lead, ScoreReason, SiteSection } from "./types";

const PREFIX: Record<string, string[]> = {
  dentista: ["Clínica Sorriso", "OdontoVida", "Dental Prime", "Sorriso Real", "Clínica Bianca Dutra", "OrtoCenter", "Espaço Odonto", "Dr. Marcelo Reis Odontologia"],
  academia: ["Iron Fit", "Studio Move", "Academia Pulse", "Body Prime", "Forma Fitness", "CrossBox 32", "Alpha Training", "Vita Gym"],
  clínica: ["Clínica Vitalis", "Espaço Saúde", "Instituto Aurora", "Clínica Nova Vida", "Med Center", "Clínica Renovar"],
  barbearia: ["Barbearia Nobre", "Old Gold Barber", "Barba & Cia", "Studio Corte", "The Barber Club", "Navalha de Ouro"],
  restaurante: ["Cantina Bella", "Casa do Sabor", "Empório 45", "Bistrô Aurora", "Grill House", "Tempero Sul"],
  advogado: ["Ribeiro Advocacia", "Martins & Associados", "Escritório Lex", "Advocacia Prime", "Souza Advogados"],
  default: ["Studio Prime", "Espaço Aurora", "Casa 32", "Grupo Vertex", "Atelier Nobre", "Central Prime", "Oficina Boa Vista"],
};

const SUFFIX = ["Centro", "Zona Sul", "Moinhos", "Bela Vista", "Jardins", "Petrópolis", "Menino Deus", "Centro Histórico"];

const STREETS = ["Av. Independência", "R. dos Andradas", "Av. Protásio Alves", "R. Padre Chagas", "Av. Ipiranga", "R. Fernandes Vieira"];

export function categoryKey(niche: string) {
  const n = niche.toLowerCase();
  for (const key of Object.keys(PREFIX)) {
    if (key !== "default" && (n.includes(key) || n.includes(key.slice(0, 5)))) return key;
  }
  if (n.includes("odonto")) return "dentista";
  if (n.includes("gym") || n.includes("fit")) return "academia";
  return "default";
}

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function computeScore(lead: Omit<Lead, "score" | "reasons" | "stage" | "createdAt" | "activities" | "id">) {
  const reasons: ScoreReason[] = [];
  if (!lead.hasWebsite) reasons.push({ label: "Sem site", points: 30 });
  else reasons.push({ label: "Site desatualizado", points: 8 });
  if (lead.rating >= 4.5) reasons.push({ label: "Boa avaliação", points: 15 });
  else if (lead.rating >= 4) reasons.push({ label: "Avaliação razoável", points: 8 });
  if (lead.reviews >= 100) reasons.push({ label: "Muitas avaliações", points: 15 });
  else if (lead.reviews >= 30) reasons.push({ label: "Volume de avaliações", points: 9 });
  if (lead.phone) reasons.push({ label: "Telefone disponível", points: 10 });
  if (lead.instagram) reasons.push({ label: "Instagram ativo", points: 10 });
  reasons.push({ label: "Segmento relevante", points: 10 });
  const score = Math.min(100, reasons.reduce((a, b) => a + b.points, 0));
  return { score, reasons };
}

export type Filters = {
  noWebsite: boolean;
  hasPhone: boolean;
  hasInstagram: boolean;
  minRating: number;
  minReviews: number;
  limit: number;
};

export const defaultFilters: Filters = {
  noWebsite: true,
  hasPhone: true,
  hasInstagram: false,
  minRating: 4,
  minReviews: 20,
  limit: 20,
};

export function generateLeads(niche: string, location: string, filters: Filters, seedBase = Date.now()): Lead[] {
  const key = categoryKey(niche);
  const names = PREFIX[key] ?? PREFIX.default;
  const catLabel = niche.trim() ? niche.trim().replace(/^\w/, (c) => c.toUpperCase()) : "Negócio local";
  const out: Lead[] = [];
  const total = Math.max(4, Math.min(filters.limit, 40));
  for (let i = 0; i < total * 2 && out.length < total; i++) {
    const s = seedBase / 1000 + i * 7.13;
    const base = names[i % names.length];
    const name = i < names.length ? base : `${base} ${SUFFIX[i % SUFFIX.length]}`;
    const hasWebsite = rand(s) > 0.62;
    const phone = rand(s + 1) > 0.15 ? `(51) 9${Math.floor(rand(s + 2) * 9000 + 1000)}-${Math.floor(rand(s + 3) * 9000 + 1000)}` : undefined;
    const instagram = rand(s + 4) > 0.35 ? `@${base.toLowerCase().replace(/[^a-z]/g, "")}` : undefined;
    const rating = Math.round((3.6 + rand(s + 5) * 1.4) * 10) / 10;
    const reviews = Math.floor(8 + rand(s + 6) * 320);

    if (filters.noWebsite && hasWebsite) continue;
    if (filters.hasPhone && !phone) continue;
    if (filters.hasInstagram && !instagram) continue;
    if (rating < filters.minRating) continue;
    if (reviews < filters.minReviews) continue;

    const partial = {
      name,
      category: catLabel,
      city: location || "Porto Alegre, RS",
      rating,
      reviews,
      hasWebsite,
      website: hasWebsite ? `${base.toLowerCase().replace(/[^a-z]/g, "")}.com.br` : undefined,
      phone,
      instagram,
      address: `${STREETS[i % STREETS.length]}, ${Math.floor(rand(s + 7) * 2000 + 50)}`,
    };
    const { score, reasons } = computeScore(partial as never);
    out.push({
      id: `lead_${Math.floor(rand(s + 8) * 1e9).toString(36)}_${i}`,
      ...partial,
      score,
      reasons,
      stage: "Novo",
      createdAt: new Date().toISOString(),
      activities: [{ at: new Date().toISOString(), text: "Lead encontrado no Google Maps" }],
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

const TEMPLATES: Record<string, { template: string; services: string[]; differentials: string[] }> = {
  dentista: {
    template: "Odonto Premium",
    services: ["Clínico geral", "Ortodontia", "Implantes", "Clareamento", "Estética dental"],
    differentials: ["Atendimento humanizado", "Tecnologia digital", "Horários flexíveis"],
  },
  academia: {
    template: "Performance",
    services: ["Musculação", "Treino funcional", "Aulas coletivas", "Avaliação física", "Personal trainer"],
    differentials: ["Equipamentos modernos", "Acompanhamento profissional", "Ambiente climatizado"],
  },
  clínica: {
    template: "Care",
    services: ["Consultas", "Exames", "Acompanhamento", "Procedimentos"],
    differentials: ["Equipe multidisciplinar", "Agendamento rápido", "Estrutura completa"],
  },
  barbearia: {
    template: "Barber Dark",
    services: ["Corte masculino", "Barba", "Combo corte + barba", "Pigmentação"],
    differentials: ["Ambiente exclusivo", "Profissionais experientes", "Agendamento online"],
  },
  restaurante: {
    template: "Gourmet",
    services: ["Almoço executivo", "Jantar", "Delivery", "Eventos"],
    differentials: ["Ingredientes frescos", "Ambiente acolhedor", "Cardápio autoral"],
  },
  advogado: {
    template: "Legal",
    services: ["Direito trabalhista", "Direito civil", "Consultoria jurídica", "Contratos"],
    differentials: ["Atendimento direto", "Transparência", "Experiência comprovada"],
  },
  default: {
    template: "Genérico Premium",
    services: ["Atendimento personalizado", "Orçamento sem compromisso", "Serviços sob medida"],
    differentials: ["Qualidade reconhecida", "Atendimento rápido", "Clientes satisfeitos"],
  },
};

export function generateSiteContent(lead: Lead): { template: string; content: SiteSection } {
  const key = categoryKey(lead.category);
  const t = TEMPLATES[key] ?? TEMPLATES.default;
  const city = lead.city.split(",")[0];
  return {
    template: t.template,
    content: {
      headline: `${lead.name} — referência em ${lead.category.toLowerCase()} em ${city}`,
      subheadline: `Atendimento de confiança avaliado com ${lead.rating.toFixed(1)} estrelas por ${lead.reviews} clientes no Google.`,
      about: `A ${lead.name} atende em ${city} com foco em qualidade e atendimento próximo. Conheça os serviços e agende o seu horário.`,
      services: t.services,
      differentials: t.differentials,
      cta: lead.phone ? "Falar no WhatsApp" : "Entrar em contato",
      accent: "gold",
    },
  };
}

export function generateMessage(lead: Lead, tone: "Direta" | "Consultiva" | "Casual", channel: "WhatsApp" | "Email") {
  const city = lead.city.split(",")[0];
  const link = lead.site?.url ? `https://${lead.site.url}` : "[visualizar demonstração]";
  const base: Record<string, string> = {
    Direta: `Oi! Tudo bem?\n\nEncontrei a ${lead.name} pesquisando ${lead.category.toLowerCase()} em ${city} e vi que vocês ainda não possuem um site próprio.\n\nCriei uma demonstração de como poderia ficar:\n${link}\n\nSe fizer sentido, te explico como funciona.`,
    Consultiva: `Oi! Tudo bem?\n\nEncontrei a ${lead.name} pesquisando ${lead.category.toLowerCase()} em ${city} e vi que vocês possuem nota ${lead.rating.toFixed(1)} e mais de ${lead.reviews} avaliações no Google — isso mostra uma reputação muito forte.\n\nPercebi que vocês ainda não possuem um site próprio e acabei criando uma ideia de como poderia ficar:\n${link}\n\nSe fizer sentido, posso te explicar como funciona.`,
    Casual: `Oi, tudo certo? 😊\n\nVi a ${lead.name} no Google enquanto pesquisava ${lead.category.toLowerCase()} em ${city}. Achei o trabalho de vocês muito bom (${lead.rating.toFixed(1)}★!).\n\nBrinquei um pouco e montei um site de demonstração pra vocês:\n${link}\n\nSe curtir, me chama que eu te conto o resto.`,
  };
  const text = base[tone];
  if (channel === "Email") {
    return `Assunto: Uma ideia de site para a ${lead.name}\n\n${text}\n\nAbraço,\nSeu nome`;
  }
  return text;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function seedDemo(): { leads: Lead[]; campaigns: Campaign[] } {
  const campaign: Campaign = {
    id: "camp_demo",
    name: "Dentistas Porto Alegre",
    niche: "Dentistas",
    location: "Porto Alegre, RS",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    leadIds: [],
  };
  const leads = generateLeads("Dentistas", "Porto Alegre, RS", { ...defaultFilters, limit: 12 }, 424242);
  const stages: Lead["stage"][] = ["Novo", "Qualificado", "Site criado", "Contatado", "Respondeu", "Reunião", "Proposta", "Venda"];
  leads.forEach((l, i) => {
    l.campaignId = campaign.id;
    l.stage = stages[Math.min(i, stages.length - 1)];
    if (i < 6) {
      const s = generateSiteContent(l);
      l.site = { ...s, published: i < 4, url: `${slugify(l.name)}.demo.leadforge.app`, createdAt: new Date().toISOString() };
    }
    if (i < 4) l.message = { tone: "Consultiva", channel: "WhatsApp", text: generateMessage(l, "Consultiva", "WhatsApp") };
  });
  campaign.leadIds = leads.map((l) => l.id);
  return { leads, campaigns: [campaign] };
}
