# Playbook "Diagnóstico de Marketing" — spec

Data: 2026-09-23
Status: aguardando revisão do usuário

## Contexto

O produto hoje tem um único playbook implícito: prospectar no Google Maps →
qualificar → gerar um **site demo** com IA → publicar na Netlify → abordar por
WhatsApp com cadência automática movida por triggers no Postgres (visita,
clique no CTA, resposta).

A visão é generalizar a plataforma para outros nichos de quem prospecta —
agências de marketing, assessorias comerciais, assessorias financeiras — cada
um com seu próprio artefato-isca gerado por IA no lugar do site demo. Esta
spec cobre **apenas o primeiro nicho novo: agência de marketing digital**,
como piloto da generalização. Os demais nichos ficam para specs futuras,
depois de validar o padrão com este.

O artefato-isca aqui é um **diagnóstico automático de presença digital**: nota
de site (PageSpeed), atividade de Instagram e completude do perfil no Google
Meu Negócio, com achados e recomendações escritos pela IA — o mesmo
argumento comercial de "os números são do Google, não nossos" que
`rpc/audit.ts` já usa para o pitch de site.

## Decisões já tomadas (conversa de brainstorming)

- **Formato do artefato**: página publicada (mantém o tracking de
  engajamento) **+** exportação em PDF a partir da mesma página.
- **Fontes de dados do v1**: site (PageSpeed) + Google Maps (reviews/rating/
  categoria) + Google Meu Negócio (campos estruturados do próprio scraping) +
  Instagram (atividade, via novo actor Apify).
- **Onde mora a escolha de playbook**: por conta (`Profile`), não por
  campanha. Evolui para por-campanha quando houver um 3º nicho.

## Abordagem de arquitetura

Três caminhos foram considerados:

1. **Motor "Playbook" genérico agora** — interface plugável
   (`generateArtifact`, `computeScore`, `getAngles`) com site demo e
   diagnóstico como implementações. Rejeitado: desenhar uma abstração boa com
   só 2 casos concretos é chute — risco de travar a forma errada antes de ter
   um terceiro data point.
2. **Caminho paralelo, generaliza depois (escolhido)** — o diagnóstico entra
   como um artefato novo e específico do nicho: campo próprio no `Lead`,
   função de geração própria, scoring próprio. Reaproveita o que já é
   genérico no motor (`auditSite`, publicação Netlify, tracking de visita/
   clique, cadência WhatsApp, `generateMessage`) e duplica só o que é
   específico. A abstração "Playbook" é extraída depois, quando um 3º nicho
   mostrar o padrão real em vez de um palpite.
3. **Union type único em `Lead.artifact`** — meio-termo que evita duas
   funções de publish quase iguais, mas exige refatorar o campo `site` que
   está em produção. Rejeitado por enquanto: o ganho (uma função de publish a
   menos) é pequeno perto do risco de mexer no fluxo que já funciona.

**Princípio geral do design**: nada que hoje sustenta o playbook de sites
(`score.ts`, `site-renderer.ts`, cadência, triggers do Postgres) é alterado.
Tudo que é novo entra como código adicional, condicionado a
`Profile.playbook === "diagnostico_marketing"`.

## Design

### 1. Modelo de dados (`src/lib/types.ts`)

```ts
// Profile ganha um campo novo. Hoje o playbook é implicitamente "sites".
export type Playbook = "sites" | "diagnostico_marketing";
// Profile.playbook: Playbook — default "sites" para contas existentes.

export type InstagramAudit = {
  handle: string;
  followers?: number;
  postsLast30d?: number;
  lastPostAt?: string;
  checkedAt: string;
};

export type GmbAudit = {
  hasHours: boolean;
  hasCategory: boolean;
  photoCount: number;
  /** 0-100, derivado de quantos campos do perfil estão preenchidos. */
  completeness: number;
};

export type DiagnosticFindings = {
  site?: SiteAudit;         // reaproveita o tipo que já existe
  instagram?: InstagramAudit;
  gmb?: GmbAudit;
};

export type LeadDiagnostic = {
  id?: string;
  html: string;             // documento publicado, mesmo padrão de LeadSite
  slug: string;
  published: boolean;
  url?: string;
  netlifySiteId?: string;
  findings: DiagnosticFindings;
  overallScore: number;     // 0-100, nota do diagnóstico (não confundir com Lead.score)
  summary: string;          // narrativa curta que a IA escreve
  recommendations: string[];
  createdAt: string;
};

// Lead ganha um campo novo, irmão de `site`:
// diagnostic?: LeadDiagnostic
```

`Campaign.niche` **não muda de significado** — continua sendo a categoria de
busca no Maps ("salão de beleza", "restaurante"). O playbook é um conceito
diferente e vive em `Profile`, não em `Campaign`, para não colidir com esse
nome já existente.

### 2. Coleta de dados

- **Site**: reaproveita `auditSite` (`rpc/audit.ts`) sem alteração — já roda
  PageSpeed Insights para leads com `website`.
- **Google Meu Negócio**: os campos de horário/categoria/fotos já retornam no
  dataset do actor `compass~crawler-google-places` (`rpc/apify.ts`), mas o
  mapeamento atual descarta o que não usa para o playbook de sites. Passam a
  ser lidos e guardados em `GmbAudit`. **Verificar ao implementar** o nome
  exato dos campos de horário no dataset — não confirmado nesta spec.
