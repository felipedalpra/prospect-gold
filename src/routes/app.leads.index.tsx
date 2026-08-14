import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/app/LeadsTable";
import { useStore } from "@/lib/store";
import { STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — LeadForge" },
      {
        name: "description",
        content: "Todos os leads capturados, com opportunity score, status e ações rápidas.",
      },
      { property: "og:title", content: "Leads — LeadForge" },
      { property: "og:description", content: "Sua base de oportunidades qualificadas." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { state, buildSite, llmProvider } = useStore();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("Todos");
  const [selected, setSelected] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);

  async function build(ids: string[]) {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setBuilding(true);
    let ok = 0;
    // One at a time: each is a full page generation, and parallel calls are the
    // quickest way to trip a provider rate limit.
    for (const id of ids) {
      try {
        await buildSite(id);
        ok++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao gerar o site.");
      }
    }
    if (ok > 0) toast.success(`${ok} site(s) gerado(s)`);
    setSelected([]);
    setBuilding(false);
  }

  const leads = useMemo(
    () =>
      state.leads.filter(
        (l) =>
          (stage === "Todos" || l.stage === stage) &&
          (l.name.toLowerCase().includes(q.toLowerCase()) ||
            l.category.toLowerCase().includes(q.toLowerCase()) ||
            l.city.toLowerCase().includes(q.toLowerCase())),
      ),
    [state.leads, q, stage],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Leads</p>
          <h1 className="mt-1 text-3xl font-bold">{state.leads.length} oportunidades na base</h1>
        </div>
        <Button
          variant="gold"
          disabled={selected.length === 0 || building}
          onClick={() => void build(selected)}
        >
          {building ? "Gerando..." : `Gerar sites selecionados (${selected.length})`}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa, nicho ou cidade"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["Todos", ...STAGES].map((s) => (
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

      <LeadsTable
        leads={leads}
        selected={selected}
        onToggle={(id) =>
          setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
        }
        onToggleAll={() =>
          setSelected((s) => (s.length === leads.length ? [] : leads.map((l) => l.id)))
        }
        onGenerate={(id) => void build([id])}
      />
    </div>
  );
}
