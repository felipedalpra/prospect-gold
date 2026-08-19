import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { downloadSiteHtml } from "@/lib/download";
import { hasSite } from "@/lib/buckets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, ExternalLink, Eye, Rocket } from "lucide-react";

export const Route = createFileRoute("/app/sites")({
  head: () => ({
    meta: [
      { title: "Sites gerados — LeadForge" },
      {
        name: "description",
        content: "Todos os sites gerados pela IA, publicados e prontos para enviar ao lead.",
      },
      { property: "og:title", content: "Sites gerados — LeadForge" },
      { property: "og:description", content: "Landing pages personalizadas em segundos." },
    ],
  }),
  component: Sites,
});

function Sites() {
  const { state, publishSite, keyFor } = useStore();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"draft" | "live">("draft");

  // Sites is the library of everything the AI has built — a site does not stop
  // existing once the lead is approached. The tabs split it by what still needs
  // an action (publish) from what is already out in the world.
  const all = state.leads.filter(hasSite);
  const drafts = all.filter((l) => !l.site!.published);
  const live = all.filter((l) => l.site!.published);
  const sites = tab === "draft" ? drafts : live;

  async function publish(id: string) {
    if (!keyFor("netlify")) {
      toast.error("Conecte seu token do Netlify em Configurações.");
      return;
    }
    setPublishingId(id);
    try {
      const url = await publishSite(id);
      toast.success(`Publicado em ${url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Sites</p>
        <h1 className="mt-1 text-3xl font-bold">{all.length} sites gerados</h1>
      </header>

      <div className="flex gap-1.5">
        {(
          [
            ["draft", `Rascunhos (${drafts.length})`],
            ["live", `Publicados (${live.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              tab === key
                ? "border-primary/50 bg-primary/12 text-primary"
                : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((l, i) => {
          const site = l.site!;
          return (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-primary/40"
            >
              <div className="h-40 overflow-hidden border-b border-border bg-white">
                <iframe
                  title={`Prévia de ${l.name}`}
                  srcDoc={site.html}
                  sandbox=""
                  scrolling="no"
                  // Render at full width, then shrink — an iframe at card size
                  // would trigger the page's mobile layout instead.
                  className="pointer-events-none h-[800px] w-[1280px] origin-top-left border-0"
                  style={{ transform: "scale(0.3)" }}
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{l.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${site.published ? "bg-primary/12 text-primary" : "bg-surface-2 text-muted-foreground"}`}
                  >
                    {site.published ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {site.url ?? "não publicado"} · {site.template}
                </p>
                {l.visits && l.visits.views > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2 py-0.5 text-[11px] text-success">
                    <Eye className="h-3 w-3" />
                    {l.visits.views} visita(s)
                    {l.visits.whatsappClicks > 0 &&
                      ` · ${l.visits.whatsappClicks} clique(s) no WhatsApp`}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="goldline" asChild className="flex-1">
                    <Link to="/app/leads/$id" params={{ id: l.id }}>
                      Abrir editor
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Baixar o HTML para editar no VS Code"
                    onClick={() => {
                      downloadSiteHtml(l);
                      toast.success(`${site.slug}.html baixado`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {site.published && site.url ? (
                    <Button size="sm" variant="ghost" asChild title="Abrir site">
                      <a href={site.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => void publish(l.id)}
                      disabled={publishingId === l.id}
                      title="Publicar"
                    >
                      <Rocket
                        className={
                          publishingId === l.id ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"
                        }
                      />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {sites.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {all.length === 0 ? (
              <>
                Nenhum site gerado ainda. Vá em{" "}
                <Link to="/app/prospectar" className="text-primary hover:underline">
                  Prospectar
                </Link>{" "}
                para começar.
              </>
            ) : tab === "draft" ? (
              "Nenhum rascunho — todos os sites já estão publicados."
            ) : (
              "Nenhum site publicado ainda. Publique um rascunho para gerar o link."
            )}
          </p>
        )}
      </div>
    </div>
  );
}
