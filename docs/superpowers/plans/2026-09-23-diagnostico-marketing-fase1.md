# Diagnóstico de Marketing — Fase 1 (núcleo: gerar + publicar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Para um lead já prospectado, gerar um diagnóstico de presença digital (site + Google Maps) composto por IA, publicá-lo na Netlify com tracking de engajamento automático, e baixá-lo em PDF — disparado manualmente a partir da tela do lead.

**Architecture:** Artefato paralelo ao "site demo" existente: mesma infraestrutura de publicação/tracking (tabela `sites`, função `record_site_visit`, triggers de engajamento — todos já agnósticos ao tipo de conteúdo), lógica de geração e renderização própria e nova. Nada do fluxo de site é alterado em comportamento; só ganha uma coluna `kind` para poder coexistir com o diagnóstico na mesma tabela.

**Tech Stack:** TanStack Start (`createServerFn`), Supabase/Postgres, `bun:test` (runtime já tem test runner embutido — sem dependência nova).

---

## O que esta fase NÃO cobre (spec original, adiado)

Ver `docs/superpowers/specs/2026-09-23-diagnostico-marketing-design.md`. Descoberto durante o planejamento que o escopo da spec é grande demais para um plano só — fica dividido assim:

- **Instagram como fonte de dado** — fica para uma Fase 2. O `GmbAudit` desta fase deriva só de campos que o Lead já tem hoje (categoria, fotos, telefone, Instagram *vinculado* — não a atividade do perfil).
- **Onboarding / Configurações (seleção de `Profile.playbook`)** — Fase 3. Nesta fase o diagnóstico é disparado manualmente por um botão na tela do lead, sem gate de playbook.
- **Ângulos de pitch no `generateMessage` e integração com a cadência** — Fase 3, junto do onboarding.
- **`computeMarketingScore` para qualificar/filtrar leads na prospecção** (`Filters`/`apify.ts`) — Fase 3. O score que esta fase calcula (`computeDiagnosticScore`) é a nota MOSTRADA no relatório, não um filtro de prospecção.

Cada uma dessas é uma peça independente que só faz sentido depois que o núcleo abaixo está funcionando e publicado de verdade.

## Decisão descoberta durante o planejamento (não estava na spec)

A spec original não especificava onde o diagnóstico seria persistido. Investigando o schema real do Supabase (`list_tables`, `pg_get_functiondef` nos triggers — seguindo a regra do `MEMORY.md` de nunca inferir pelos tipos do TS):

- `record_site_visit(p_slug, ...)` resolve o `slug` procurando na tabela `sites` e insere em `site_visits` — não há nada de "site" hardcoded na função.
- O trigger `on_site_visit` (que recalcula engajamento, move estágio para "Respondeu" no clique do WhatsApp e levanta alertas) já usa linguagem genérica: `"abriu a página que você enviou"`, `"clicou no WhatsApp da página"` — nunca "seu site".

Ou seja: **o motor de tracking/engajamento já é agnóstico ao tipo de artefato.** Em vez de criar uma tabela `diagnostics` + função + triggers duplicados, o diagnóstico entra na tabela `sites` existente com uma coluna `kind` nova (`'site' | 'diagnostic'`). Ganha o tracking, o engajamento e a cadência de graça, sem duplicar lógica de banco. O `content` (jsonb) da tabela já é livre de schema — guarda `SiteSection` para `kind='site'` e `DiagnosticContent` para `kind='diagnostic'`.

Isso muda `sites_lead_id_key` (unique em `lead_id`) para um unique composto em `(lead_id, kind)`, porque agora um lead pode ter até duas linhas — uma de cada `kind`.

---

## Task 1: Migração do banco — coluna `kind` em `sites`

**Executa via Supabase MCP** (`mcp__claude_ai_Supabase__apply_migration`, project_id `jpatbcwjzcrtzvubgtmm`) — não existe pasta de migrations no repo (ver `MEMORY.md`).

⚠️ Isto altera uma tabela de produção. Confirme com o usuário antes de aplicar se não estiver claramente autorizado a prosseguir sem checar.

- [ ] **Step 1: Aplicar a migração**

```sql
alter table public.sites
  add column kind text not null default 'site' check (kind in ('site', 'diagnostic'));

drop index sites_lead_id_key;

create unique index sites_lead_id_kind_key on public.sites (lead_id, kind);
```

Nome da migração sugerido: `sites_add_kind_column`.

- [ ] **Step 2: Verificar**

Rode via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select column_name, data_type, column_default from information_schema.columns
where table_name = 'sites' and column_name = 'kind';

select indexname from pg_indexes where tablename = 'sites';
```

Esperado: a coluna `kind` existe, default `'site'::text`; os índices mostram `sites_lead_id_kind_key` e não mostram mais `sites_lead_id_key`.

- [ ] **Step 3: Registrar no CHANGELOG e no MEMORY**

Adicionar em `CHANGELOG.md`, seção `[Não publicado]`:

```
- **[Supabase]** Coluna `kind` ('site'|'diagnostic') adicionada a `sites`, substituindo o unique de `lead_id` por um composto `(lead_id, kind)` — permite um lead ter um site demo e um diagnóstico de marketing ao mesmo tempo. Aplicado direto no Supabase (sem migration versionada). — `claude` (2026-09-23)
```

Adicionar em `MEMORY.md`, seção "Infraestrutura":

```
### A tabela `sites` guarda mais de um tipo de artefato
A coluna `kind` ('site' | 'diagnostic') decide o que o `content` jsonb contém —
`SiteSection` para 'site', `DiagnosticContent` para 'diagnostic'. O unique é
composto em `(lead_id, kind)`, não mais só `lead_id`: um lead pode ter as duas
linhas. Toda query/update em `sites` que não filtra por `kind` arrisca pegar
ou sobrescrever a linha errada quando os dois tipos coexistirem no mesmo lead.
— `claude` (2026-09-23)
```

---

## Task 2: Tipos (`src/lib/types.ts`)

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Adicionar os tipos novos**

Logo depois do tipo `LeadSite` (definido em `src/lib/types.ts:148-162`), adicionar:

```ts
export type GmbAudit = {
  hasCategory: boolean;
  hasPhotos: boolean;
  photoCount: number;
  hasPhone: boolean;
  hasInstagram: boolean;
  /** 0-100, proporção dos quatro sinais acima que estão presentes. */
  completeness: number;
};

