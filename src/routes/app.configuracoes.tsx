import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
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

const PROVIDERS: Provider[] = ["apify", "anthropic", "openai", "netlify"];

const COSTS = [
  ["Busca de leads", "1 crédito por lead"],
  ["Site gerado", "5 créditos"],
  ["Mensagem gerada", "1 crédito"],
];

function Config() {
  const { state, setProfile, llmProvider, keyFor } = useStore();

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
          {COSTS.map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-primary">{v}</span>
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
