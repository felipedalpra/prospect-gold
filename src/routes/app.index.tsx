import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { Counter } from "@/components/shared/Counter";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, MessageSquare, Search, Users, Handshake, Trophy } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Visão geral — LeadForge" },
      { name: "description", content: "Acompanhe leads, sites gerados, contatos, respostas e vendas da sua prospecção." },
      { property: "og:title", content: "Visão geral — LeadForge" },
      { property: "og:description", content: "Métricas e funil da sua máquina de prospecção." },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const { state } = useStore();
  const leads = state.leads;

  const count = (fn: (l: (typeof leads)[number]) => boolean) => leads.filter(fn).length;
  const sites = count((l) => !!l.site);
  const contacted = count((l) => ["Contatado", "Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage));
  const replied = count((l) => ["Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage));
  const meetings = count((l) => ["Reunião", "Proposta", "Venda"].includes(l.stage));
  const sales = count((l) => l.stage === "Venda");

  const kpis = [
    { label: "Leads encontrados", value: leads.length, icon: Users },
    { label: "Sites gerados", value: sites, icon: Globe },
    { label: "Contatados", value: contacted, icon: MessageSquare },
    { label: "Respostas", value: replied, icon: ArrowRight },
    { label: "Reuniões", value: meetings, icon: Handshake },
    { label: "Vendas", value: sales, icon: Trophy },
  ];

  const funnel = [
    { label: "Leads", value: leads.length },
    { label: "Sites", value: sites },
    { label: "Contatados", value: contacted },
    { label: "Respostas", value: replied },
    { label: "Reuniões", value: meetings },
    { label: "Vendas", value: sales },
  ];
  const max = Math.max(1, ...funnel.map((f) => f.value));

  const best = [...leads].sort((a, b) => b.score - a.score).slice(0, 5);
  const activities = leads
    .flatMap((l) => l.activities.slice(0, 2).map((a) => ({ ...a, lead: l.name, id: l.id })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Visão geral</p>
          <h1 className="mt-1 text-3xl font-bold">Olá, {state.profile.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sua máquina de prospecção em tempo real.</p>
        </div>
        <Button variant="gold" asChild>
          <Link to="/app/prospectar">Nova prospecção <Search className="h-4 w-4" /></Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
            <k.icon className="h-4 w-4 text-primary" />
            <p className="mt-3 font-display text-3xl font-bold tabular-nums">
              <Counter to={k.value} />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Funil de prospecção</h2>
          <div className="mt-6 space-y-3">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                <div className="h-9 flex-1 overflow-hidden rounded-lg bg-surface-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(6, (f.value / max) * 100)}%` }}
                    transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="flex h-full items-center justify-end rounded-lg bg-[image:var(--gradient-gold)] pr-3"
                    style={{ opacity: 1 - i * 0.1 }}
                  >
                    <span className="font-display text-sm font-bold text-primary-foreground tabular-nums">{f.value}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Melhores oportunidades</h2>
          <ul className="mt-4 space-y-2">
            {best.map((l) => (
              <li key={l.id}>
                <Link
                  to="/app/leads/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-2 px-3 py-2.5 transition-colors hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{l.name}</span>
                    <span className="text-xs text-muted-foreground">{l.category} · {l.city}</span>
                  </span>
                  <ScoreBadge score={l.score} compact />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Campanhas recentes</h2>
            <Link to="/app/campanhas" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <ul className="mt-4 space-y-2">
            {state.campaigns.slice(0, 4).map((c) => {
              const cl = leads.filter((l) => l.campaignId === c.id);
              return (
                <li key={c.id} className="rounded-lg border border-border/60 bg-surface-2 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{cl.length} leads</span>
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                    <span>{cl.filter((l) => l.site).length} sites</span>
                    <span>{cl.filter((l) => l.message).length} abordagens</span>
                    <span>{cl.filter((l) => l.stage === "Venda").length} vendas</span>
                  </div>
                </li>
              );
            })}
            {state.campaigns.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma campanha ainda.</p>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Atividades recentes</h2>
          <ul className="mt-4 space-y-3">
            {activities.map((a, i) => (
              <li key={`${a.id}-${i}`} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-foreground/85">{a.text}</span>
                  <span className="text-xs text-muted-foreground">{a.lead}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
