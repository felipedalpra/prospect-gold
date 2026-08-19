import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/app/LeadsTable";
import { useStore } from "@/lib/store";
import { PROSPECT_STAGES, isProspect, isReadyToSend } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import { downloadCsv, leadsToCsv, parseLeadsCsv } from "@/lib/csv";
import { ArrowRight, Download, Search, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
  const { state, buildSite, importLeads, llmProvider } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
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

  // This screen is the top of the funnel only: leads with no site yet. Once a
  // site exists the lead moves on to Sites, and once approached, to Abordagens.
  const pool = useMemo(() => state.leads.filter(isProspect), [state.leads]);
  const withSite = useMemo(() => state.leads.filter(isReadyToSend).length, [state.leads]);

  const leads = useMemo(
    () =>
      pool.filter(
        (l) =>
          (stage === "Todos" || l.stage === stage) &&
          (l.name.toLowerCase().includes(q.toLowerCase()) ||
            l.category.toLowerCase().includes(q.toLowerCase()) ||
            l.city.toLowerCase().includes(q.toLowerCase())),
      ),
    [pool, q, stage],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Leads · sem site</p>
          <h1 className="mt-1 text-3xl font-bold">{pool.length} oportunidades para trabalhar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que o site é gerado, o lead sai desta lista.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void file.text().then(async (text) => {
                const rows = parseLeadsCsv(text);
                if (rows.length === 0) {
                  toast.error("Não encontrei leads nesse CSV. Precisa de uma coluna de nome.");
                  return;
                }
                try {
                  const added = await importLeads(rows);
                  toast.success(
                    added === rows.length
                      ? `${added} lead(s) importado(s)`
                      : `${added} importado(s) · ${rows.length - added} já estavam na base`,
                  );
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao importar.");
                }
              });
            }}
          />
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button
            variant="ghost"
            disabled={state.leads.length === 0}
            onClick={() => {
              downloadCsv("leads.csv", leadsToCsv(state.leads));
              toast.success("leads.csv baixado");
            }}
          >
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button
            variant="gold"
            disabled={selected.length === 0 || building}
            onClick={() => void build(selected)}
          >
            {building ? "Gerando..." : `Gerar sites selecionados (${selected.length})`}
          </Button>
        </div>
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
          {["Todos", ...PROSPECT_STAGES].map((s) => (
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

      {withSite > 0 && (
        <Link
          to="/app/sites"
          className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/6 px-4 py-3 text-sm transition-colors hover:border-primary/50"
        >
          <span>
            <b className="text-primary">{withSite}</b> lead(s) já com site gerado, prontos para
            enviar.
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
            Ver em Sites <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

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
