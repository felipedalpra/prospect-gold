import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { defaultFilters } from "@/lib/score";
import { cn } from "@/lib/utils";
import { Check, Sparkles, X, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — LeadForge" },
      {
        name: "description",
        content:
          "Crie campanhas completas de prospecção com leads, sites e abordagens geradas automaticamente.",
      },
      { property: "og:title", content: "Campanhas — LeadForge" },
      { property: "og:description", content: "Uma campanha inteira em minutos." },
    ],
  }),
  component: Campanhas,
});

type LogEntry = { text: string; status: "running" | "done" | "failed" };

function Campanhas() {
  const { state, prospect, enqueue, drainQueue, keyFor, llmProvider } = useStore();
  const [niche, setNiche] = useState(state.profile.targets[0] ?? "");
  const [location, setLocation] = useState(state.profile.location);
  const [howMany, setHowMany] = useState(5);
  const [alsoPublish, setAlsoPublish] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<{ leads: number; sites: number; msgs: number } | null>(null);

  const hasApify = Boolean(keyFor("apify"));
  const hasNetlify = Boolean(keyFor("netlify"));
  const ready = hasApify && Boolean(llmProvider) && niche.trim().length > 0;

  // setLog's updater runs after this returns, so the index comes from a counter
  // we control rather than from the current log length.
  const nextIndex = useRef(0);

  function push(text: string): number {
    const index = nextIndex.current++;
    setLog((l) => [...l, { text, status: "running" }]);
    return index;
  }

  function settle(index: number, status: "done" | "failed", text?: string) {
    setLog((l) => l.map((e, i) => (i === index ? { ...e, status, text: text ?? e.text } : e)));
  }

  async function run() {
    setRunning(true);
    setResult(null);
    setLog([]);
    nextIndex.current = 0;

    let sites = 0;
    let msgs = 0;

    try {
      const searchStep = push(`Buscando ${niche} em ${location} no Google Maps...`);
      const leads = await prospect(niche, location, {
        ...defaultFilters,
        limit: Math.max(howMany, 10),
      });
      if (leads.length === 0) {
        settle(
          searchStep,
          "failed",
          "Nenhuma empresa nova encontrada — afrouxe os filtros ou tente outra cidade.",
        );
        setRunning(false);
        return;
      }
      settle(searchStep, "done", `${leads.length} oportunidades encontradas`);

      // Work the best-scoring leads first; the rest stay in the list for later.
      const targets = leads.slice(0, howMany);

      // The plan is written to the database before a single call is made, so
      // closing the tab pauses the campaign instead of throwing it away — any
      // session that opens later picks it up from where this one stopped.
      const queueStep = push("Montando a fila de trabalho...");
      await enqueue(
        targets.flatMap((lead) => [
          { leadId: lead.id, kind: "site" as const },
          ...(alsoPublish && hasNetlify ? [{ leadId: lead.id, kind: "publish" as const }] : []),
          { leadId: lead.id, kind: "message" as const },
        ]),
      );
      settle(
        queueStep,
        "done",
        `${targets.length} negócio(s) na fila — pode fechar a aba, o trabalho continua depois`,
      );

      const runStep = push("Trabalhando a fila...");
      const outcome = await drainQueue();
      sites = outcome.sites;
      msgs = outcome.messages;
      settle(
        runStep,
        outcome.failed > 0 ? "failed" : "done",
        `${sites} site(s) e ${msgs} abordagem(ns) prontos` +
          (outcome.failed > 0 ? ` · ${outcome.failed} falha(s)` : ""),
      );

      setResult({ leads: leads.length, sites, msgs });
      toast.success("Sua campanha está pronta");
    } catch (err) {
      toast.error(errText(err));
      setLog((l) => l.map((e) => (e.status === "running" ? { ...e, status: "failed" } : e)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Campanhas</p>
        <h1 className="mt-1 text-3xl font-bold">Crie uma campanha inteira em minutos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Busca as empresas, escreve um site para cada uma, publica e já deixa a abordagem pronta.
        </p>
      </header>

      {(!hasApify || !llmProvider) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <KeyRound className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            {!hasApify
              ? "Conecte a Apify para buscar empresas."
              : "Conecte Anthropic ou OpenAI para gerar sites e abordagens."}
          </span>
          <Button size="sm" variant="goldline" asChild>
            <Link to="/app/configuracoes">Configurar</Link>
          </Button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative grid gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>O que você quer prospectar?</Label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Academias"
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Onde?</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Porto Alegre, RS"
              className="h-12"
            />
          </div>
        </div>

        <div className="relative mt-6 grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="rounded-xl border border-border/60 bg-surface-2 p-4">
            <div className="flex justify-between text-sm">
              <span>Sites a gerar</span>
              <span className="text-primary">{howMany}</span>
            </div>
            <Slider
              className="mt-3"
              value={[howMany]}
              min={1}
              max={15}
              step={1}
              onValueChange={([v]) => setHowMany(v ?? 5)}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Cada site é uma geração completa da IA — leva cerca de 1 minuto por lead.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Publicar no Netlify</span>
              <Switch
                checked={alsoPublish && hasNetlify}
                disabled={!hasNetlify}
                onCheckedChange={setAlsoPublish}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {hasNetlify
                ? "Publica cada site e usa o link real na abordagem."
                : "Conecte o Netlify em Configurações para publicar automaticamente."}
            </p>
          </div>
          <Button variant="gold" size="lg" onClick={() => void run()} disabled={running || !ready}>
            <Sparkles className="h-4 w-4" /> {running ? "Rodando..." : "Criar campanha"}
          </Button>
        </div>

        <AnimatePresence>
          {log.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative mt-6 overflow-hidden"
            >
              <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-surface-2 p-4">
                {log.map((entry, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px]",
                        entry.status === "done" && "border-success bg-success/15 text-success",
                        entry.status === "failed" &&
                          "border-destructive bg-destructive/15 text-destructive",
                        entry.status === "running" && "border-primary/50 text-primary",
                      )}
                    >
                      {entry.status === "done" ? (
                        <Check className="h-2.5 w-2.5" />
                      ) : entry.status === "failed" ? (
                        <X className="h-2.5 w-2.5" />
                      ) : (
                        ""
                      )}
                    </span>
                    <span
                      className={cn(
                        entry.status === "failed" ? "text-destructive" : "text-foreground/85",
                      )}
                    >
                      {entry.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-primary/30 bg-primary/8 p-5"
          >
            <p className="font-display text-lg">Sua campanha está pronta.</p>
            <div className="flex gap-6 text-sm">
              <span>
                <b className="text-primary">{result.leads}</b> oportunidades
              </span>
              <span>
                <b className="text-primary">{result.sites}</b> sites
              </span>
              <span>
                <b className="text-primary">{result.msgs}</b> abordagens
              </span>
            </div>
            <Button variant="gold" asChild>
              <Link to="/app/leads">Começar prospecção</Link>
            </Button>
          </motion.div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.campaigns.map((c) => {
          const cl = state.leads.filter((l) => l.campaignId === c.id);
          const rows = [
            ["leads encontrados", cl.length],
            ["sem site", cl.filter((l) => !l.hasWebsite).length],
            ["sites gerados", cl.filter((l) => l.site).length],
            [
              "contatados",
              cl.filter((l) =>
                ["Contatado", "Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage),
              ).length,
            ],
            [
              "respostas",
              cl.filter((l) => ["Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage))
                .length,
            ],
            [
              "reuniões",
              cl.filter((l) => ["Reunião", "Proposta", "Venda"].includes(l.stage)).length,
            ],
          ] as const;
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {rows.map(([label, v]) => (
                  <li key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-primary tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : "erro desconhecido";
}
