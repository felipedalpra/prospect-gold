import { createServerFn } from "@tanstack/react-start";
import type { Lead, LlmProvider, SiteSection } from "../types";
import { renderSiteHtml } from "../site-renderer";

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

const SITE_SYSTEM = `Você é um diretor de arte, UX designer e copywriter sênior que cria landing pages de altíssima qualidade para pequenos negócios brasileiros.

Você recebe os dados reais de um negócio (extraídos do Google Maps) e devolve uma landing page COMPLETA.

Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, sem cercas de código, no formato:
{
  "template": "nome curto do estilo visual escolhido, como luxury-medical ou dark-barbershop",
  "content": {
    "headline": "...",
    "subheadline": "...",
    "about": "...",
    "services": ["...", "..."],
    "differentials": ["...", "..."],
    "cta": "...",
    "accent": "um hex de cor, ex #C8A24A",
    "visualStyle": "descrição curta da direção visual"
  }
}

Direção obrigatória:
- Pense como uma experiência de produto premium, no estilo de uma landing page criada por uma ferramenta moderna de geração de interfaces.
- O resultado será renderizado por um sistema visual com hero de impacto, imagem, cards, glow, profundidade, animações e CTA.
- Escreva copy curta, visual e específica. Evite parágrafos longos e aparência de documento.
- Escolha um template adequado ao nicho e uma direção visual coerente: editorial, tecnológico, sofisticado ou energético.
- Gere entre 3 e 6 serviços e entre 3 e 4 diferenciais.
- Se houver telefone, os botões de CTA devem apontar para https://wa.me/<numero só com dígitos, com 55 na frente>.
- Português do Brasil. Copy concreta e específica ao negócio — nada de "Lorem ipsum" ou placeholder.
- Nunca invente fatos: não crie preços, prêmios, anos de fundação ou depoimentos. Use apenas os dados fornecidos.
- Design elegante e moderno, digno de um negócio premium. Nada de visual amador.
- Não gere HTML, CSS ou JavaScript. Retorne somente o JSON especificado.`;

export type GenerateSiteInput = {
  provider: LlmProvider;
  apiKey: string;
  lead: Lead;
  /** What the seller offers — steers tone, e.g. "Sites" vs "Automação". */
  sells: string;
};

export type GeneratedSite = { template: string; content: SiteSection; html: string };

export const generateSite = createServerFn({ method: "POST" })
  .validator((d: GenerateSiteInput) => d)
  .handler(async ({ data }): Promise<GeneratedSite> => {
    const raw = await callLlm({
      provider: data.provider,
      apiKey: data.apiKey,
      system: SITE_SYSTEM,
      maxTokens: 16000,
      prompt: `Crie a direção visual e o conteúdo estruturado da landing page deste negócio.\n\n${leadBrief(data.lead)}\n\nEsta página será usada como demonstração por alguém que vende ${data.sells || "sites"}. Ela precisa parecer uma landing page premium, visual e tecnológica à primeira vista.`,
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
    const content: SiteSection = {
      headline: parsed.content.headline,
      subheadline: parsed.content.subheadline ?? "",
      about: parsed.content.about ?? "",
      services: parsed.content.services,
      differentials: parsed.content.differentials ?? [],
      cta: parsed.content.cta ?? "Fale conosco",
      accent: parsed.content.accent ?? "#D5AD61",
      visualStyle: parsed.content.visualStyle,
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
