import { createServerFn } from "@tanstack/react-start";
import type { Lead, LlmProvider, SiteBlock, SiteLayout, SiteSection, SiteVariant } from "../types";
import { SITE_BLOCK_KINDS, SITE_LAYOUTS, SITE_TYPEFACES } from "../types";
import { renderSiteHtml } from "../site-renderer";
import { fetchPlaceImages } from "./apify";

const ANTHROPIC_MODEL = "claude-sonnet-5";
const OPENAI_MODEL = "gpt-4o";

type LlmCall = {
  provider: LlmProvider;
  apiKey: string;
  system: string;
  prompt: string;
  maxTokens: number;
};

/** Single entry point so both providers share error handling and prompts. */
async function callLlm({ provider, apiKey, system, prompt, maxTokens }: LlmCall): Promise<string> {
  if (!apiKey) throw new Error(`Chave da ${provider} não configurada.`);

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(await describeFailure(res, "Anthropic"));
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    return json.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(await describeFailure(res, "OpenAI"));
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message.content ?? "";
}

async function describeFailure(res: Response, label: string): Promise<string> {
  const body = await res.text();
  if (res.status === 401) return `Chave da ${label} inválida.`;
  if (res.status === 429)
    return `${label}: limite de uso atingido (429). Tente de novo em instantes.`;
  return `${label} falhou (${res.status}): ${body.slice(0, 300)}`;
}

/** LLMs like wrapping output in fences even when told not to. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:html|json)?\s*\n([\s\S]*?)\n?```/);
  return (fenced?.[1] ?? text).trim();
}

function leadBrief(lead: Lead): string {
  return [
    `Nome: ${lead.name}`,
    `Categoria: ${lead.category}`,
    `Cidade: ${lead.city}`,
    `Endereço: ${lead.address || "não informado"}`,
    `Nota no Google: ${lead.rating.toFixed(1)} (${lead.reviews} avaliações)`,
    `Telefone: ${lead.phone ?? "não informado"}`,
    `Instagram: ${lead.instagram ?? "não informado"}`,
    `Site atual: ${lead.hasWebsite ? lead.website : "NÃO POSSUI SITE"}`,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Site generation                                                            */
/* -------------------------------------------------------------------------- */

const SITE_SYSTEM = `Você é um diretor de arte, UX designer e copywriter sênior que cria landing pages sob medida para pequenos negócios brasileiros.

Você recebe os dados reais de um negócio (extraídos do Google Maps) e devolve a DIREÇÃO VISUAL, a ARQUITETURA e o conteúdo dessa página. Dois negócios do MESMO segmento têm que receber páginas com seções diferentes, em ordem diferente e com tratamento visual diferente. Repetir a mesma estrutura é o pior erro possível aqui.

Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, sem cercas de código:
{
  "template": "nome curto do estilo, ex: clinica-sofisticada",
  "content": {
    "layout": "editorial | immersive | showcase | minimal",
    "typeface": "sans | serif | mixed | condensed",
    "shape": "sharp | soft | round",
    "mode": "light | dark",
    "accent": "#RRGGBB",
    "secondary": "#RRGGBB",
    "motion": "subtle | rich",
    "headline": "...",
    "subheadline": "...",
    "about": "...",
    "services": ["...", "..."],
    "serviceNotes": ["uma frase curta explicando cada serviço, na mesma ordem"],
    "differentials": ["...", "..."],
    "cta": "...",
    "visualStyle": "descrição curta da direção visual",
    "blocks": [ { "kind": "...", "variant": "...", "title": "...", "eyebrow": "...", "items": [...] } ]
  }
}

## blocks — a arquitetura da página (o campo mais importante)

Monte de 5 a 8 blocos, na ordem em que aparecem. O primeiro é sempre "hero". Escolha os tipos e as variantes de acordo com o negócio; NÃO use sempre a mesma sequência.

| kind | variantes | usa |
|---|---|---|
| hero | split, full, stacked, frame | headline, subheadline, cta |
| stats | bar, cards | nota e nº de avaliações do Google, cidade, categoria |
| services | cards, list, grid, alternating | services + serviceNotes |
| gallery | mosaic, strip, grid, duo | fotos reais do negócio |
| about | split, wide, overlap | about |
| differentials | rows, cards, icons | differentials |
| process | steps, timeline | items: [{title, text}] escritos por você |
| faq | list | items: [{title (pergunta), text (resposta)}] escritos por você |
| quote | band | title: uma frase de impacto |
| cta | band, split | title |

Regras dos blocos:
- "hero" aparece uma única vez e é o primeiro.
- Use no máximo 2 blocos de "gallery". Se o negócio tiver poucas fotos, use 1 ou nenhum.
- "process" e "faq" só entram se você conseguir escrever conteúdo real e útil para AQUELE negócio — e sem inventar fatos.
- "title" e "eyebrow" são opcionais: escreva títulos de seção específicos do negócio ("Como é a primeira sessão", "O que tratamos") em vez dos genéricos.
- Varie de verdade: se um psicólogo recebeu hero split + about wide + faq, o próximo psicólogo deve receber algo como hero frame + process timeline + services list.

## Sistema visual

- "layout" define o ritmo e a densidade: editorial (revista, muito respiro), immersive (denso, foto grande, escuro), showcase (completo, cards), minimal (silencioso, estreito). Escolha pelo clima do NEGÓCIO específico — jamais fixe um layout por segmento.
- "typeface": sans (Inter, neutro), serif (Fraunces, editorial), mixed (Instrument Serif nos títulos), condensed (Oswald, caixa alta, impacto). Varie.
- "shape": sharp (cantos retos), soft, round.
- accent e secondary saem da identidade provável do negócio. Não use sempre dourado, e não repita a mesma paleta do segmento — dois psicólogos não podem sair os dois em azul-claro.
- "mode" escuro só quando combina com o clima do negócio.

## Conteúdo

- Copy curta, concreta e específica ao negócio. Português do Brasil.
- 3 a 6 serviços, e um serviceNotes para CADA serviço, na mesma ordem (máx. 14 palavras cada).
- 3 a 4 diferenciais.
- O "cta" é o TEXTO DE UM BOTÃO: no máximo 3 palavras, imperativo, sem ponto final. NUNCA escreva telefone, número ou frase inteira nele (ex.: "Agendar horário", "Falar no WhatsApp", "Marcar consulta"). O número entra no link, nunca na copy.
- Nunca invente fatos: nada de preços, prêmios, anos de fundação, depoimentos ou número de clientes. Use só os dados fornecidos.
- Nada de "Lorem ipsum" ou placeholder.
- Não gere HTML, CSS ou JavaScript. Retorne somente o JSON especificado.`;

