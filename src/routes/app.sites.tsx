import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export const Route = createFileRoute("/app/sites")({
  head: () => ({
    meta: [
      { title: "Sites gerados — LeadForge" },
      { name: "description", content: "Todos os sites demo gerados pela IA, publicados e prontos para enviar ao lead." },
      { property: "og:title", content: "Sites gerados — LeadForge" },
      { property: "og:description", content: "Landing pages personalizadas em segundos." },
    ],
  }),
  component: Sites,
});

function Sites() {
  const { state, publishSite } = useStore();
  const sites = state.leads.filter((l) => l.site);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Sites</p>
        <h1 className="mt-1 text-3xl font-bold">{sites.length} sites gerados</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((l, i) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40"
          >
            <div className="relative h-32 overflow-hidden border-b border-border bg-background p-4">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
              <p className="text-[10px] uppercase tracking-widest text-primary">{l.category}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold">{l.site!.content.headline}</p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm">{l.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${l.site!.published ? "bg-primary/12 text-primary" : "bg-surface-2 text-muted-foreground"}`}>
                  {l.site!.published ? "Publicado" : "Rascunho"}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {l.site!.url ?? "não publicado"} · template {l.site!.template}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="goldline" asChild className="flex-1">
                  <Link to="/app/leads/$id" params={{ id: l.id }}>Abrir editor</Link>
                </Button>
                {!l.site!.published && (
                  <Button size="sm" variant="gold" onClick={() => publishSite(l.id)}>
                    <Rocket className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {sites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum site gerado ainda.</p>}
      </div>
    </div>
  );
}
