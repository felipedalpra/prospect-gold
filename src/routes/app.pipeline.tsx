import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { STAGES, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "@/components/shared/ScoreBadge";

export const Route = createFileRoute("/app/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — LeadForge" },
      { name: "description", content: "Kanban de prospecção: do lead novo à venda, com arrastar e soltar." },
      { property: "og:title", content: "Pipeline — LeadForge" },
      { property: "og:description", content: "Acompanhe cada oportunidade em um único lugar." },
    ],
  }),
  component: Pipeline,
});

function Pipeline() {
  const { state, moveLead } = useStore();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Pipeline</p>
        <h1 className="mt-1 text-3xl font-bold">Acompanhe tudo em um único lugar</h1>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const items = state.leads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={() => {
                if (dragging) { moveLead(dragging, stage); toast.success(`Movido para ${stage}`); }
                setDragging(null); setOver(null);
              }}
              className={cn(
                "w-64 shrink-0 rounded-xl border bg-surface p-3 transition-colors",
                over === stage ? "border-primary/60 bg-primary/6" : "border-border",
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-semibold">{stage}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <motion.div
                    key={l.id}
                    layout
                    draggable
                    onDragStart={() => setDragging(l.id)}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "cursor-grab rounded-lg border border-border/70 bg-surface-2 p-3 transition-colors hover:border-primary/40 active:cursor-grabbing",
                      dragging === l.id && "opacity-50",
                    )}
                  >
                    <Link to="/app/leads/$id" params={{ id: l.id }} className="block truncate text-sm hover:text-primary">
                      {l.name}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{l.category} · {l.city}</p>
                    <div className="mt-2"><ScoreBadge score={l.score} compact /></div>
                  </motion.div>
                ))}
                {items.length === 0 && <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