- **Instagram**: novo módulo `rpc/instagram.ts`, um actor Apify separado que
  lê o perfil público a partir do handle já capturado hoje (`pickInstagram`
  em `apify.ts` já resolve `@handle`, só não é usado além disso). Roda com a
  chave Apify do próprio usuário (regra BYOK do domínio) — custo extra por
  lead, mostrado no `estimate-cost` antes de rodar.

### 3. Pontuação (`src/lib/score-marketing.ts`, novo arquivo)

Nova função `computeMarketingScore()`, **não** uma ramificação dentro de
`score.ts` — os sinais são opostos aos do playbook de sites:

- PageSpeed < 50 → pontua forte (site ruim é a dor, não a ausência dele).
- Instagram sem post há 30+ dias, ou sem Instagram → pontua.
- Perfil GMB incompleto (`completeness` baixo) → pontua.
- Volume de reviews alto **e** presença digital fraca → maior pontuação
  ainda (contraste = "você tem reputação e ninguém sabe disso online").

`Filters` (usado no `apify.ts` para a busca) ganha os campos equivalentes
para este playbook quando `Profile.playbook === "diagnostico_marketing"` —
mesma tela de prospecção, filtros diferentes.

### 4. Geração do artefato

- `generateDiagnostic()` em `rpc/llm.ts`, paralelo a `generateSite()`: recebe
  `DiagnosticFindings` brutos e devolve `summary`, `recommendations[]` e a
  estrutura de seções, sem template fixo — mesmo princípio de
  `generateSite`, onde a IA compõe a partir dos dados do lead em vez de
  preencher um texto genérico.
- `diagnostic-renderer.ts` (novo, paralelo a `site-renderer.ts`): renderiza o
  HTML final, reaproveitando o sistema visual existente (tipografia/textura/
  seleção por hash do lead) para manter a mesma sensação de artefato feito
  sob medida.

### 5. Publicação e PDF

- Publica na Netlify exatamente como o site demo hoje
  (`publishSite`/`rpc/netlify.ts`, reaproveitado sem mudança de contrato) —
  isso significa que `/t/<slug>` e os triggers de visita/clique/engajamento
  no Postgres **funcionam automaticamente**, sem qualquer mudança na
  cadência.
- **PDF**: CSS de impressão (`@media print`) na própria página publicada, sem
  geração de PDF no servidor. Um botão "Baixar PDF" aciona `window.print()`.
  Zero biblioteca nova, zero custo por lead. Se isso não atender
  visualmente, geração server-side fica como follow-up, não como parte
  deste v1.

### 6. Abordagem / copy

`generateMessage()` (`rpc/llm.ts`) já existe e já aceita ângulos de pitch
(mesmo padrão de `Enrichment.angles`). Estende o prompt para incluir os
achados do diagnóstico como ângulo — "seu Instagram parado há 40 dias", "seu
site carrega em 8s no celular". A cadência (`Sequence`, `Enrollment`,
`Schedule`) não muda.

### 7. Onboarding e Configurações

- Onboarding (`routes/onboarding.tsx`) ganha uma pergunta que define
  `Profile.playbook` a partir do que a conta vende — hoje já pergunta
  `sells`/`targets`, o playbook deriva dessa resposta ou é perguntado
  diretamente.
- `Configurações` permite trocar o playbook depois, com aviso explícito: a
  troca não regera diagnósticos/sites de leads já existentes, só afeta
  prospecções novas.

### 8. Custos

- `COST_USD.diagnostic` — nova entrada, equivalente ao `COST_USD.site` de
  hoje (chamada LLM de geração).
- Custo de Instagram (actor Apify separado) é do usuário, mostrado
  explicitamente antes de rodar — mesma regra de "quem prospecta assume o
  custo" que já vale para Maps e mensagens.

## Erros e casos de borda

- Lead sem `website`: `findings.site` fica ausente, diagnóstico é gerado só
  com Maps + GMB + Instagram (mesmo padrão de "campo opcional" que
  `siteAudit` já segue).
- Lead sem Instagram capturado: `findings.instagram` ausente, sem erro —
  vira, ele mesmo, um achado ("sem presença no Instagram").
- Falha da API do Instagram (rate limit, perfil privado): não bloqueia a
  geração do diagnóstico — mesma filosofia de `auditSite`, que já trata
  429 do PageSpeed sem quebrar o fluxo.
- Troca de playbook no meio do uso: não deleta nem regera artefatos
  existentes; leads antigos mantêm o que já foi gerado.

## Testes

- `computeMarketingScore()`: unitário, cobrindo os casos de sinal descritos
  acima (site ruim, Instagram parado, GMB incompleto, contraste reviews x
  presença digital).
- `generateDiagnostic()` / `diagnostic-renderer.ts`: mesmo padrão de teste
  que `site-renderer.ts` já usa, se houver.
- Fluxo de publicação: verificar manualmente que `/t/<slug>` do diagnóstico
  dispara os mesmos triggers de engajamento que o site demo já dispara —
  não deve exigir mudança nos triggers, só confirmar que o contrato de
  publish é idêntico.

## Fora de escopo desta spec

- Motor "Playbook" genérico/plugável.
- Seleção de playbook por campanha (fica por conta, ver decisões acima).
- Qualquer nicho além de agência de marketing (comercial, financeiro, etc. —
  specs futuras, depois de validar este piloto).
- Geração de PDF no servidor (fallback só se o CSS de impressão não bastar).
