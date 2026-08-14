import { createServerFn } from "@tanstack/react-start";
import type { Lead, LlmProvider, SiteSection } from "../types";

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

const SITE_SYSTEM = `Você é um diretor de arte e copywriter sênior que cria landing pages de altíssima qualidade para pequenos negócios brasileiros.

Você recebe os dados reais de um negócio (extraídos do Google Maps) e devolve uma landing page COMPLETA.

Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, sem cercas de código, no formato:
{
  "template": "nome curto do estilo visual escolhido",
  "content": {
    "headline": "...",
    "subheadline": "...",
    "about": "...",
    "services": ["...", "..."],
    "differentials": ["...", "..."],
    "cta": "...",
    "accent": "um hex de cor, ex #C8A24A"
  },
  "html": "documento HTML completo e autossuficiente"
}

Regras do campo html:
- Documento completo começando em <!DOCTYPE html>, com <html lang="pt-BR">, meta viewport e <title>.
- TODO o CSS embutido em uma única tag <style>. Nenhum arquivo, fonte, script ou imagem externa — a página precisa funcionar offline.
- Nada de <img> com URL externa. Use gradientes, formas CSS, tipografia e emoji quando precisar de elemento visual.
- Responsivo de verdade (mobile primeiro), com seções: hero, serviços, sobre, prova social com a nota real do Google, localização e um CTA final.
- Se houver telefone, os botões de CTA devem apontar para https://wa.me/<numero só com dígitos, com 55 na frente>.
- Português do Brasil. Copy concreta e específica ao negócio — nada de "Lorem ipsum" ou placeholder.
- Nunca invente fatos: não crie preços, prêmios, anos de fundação ou depoimentos. Use apenas os dados fornecidos.
- Design elegante e moderno, digno de um negócio premium. Nada de visual amador.`;

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
      prompt: `Crie a landing page deste negócio:\n\n${leadBrief(data.lead)}\n\nEsta página será usada como demonstração por alguém que vende ${data.sells || "sites"}. Ela precisa impressionar o dono do negócio à primeira vista.`,
    });

    let parsed: GeneratedSite;
    try {
      parsed = JSON.parse(stripFences(raw)) as GeneratedSite;
    } catch {
      throw new Error("A IA devolveu uma resposta que não pôde ser lida. Tente gerar novamente.");
    }

    if (!parsed.html?.includes("<html")) {
      throw new Error("A IA não devolveu um HTML válido. Tente gerar novamente.");
    }
    return parsed;
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
