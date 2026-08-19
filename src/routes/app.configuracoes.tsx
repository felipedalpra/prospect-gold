import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore, COST_USD } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiKeyCard } from "@/components/app/ApiKeyCard";
import type { Provider } from "@/lib/types";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LeadForge" },
      { name: "description", content: "Perfil, integrações e créditos da sua conta LeadForge." },
      { property: "og:title", content: "Configurações — LeadForge" },
      { property: "og:description", content: "Conecte suas chaves de API e ajuste seu perfil." },
    ],
  }),
  component: Config,
});

const PROVIDERS: Provider[] = ["apify", "anthropic", "openai", "netlify", "google"];

const COSTS = [
  ["Busca de leads", "1 crédito por lead", COST_USD.lead],
  ["Site gerado", "5 créditos", COST_USD.site],
  ["Mensagem gerada", "1 crédito", COST_USD.message],
] as const;

function Config() {
  const { state, setProfile, setPublishDomain, llmProvider, keyFor } = useStore();
  const netlifyMeta = state.integrations.find((i) => i.provider === "netlify")?.meta;
  const [domain, setDomain] = useState((netlifyMeta?.["domain"] as string | undefined) ?? "");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Configurações</p>
        <h1 className="mt-1 text-3xl font-bold">Sua conta</h1>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Integrações</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Você usa suas próprias chaves — o custo de cada busca e de cada geração vai direto para a
          sua conta em cada serviço. As chaves ficam salvas na sua conta e só saem do navegador para
          o servidor do LeadForge no momento de executar a ação.
        </p>

        {!keyFor("apify") && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            Sem a chave da Apify a prospecção não roda — é a integração que busca as empresas.
          </p>
        )}
        {!llmProvider && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Conecte Anthropic ou OpenAI para gerar sites e abordagens.
          </p>
        )}

        <div className="grid gap-3">
          {PROVIDERS.map((p) => (
            <ApiKeyCard key={p} provider={p} />
          ))}
        </div>

        {keyFor("netlify") && (
          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <Label>Domínio próprio para os sites publicados</Label>
            <p className="text-xs text-muted-foreground">
              Cada demo sai em <code>slug.seudominio.com</code> em vez de um endereço netlify.app —
              o que parece um site de verdade, não um teste. Aponte um CNAME curinga (
              <code>*.seudominio.com</code>) para o Netlify antes de usar.
            </p>
            <div className="flex gap-2">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="demos.minhaagencia.com.br"
              />
              <Button
                variant="goldline"
                onClick={() => {
                  void setPublishDomain(domain)
                    .then(() => toast.success("Domínio salvo"))
                    .catch(() => toast.error("Não foi possível salvar o domínio."));
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input
            value={state.profile.name}
            onChange={(e) => void setProfile({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={state.profile.email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>O que você vende</Label>
          <Input
            value={state.profile.sells}
            onChange={(e) => void setProfile({ sells: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Região de atuação</Label>
          <Input
            value={state.profile.location}
            onChange={(e) => void setProfile({ location: e.target.value })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Plano {state.profile.plan}</h2>
            <p className="text-xs text-muted-foreground">{state.credits} créditos restantes</p>
          </div>
          <Button variant="gold" onClick={() => toast.info("Pagamentos chegam em breve")}>
            Fazer upgrade
          </Button>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          {COSTS.map(([k, v, usd]) => (
            <li key={k} className="flex justify-between gap-4 border-b border-border/50 pb-2">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right">
                <span className="text-primary">{v}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  ≈ US$ {usd.toFixed(3)} nas suas chaves
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Créditos são o contador de uso interno do LeadForge. O custo real de cada chamada é
          cobrado pela Apify, pela Anthropic/OpenAI e pelo Netlify nas suas próprias contas.
        </p>
      </section>
    </div>
  );
}
