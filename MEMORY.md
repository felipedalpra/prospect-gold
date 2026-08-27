# Memória do projeto

Conhecimento que **não se deduz lendo o código**: armadilhas, decisões e
acoplamentos com serviços externos. Se o diff já conta a história, não escreva
aqui — escreva no `CHANGELOG.md`.

Formato: um item por fato, com data e quem descobriu.

---

## Infraestrutura

### O banco não tem migrações versionadas no repositório
As tabelas foram criadas pelo Lovable e as mudanças posteriores foram aplicadas
**direto no Supabase**, via MCP ou dashboard. Não existe pasta `migrations/`.

**Consequência:** o schema em produção é a única fonte de verdade. Antes de
mexer em qualquer tabela, **leia o schema real** (`list_tables`) em vez de
inferir pelos tipos em `src/lib/types.ts`. E toda DDL aplicada precisa entrar no
`CHANGELOG.md`, senão a alteração fica invisível.

Projeto Supabase: `jpatbcwjzcrtzvubgtmm`
— `claude` (2026-08-26)

### Não existe deploy automático na Vercel
O projeto `prospect-gold` **não está conectado ao Git**. Todo deploy é manual:

```bash
npx vercel login    # se o CLI não estiver autenticado
npx vercel --prod --yes
```

Push na `main` **não publica nada**. Os deploys antigos carregam o branch
`agent/visual-landing-pages` no metadado, mas isso é só o branch que estava
local na hora — não é Production Branch, e seguir essa pista custa tempo.

Para resolver de vez: `npx vercel git connect`. Ainda não foi feito.
— `claude` (2026-08-26)

### O gerenciador é bun, mas há um `package-lock.json` solto
`bun.lock` é o lockfile versionado. O `package-lock.json` na raiz é resíduo de
`npx` e está **fora do controle de versão de propósito** — commitá-lo faria a
resolução de dependências divergir silenciosamente. Não adicione ao git.
— `claude` (2026-08-26)

---

## Domínio

### Modelo BYOK é decisão de produto, não limitação técnica
O usuário conecta as próprias chaves (Apify, LLM, Netlify, WhatsApp). Não
operamos número nem conta de ninguém: conta, custo e risco de banimento ficam
com quem prospecta. Isso é o que permite oferecer envio automatizado sem virar
responsável por bloqueio de WhatsApp alheio.

**Corolário:** todo caminho automatizado precisa ter fallback manual. Sem
instância conectada, o envio abre `wa.me`.
— `claude` (2026-08-26)

### A fila depende de aba aberta; os gatilhos não
`jobs` só é drenada pelo `drainQueue` de uma aba aberta. Por isso tudo que não
pode esperar o usuário voltar vive em trigger do Postgres: engajamento, mudança
de estágio no clique do CTA, encerramento de cadência e alertas.

Ao adicionar comportamento automático, decida primeiro **onde ele mora**.
— `claude` (2026-08-26)

### Cada provedor de WhatsApp tem um dialeto
Evolution (v1 e v2 divergem no payload de envio), Z-API (credenciais na própria
URL, campo `phone`/`message`) e Uazapi. O adaptador em `src/lib/rpc/whatsapp.ts`
infere pela URL e, no envio Evolution, tenta o formato v2 e cai para o v1 se
levar 400. Webhooks de entrada têm três envelopes diferentes, tratados em
`readInbound` no `src/server.ts`.

Nenhum destes contratos é estável. Ao aparecer um provedor novo, adicione um
`flavor` em vez de tentar generalizar mais.
— `claude` (2026-08-26)

### O webhook se identifica por segredo na própria URL
Uma resposta chega sem sessão. Em vez de service-role key, a URL carrega um
token (`/api/wa/<token>`) que a função `record_inbound_message` resolve para o
`user_id`. É o mesmo truque que o beacon de visitas (`/t/<slug>`) já usava.

**Nunca rotacione o `webhookToken` sem avisar** — ele já está colado no painel
do provedor do usuário.
— `claude` (2026-08-26)

---

## Armadilhas já pagas

### `eslint --fix src` reformata o repositório inteiro
Rodar o autofix em `src` inteiro varre arquivos que você nunca tocou e enche o
diff de mudança de Prettier. Rode só nos arquivos da sua mudança, ou separe a
formatação em um commit próprio.
— `claude` (2026-08-26)

### `routeTree.gen.ts` só é regenerado pelo build
Criar uma rota nova e rodar `tsc` direto dá erro de tipo (`not assignable to
keyof FileRoutesByPath`). Rode `bun run build` (ou o dev server) primeiro.
— `claude` (2026-08-26)

### Constraint de `integrations.provider` rejeitava `google`
O app oferecia a chave do PageSpeed mas o `CHECK` não a permitia, e o erro
sumia silenciosamente. Corrigido em 2026-08-26. **Ao adicionar um provider
novo, altere a constraint junto** — a lista em `types.ts` não é a que vale.
— `claude` (2026-08-26)