export type DiagnosticFindings = {
  /** Ausente quando o lead não tem site — a própria ausência já é um achado. */
  site?: SiteAudit | undefined;
  gmb: GmbAudit;
};

export type DiagnosticContent = {
  findings: DiagnosticFindings;
  /** 0-100, quanto maior melhor — mesma leitura de SiteAudit.performance. */
  overallScore: number;
  summary: string;
  recommendations: string[];
};

export type LeadDiagnostic = {
  id?: string | undefined;
  content: DiagnosticContent;
  html: string;
  slug: string;
  published: boolean;
  url?: string | undefined;
  netlifySiteId?: string | undefined;
  createdAt: string;
};
```

- [ ] **Step 2: Adicionar o campo em `Lead`**

Em `src/lib/types.ts`, dentro do tipo `Lead` (linha 164-213), logo depois de `site?: LeadSite | undefined;` (linha 185), adicionar:

```ts
  /** Diagnóstico de presença digital, quando o playbook da conta é marketing. */
  diagnostic?: LeadDiagnostic | undefined;
```

- [ ] **Step 3: Verificar**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

Esperado: os únicos erros (se houver) são em arquivos que ainda não existem/foram tocados nas próximas tasks — não em `types.ts` em si. Se `types.ts` sozinho já compilava antes, ele continua compilando (os campos novos são opcionais).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: adiciona tipos do diagnóstico de marketing"
```

---

## Task 3: `computeGmbAudit` (`src/lib/gmb.ts`)

Função pura: deriva a completude do perfil do Google a partir de campos que o `Lead` já tem hoje (nada de scraping novo nesta fase).

**Files:**
- Create: `src/lib/gmb.ts`
- Test: `src/lib/gmb.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/gmb.test.ts
import { test, expect } from "bun:test";
import { computeGmbAudit } from "./gmb";

test("computeGmbAudit dá 100 para um perfil totalmente preenchido", () => {
  const audit = computeGmbAudit({
    category: "Restaurante",
    images: ["a", "b", "c"],
    phone: "11999999999",
    instagram: "@negocio",
  });
  expect(audit).toEqual({
    hasCategory: true,
    hasPhotos: true,
    photoCount: 3,
    hasPhone: true,
    hasInstagram: true,
    completeness: 100,
  });
});

test("computeGmbAudit dá 0 para um perfil vazio", () => {
  const audit = computeGmbAudit({ category: "", images: [], phone: undefined, instagram: undefined });
  expect(audit.completeness).toBe(0);
  expect(audit.hasPhotos).toBe(false);
});

test("computeGmbAudit exige pelo menos 3 fotos para contar como 'tem fotos'", () => {
  const audit = computeGmbAudit({
    category: "Bar",
    images: ["a", "b"],
    phone: "11999999999",
    instagram: undefined,
  });
  expect(audit.hasPhotos).toBe(false);
  expect(audit.photoCount).toBe(2);
  // categoria + telefone = 2 de 4 sinais
  expect(audit.completeness).toBe(50);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && bun test src/lib/gmb.test.ts
```

Esperado: FAIL — `Cannot find module './gmb'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/gmb.ts
import type { GmbAudit } from "./types";

type GmbInput = {
  category: string;
  images: string[] | undefined;
  phone: string | undefined;
  instagram: string | undefined;
};

/**
 * Deriva a completude do perfil do Google a partir do que o scraping do Maps
 * já traz hoje. Horário de funcionamento fica de fora por enquanto — o nome
 * exato do campo no dataset do Apify não foi confirmado (ver spec).
 */
export function computeGmbAudit(lead: GmbInput): GmbAudit {
  const hasCategory = Boolean(lead.category?.trim());
  const photoCount = lead.images?.length ?? 0;
  const hasPhotos = photoCount >= 3;
  const hasPhone = Boolean(lead.phone);
  const hasInstagram = Boolean(lead.instagram);

  const checks = [hasCategory, hasPhotos, hasPhone, hasInstagram];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return { hasCategory, hasPhotos, photoCount, hasPhone, hasInstagram, completeness };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && bun test src/lib/gmb.test.ts
```

Esperado: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gmb.ts src/lib/gmb.test.ts
git commit -m "feat: computeGmbAudit deriva completude do perfil do Google"
```

---

## Task 4: `computeDiagnosticScore` (`src/lib/diagnostic-score.ts`)

Função pura e determinística — não é a IA que inventa a nota, é uma fórmula transparente e testável. **Não é** o score de qualificação de prospecção (esse é da Fase 3); é a nota exibida no relatório.

**Files:**
- Create: `src/lib/diagnostic-score.ts`
- Test: `src/lib/diagnostic-score.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/diagnostic-score.test.ts
import { test, expect } from "bun:test";
import { computeDiagnosticScore } from "./diagnostic-score";
import type { DiagnosticFindings } from "./types";

