# Changelog

Registro de tudo que muda neste projeto — inclusive o que **não** aparece no
diff: migração aplicada no Supabase, configuração da Vercel, chave adicionada.

**Toda alteração feita por qualquer agente ou IA precisa ser registrada aqui.**
Regra completa em `CLAUDE.md`.

Formato:

```
- **[Área]** O que mudou e por quê. — `agente` (AAAA-MM-DD)
```

---

## [Não publicado]

- **[Sites]** A geração agora oferece três propostas visuais, com presets de direção (luxo editorial, orgânico calmo, tech impacto e energia urbana), reordenação/ocultação de seções, preview desktop/tablet/celular e checklist de qualidade antes da publicação. — `codex` (2026-09-05)
- **[Sites]** Adicionada direção visual editável no editor do lead: cores principal/secundária, layout, tipografia, formato, textura, fundo e animação agora atualizam a prévia e o HTML salvo automaticamente; o renderer também ganhou texturas CSS e movimento rico configurável, e respeita as cores escolhidas exatamente. — `codex` (2026-09-05)
- **[Supabase]** Função `spend_credits` não bloqueia mais por saldo insuficiente (removido o `and credits >= amount`); saldo pode ficar negativo mas a ação sempre é permitida. Pedido do usuário para prospectar sem limite de créditos "por agora". Conta `felipeodriosolladalpra@gmail.com` recarregada para 1.000.000 créditos. Reverter recolocando o `and credits >= amount` no `update` quando o limite voltar a valer. — `claude` (2026-09-03)

---

## 2026-08-26

Sessão grande: o app sabia encontrar, construir e escrever — e parava no botão
"copiar". Tudo depois disso (enviar, insistir, perceber a resposta) era trabalho
que dependia da memória do vendedor. Cinco frentes fechadas de uma vez.

### Envio e cadência

- **[WhatsApp]** Adaptador para a instância do próprio usuário
  (`src/lib/rpc/whatsapp.ts`), falando Evolution, Z-API e Uazapi. Dialeto
  inferido pela URL, com override manual; no Evolution tenta o payload v2 e cai
  para o v1 em caso de 400. Decisão de produto: não operamos número de ninguém —
  conta, custo e risco de bloqueio ficam com quem prospecta. — `claude`
- **[WhatsApp]** Card de configuração (`WhatsAppCard.tsx`) com teste de conexão,
  intervalo entre envios (45s padrão) e janela de horário. — `claude`
- **[WhatsApp]** Webhook de entrada em `/api/wa/<token>` (`src/server.ts`). Lê os
  três formatos de payload, ignora eco e grupos, e se identifica por segredo na
  própria URL — sem service-role key. — `claude`
- **[Cadência]** Sequências de N toques com tom e atraso por passo, matrículas
  por lead e página `/app/automacoes`. Uma cadência padrão de 3 toques (D+0,
  D+3, D+7) nasce sozinha no primeiro uso. — `claude`
- **[Cadência]** Fora da janela de envio, o toque é **adiado**, não falhado. — `claude`
- **[Conversas]** Nova rota `/app/conversas`: thread por lead, quem respondeu no
  topo. — `claude`

### Sinal em tempo real

- **[DB]** Triggers no Postgres para o que não pode depender de aba aberta:
  visita à página recalcula engajamento; clique no CTA move `Contatado →
  Respondeu`, encerra a cadência e levanta alerta; resposta recebida faz o
  mesmo. — `claude`
- **[UI]** Sino de alertas com Supabase Realtime (`AlertBell.tsx`) e painel
  "Quentes agora" no dashboard, ordenado por score × engajamento × recência. — `claude`

### Prospecção recorrente, métricas e enriquecimento

- **[Agendamentos]** Prospecção diária/semanal com score mínimo e toggles de
  gerar site / publicar / escrever abordagem / entrar em cadência. — `claude`
- **[Métricas]** `src/lib/analytics.ts`: taxa de resposta por nicho ("onde vale
  prospectar") e por tom ("o que converte melhor"), ambos no dashboard. — `claude`
- **[Enriquecimento]** `src/lib/rpc/enrich.ts`: lê o site do lead (plataforma,
  ano do rodapé, e-mail público) e, achando CNPJ no rodapé, consulta a Receita
  via BrasilAPI. Vira ângulos de abordagem. Sem chave nova, sem custo por lead. — `claude`
- **[Leads]** Flag "não contatar", que exclui o lead de toda automação. — `claude`

### Correções

- **[DB]** A constraint de `integrations.provider` rejeitava `google`, então
  salvar a chave do PageSpeed falhava em silêncio. Corrigida (e `whatsapp`
  adicionado). — `claude`
- **[Segurança]** Revogado `EXECUTE` via API das funções de trigger
  (`on_site_visit`, `on_inbound_message`, `recompute_engagement` e o
  pré-existente `handle_new_user`), que não têm motivo para ser alcançáveis por
  REST. `stage_rank` passou a ter `search_path` fixo. — `claude`
- **[Formatação]** Prettier aplicado a 8 arquivos que haviam divergido da
  config, em commit separado (`aeae8bf`) para não poluir o diff da feature. — `claude`

### Migrações aplicadas no Supabase (`jpatbcwjzcrtzvubgtmm`)

Não há pasta de migrações no repositório — estas foram aplicadas direto no
projeto e existem **apenas** neste registro:

- `automation_core_schema` — tabelas `messages`, `sequences`, `enrollments`,
  `schedules`, `alerts`; colunas `due_at`/`payload` em `jobs`; colunas `email`,
  `enriched`, `engagement`, `hot_at`, `never_contact` em `leads`; `variant_key`
  em `sites`; RLS por `user_id` em tudo que é novo.
- `engagement_and_reply_triggers` — `stage_rank`, `recompute_engagement`,
  `on_site_visit`, `on_inbound_message`, `advance_enrollment`.
- `inbound_whatsapp_rpc` — `record_inbound_message`, que resolve o token do
  webhook para o `user_id`.
- `realtime_alerts` — `alerts` publicada em `supabase_realtime`.
- `lock_down_new_functions` — revogações de `EXECUTE` e `search_path` fixo.

— `claude` (2026-08-26)

### Infraestrutura

- **[Deploy]** Publicado em produção (`dpl_B5yXur58wzpECfgxkkNqDm5SGFYD`) em
  https://prospect-gold.vercel.app, via `vercel --prod`. Descoberto no caminho
  que **o projeto não tem deploy automático** — push na `main` não publica nada.
  Registrado em `MEMORY.md`. — `claude`
- **[Git]** Branch `agent/visual-landing-pages` avançado para o mesmo commit da
  `main` (fast-forward, nada perdido). — `claude`
- **[Docs]** Criados `CLAUDE.md`, `MEMORY.md` e este arquivo, com a regra de
  registro obrigatório para agentes. — `claude`

---

## Antes de 2026-08-26

Não registrado neste arquivo. O histórico está no git (`git log`) e no editor do
Lovable.
