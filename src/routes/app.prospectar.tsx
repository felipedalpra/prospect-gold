import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { LeadsTable } from "@/components/app/LeadsTable";
import { useStore } from "@/lib/store";
import { defaultFilters, generateLeads, type Filters } from "@/lib/mock";
import type { Lead } from "@/lib/types";
import { Search, Sparkles, MapPin } from "lucide-react";

export const Route = createFileRoute("/app/prospectar")({
  head: () => ({
    meta: [
      { title: "Prospectar — LeadForge" },
      { name: "description", content: "Busque empresas por nicho e cidade, filtre por presença digital e encontre oportunidades reais." },
      { property: "og:title", content: "Prospectar — LeadForge" },
      { property: "og:description", content: "Encontre suas próximas oportunidades em segundos." },
    ],
  }),
  component: Prospectar,
});

const PHASES = ["Buscando empresas...", "Analisando presença digital...", "Calculando oportunidades..."];

function Prospectar() {
  const { state, addLeads, buildSite } = useStore();
  const [niche, setNiche] = useState(state.profile.targets[0] ?? "Dentistas");
  const [location, setLocation] = useState(state.profile.location);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [found, setFound] = useState(0);
  const [results, setResults] = useState<Lead[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function run() {
    setRunning(true);
    setResults(null);
    setSelected([]);
    setPhase(0);
    setFound(0);
    const totalScan = 60 + Math.floor(Math.random() * 90);
    for (let i = 0; i <= 8; i++) {
      await new Promise((r) => setTimeout(r, 130));
      setFound(Math.round((totalScan / 8) * i));
    }
    setPhase(1);
    await new Promise((r) => setTimeout(r, 900));
    setPhase(2);
    await new Promise((r) => setTimeout(r, 800));
    const leads = generateLeads(niche, location, filters);
    setResults(leads);
    addLeads(leads);
    setRunning(false);
    toast.success(`${leads.length} oportunidades encontradas`);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Prospectar</p>
        <h1 className="mt-1 text-3xl font-bold">Encontre suas próximas oportunidades</h1>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label>O que você quer prospectar?</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Dentistas" className="h-13 pl-10 text-base" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Localização</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Porto Alegre, RS" className="h-13 pl-10 text-base" />
            </div>
          </div>
        </div>

        <div className="relative mt-7 grid gap-5 md:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-border/60 bg-surface-2 p-4">
            {([
              ["noWebsite", "Sem website"],
              ["hasPhone", "Possui telefone"],
              ["hasInstagram", "Possui Instagram"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-foreground/85">{label}</span>
                <Switch checked={filters[key]} onCheckedChange={(v) => setFilters((f) => ({ ...f, [key]: v }))} />
              </div>
            ))}
          </div>
          <div className="space-y-5 rounded-xl border border-border/60 bg-surface-2 p-4">
            <div>
              <div className="flex justify-between text-sm"><span>Nota mínima</span><span className="text-primary">{filters.minRating.toFixed(1)}</span></div>
              <Slider className="mt-3" value={[filters.minRating]} min={0} max={5} step={0.1} onValueChange={([v]) => setFilters((f) => ({ ...f, minRating: v ?? 0 }))} />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>Mínimo de avaliações</span><span className="text-primary">{filters.minReviews}</span></div>
              <Slider className="mt-3" value={[filters.minReviews]} min={0} max={200} step={5} onValueChange={([v]) => setFilters((f) => ({ ...f, minReviews: v ?? 0 }))} />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-border/60 bg-surface-2 p-4">
            <div>
              <div className="flex justify-between text-sm"><span>Resultados</span><span className="text-primary">{filters.limit}</span></div>
              <Slider className="mt-3" value={[filters.limit]} min={5} max={40} step={5} onValueChange={([v]) => setFilters((f) => ({ ...f, limit: v ?? 20 }))} />
            </div>
            <Button variant="gold" size="lg" onClick={run} disabled={running}>
              {running ? "Processando..." : "Encontrar oportunidades"} <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {running && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center"
          >
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <p className="mt-5 font-display text-lg">{PHASES[phase]}</p>
            {phase === 0 && (
              <p className="mt-2 font-display text-4xl font-bold text-primary tabular-nums">{found} encontradas</p>
            )}
            <div className="mx-auto mt-6 flex max-w-md gap-2">
              {PHASES.map((_, i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <motion.div animate={{ width: i <= phase ? "100%" : "0%" }} transition={{ duration: 0.6 }} className="h-full bg-[image:var(--gradient-gold)]" />
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {results && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              <span className="text-primary">{results.length}</span> oportunidades encontradas
            </h2>
            <Button
              variant="gold"
              disabled={selected.length === 0}
              onClick={() => {
                selected.forEach((id) => buildSite(id));
                toast.success(`${selected.length} sites gerados`);
                setSelected([]);
              }}
            >
              Gerar sites selecionados ({selected.length})
            </Button>
          </div>
          <LeadsTable
            leads={results.map((r) => state.leads.find((l) => l.id === r.id) ?? r)}
            selected={selected}
            onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            onToggleAll={() => setSelected((s) => (s.length === results.length ? [] : results.map((r) => r.id)))}
            onGenerate={(id) => {
              buildSite(id);
              toast.success("Site demo gerado");
            }}
          />
        </motion.section>
      )}
    </div>
  );
}
