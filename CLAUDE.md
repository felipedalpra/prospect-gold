# LeadForge / prospect-gold — instruções para agentes

SaaS de prospecção: encontra empresas locais no Google Maps, qualifica, gera um
site demo, publica, escreve a abordagem e conduz a cadência de follow-up até a
resposta.

---

## ⛔ REGRA OBRIGATÓRIA — registre o que você fez

**Toda alteração feita por qualquer agente ou IA neste repositório TEM QUE ser
registrada. Sem exceção, por menor que seja a mudança.**

Antes de encerrar o turno em que você alterou qualquer arquivo:

1. **`CHANGELOG.md`** — adicione a entrada na seção `[Não publicado]`, no topo.
   Uma linha por mudança, no formato:

   ```
   - **[Área]** O que mudou e por quê. — `agente` (AAAA-MM-DD)
   ```

   `agente` é quem executou: `claude`, `codex`, `lovable`, `humano`, etc.

2. **`MEMORY.md`** — só quando você descobrir ou decidir algo **não óbvio pelo
   código**: uma armadilha, uma decisão de arquitetura, um acoplamento com
   serviço externo. Não repita o que o diff já conta.

3. Ao publicar uma versão, mova o bloco `[Não publicado]` para uma seção
   datada.

**Isto vale igualmente para mudanças fora do repositório** — migração aplicada
no Supabase, configuração alterada na Vercel, chave adicionada. Essas são
justamente as que se perdem, porque não aparecem em nenhum diff.

Se você alterou algo e não registrou, o trabalho **não está terminado**.

---

## Antes de mexer

- Leia `MEMORY.md`. Ele guarda as armadilhas que já custaram tempo a alguém.
- Leia `AGENTS.md`. O projeto é conectado ao Lovable: **nunca** reescreva
  histórico já publicado (`--force`, rebase, amend ou squash de commits já
  enviados) — isso corrompe o histórico do lado do Lovable.

## Comandos

```bash
bun install          # bun é o gerenciador; bun.lock é o lockfile versionado
bun run dev
bun run build
bun run lint
npx tsc --noEmit     # rode SEMPRE antes de commitar
```

`eslint --fix src` aplica Prettier em tudo que tocar. Se ele reformatar
arquivos alheios à sua mudança, **separe em um commit próprio** para não poluir
o diff da feature.

## Arquitetura em uma página

- **TanStack Start** (SSR) + React 19 + Tailwind v4 + shadcn/ui.
- **Rotas por arquivo** em `src/routes/`. `routeTree.gen.ts` é gerado — nunca
  edite à mão; rode o build para regenerá-lo.
- **`src/lib/store.tsx`** é o cérebro: todo estado e toda ação passam por ele.
- **`src/lib/rpc/*`** são `createServerFn` — o único lugar onde chaves de API
  saem do navegador.
- **`src/server.ts`** tem dois endpoints crus (`/t/*` de tracking e `/api/wa/*`
  de webhook) porque esta versão do framework não tem API de server routes.
- **Supabase** para tudo que persiste, com RLS por `user_id`.

## Duas regras de domínio que não se negociam

1. **O usuário traz as próprias chaves.** Apify, Anthropic/OpenAI, Netlify e a
   instância de WhatsApp são dele. Nunca operamos um número, nem uma conta, em
   nome de ninguém — a conta, o custo e o risco de bloqueio ficam com quem
   prospecta.
2. **Automação é upgrade, nunca requisito.** Todo caminho automatizado precisa
   ter um equivalente manual funcionando. Sem instância conectada, o envio
   continua abrindo o `wa.me`.

## O que roda sem aba aberta

A fila (`jobs`) só é drenada por uma aba aberta. Mas o que **não pode** depender
disso vive em triggers do Postgres: visita à página demo, clique no CTA e
resposta recebida recalculam engajamento, movem o estágio, encerram a cadência
e levantam alerta — às 3h da manhã, sem ninguém olhando.

Ao mexer em cadência, engajamento ou alertas, pergunte-se sempre: **isto
precisa funcionar com o app fechado?** Se sim, é trigger, não código de cliente.
