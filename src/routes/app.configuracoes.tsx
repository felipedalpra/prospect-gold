import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LeadForge" },
      { name: "description", content: "Perfil, plano e créditos da sua conta LeadForge." },
      { property: "og:title", content: "Configurações — LeadForge" },
      { property: "og:description", content: "Ajuste seu perfil e acompanhe seus créditos." },
    ],
  }),
  component: Config,
});

const COSTS = [
  ["Busca de leads", "1 crédito por lead"],
  ["Enriquecimento", "1 crédito por lead"],
  ["Site gerado", "5 créditos"],
  ["Mensagem gerada", "1 crédito"],
];

function Config() {
  const { state, setProfile, reset } = useStore();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Configurações</p>
        <h1 className="mt-1 text-3xl font-bold">Sua conta</h1>
      </header>

      <section className="grid gap-4 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Nome</Label><Input value={state.profile.name} onChange={(e) => setProfile({ name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label><Input value={state.profile.email} onChange={(e) => setProfile({ email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>O que você vende</Label><Input value={state.profile.sells} onChange={(e) => setProfile({ sells: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Região de atuação</Label><Input value={state.profile.location} onChange={(e) => setProfile({ location: e.target.value })} /></div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Plano {state.profile.plan}</h2>
            <p className="text-xs text-muted-foreground">{state.credits} créditos restantes</p>
          </div>
          <Button variant="gold" onClick={() => toast.info("Pagamentos chegam em breve")}>Fazer upgrade</Button>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          {COSTS.map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">{k}</span><span className="text-primary">{v}</span>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="subtle" onClick={() => { reset(); toast.success("Dados de demonstração restaurados"); }}>
        Restaurar dados de demonstração
      </Button>
    </div>
  );
}
