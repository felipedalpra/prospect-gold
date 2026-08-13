import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { defaultFilters, generateLeads, generateMessage, generateSiteContent, slugify } from "@/lib/mock";
import type { Lead } from "@/lib/types";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — LeadForge" },
      { name: "description", content: "Crie campanhas completas de prospecção com leads, sites e abordagens geradas automaticamente." },
      { property: "og:title", content: "Campanhas — LeadForge" },
      { property: "og:description", content: "Uma campanha inteira em minutos." },
    ],
  }),
  component: Campanhas,
});

const STEPS = [
  "Encontrando empresas...",
  "Qualificando leads...",
  "Selecionando oportunidades...",
  "Gerando sites...",
  "Criando abordagens...",
];

function Campanhas() {
  const { state, createCampaign } = useStore();
  const [niche, setNiche] = useState("Academias");
  const [location, setLocation] = useState(state.profile.location);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<{ leads: number; sites: number; msgs: number } | null>(null);

  useEffect(() => {
    if (step < 0) return;
    if (step >= STEPS.length) {
      const leads: Lead[] = generateLeads(niche, location, { ...defaultFilters, limit: 20 }).map((l, i) => {
        if (i < 10) {
          const gen = generateSiteContent(l);
          const withSite: Lead = {
            ...l,
            stage: "Site criado",
            site: { ...gen, published: true, url: `${slugify(l.name)}.demo.leadforge.app`, createdAt: new Date().toISOString() },
          };
          return { ...withSite, message: { tone: "Consultiva", channel: "WhatsApp", text: generateMessage(withSite, "Consultiva", "WhatsApp") } };
        }
        return l;
      });
      createCampaign({ name: `${niche} ${location.split(",")[0]}`, niche, location }, leads);
      setResult({ leads: leads.length, sites: leads.filter((l) => l.site).length, msgs: leads.filter((l) => l.message).length });
      setStep(-1);
      toast.success("Sua campanha está pronta");
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [step, niche, location, createCampaign]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Campanhas</p>
        <h1 className="mt-1 text-3xl font-bold">Crie uma campanha inteira em minutos</h1>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5"><Label>O que você quer prospectar?</Label><Input value={niche} onChange={(e) => setNiche(e.target.value)} className="h-12" /></div>
          <div className="space-y-1.5"><Label>Onde?</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-12" /></div>
          <Button variant="gold" size="lg" onClick={() => { setResult(null); setStep(0); }} disabled={step >= 0}>
            <Sparkles className="h-4 w-4" /> Criar campanha
          </Button>
        </div>

        <AnimatePresence>
          {step >= 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative mt-6 overflow-hidden">
              <div className="mx-auto max-w-sm space-y-3">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-3 text-sm ${i <= step ? "opacity-100" : "opacity-30"}`}>
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-primary/50 text-[10px] text-primary">{i < step ? "✓" : i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-primary/30 bg-primary/8 p-5">
            <p className="font-display text-lg">Sua campanha está pronta.</p>
            <div className="flex gap-6 text-sm">
              <span><b className="text-primary">{result.leads}</b> oportunidades</span>
              <span><b className="text-primary">{result.sites}</b> sites</span>
              <span><b className="text-primary">{result.msgs}</b> abordagens</span>
            </div>
            <Button variant="gold" asChild><Link to="/app/leads">Começar prospecção</Link></Button>
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
            ["contatados", cl.filter((l) => ["Contatado", "Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage)).length],
            ["respostas", cl.filter((l) => ["Respondeu", "Reunião", "Proposta", "Venda"].includes(l.stage)).length],
            ["reuniões", cl.filter((l) => ["Reunião", "Proposta", "Venda"].includes(l.stage)).length],
          ] as const;
          return (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40">
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</p>
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
