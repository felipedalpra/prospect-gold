import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { useStore } from "@/lib/store";
import { OUTREACH_STAGES, isOutreach } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import { CalendarClock, Copy, ExternalLink, Eye, MessageSquare, Search } from "lucide-react";

export const Route = createFileRoute("/app/abordagens")({
  head: () => ({
    meta: [
      { title: "Abordagens — LeadForge" },
      {
        name: "description",
        content: "Leads já contatados: mensagem enviada, link do site e resposta em andamento.",
      },
      { property: "og:title", content: "Abordagens — LeadForge" },
      { property: "og:description", content: "Acompanhe quem já recebeu sua mensagem." },
    ],
  }),
  component: Outreach,
});

function Outreach() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("Todos");

  // Everything from "Contatado" onwards. These leads are done being prospected
  // and done being built — what matters here is the conversation.
  const pool = useMemo(() => state.leads.filter(isOutreach), [state.leads]);
  const leads = useMemo(
    () =>
      pool.filter(
        (l) =>
          (stage === "Todos" || l.stage === stage) &&
          (l.name.toLowerCase().includes(q.toLowerCase()) ||
            l.city.toLowerCase().includes(q.toLowerCase())),
      ),
    [pool, q, stage],
  );

  // What deserves attention first: who opened the site, then who is overdue.
  const sorted = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const engaged = (l: typeof a) =>
          (l.visits?.whatsappClicks ?? 0) * 10 + (l.visits?.views ?? 0);
        const due = (l: typeof a) => (l.followUpAt && new Date(l.followUpAt) <= new Date() ? 1 : 0);
        return due(b) - due(a) || engaged(b) - engaged(a) || b.score - a.score;
      }),
    [leads],
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Abordagens</p>
        <h1 className="mt-1 text-3xl font-bold">{pool.length} leads já contatados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem já recebeu mensagem sai de Leads e de Sites e passa a viver aqui.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa ou cidade"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["Todos", ...OUTREACH_STAGES].map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                stage === s
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {sorted.map((l, i) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to="/app/leads/$id"
                    params={{ id: l.id }}
                    className="truncate font-medium hover:text-primary"
                  >
                    {l.name}
                  </Link>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {l.stage}
                  </span>
                  <ScoreBadge score={l.score} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.category} · {l.city}
                  {l.message ? ` · abordagem por ${l.message.channel}` : " · sem mensagem escrita"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {l.visits && l.visits.views > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2 py-0.5 text-success">
                      <Eye className="h-3 w-3" /> abriu {l.visits.views}x
                      {l.visits.whatsappClicks > 0 && ` · clicou no WhatsApp`}
                    </span>
                  )}
                  {l.followUpAt && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
                        new Date(l.followUpAt) <= new Date()
                          ? "bg-primary/15 text-primary"
                          : "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {new Date(l.followUpAt) <= new Date()
                        ? "follow-up vencido"
                        : `follow-up em ${new Date(l.followUpAt).toLocaleDateString("pt-BR")}`}
                    </span>
                  )}
                </div>
                {l.message && (
                  <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-foreground/75">
                    {l.message.text}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {l.message && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Copiar a mensagem"
                    onClick={() => {
                      void navigator.clipboard.writeText(l.message!.text);
                      toast.success("Mensagem copiada");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                {l.site?.url && (
                  <Button size="sm" variant="ghost" asChild title="Abrir o site enviado">
                    <a href={l.site.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="goldline" asChild>
                  <Link to="/app/leads/$id" params={{ id: l.id }}>
                    <MessageSquare className="h-3.5 w-3.5" /> Abrir
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {leads.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {pool.length === 0 ? (
              <>
                Nenhum lead contatado ainda. Gere um site em{" "}
                <Link to="/app/sites" className="text-primary hover:underline">
                  Sites
                </Link>{" "}
                e mova o lead para “Contatado” depois de mandar a mensagem.
              </>
            ) : (
              "Nenhum lead nesta etapa."
            )}
          </p>
        )}
      </div>
    </div>
  );
}
