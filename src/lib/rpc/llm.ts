import { createServerFn } from "@tanstack/react-start";
import type { Lead, LlmProvider, SiteLayout, SiteSection } from "../types";
import { SITE_LAYOUTS } from "../types";
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

Você recebe os dados reais de um negócio (extraídos do Google Maps) e devolve a DIREÇÃO VISUAL e o conteúdo dessa página. Cada negócio precisa receber um site visivelmente diferente dos outros — a arquitetura da página, a paleta e o ritmo mudam conforme o segmento, o público e o clima do lugar.

Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, sem cercas de código:
{
  "template": "nome curto do estilo, ex: clinica-sofisticada",
  "content": {
    "layout": "editorial | immersive | showcase | minimal",
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
    "visualStyle": "descrição curta da direção visual"
  }
}

Como escolher o LAYOUT (obrigatório escolher de forma consciente, nunca sempre o mesmo):
- "editorial": tipografia serifada de revista, muito respiro, grid assimétrico, mosaico de fotos. Bom para restaurantes autorais, estúdios, arquitetura, moda, joalheria, hotelaria.
- "immersive": escuro, foto em tela cheia com parallax, brilho na cor da marca, faixa animada, muitas animações. Bom para barbearias, academias, bares, tatuagem, night life, automotivo, tecnologia.
- "showcase": o mais completo — herói + números + cards de serviço + galeria grande + sobre + bloco de contato. Bom para clínicas, odontologia, pet shops, oficinas, escolas, imobiliárias, prestadores de serviço em geral.
- "minimal": branco, tipografia pequena, silêncio visual, poucas imagens. Bom para advocacia, contabilidade, consultoria, psicologia, estética discreta, marcas premium sóbrias.

Como escolher as CORES:
- accent e secondary devem sair da identidade provável do negócio e do segmento (ex.: verde profundo para clínica natural, âmbar para padaria, azul-petróleo para jurídico, vinho para barbearia). Não use sempre dourado.
- "mode" escuro só quando combina com o clima do negócio; a maioria dos serviços de saúde e jurídico pede claro.

Direção de conteúdo:
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
};

function normalizeLayout(value: unknown): SiteLayout | undefined {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return SITE_LAYOUTS.find((l) => l === v);
}

export type GeneratedSite = { template: string; content: SiteSection; html: string };

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

    let parsed: GeneratedSite;
    try {
      parsed = JSON.parse(stripFences(raw)) as GeneratedSite;
    } catch {
      throw new Error("A IA devolveu uma resposta que não pôde ser lida. Tente gerar novamente.");
    }

    if (!parsed.template || !parsed.content?.headline || !Array.isArray(parsed.content.services)) {
      throw new Error("A IA não devolveu uma estrutura visual válida. Tente gerar novamente.");
    }
    // Real photos of the place. Leads round-trip through the database, which
    // does not persist the scraped image list, so we re-read them here.
    const images =
      data.lead.images && data.lead.images.length > 0
        ? data.lead.images
        : data.apifyKey
          ? await fetchPlaceImages({
              data: {
                apiKey: data.apifyKey,
                placeId: data.lead.placeId,
                query: `${data.lead.name} ${data.lead.city}`.trim(),
                location: data.lead.city,
              },
            })
          : [];

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
      images,
      logo: data.lead.logo,
    };
    return {
      template: parsed.template,
      content,
      html: renderSiteHtml(data.lead, content, parsed.template),
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
