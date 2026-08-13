import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRing, scoreLabel } from "@/components/shared/ScoreBadge";
import { SitePreview } from "@/components/app/SitePreview";
import { useStore } from "@/lib/store";
import { STAGES, type SiteSection, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Copy, ExternalLink, Globe, Instagram, MapPin, Phone, RefreshCw, Rocket, Sparkles, Star,
} from "lucide-react";

export const Route = createFileRoute("/app/leads/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do lead — LeadForge" },
      { name: "description", content: "Veja dados do negócio, opportunity score, site demo gerado e abordagem pronta." },
      { property: "og:title", content: "Detalhe do lead — LeadForge" },
      { property: "og:description", content: "Tudo sobre a oportunidade em uma tela." },
    ],
  }),
  component: LeadDetail,
});

const GEN_STEPS = [
  "Analisando negócio...",
  "Criando proposta visual...",
  "Escrevendo conteúdo...",
  "Montando site...",
  "Finalizando...",
];

function LeadDetail() {
  const { id } = useParams({ from: "/app/leads/$id" });
  const { state, buildSite, publishSite, updateLead, moveLead, writeMessage } = useStore();
  const lead = state.leads.find((l) => l.id === id);

  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [justBuilt, setJustBuilt] = useState(false);
  const [tab, setTab] = useState("overview");
  const [tone, setTone] = useState<"Direta" | "Consultiva" | "Casual">("Consultiva");
  const [channel, setChannel] = useState<"WhatsApp" | "Email">("WhatsApp");

  useEffect(() => {
    if (!generating) return;
    if (genStep >= GEN_STEPS.length) {
      buildSite(id);
      setGenerating(false);
      setGenStep(0);
      setJustBuilt(true);
      setTab("site");
      toast.success("Seu site está pronto");
      return;
    }
    const t = setTimeout(() => setGenStep((s) => s + 1), 750);
    return () => clearTimeout(t);
  }, [generating, genStep, buildSite, id]);

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Lead não encontrado.</p>
        <Button variant="goldline" className="mt-4" asChild><Link to="/app/leads">Voltar</Link></Button>
      </div>
    );
  }

  const label = scoreLabel(lead.score);
  const content = lead.site?.content;

  function patchContent(patch: Partial<SiteSection>) {
    if (!lead?.site) return;
    updateLead(lead.id, { site: { ...lead.site, content: { ...lead.site.content, ...patch } } });
  }

  return (
    <div className="space-y-6">
      <Link to="/app/leads" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para leads
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-[90px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary">{lead.category}</p>
            <h1 className="mt-1 text-3xl font-bold">{lead.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{lead.address}, {lead.city}</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{lead.rating.toFixed(1)} · {lead.reviews} avaliações</span>
              {lead.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary" />{lead.phone}</span>}
              {lead.instagram && <span className="inline-flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5 text-primary" />{lead.instagram}</span>}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />{lead.hasWebsite ? lead.website : "Sem site"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa:</span>
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => moveLead(lead.id, s as Stage)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    lead.stage === s
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-center">
              <ScoreRing score={lead.score} />
              <p className="mt-1 text-xs text-primary">{label.icon} {label.label}</p>
            </div>
            {!lead.site && (
              <Button variant="gold" size="lg" onClick={() => { setGenerating(true); setGenStep(0); }} disabled={generating}>
                <Sparkles className="h-4 w-4" /> Gerar site demo
              </Button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-8"
          >
            <div className="mx-auto max-w-sm space-y-3">
              {GEN_STEPS.map((s, i) => (
                <div key={s} className={cn("flex items-center gap-3 text-sm transition-opacity", i <= genStep ? "opacity-100" : "opacity-30")}>
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[10px]", i < genStep ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary")}>
                    {i < genStep ? "✓" : i + 1}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="message">Abordagem</TabsTrigger>
          <TabsTrigger value="activity">Atividades</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-sm font-semibold">Breakdown do Opportunity Score</h2>
              <ul className="mt-4 space-y-2.5">
                {lead.reasons.map((r) => (
                  <li key={r.label} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-foreground/85">{r.label}</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(r.points / 30) * 100}%` }} className="h-full bg-[image:var(--gradient-gold)]" />
                    </div>
                    <span className="w-9 text-right text-sm font-semibold text-primary">+{r.points}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-sm font-semibold">Dados do negócio</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Categoria", lead.category],
                  ["Cidade", lead.city],
                  ["Google Maps", "Perfil verificado"],
                  ["Telefone", lead.phone ?? "—"],
                  ["Instagram", lead.instagram ?? "—"],
                  ["Site atual", lead.hasWebsite ? lead.website! : "Sem site"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="site" className="mt-5">
          {!lead.site || !content ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum site demo gerado ainda.</p>
              <Button variant="gold" className="mt-4" onClick={() => { setGenerating(true); setGenStep(0); }}>
                <Sparkles className="h-4 w-4" /> Gerar site demo
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {lead.site.published && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 p-4">
                  <Rocket className="h-4 w-4 text-primary" />
                  <span className="text-sm">Site publicado em</span>
                  <code className="rounded bg-background px-2 py-1 text-xs text-primary">{lead.site.url}</code>
                  <Button size="sm" variant="goldline" onClick={() => { navigator.clipboard.writeText(`https://${lead.site!.url}`); toast.success("Link copiado"); }}>
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.info("Preview de demonstração")}>
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir site
                  </Button>
                  <Button size="sm" variant="gold" onClick={() => setTab("message")}>Gerar abordagem</Button>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
                  <h3 className="text-sm font-semibold">Editor</h3>
                  <div className="space-y-1.5"><Label>Headline</Label><Input value={content.headline} onChange={(e) => patchContent({ headline: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Subheadline</Label><Textarea rows={2} value={content.subheadline} onChange={(e) => patchContent({ subheadline: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={content.about} onChange={(e) => patchContent({ about: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Serviços (um por linha)</Label><Textarea rows={4} value={content.services.join("\n")} onChange={(e) => patchContent({ services: e.target.value.split("\n") })} /></div>
                  <div className="space-y-1.5"><Label>CTA</Label><Input value={content.cta} onChange={(e) => patchContent({ cta: e.target.value })} /></div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input value={lead.phone ?? ""} onChange={(e) => updateLead(lead.id, { phone: e.target.value })} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="gold" className="flex-1" onClick={() => { publishSite(lead.id); toast.success("Site publicado"); }}>
                      <Rocket className="h-4 w-4" /> {lead.site.published ? "Republicar" : "Publicar"}
                    </Button>
                    <Button variant="goldline" onClick={() => { setGenerating(true); setGenStep(0); }}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <SitePreview lead={lead} content={content} template={lead.site.template} animateIn={justBuilt} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="message" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
              <div>
                <Label>Tom da abordagem</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["Direta", "Consultiva", "Casual"] as const).map((t) => (
                    <button key={t} onClick={() => setTone(t)} className={cn("rounded-lg border px-3 py-2 text-xs transition-colors", tone === t ? "border-primary/50 bg-primary/12 text-primary" : "border-border bg-surface-2 text-muted-foreground")}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Canal</Label>
                <div className="mt-2 flex gap-2">
                  {(["WhatsApp", "Email"] as const).map((c) => (
                    <button key={c} onClick={() => setChannel(c)} className={cn("rounded-lg border px-3 py-2 text-xs transition-colors", channel === c ? "border-primary/50 bg-primary/12 text-primary" : "border-border bg-surface-2 text-muted-foreground")}>{c}</button>
                  ))}
                </div>
              </div>
              <Button variant="gold" className="w-full" onClick={() => { writeMessage(lead.id, tone, channel); toast.success("Abordagem gerada"); }}>
                <Sparkles className="h-4 w-4" /> {lead.message ? "Gerar novamente" : "Gerar abordagem"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              {lead.message ? (
                <>
                  <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs text-primary">{lead.name.slice(0, 2).toUpperCase()}</span>
                      <div><p className="text-sm">{lead.name}</p><p className="text-[11px] text-muted-foreground">{lead.message.channel}</p></div>
                    </div>
                    <Textarea
                      rows={12}
                      value={lead.message.text}
                      onChange={(e) => updateLead(lead.id, { message: { ...lead.message!, text: e.target.value } })}
                      className="resize-none border-none bg-transparent text-sm focus-visible:ring-0"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="goldline" onClick={() => { navigator.clipboard.writeText(lead.message!.text); toast.success("Mensagem copiada"); }}>
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    <Button variant="gold" onClick={() => { moveLead(lead.id, "Contatado"); window.open(`https://wa.me/?text=${encodeURIComponent(lead.message!.text)}`, "_blank"); }}>
                      Abrir WhatsApp <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">Escolha um tom e gere a abordagem.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <ul className="space-y-3 rounded-xl border border-border bg-surface p-6">
            {lead.activities.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="block">{a.text}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString("pt-BR")}</span>
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
