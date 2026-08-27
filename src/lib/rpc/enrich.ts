import { createServerFn } from "@tanstack/react-start";
import type { Enrichment } from "../types";

/**
 * Turns "olá, tudo bem?" into "vi que a Clínica X abriu em 2016 e o site ainda
 * roda WordPress de 2019".
 *
 * Everything here is free and keyless on purpose — the point of enrichment is
 * that it runs on every lead automatically, and a per-lead API bill would make
 * the seller ration it. Brazilian business sites put the CNPJ in the footer far
 * more often than anywhere else in the world, and BrasilAPI turns that number
 * into the registry record for nothing.
 */

export type EnrichInput = {
  website?: string | undefined;
  instagram?: string | undefined;
  name: string;
};

export type EnrichResult = Enrichment & {
  /** Emails found on the page — usually the fastest second channel. */
  emails: string[];
  /** Platform the current site runs on, when detectable. */
  platform?: string | undefined;
  /** Newest copyright year in the footer: how stale the site looks. */
  copyrightYear?: number | undefined;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchPage(url: string): Promise<string> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const res = await fetch(target, {
    headers: { "user-agent": UA, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return "";
  // A hero video or a huge inlined bundle would otherwise dominate the read;
  // everything we want lives in the head and the footer.
  return (await res.text()).slice(0, 400000);
}

function findEmails(html: string): string[] {
  const found = html.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g) ?? [];
  return [
    ...new Set(
      found
        .map((e) => e.toLowerCase())
        // Tracking pixels and asset filenames look like emails often enough.
        .filter((e) => !/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e))
        .filter((e) => !/^(example|no-?reply|sentry|wixpress|godaddy)/.test(e)),
    ),
  ].slice(0, 5);
}

/** CNPJ in the footer, in either of the two shapes Brazilians write it. */
function findCnpj(html: string): string | undefined {
  const m = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  return m ? m[0].replace(/\D/g, "") : undefined;
}

function detectPlatform(html: string): string | undefined {
  const checks: [RegExp, string][] = [
    [/wp-content|wp-includes/i, "WordPress"],
    [/wix\.com|wixstatic/i, "Wix"],
    [/squarespace/i, "Squarespace"],
    [/shopify/i, "Shopify"],
    [/webflow/i, "Webflow"],
    [/linktr\.ee/i, "Linktree"],
  ];
  for (const [re, label] of checks) if (re.test(html)) return label;
  return undefined;
}

function detectCopyrightYear(html: string): number | undefined {
  const years = (html.match(/(?:©|&copy;|copyright)[^0-9]{0,20}(20\d{2})/gi) ?? [])
    .map((s) => Number(s.match(/20\d{2}/)?.[0]))
    .filter((n) => Number.isFinite(n));
  return years.length > 0 ? Math.max(...years) : undefined;
}

type BrasilApiCnpj = {
  razao_social?: string;
  nome_fantasia?: string;
  data_inicio_atividade?: string;
  porte?: string;
  email?: string;
};

async function lookupCnpj(cnpj: string): Promise<BrasilApiCnpj | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as BrasilApiCnpj;
  } catch {
    return null;
  }
}

/**
 * The pitch angles. These are derived, not generated — a rule that fires on a
 * real fact beats a sentence an LLM invented, and it costs nothing per lead.
 */
function buildAngles(r: {
  platform?: string | undefined;
  copyrightYear?: number | undefined;
  openedAt?: string | undefined;
  emails: string[];
  hasWebsite: boolean;
  instagram?: string | undefined;
}): string[] {
  const angles: string[] = [];
  const thisYear = new Date().getFullYear();

  if (!r.hasWebsite) {
    angles.push("Não tem site: todo o tráfego do Maps morre no perfil.");
  }
  if (r.copyrightYear && thisYear - r.copyrightYear >= 2) {
    angles.push(
      `Rodapé do site ainda diz ${r.copyrightYear} — abandonado há ${thisYear - r.copyrightYear} anos.`,
    );
  }
  if (r.platform && ["WordPress", "Wix", "Linktree"].includes(r.platform)) {
    angles.push(
      r.platform === "Linktree"
        ? "Usa Linktree como se fosse site — não ranqueia e não converte."
        : `Site em ${r.platform}, provável template genérico.`,
    );
  }
  if (r.openedAt) {
    const years = thisYear - new Date(r.openedAt).getFullYear();
    if (years >= 5) angles.push(`${years} anos de mercado — tem caixa e reputação a proteger.`);
  }
  if (r.instagram && !r.hasWebsite) {
    angles.push("Vende pelo Instagram sem destino próprio: a bio é o gargalo.");
  }
  if (r.emails.length > 0) {
    angles.push(`E-mail público encontrado (${r.emails[0]}) — segundo canal disponível.`);
  }
  return angles;
}

export const enrichLead = createServerFn({ method: "POST" })
  .validator((d: EnrichInput) => d)
  .handler(async ({ data }): Promise<EnrichResult> => {
    const hasWebsite = Boolean(data.website?.trim());
    let html = "";

    if (hasWebsite) {
      try {
        html = await fetchPage(data.website!);
      } catch {
        // A site that refuses us is itself a finding, not a failure: the lead
        // keeps whatever we can derive without it.
      }
    }

    const emails = html ? findEmails(html) : [];
    const platform = html ? detectPlatform(html) : undefined;
    const copyrightYear = html ? detectCopyrightYear(html) : undefined;
    const cnpj = html ? findCnpj(html) : undefined;

    const registry = cnpj ? await lookupCnpj(cnpj) : null;

    const result: EnrichResult = {
      emails,
      ...(platform ? { platform } : {}),
      ...(copyrightYear ? { copyrightYear } : {}),
      ...(cnpj ? { cnpj } : {}),
      ...(registry?.razao_social ? { legalName: registry.razao_social } : {}),
      ...(registry?.data_inicio_atividade ? { openedAt: registry.data_inicio_atividade } : {}),
      ...(registry?.porte ? { size: registry.porte } : {}),
      checkedAt: new Date().toISOString(),
    };

    const email = emails[0] ?? registry?.email;
    if (email) result.email = email;

    result.angles = buildAngles({
      platform,
      copyrightYear,
      openedAt: result.openedAt,
      emails,
      hasWebsite,
      instagram: data.instagram,
    });

    return result;
  });