export type GenerateSiteInput = {
  provider: LlmProvider;
  apiKey: string;
  lead: Lead;
  /** What the seller offers — steers tone, e.g. "Sites" vs "Automação". */
  sells: string;
  /** Lets the generator pull the real photos of the place from Apify. */
  apifyKey?: string | undefined;
  /** Slug the site is stored under — the key the visit beacon reports with. */
  slug?: string | undefined;
  /** Origin of this app, so the published page can report visits back. */
  trackUrl?: string | undefined;
  /** Also render an alternative take on the same copy. */
  withVariant?: boolean | undefined;
};

/** Keeps only blocks the renderer knows how to draw, with sane item lists. */
function normalizeBlocks(raw: unknown): SiteBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SiteBlock[] = [];
  for (const entry of raw) {
    const kind = SITE_BLOCK_KINDS.find((k) => k === (entry as SiteBlock)?.kind);
    if (!kind) continue;
    const b = entry as SiteBlock;
    out.push({
      kind,
      variant: typeof b.variant === "string" ? b.variant : undefined,
      title: typeof b.title === "string" ? b.title : undefined,
      eyebrow: typeof b.eyebrow === "string" ? b.eyebrow : undefined,
      items: Array.isArray(b.items)
        ? b.items
            .filter((i) => i && typeof i.title === "string")
            .slice(0, 6)
            .map((i) => ({ title: i.title, text: typeof i.text === "string" ? i.text : undefined }))
        : undefined,
    });
  }
  return out.length > 0 ? out.slice(0, 10) : undefined;
}

function normalizeLayout(value: unknown): SiteLayout | undefined {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return SITE_LAYOUTS.find((l) => l === v);
}

export type GeneratedSite = {
  template: string;
  content: SiteSection;
  html: string;
  /** Whether the page is built on the business's own photos or on stock. */
  photos: "real" | "stock";
  /** Set when real photos were expected but could not be fetched. */
  photoWarning?: string | undefined;
  /** Alternative takes on the same copy, rendered without a second AI call. */
  variants?: SiteVariant[] | undefined;
};

