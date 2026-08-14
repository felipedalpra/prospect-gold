import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { LeadsTable } from "@/components/app/LeadsTable";
import { useStore } from "@/lib/store";
import { defaultFilters, type Filters } from "@/lib/score";
import type { Lead } from "@/lib/types";
import { Search, Sparkles, MapPin, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/prospectar")({
  head: () => ({
    meta: [
      { title: "Prospectar — LeadForge" },
      {
        name: "description",
        content:
          "Busque empresas por nicho e cidade, filtre por presença digital e encontre oportunidades reais.",
      },
      { property: "og:title", content: "Prospectar — LeadForge" },
      { property: "og:description", content: "Encontre suas próximas oportunidades em segundos." },
    ],
  }),
  component: Prospectar,
});

function Prospectar() {
  const { state, prospect, buildSite, keyFor, llmProvider } = useStore();
  const [niche, setNiche] = useState(state.profile.targets[0] ?? "");
  const [location, setLocation] = useState(state.profile.location);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Lead[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [buildingIds, setBuildingIds] = useState<string[]>([]);

  const hasApify = Boolean(keyFor("apify"));

  async function run() {
    if (!hasApify) {
      toast.error("Conecte sua chave da Apify em Configurações.");
      return;
    }
    setRunning(true);
    setResults(null);
    setSelected([]);
    try {
      const leads = await prospect(niche, location, filters);
      setResults(leads);
      if (leads.length === 0) {
        toast.info("Nenhuma empresa nova encontrada. Tente afrouxar os filtros ou outra cidade.");
      } else {
        toast.success(`${leads.length} oportunidades encontradas`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "A busca falhou.");
    } finally {
      setRunning(false);
    }
  }

  async function build(ids: string[]) {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setBuildingIds((b) => [...b, ...ids]);
    // Sequential: each call is a long LLM generation, and firing them all at
    // once is the fastest way to hit a provider rate limit.
    for (const id of ids) {
      try {
        await buildSite(id);
        toast.success("Site gerado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao gerar o site.");
      } finally {
        setBuildingIds((b) => b.filter((x) => x !== id));
      }
    }
    setSelected([]);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Prospectar</p>
        <h1 className="mt-1 text-3xl font-bold">Encontre suas próximas oportunidades</h1>
      </header>

      {!hasApify && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <KeyRound className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            Conecte sua chave da Apify para buscar empresas reais no Google Maps.
          </span>
          <Button size="sm" variant="goldline" asChild>
            <Link to="/app/configuracoes">Configurar</Link>
          </Button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label>O que você quer prospectar?</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Dentistas"
                className="h-13 pl-10 text-base"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Localização</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Porto Alegre, RS"
                className="h-13 pl-10 text-base"
              />
            </div>
          </div>
        </div>

        <div className="relative mt-7 grid gap-5 md:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-border/60 bg-surface-2 p-4">
            {(
              [
                ["noWebsite", "Sem website"],
                ["hasPhone", "Possui telefone"],
                ["hasInstagram", "Possui Instagram"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-foreground/85">{label}</span>
                <Switch
                  checked={filters[key]}
                  onCheckedChange={(v) => setFilters((f) => ({ ...f, [key]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-5 rounded-xl border border-border/60 bg-surface-2 p-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Nota mínima</span>
                <span className="text-primary">{filters.minRating.toFixed(1)}</span>
              </div>
              <Slider
                className="mt-3"
                value={[filters.minRating]}
                min={0}
                max={5}
                step={0.1}
                onValueChange={([v]) => setFilters((f) => ({ ...f, minRating: v ?? 0 }))}
              />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Mínimo de avaliações</span>
                <span className="text-primary">{filters.minReviews}</span>
              </div>
              <Slider
                className="mt-3"
                value={[filters.minReviews]}
                min={0}
                max={200}
                step={5}
                onValueChange={([v]) => setFilters((f) => ({ ...f, minReviews: v ?? 0 }))}
              />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-border/60 bg-surface-2 p-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Resultados</span>
                <span className="text-primary">{filters.limit}</span>
              </div>
              <Slider
                className="mt-3"
                value={[filters.limit]}
                min={5}
                max={40}
                step={5}
                onValueChange={([v]) => setFilters((f) => ({ ...f, limit: v ?? 20 }))}
              />
            </div>
            <Button
              variant="gold"
              size="lg"
              onClick={() => void run()}
              disabled={running || !hasApify || !niche.trim()}
            >
              {running ? "Buscando..." : "Encontrar oportunidades"} <Sparkles className="h-4 w-4" />
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
            <p className="mt-5 font-display text-lg">Varrendo o Google Maps via Apify...</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Isso costuma levar de 30 segundos a 2 minutos, dependendo do tamanho da busca.
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {results && results.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              <span className="text-primary">{results.length}</span> oportunidades encontradas
            </h2>
            <Button
              variant="gold"
              disabled={selected.length === 0 || buildingIds.length > 0}
              onClick={() => void build(selected)}
            >
              {buildingIds.length > 0
                ? `Gerando ${buildingIds.length} site(s)...`
                : `Gerar sites selecionados (${selected.length})`}
            </Button>
          </div>
          <LeadsTable
            leads={results.map((r) => state.leads.find((l) => l.id === r.id) ?? r)}
            selected={selected}
            onToggle={(id) =>
              setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
            }
            onToggleAll={() =>
              setSelected((s) => (s.length === results.length ? [] : results.map((r) => r.id)))
            }
            onGenerate={(id) => void build([id])}
          />
        </motion.section>
      )}
    </div>
  );
}