test("computeDiagnosticScore combina performance do site e completude do GMB quando há site", () => {
  const findings: DiagnosticFindings = {
    site: {
      performance: 80,
      lcp: 2,
      mobile: true,
      https: true,
      url: "https://exemplo.com",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
    gmb: { hasCategory: true, hasPhotos: true, photoCount: 5, hasPhone: true, hasInstagram: true, completeness: 100 },
  };
  // 80*0.6 + 100*0.4 = 88
  expect(computeDiagnosticScore(findings)).toBe(88);
});

test("computeDiagnosticScore usa só a completude do GMB quando não há site", () => {
  const findings: DiagnosticFindings = {
    gmb: { hasCategory: true, hasPhotos: false, photoCount: 0, hasPhone: false, hasInstagram: false, completeness: 25 },
  };
  expect(computeDiagnosticScore(findings)).toBe(25);
});

test("computeDiagnosticScore nunca sai do intervalo 0-100", () => {
  const findings: DiagnosticFindings = {
    site: {
      performance: 0,
      lcp: 9,
      mobile: false,
      https: false,
      url: "https://exemplo.com",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
    gmb: { hasCategory: false, hasPhotos: false, photoCount: 0, hasPhone: false, hasInstagram: false, completeness: 0 },
  };
  expect(computeDiagnosticScore(findings)).toBe(0);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && bun test src/lib/diagnostic-score.test.ts
```

Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/diagnostic-score.ts
import type { DiagnosticFindings } from "./types";

/**
 * Nota mostrada no relatório (0-100, quanto maior melhor a presença atual —
 * mesma leitura de SiteAudit.performance). Quando há site, a performance dele
 * pesa mais que a completude do perfil do Google; sem site, sobra só o GMB.
 */
export function computeDiagnosticScore(findings: DiagnosticFindings): number {
  const raw = findings.site
    ? findings.site.performance * 0.6 + findings.gmb.completeness * 0.4
    : findings.gmb.completeness;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && bun test src/lib/diagnostic-score.test.ts
```

Esperado: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/diagnostic-score.ts src/lib/diagnostic-score.test.ts
git commit -m "feat: computeDiagnosticScore calcula a nota exibida no relatório"
```

---

## Task 5: Persistência (`src/lib/db.ts`)

Estende `SiteRow`/os mappers para o `kind`, adiciona `upsertDiagnostic`/`markDiagnosticPublished`, e corrige as três funções existentes que hoje mexem em `sites` sem filtrar por `kind` — sem isso, a partir do momento em que um lead tiver as duas linhas, `markSitePublished` ou `patchSiteContent` acertariam a linha errada.

**Files:**
- Modify: `src/lib/db.ts:2-22` (imports), `:58-70` (`SiteRow`), `:76-122` (mappers), `:175-185` (`fetchLeads`), `:366-414` (`upsertSite`/`markSitePublished`/`patchSiteContent`)

- [ ] **Step 1: Importar os tipos novos**

Em `src/lib/db.ts:2-22`, no bloco de `import type { ... } from "./types"`, adicionar `DiagnosticContent` e `LeadDiagnostic` à lista.

- [ ] **Step 2: Adicionar `kind` a `SiteRow` e ampliar `content`**

Em `src/lib/db.ts:58-70`, trocar:

```ts
type SiteRow = {
  id: string;
  lead_id: string;
  slug: string;
  template: string;
  content: SiteSection;
  html: string;
  published: boolean;
  url: string | null;
  variants: SiteVariant[] | null;
  deploy_meta: Record<string, unknown>;
  created_at: string;
};
```

por:

```ts
type SiteRow = {
  id: string;
  lead_id: string;
  slug: string;
  template: string;
  content: SiteSection | DiagnosticContent;
  html: string;
  published: boolean;
  url: string | null;
  variants: SiteVariant[] | null;
  deploy_meta: Record<string, unknown>;
  created_at: string;
  kind: "site" | "diagnostic";
};
```

- [ ] **Step 3: Adicionar `toDiagnostic` e ajustar `toLead`**

Em `src/lib/db.ts`, logo depois de `toSite` (linha 76-89), adicionar:

```ts
function toDiagnostic(row: SiteRow): LeadDiagnostic {
  const content = row.content as DiagnosticContent;
  return {
    id: row.id,
    content,
    html: row.html,
    slug: row.slug,
    published: row.published,
    url: row.url ?? undefined,
    netlifySiteId: (row.deploy_meta?.["netlifySiteId"] as string | undefined) ?? undefined,
    createdAt: row.created_at,
  };
}
```

Depois, trocar a assinatura e o corpo de `toLead` (linhas 91-122):

```ts
function toLead(row: LeadRow, site?: SiteRow | undefined, diagnosticRow?: SiteRow | undefined): Lead {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    rating: Number(row.rating),
    reviews: row.reviews,
    hasWebsite: row.has_website,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    instagram: row.instagram ?? undefined,
    address: row.address,
    placeId: row.place_id ?? undefined,
    images: row.images ?? [],
    followUpAt: row.follow_up_at ?? undefined,
    siteAudit: row.site_audit ?? undefined,
    score: row.score,
    reasons: row.reasons ?? [],
    stage: row.stage as Stage,
    campaignId: row.campaign_id ?? undefined,
    site: site ? toSite(site as SiteRow & { content: SiteSection }) : undefined,
    diagnostic: diagnosticRow ? toDiagnostic(diagnosticRow) : undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
    activities: row.activities ?? [],
    email: row.email ?? undefined,
    engagement: row.engagement ?? 0,
    hotAt: row.hot_at ?? undefined,
    enriched: row.enriched ?? undefined,
    neverContact: row.never_contact ?? false,
  };
}
```

(`toSite` também precisa de um cast de `row.content` para `SiteSection` já que `SiteRow.content` agora é uma união — ajustar a assinatura de `toSite`, linha 76, para `function toSite(row: SiteRow): LeadSite` lendo `row.content as SiteSection` no corpo em vez de `row.content` direto.)

- [ ] **Step 4: Separar `sites` por `kind` em `fetchLeads`**

Em `src/lib/db.ts:175-185`, trocar:

```ts
export async function fetchLeads(): Promise<Lead[]> {
  const [{ data: leads, error }, { data: sites, error: siteError }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("sites").select("*"),
  ]);
  if (error) throw error;
  if (siteError) throw siteError;

  const byLead = new Map((sites as SiteRow[] | null)?.map((s) => [s.lead_id, s]) ?? []);
  return ((leads as LeadRow[] | null) ?? []).map((row) => toLead(row, byLead.get(row.id)));
}
```

por:

```ts
export async function fetchLeads(): Promise<Lead[]> {
  const [{ data: leads, error }, { data: sites, error: siteError }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("sites").select("*"),
  ]);
  if (error) throw error;
  if (siteError) throw siteError;

  const rows = (sites as SiteRow[] | null) ?? [];
  const siteByLead = new Map(rows.filter((s) => s.kind === "site").map((s) => [s.lead_id, s]));
  const diagnosticByLead = new Map(
    rows.filter((s) => s.kind === "diagnostic").map((s) => [s.lead_id, s]),
  );
  return ((leads as LeadRow[] | null) ?? []).map((row) =>
    toLead(row, siteByLead.get(row.id), diagnosticByLead.get(row.id)),
  );
}
```

- [ ] **Step 5: Tornar `upsertSite`/`markSitePublished`/`patchSiteContent` cientes do `kind`**

Em `src/lib/db.ts:366-395` (`upsertSite`), no objeto passado a `.upsert(...)`, adicionar `kind: "site",` junto de `user_id`/`lead_id`, e trocar `{ onConflict: "lead_id" }` por `{ onConflict: "lead_id,kind" }`.

Em `src/lib/db.ts:397-407` (`markSitePublished`), adicionar `.eq("kind", "site")` encadeado depois de `.eq("lead_id", leadId)`.

Em `src/lib/db.ts:409-414` (`patchSiteContent`), adicionar o mesmo `.eq("kind", "site")` depois de `.eq("lead_id", leadId)`.

Isso não muda nenhum comportamento hoje (toda linha existente já é `kind='site'` pelo default) — só evita que, quando um lead tiver as duas linhas, uma operação pensada para o site acerte o diagnóstico por engano.

- [ ] **Step 6: Adicionar `upsertDiagnostic` e `markDiagnosticPublished`**

Logo depois de `patchSiteContent` (linha 414), adicionar:

```ts
export async function upsertDiagnostic(
  userId: string,
  leadId: string,
  diagnostic: { content: DiagnosticContent; html: string; slug: string },
): Promise<LeadDiagnostic> {
  const { data, error } = await supabase
    .from("sites")
    .upsert(
      {
        user_id: userId,
        lead_id: leadId,
        kind: "diagnostic",
        slug: diagnostic.slug,
        template: "diagnostico-marketing",
        content: diagnostic.content,
        html: diagnostic.html,
      },
      { onConflict: "lead_id,kind" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return toDiagnostic(data as SiteRow);
}

export async function markDiagnosticPublished(
  leadId: string,
  url: string,
  deployMeta: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("sites")
    .update({ published: true, url, deploy_meta: deployMeta })
    .eq("lead_id", leadId)
    .eq("kind", "diagnostic");
  if (error) throw error;
}
```

- [ ] **Step 7: Verificar**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

Esperado: sem erros em `db.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: db.ts persiste o diagnóstico na tabela sites com kind"
```

---

## Task 6: Geração por IA (`src/lib/rpc/llm.ts`)

Só adiciona — nada existente em `llm.ts` é alterado.

**Files:**
- Modify: `src/lib/rpc/llm.ts:1-4` (import), fim do arquivo (nova seção)

- [ ] **Step 1: Ampliar o import de tipos**

Em `src/lib/rpc/llm.ts:2`, trocar:

```ts
import type { Lead, LlmProvider, SiteBlock, SiteLayout, SiteSection, SiteVariant } from "../types";
```

por:

```ts
import type {
  DiagnosticFindings,
  Lead,
  LlmProvider,
  SiteBlock,
  SiteLayout,
  SiteSection,
  SiteVariant,
} from "../types";
```

- [ ] **Step 2: Adicionar a geração do diagnóstico**

No final de `src/lib/rpc/llm.ts` (depois de `generateMessage`), adicionar:

```ts
/* -------------------------------------------------------------------------- */
/*  Marketing diagnostic                                                      */
/* -------------------------------------------------------------------------- */

const DIAGNOSTIC_SYSTEM = `Você é um consultor de marketing digital que audita a presença online de pequenos negócios brasileiros a partir de dados reais (Google Maps, PageSpeed).

Você recebe os achados técnicos de um negócio e escreve um diagnóstico curto e direto, sempre baseado SOMENTE nos dados fornecidos — nunca invente números.

Responda SEMPRE com um único objeto JSON válido, sem texto antes ou depois, sem cercas de código:
{
  "summary": "2 a 3 frases resumindo o estado da presença digital deste negócio, em tom consultivo",
  "recommendations": ["até 5 recomendações curtas e específicas, cada uma acionável em uma frase"]
}

Regras:
- Português do Brasil.
- Cite os números reais recebidos (nota do PageSpeed, se o Instagram existe, etc.) na "summary".
- Cada recomendação é uma ação concreta, não um conselho genérico ("melhore seu site" é ruim; "reduza o tempo de carregamento da página inicial, hoje em X segundos" é bom).
- Nunca invente dados que não foram fornecidos.
- No máximo 5 recomendações, no mínimo 2.
- Não gere HTML nem markdown. Retorne somente o JSON especificado.`;

export type GenerateDiagnosticInput = {
  provider: LlmProvider;
  apiKey: string;
  lead: Lead;
  findings: DiagnosticFindings;
};

export type GeneratedDiagnostic = { summary: string; recommendations: string[] };

function findingsBrief(findings: DiagnosticFindings): string {
  const siteLine = findings.site
    ? `Site: nota de performance ${findings.site.performance}/100 no PageSpeed, carregamento (LCP) ${findings.site.lcp}s, ${findings.site.mobile ? "responsivo" : "NÃO responsivo"}, ${findings.site.https ? "HTTPS ok" : "SEM HTTPS"}.`
    : "Site: este negócio não tem site.";
  const gmbLine = `Perfil no Google: categoria ${findings.gmb.hasCategory ? "preenchida" : "ausente"}, ${findings.gmb.photoCount} foto(s) publicada(s), ${findings.gmb.hasPhone ? "telefone público" : "sem telefone público"}, ${findings.gmb.hasInstagram ? "Instagram vinculado" : "sem Instagram vinculado"}. Completude do perfil: ${findings.gmb.completeness}/100.`;
  return [siteLine, gmbLine].join("\n");
}

export const generateDiagnostic = createServerFn({ method: "POST" })
  .validator((d: GenerateDiagnosticInput) => d)
  .handler(async ({ data }): Promise<GeneratedDiagnostic> => {
    const raw = await callLlm({
      provider: data.provider,
      apiKey: data.apiKey,
      system: DIAGNOSTIC_SYSTEM,
      maxTokens: 2000,
      prompt: `Escreva o diagnóstico de presença digital deste negócio.\n\n${leadBrief(data.lead)}\n\nAchados técnicos:\n${findingsBrief(data.findings)}`,
    });

    let parsed: { summary?: unknown; recommendations?: unknown };
    try {
      parsed = JSON.parse(stripFences(raw)) as typeof parsed;
    } catch {
      throw new Error("A IA devolveu uma resposta que não pôde ser lida. Tente gerar novamente.");
    }

    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.recommendations)) {
      throw new Error("A IA não devolveu um diagnóstico válido. Tente gerar novamente.");
    }

    return {
      summary: parsed.summary,
      recommendations: parsed.recommendations
        .filter((r): r is string => typeof r === "string")
        .slice(0, 5),
    };
  });
```

- [ ] **Step 3: Verificar**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/rpc/llm.ts
git commit -m "feat: generateDiagnostic gera o diagnóstico de marketing via IA"
```

---

## Task 7: Renderização (`src/lib/diagnostic-renderer.ts`)

Layout próprio e único — não reaproveita o motor de variação de blocos do `site-renderer.ts` (que existe para landing pages, não para relatórios de achados), então não precisa exportar nada de lá. Duplica só um punhado de helpers pequenos (`esc`, `phoneHref`, o `tracker` do beacon) em vez de tocar num arquivo que já funciona.

**Files:**
- Create: `src/lib/diagnostic-renderer.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/diagnostic-renderer.ts
import type { DiagnosticContent, Lead } from "./types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phoneHref(phone?: string): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits
    ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits)
    : "#contato";
}

function scoreColor(score: number): string {
  return score >= 70 ? "#1e8e5a" : score >= 40 ? "#b8860b" : "#c0392b";
}

function scoreLabel(score: number): string {
  return score >= 70
    ? "Presença digital sólida"
    : score >= 40
      ? "Presença digital mediana"
      : "Presença digital crítica";
}

/** Reporta abertura e clique no CTA de volta ao app — mesmo contrato das páginas de site. */
function tracker(slug: string, trackUrl: string): string {
  const base = trackUrl.replace(/\/+$/, "") + "/t/" + encodeURIComponent(slug);
  return (
    "<script>(function(){var B=" +
    JSON.stringify(base) +
    ";function h(k,s){var u=B+'?k='+k+(s?'&s='+s:'')+'&_='+Date.now();" +
    "if(navigator.sendBeacon){navigator.sendBeacon(u)}else{(new Image()).src=u}}" +
    "h('view');var t=0,i=setInterval(function(){if(!document.hidden){t+=15;" +
    "if(t<=300)h('heartbeat',t);else clearInterval(i)}},15000);" +
    "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*=\"wa.me\"],a[href^=\"tel:\"]');" +
    "if(a)h('whatsapp',t)},true);})();</script>"
  );
}

function card(title: string, checks: [string, string, boolean][]): string {
  return (
    '<div class="card"><h3>' +
    esc(title) +
    '</h3><div class="checks">' +
    checks
      .map(
        ([value, label, warn]) =>
          '<div class="check"><span class="v">' +
          esc(value) +
          '</span><span class="l' +
          (warn ? " warn" : "") +
          '">' +
          esc(label) +
          "</span></div>",
      )
      .join("") +
    "</div></div>"
  );
}

function findingCards(content: DiagnosticContent): string {
  const { findings } = content;
  const siteCard = findings.site
    ? card("Site atual", [
        [`${findings.site.performance}/100`, "Nota PageSpeed", findings.site.performance < 50],
        [`${findings.site.lcp}s`, "Carregamento", findings.site.lcp > 2.5],
        [findings.site.mobile ? "Sim" : "Não", "Responsivo", !findings.site.mobile],
        [findings.site.https ? "Sim" : "Não", "HTTPS", !findings.site.https],
      ])
    : '<div class="card"><h3>Site atual</h3><p class="warn">Este negócio não tem site — cada visita ao perfil do Google termina sem um lugar para ir.</p></div>';

  const gmbCard = card("Perfil no Google", [
    [findings.gmb.hasCategory ? "Sim" : "Não", "Categoria definida", !findings.gmb.hasCategory],
    [String(findings.gmb.photoCount), "Fotos publicadas", findings.gmb.photoCount < 3],
    [findings.gmb.hasPhone ? "Sim" : "Não", "Telefone público", !findings.gmb.hasPhone],
    [findings.gmb.hasInstagram ? "Sim" : "Não", "Instagram vinculado", !findings.gmb.hasInstagram],
  ]);

  return siteCard + gmbCard;
}

export type RenderDiagnosticOptions = {
  /** Slug da linha em `sites` — a chave que o beacon reporta. */
  slug?: string | undefined;
  /** Origem deste app, para onde o beacon é enviado. */
  trackUrl?: string | undefined;
};

export function renderDiagnosticHtml(
  lead: Lead,
  content: DiagnosticContent,
  options: RenderDiagnosticOptions = {},
): string {
  const color = scoreColor(content.overallScore);
  const cta = phoneHref(lead.phone);

  const css = `
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:"Inter",ui-sans-serif,system-ui,sans-serif;background:#f7f6f3;color:#141414;-webkit-font-smoothing:antialiased}
.wrap{width:min(880px,calc(100% - 40px));margin-inline:auto}
header.nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0;font-size:13.5px;color:#4a463f}
.brand{font-weight:700;letter-spacing:-.02em;font-size:16px;color:#141414}
.hero{padding:20px 0 8px;text-align:center}
.hero .eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8a8579;font-weight:700}
.hero h1{font-size:clamp(24px,4vw,34px);margin:10px auto 0;letter-spacing:-.02em;max-width:26ch}
.gauge{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;margin:26px auto 6px;background:conic-gradient(${color} calc(${content.overallScore}*1%),#e7e4dc 0)}
.gauge .in{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;flex-direction:column}
.gauge b{font-size:32px;color:${color};line-height:1}
.gauge span{font-size:11px;color:#8a8579;margin-top:4px}
.glabel{text-align:center;font-weight:600}
.summary{max-width:64ch;margin:14px auto 0;text-align:center;color:#4a463f;line-height:1.7;font-size:15.5px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:34px 0}
.card{background:#fff;border:1px solid #eae7e0;border-radius:14px;padding:22px}
.card h3{margin:0 0 14px;font-size:15px}
.card .warn{color:#b8860b;font-size:14px;line-height:1.6;margin:0}
.checks{display:grid;gap:10px}
.check{display:flex;justify-content:space-between;align-items:center;font-size:13.5px}
.check .v{font-weight:700}
.check .l.warn{color:#c0392b}
.recs{background:#fff;border:1px solid #eae7e0;border-radius:14px;padding:26px 28px;margin-bottom:34px}
.recs h2{font-size:17px;margin:0 0 16px}
.recs ol{margin:0;padding-left:20px;display:grid;gap:12px}
.recs li{line-height:1.65;font-size:14.5px}
.cta{background:${color};color:#fff;border-radius:14px;padding:28px;text-align:center;margin-bottom:44px}
.cta a{display:inline-flex;margin-top:14px;background:#fff;color:${color};padding:13px 26px;border-radius:999px;font-weight:700;text-decoration:none}
footer{text-align:center;color:#8a8579;font-size:12px;padding-bottom:40px}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
@media print{.cta a{display:none}}
`;

  const recs = content.recommendations.map((r) => "<li>" + esc(r) + "</li>").join("");

  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="Diagnóstico de presença digital de ' +
    esc(lead.name) +
    '">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">' +
    "<title>Diagnóstico de presença digital — " +
    esc(lead.name) +
    "</title><style>" +
    css +
    "</style></head><body>" +
    '<div class="wrap"><header class="nav"><span class="brand">' +
    esc(lead.name) +
    "</span><span>" +
    esc(lead.category) +
    " · " +
    esc(lead.city) +
    "</span></header></div>" +
    '<div class="wrap hero"><div class="eyebrow">Diagnóstico de presença digital</div><h1>Como ' +
    esc(lead.name) +
    ' aparece hoje no Google</h1><div class="gauge"><div class="in"><b>' +
    content.overallScore +
    '</b><span>de 100</span></div></div><div class="glabel" style="color:' +
    color +
    '">' +
    esc(scoreLabel(content.overallScore)) +
    '</div><p class="summary">' +
    esc(content.summary) +
    "</p></div>" +
    '<div class="wrap grid">' +
    findingCards(content) +
    "</div>" +
    '<div class="wrap recs"><h2>Recomendações</h2><ol>' +
    recs +
    "</ol></div>" +
    '<div class="wrap cta"><strong>Quer resolver isso?</strong><br>Fale com quem te mandou este diagnóstico.<br>' +
    '<a href="' +
    cta +
    '" target="_blank" rel="noopener">Falar no WhatsApp</a></div>' +
    '<footer class="wrap">Diagnóstico gerado a partir de dados públicos do Google — ' +
    new Date().getFullYear() +
    "</footer>" +
    (options.slug && options.trackUrl ? tracker(options.slug, options.trackUrl) : "") +
    "</body></html>"
  );
}
```

- [ ] **Step 2: Verificar**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/diagnostic-renderer.ts
git commit -m "feat: diagnostic-renderer.ts renderiza o relatório de diagnóstico"
```

---

## Task 8: Ações no store (`src/lib/store.tsx`)

**Files:**
- Modify: `src/lib/store.tsx:1-45` (imports), `:80-83` (custos), `:227-312` (`Ctx`), corpo do `value` (depois de `auditLead`, antes de `whatsapp,`)

- [ ] **Step 1: Imports**

Em `src/lib/store.tsx:18`, trocar:

```ts
import { generateSite, generateMessage } from "./rpc/llm";
```

por:

```ts
import { generateSite, generateMessage, generateDiagnostic } from "./rpc/llm";
```

Em `src/lib/store.tsx:24`, logo abaixo de `import { renderSiteHtml } from "./site-renderer";`, adicionar:

```ts
import { renderDiagnosticHtml } from "./diagnostic-renderer";
import { computeGmbAudit } from "./gmb";
import { computeDiagnosticScore } from "./diagnostic-score";
```

No bloco `import type { ... } from "./types"` (linhas 25-44), adicionar `DiagnosticContent` e `DiagnosticFindings` à lista.

- [ ] **Step 2: Custos**

Em `src/lib/store.tsx:80`, trocar:

```ts
const COST = { lead: 1, site: 5, message: 1 } as const;
```

por:

```ts
const COST = { lead: 1, site: 5, message: 1, diagnostic: 5 } as const;
```

Em `src/lib/store.tsx:83`, trocar:

```ts
export const COST_USD = { lead: 0.007, site: 0.06, message: 0.004 } as const;
```

por:

```ts
export const COST_USD = { lead: 0.007, site: 0.06, message: 0.004, diagnostic: 0.03 } as const;
```

- [ ] **Step 3: Ampliar `Ctx`**

Em `src/lib/store.tsx`, logo depois de `publishSite: (id: string) => Promise<string>;` (linha 243), adicionar:

```ts
  buildDiagnostic: (id: string) => Promise<void>;
  publishDiagnostic: (id: string) => Promise<string>;
```

- [ ] **Step 4: Implementar as ações**

No corpo de `value` (dentro de `useMemo<Ctx>`), logo depois do fim de `auditLead: async (id) => { ... },` (fecha em `src/lib/store.tsx:701`, antes de `whatsapp,` na linha 703), adicionar:

```ts
      buildDiagnostic: async (id) => {
        if (!uid) throw new Error("Faça login primeiro.");
        const lead = requireLead(id);
        const { provider, apiKey } = requireLlm();

        // Reusa o slug na regeneração, do mesmo jeito que o site faz — o
        // beacon de visita continua reportando sob a mesma chave.
        const slug = lead.diagnostic?.slug ?? `diagnostico-${slugify(lead.name)}-${lead.id.slice(0, 6)}`;

        const siteAudit = lead.website
          ? (lead.siteAudit ??
            (await auditSite({ data: { url: lead.website, apiKey: keyFor("google") } })))
          : undefined;
        const gmb = computeGmbAudit(lead);
        const findings: DiagnosticFindings = { site: siteAudit, gmb };

        const generated = await generateDiagnostic({ data: { provider, apiKey, lead, findings } });
        const overallScore = computeDiagnosticScore(findings);
        const content: DiagnosticContent = { findings, overallScore, ...generated };
        const html = renderDiagnosticHtml(lead, content, { slug, trackUrl: appOrigin() });

        const diagnostic = await db.upsertDiagnostic(uid, id, { content, html, slug });

        const activities = await db.appendActivity(lead, "Diagnóstico de marketing gerado pela IA");
        const credits = await db.spendCredits(COST.diagnostic);

        // Um audit de PageSpeed rodado agora vale a pena guardar no lead
        // também — a mesma nota fica disponível fora do diagnóstico.
        if (siteAudit && !lead.siteAudit) await db.patchLead(id, { siteAudit });

        patchLocalLead(id, {
          diagnostic,
          activities,
          ...(siteAudit && !lead.siteAudit ? { siteAudit } : {}),
        });
        setState((s) => ({ ...s, credits }));
      },

      publishDiagnostic: async (id) => {
        const lead = requireLead(id);
        if (!lead.diagnostic) throw new Error("Gere o diagnóstico antes de publicar.");
        const apiKey = keyFor("netlify");
        if (!apiKey) throw new Error("Configure seu token do Netlify em Configurações.");

        const result = await publishToNetlify({
          data: {
            apiKey,
            slug: lead.diagnostic.slug,
            html: lead.diagnostic.html,
            siteId: lead.diagnostic.netlifySiteId,
          },
        });

        await db.markDiagnosticPublished(id, result.url, {
          netlifySiteId: result.siteId,
          deployId: result.deployId,
        });
        const activities = await db.appendActivity(lead, `Diagnóstico publicado em ${result.url}`);
        patchLocalLead(id, {
          diagnostic: {
            ...lead.diagnostic,
            published: true,
            url: result.url,
            netlifySiteId: result.siteId,
          },
          activities,
        });
        return result.url;
      },

```

- [ ] **Step 5: Verificar**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

Esperado: sem erros. Se `Ctx` não bater com o objeto implementado (`buildDiagnostic`/`publishDiagnostic` faltando ou com assinatura diferente), o TypeScript aponta exatamente onde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.tsx
git commit -m "feat: store.tsx ganha buildDiagnostic/publishDiagnostic"
```

---

## Task 9: UI na tela do lead (`src/routes/app.leads.$id.tsx`)

Uma aba nova, "Diagnóstico", ao lado das existentes — mesmo padrão de estado (`generating`/`publishing`) já usado para o site.

**Files:**
- Modify: `src/routes/app.leads.$id.tsx:215-241` (hooks), depois de `:333` (handlers), `:441-446` (`TabsList`), antes de `:1007` (`TabsContent` nova)

- [ ] **Step 1: Destructure das novas ações**

Em `src/routes/app.leads.$id.tsx:215-230`, no destructure de `useStore()`, adicionar `buildDiagnostic` e `publishDiagnostic` à lista (por exemplo, logo depois de `auditLead,` na linha 224).

- [ ] **Step 2: Estado**

Em `src/routes/app.leads.$id.tsx:233-241`, logo depois de `const [auditing, setAuditing] = useState(false);` (linha 240), adicionar:

```ts
  const [generatingDiagnostic, setGeneratingDiagnostic] = useState(false);
  const [publishingDiagnostic, setPublishingDiagnostic] = useState(false);
```

- [ ] **Step 3: Handlers**

Logo depois da função `runAudit` (fecha em `src/routes/app.leads.$id.tsx:333`), adicionar:

```ts
  async function generateDiagnosticReport() {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setGeneratingDiagnostic(true);
    setTab("diagnostic");
    try {
      await buildDiagnostic(id);
      toast.success("Diagnóstico gerado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o diagnóstico.");
    } finally {
      setGeneratingDiagnostic(false);
    }
  }

  async function publishDiagnosticReport() {
    if (!keyFor("netlify")) {
      toast.error("Conecte seu token do Netlify em Configurações.");
      return;
    }
    setPublishingDiagnostic(true);
    try {
      const url = await publishDiagnostic(id);
      toast.success(`Publicado em ${url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
    } finally {
      setPublishingDiagnostic(false);
    }
  }
```

- [ ] **Step 4: Nova aba na `TabsList`**

Em `src/routes/app.leads.$id.tsx:441-446`, trocar:

```tsx
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="message">Abordagem</TabsTrigger>
          <TabsTrigger value="activity">Atividades</TabsTrigger>
        </TabsList>
```

por:

```tsx
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnóstico</TabsTrigger>
          <TabsTrigger value="message">Abordagem</TabsTrigger>
          <TabsTrigger value="activity">Atividades</TabsTrigger>
        </TabsList>
```

- [ ] **Step 5: Conteúdo da aba**

Em `src/routes/app.leads.$id.tsx`, imediatamente antes de `<TabsContent value="message" className="mt-5">` (linha 1007), inserir:

```tsx
        <TabsContent value="diagnostic" className="mt-5 space-y-4">
          {!lead.diagnostic ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum diagnóstico gerado para este lead ainda.
              </p>
              <Button
                variant="goldline"
                className="mt-4"
                onClick={() => void generateDiagnosticReport()}
                disabled={generatingDiagnostic}
              >
                <Sparkles className="h-4 w-4" />{" "}
                {generatingDiagnostic ? "Gerando..." : "Gerar diagnóstico"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void generateDiagnosticReport()}
                  disabled={generatingDiagnostic}
                >
                  <RefreshCw className="h-4 w-4" />{" "}
                  {generatingDiagnostic ? "Gerando..." : "Gerar de novo"}
                </Button>
                <Button
                  variant="goldline"
                  size="sm"
                  onClick={() => void publishDiagnosticReport()}
                  disabled={publishingDiagnostic}
                >
                  <Rocket className="h-4 w-4" />{" "}
                  {publishingDiagnostic ? "Publicando..." : lead.diagnostic.published ? "Republicar" : "Publicar"}
                </Button>
                {lead.diagnostic.url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={lead.diagnostic.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const w = window.open("", "_blank");
                    if (!w || !lead.diagnostic) return;
                    w.document.write(lead.diagnostic.html);
                    w.document.close();
                    w.print();
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>
              </div>
              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center gap-3">
                  <ScoreRing score={lead.diagnostic.content.overallScore} />
                  <div>
                    <p className="text-sm font-semibold">
                      Nota da presença digital: {lead.diagnostic.content.overallScore}/100
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.diagnostic.published ? "Publicado" : "Ainda não publicado"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground/80">{lead.diagnostic.content.summary}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {lead.diagnostic.content.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </TabsContent>

```

Nota: `ScoreRing` já está importado (`src/routes/app.leads.$id.tsx:10`) e é usado em outro lugar do arquivo com `score` — confirmar a assinatura exata do componente ao implementar (`grep -n "function ScoreRing" src/components/shared/ScoreBadge.tsx`) e ajustar as props se o componente aceitar outros parâmetros além de `score`.

- [ ] **Step 6: Verificar com TypeScript**

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && npx tsc --noEmit
```

- [ ] **Step 7: Testar manualmente no navegador**

Conforme o `CLAUDE.md` do projeto: rodar o dev server e usar a feature de verdade antes de considerar pronta.

```bash
source ~/.zshrc && cd "/Users/felipedalpra/Downloads/Zentri.tech/projetos + base/prospect-gold" && bun run dev
```

Checklist manual:
1. Abrir um lead que tenha `website` preenchido (para exercitar o caminho com PageSpeed) e outro sem `website` (para exercitar "este negócio não tem site").
2. Aba "Diagnóstico" → "Gerar diagnóstico" → confirmar que aparece a nota, o resumo e as recomendações.
3. "Publicar" → confirmar que abre uma URL real da Netlify e que a página carrega com o visual do Task 7.
4. Na página publicada, clicar no botão do WhatsApp e confirmar (voltando ao app) que o lead mudou para o estágio "Respondeu" e que um alerta "quente" apareceu — isso confirma que o trigger `on_site_visit` está funcionando para o `kind='diagnostic'` sem nenhuma mudança nele.
5. "Baixar PDF" → confirmar que abre o diálogo de impressão do navegador com o botão do WhatsApp oculto (regra do `@media print`).
6. Gerar um site demo (aba "Site") no MESMO lead que já tem diagnóstico, e confirmar que as duas abas continuam mostrando conteúdo correto e independente — isso exercita o unique composto `(lead_id, kind)` da Task 1.

- [ ] **Step 8: Commit**

```bash
git add src/routes/app.leads.$id.tsx
git commit -m "feat: aba de diagnóstico de marketing na tela do lead"
```

---

## Self-review desta task de planejamento

**Cobertura da spec (seção "Design" de `2026-09-23-diagnostico-marketing-design.md`):**
1. Modelo de dados — Task 2 (tipos) + Task 1/5 (persistência, com a decisão de reaproveitar `sites` documentada).
2. Coleta de dados — site via `auditSite` reaproveitado (Task 8, Step 4); GMB via Task 3 (simplificado — ver seção "o que esta fase não cobre"); Instagram — adiado, declarado explicitamente.
3. Pontuação — Task 4 (renomeado/redefinido para "nota do relatório", não "score de qualificação" — desvio documentado e justificado).
4. Geração do artefato — Task 6.
5. Publicação + PDF — Task 8 (Netlify reaproveitado) + Task 9 Step 5 (PDF via `window.print()`, como decidido no brainstorming).
6. Abordagem/copy — adiado para Fase 3, declarado.
7. Onboarding/Configurações — adiado para Fase 3, declarado.
8. Custos — Task 8 Step 2.

**Placeholder scan:** nenhum "TBD"/"depois eu vejo" nos passos — a única incerteza aberta (nome do campo de horário no Apify) já estava fora do escopo desta fase antes mesmo de eu chegar nela.

**Consistência de tipos:** `DiagnosticFindings`, `DiagnosticContent`, `LeadDiagnostic`, `GmbAudit` usados com os mesmos nomes de campo em todas as tasks (`findings.site`, `findings.gmb`, `content.overallScore`, `content.summary`, `content.recommendations`) — conferido task a task ao escrever.

## Handoff

Plano salvo em `docs/superpowers/plans/2026-09-23-diagnostico-marketing-fase1.md`. Duas opções de execução:

1. **Subagent-Driven (recomendado)** — um subagente novo por task, com revisão entre elas.
2. **Execução inline** — executa as tasks nesta sessão via `executing-plans`, em lote com checkpoints.

Qual prefere?