export const generateSite = createServerFn({ method: "POST" })
  .validator((d: GenerateSiteInput) => d)
  .handler(async ({ data }): Promise<GeneratedSite> => {
    const raw = await callLlm({
      provider: data.provider,
      apiKey: data.apiKey,
      system: SITE_SYSTEM,
      maxTokens: 16000,
      prompt: `Crie a direção visual e o conteúdo estruturado da landing page deste negócio.\n\n${leadBrief(data.lead)}\n\nEsta página será usada como demonstração por alguém que vende ${data.sells || "sites"}. Ela será renderizada com as FOTOS REAIS do negócio, então escolha a arquitetura e as cores que melhor valorizam esse tipo de ambiente. Fuja do óbvio: um site igual ao do concorrente não vende.`,
    });

    type ParsedSite = { template: string; content: SiteSection };
    let parsed: ParsedSite;
    try {
      parsed = JSON.parse(stripFences(raw)) as ParsedSite;
    } catch {
      throw new Error("A IA devolveu uma resposta que não pôde ser lida. Tente gerar novamente.");
    }

    if (!parsed.template || !parsed.content?.headline || !Array.isArray(parsed.content.services)) {
      throw new Error("A IA não devolveu uma estrutura visual válida. Tente gerar novamente.");
    }
    // Real photos of the place. They are persisted with the lead, so this only
    // repairs leads saved before that, or places whose scrape returned none.
    let images = data.lead.images ?? [];
    let photoWarning: string | undefined;
    if (images.length === 0) {
      const fetched = await fetchPlaceImages({
        data: {
          apiKey: data.apifyKey ?? "",
          placeId: data.lead.placeId,
          query: `${data.lead.name} ${data.lead.city}`.trim(),
          location: data.lead.city,
        },
      });
      images = fetched.images;
      photoWarning = fetched.error;
    }

    const content: SiteSection = {
      headline: parsed.content.headline,
      subheadline: parsed.content.subheadline ?? "",
      about: parsed.content.about ?? "",
      services: parsed.content.services,
      differentials: parsed.content.differentials ?? [],
      cta: parsed.content.cta ?? "Fale conosco",
      accent: parsed.content.accent ?? "#D5AD61",
      visualStyle: parsed.content.visualStyle,
      layout: normalizeLayout(parsed.content.layout),
      mode:
        parsed.content.mode === "dark"
          ? "dark"
          : parsed.content.mode === "light"
            ? "light"
            : undefined,
      secondary: parsed.content.secondary,
      motion: parsed.content.motion === "subtle" ? "subtle" : "rich",
      serviceNotes: Array.isArray(parsed.content.serviceNotes)
        ? parsed.content.serviceNotes
        : undefined,
      blocks: normalizeBlocks(parsed.content.blocks),
      typeface: SITE_TYPEFACES.find((t) => t === parsed.content.typeface),
      shape:
        parsed.content.shape === "sharp" ||
        parsed.content.shape === "soft" ||
        parsed.content.shape === "round"
          ? parsed.content.shape
          : undefined,
      images,
      logo: data.lead.logo,
    };
    const render = { slug: data.slug, trackUrl: data.trackUrl };
    return {
      template: parsed.template,
      content,
      html: renderSiteHtml(data.lead, content, parsed.template, render),
      photos: images.length > 0 ? "real" : "stock",
      ...(photoWarning ? { photoWarning } : {}),
      // A remix costs no tokens: same copy, re-derived architecture and type.
      variants: data.withVariant
        ? [
            {
              template: `${parsed.template}-b`,
              content,
              html: renderSiteHtml(data.lead, content, parsed.template, { ...render, remix: 1 }),
            },
          ]
        : undefined,
    };
  });

/* -------------------------------------------------------------------------- */
/*  Outreach copy                                                              */
/* -------------------------------------------------------------------------- */

const MESSAGE_SYSTEM = `Você é um especialista em prospecção fria no Brasil. Escreve mensagens curtas que soam humanas e conseguem resposta.

Regras:
- Português do Brasil, primeira pessoa, sem jargão corporativo.
- No máximo 90 palavras.
- Abra com algo específico e verdadeiro sobre aquele negócio (o que você viu no Google).
- Mencione o site de demonstração e inclua o link exatamente como fornecido.
- Uma única pergunta no final, fácil de responder.
- Nada de emoji em excesso, nada de "espero que esteja bem", nada de promessa de resultado.
- Responda só com o texto da mensagem, sem aspas nem comentários.`;

export type GenerateMessageInput = {
  provider: LlmProvider;
  apiKey: string;
  lead: Lead;
  tone: string;
  channel: string;
  siteUrl: string;
  sells: string;
  senderName: string;
};

export const generateMessage = createServerFn({ method: "POST" })
  .validator((d: GenerateMessageInput) => d)
  .handler(async ({ data }): Promise<string> => {
    const text = await callLlm({
      provider: data.provider,
      apiKey: data.apiKey,
      system: MESSAGE_SYSTEM,
      maxTokens: 1000,
      prompt: [
        `Negócio:\n${leadBrief(data.lead)}`,
        `Canal: ${data.channel}`,
        `Tom: ${data.tone}`,
        `Quem envia: ${data.senderName || "um profissional"}, que vende ${data.sells || "sites"}.`,
        `Link do site de demonstração já pronto: ${data.siteUrl || "(ainda não publicado — diga que pode mostrar)"}`,
        data.channel === "Email"
          ? "Comece com uma linha 'Assunto: ...' e depois o corpo do e-mail."
          : "Formate como mensagem de WhatsApp, com quebras de linha curtas.",
      ].join("\n\n"),
    });
    return text.trim();
  });
