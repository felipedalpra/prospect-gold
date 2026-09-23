import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { copySiteHtml, downloadSiteHtml } from "@/lib/download";
import {
  DEFAULT_SEQUENCE_STEPS,
  SITE_LAYOUTS,
  SITE_TEXTURES,
  SITE_TYPEFACES,
  STAGES,
  type Lead,
  type SiteSection,
  type Stage,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarClock,
  Code2,
  Eye,
  EyeOff,
  Gauge,
  Github,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Instagram,
  MapPin,
  Phone,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  Workflow,
} from "lucide-react";

export const Route = createFileRoute("/app/leads/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do lead — LeadForge" },
      {
        name: "description",
        content: "Veja dados do negócio, opportunity score, site gerado e abordagem pronta.",
      },
      { property: "og:title", content: "Detalhe do lead — LeadForge" },
      { property: "og:description", content: "Tudo sobre a oportunidade em uma tela." },
    ],
  }),
  component: LeadDetail,
});

function VisualSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#c8a24a";
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2">
        <input
          type="color"
          value={safe}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          spellCheck={false}
          aria-label={`${label} em hexadecimal`}
        />
      </div>
    </label>
  );
}

const VISUAL_PRESETS: Record<string, Partial<SiteSection> & { label: string }> = {
  "luxo-editorial": {
    label: "Luxo editorial",
    layout: "editorial",
    typeface: "mixed",
    shape: "soft",
    mode: "light",
    texture: "paper",
    motion: "subtle",
    accent: "#9b6b3d",
    secondary: "#e6c9a8",
  },
  "organico-calmo": {
    label: "Orgânico calmo",
    layout: "minimal",
    typeface: "serif",
    shape: "round",
    mode: "light",
    texture: "grain",
    motion: "subtle",
    accent: "#56745d",
    secondary: "#d8c8a8",
  },
  "tech-impacto": {
    label: "Tech impacto",
    layout: "immersive",
    typeface: "condensed",
    shape: "sharp",
    mode: "dark",
    texture: "grid",
    motion: "rich",
    accent: "#7c5cff",
    secondary: "#28d7c3",
  },
  "energia-urbana": {
    label: "Energia urbana",
    layout: "showcase",
    typeface: "sans",
    shape: "sharp",
    mode: "dark",
    texture: "dots",
    motion: "rich",
    accent: "#f05d3d",
    secondary: "#f4c95d",
  },
};

function QualityChecklist({ content, lead }: { content: SiteSection; lead: Lead }) {
  const checks = [
    [Boolean(content.headline.trim()), "Headline preenchida"],
    [content.services.filter(Boolean).length >= 3, "Pelo menos 3 serviços"],
    [Boolean(content.cta.trim()) && Boolean(lead.phone), "CTA e WhatsApp configurados"],
    [(content.images?.length ?? lead.images?.length ?? 0) > 0, "Imagem disponível para o hero"],
    [
      (content.blocks?.filter((block) => block.enabled !== false).length ?? 0) >= 4,
      "Arquitetura com 4+ seções",
    ],
    [Boolean(content.accent?.match(/^#[0-9a-f]{6}$/i)), "Cor principal válida"],
    [Boolean(content.secondary?.match(/^#[0-9a-f]{6}$/i)), "Cor secundária válida"],
  ] as const;
  const score = Math.round((checks.filter(([ok]) => ok).length / checks.length) * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Checklist de qualidade</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Verificações rápidas antes de publicar.
          </p>
        </div>
        <span className={cn("text-lg font-bold", score >= 85 ? "text-success" : "text-warning")}>
          {score}%
        </span>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {checks.map(([ok, label]) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className={cn("text-sm", ok ? "text-success" : "text-warning")}>
              {ok ? "✓" : "!"}
            </span>
            <span className={ok ? "text-foreground/80" : "text-muted-foreground"}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadDetail() {
  const { id } = useParams({ from: "/app/leads/$id" });
  const {
    state,
    buildSite,
    publishSite,
    publishGithubSite,
    updateLead,
    patchSiteContent,
    moveLead,
    writeMessage,
    auditLead,
    buildDiagnostic,
    publishDiagnostic,
    chooseVariant,
    sendWhatsApp,
    setFollowUp,
    llmProvider,
    keyFor,
  } = useStore();
  const lead = state.leads.find((l) => l.id === id);

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingGithub, setPublishingGithub] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tab, setTab] = useState("overview");
  const [tone, setTone] = useState<"Direta" | "Consultiva" | "Casual">("Consultiva");
  const [channel, setChannel] = useState<"WhatsApp" | "Email">("WhatsApp");
  const [auditing, setAuditing] = useState(false);
  const [variant, setVariant] = useState(0);
  const [generatingDiagnostic, setGeneratingDiagnostic] = useState(false);
  const [publishingDiagnostic, setPublishingDiagnostic] = useState(false);

  if (state.loading) {
    return (
      <div className="grid place-items-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Lead não encontrado.</p>
        <Button variant="goldline" className="mt-4" asChild>
          <Link to="/app/leads">Voltar</Link>
        </Button>
      </div>
    );
  }

  async function generate() {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setGenerating(true);
    setTab("site");
    try {
      await buildSite(id);
      toast.success("Seu site está pronto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o site.");
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    if (!keyFor("netlify")) {
      toast.error("Conecte seu token do Netlify em Configurações.");
      return;
    }
    setPublishing(true);
    try {
      const url = await publishSite(id);
      toast.success(`Publicado em ${url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  async function publishGithub() {
    setPublishingGithub(true);
    try {
      const url = await publishGithubSite(id);
      toast.success(`Site enviado para o GitHub: ${url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar para o GitHub.");
    } finally {
      setPublishingGithub(false);
    }
  }

  async function write() {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setWriting(true);
    try {
      await writeMessage(id, tone, channel);
      toast.success("Abordagem gerada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar a abordagem.");
    } finally {
      setWriting(false);
    }
  }

  async function runAudit() {
    setAuditing(true);
    try {
      const a = await auditLead(id);
      toast.success(`Site atual: ${a.performance}/100 no PageSpeed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao analisar o site.");
    } finally {
      setAuditing(false);
    }
  }

  async function generateDiagnosticReport() {
    if (!llmProvider) {
      toast.error("Conecte Anthropic ou OpenAI em Configurações.");
      return;
    }
    setGeneratingDiagnostic(true);
    setTab("diagnostic");
    try {
      await buildDiagnostic(id);
      toast.success("Diagnóstico gerado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o diagnóstico.");
    } finally {
      setGeneratingDiagnostic(false);
    }
  }

  async function publishDiagnosticReport() {
    if (!keyFor("netlify")) {
      toast.error("Conecte seu token do Netlify em Configurações.");
      return;
    }
    setPublishingDiagnostic(true);
    try {
      const url = await publishDiagnostic(id);
      toast.success(`Publicado em ${url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
    } finally {
      setPublishingDiagnostic(false);
    }
  }

  const label = scoreLabel(lead.score);
  const content = lead.site?.content;
  const blocks = content?.blocks ?? [];
  const whatsappNumber = lead.phone?.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <Link
        to="/app/leads"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para leads
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-[90px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary">{lead.category}</p>
            <h1 className="mt-1 text-3xl font-bold">{lead.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {lead.address}, {lead.city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                {lead.rating.toFixed(1)} · {lead.reviews} avaliações
              </span>
              {lead.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  {lead.phone}
                </span>
              )}
              {lead.instagram && (
                <span className="inline-flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-primary" />
                  {lead.instagram}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {lead.hasWebsite ? lead.website : "Sem site"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa:</span>
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => void moveLead(lead.id, s as Stage)}
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
              <p className="mt-1 text-xs text-primary">
                {label.icon} {label.label}
              </p>
            </div>
            {!lead.site && (
              <Button
                variant="gold"
                size="lg"
                onClick={() => void generate()}
                disabled={generating}
              >
                <Sparkles className="h-4 w-4" /> {generating ? "Gerando..." : "Gerar site"}
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
            className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center"
          >
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <p className="mt-4 font-display text-lg">
              A IA está escrevendo a landing page de {lead.name}...
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escrever uma página inteira leva de 30 a 90 segundos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnóstico</TabsTrigger>
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
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.points / 30) * 100}%` }}
                        className="h-full bg-[image:var(--gradient-gold)]"
                      />
                    </div>
                    <span className="w-9 text-right text-sm font-semibold text-primary">
                      +{r.points}
                    </span>
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
                  ["Telefone", lead.phone ?? "—"],
                  ["Instagram", lead.instagram ?? "—"],
                  ["Site atual", lead.hasWebsite ? lead.website! : "Sem site"],
                  ["Encontrado em", new Date(lead.createdAt).toLocaleDateString("pt-BR")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Site atual do lead</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A nota do Google sobre o site que ele já tem — o melhor argumento de venda.
                  </p>
                </div>
                {lead.website && (
                  <Button
                    size="sm"
                    variant="goldline"
                    onClick={() => void runAudit()}
                    disabled={auditing}
                  >
                    <Gauge className={cn("h-3.5 w-3.5", auditing && "animate-pulse")} />
                    {auditing ? "Analisando..." : lead.siteAudit ? "Analisar de novo" : "Analisar"}
                  </Button>
                )}
              </div>

              {!lead.website ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  Este lead não tem site — esse já é o argumento.
                </p>
              ) : lead.siteAudit ? (
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  {[
                    [
                      `${lead.siteAudit.performance}/100`,
                      "PageSpeed",
                      lead.siteAudit.performance < 50,
                    ],
                    [`${lead.siteAudit.lcp}s`, "Carregamento", lead.siteAudit.lcp > 2.5],
                    [lead.siteAudit.mobile ? "Sim" : "Não", "Responsivo", !lead.siteAudit.mobile],
                    [lead.siteAudit.https ? "Sim" : "Não", "HTTPS", !lead.siteAudit.https],
                  ].map(([value, key, bad]) => (
                    <div key={String(key)}>
                      <p
                        className={cn(
                          "font-display text-2xl font-bold",
                          bad ? "text-destructive" : "text-primary",
                        )}
                      >
                        {String(value)}
                      </p>
                      <p className="text-xs text-muted-foreground">{String(key)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  Ainda não analisado. Leva uns 20 segundos e roda no PageSpeed do Google.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-sm font-semibold">Próximo toque</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Prospecção fria fecha no segundo e no terceiro contato, não no primeiro.
              </p>
              <p className="mt-4 text-sm">
                {lead.followUpAt ? (
                  <>
                    Agendado para{" "}
                    <b className="text-primary">
                      {new Date(lead.followUpAt).toLocaleDateString("pt-BR")}
                    </b>
                  </>
                ) : (
                  <span className="text-muted-foreground">Sem follow-up agendado.</span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[1, 3, 7, 14].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="goldline"
                    onClick={() => void setFollowUp(id, d)}
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> +{d}d
                  </Button>
                ))}
                {lead.followUpAt && (
                  <Button size="sm" variant="ghost" onClick={() => void setFollowUp(id, null)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </section>

            <CadencePanel lead={lead} />
            <IntelPanel lead={lead} />
          </div>
        </TabsContent>

        <TabsContent value="site" className="mt-5">
          {!lead.site || !content ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum site gerado ainda.</p>
              <Button
                variant="gold"
                className="mt-4"
                onClick={() => void generate()}
                disabled={generating}
              >
                <Sparkles className="h-4 w-4" /> Gerar site
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {lead.visits && lead.visits.views > 0 && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-success/40 bg-success/8 p-4 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-success">
                    <Eye className="h-4 w-4" /> O lead abriu este site
                  </span>
                  <span>
                    <b>{lead.visits.views}</b> visita(s)
                  </span>
                  {lead.visits.seconds > 0 && (
                    <span>
                      ficou <b>{lead.visits.seconds}s</b> na página
                    </span>
                  )}
                  {lead.visits.whatsappClicks > 0 && (
                    <span className="text-success">
                      clicou no WhatsApp <b>{lead.visits.whatsappClicks}x</b>
                    </span>
                  )}
                  {lead.visits.lastAt && (
                    <span className="text-muted-foreground">
                      última em {new Date(lead.visits.lastAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 p-4">
                <Rocket className="h-4 w-4 text-primary" />
                {lead.site.published && lead.site.url ? (
                  <>
                    <span className="text-sm">Publicado em</span>
                    <code className="rounded bg-background px-2 py-1 text-xs text-primary">
                      {lead.site.url}
                    </code>
                    <Button
                      size="sm"
                      variant="goldline"
                      onClick={() => {
                        void navigator.clipboard.writeText(lead.site!.url!);
                        toast.success("Link copiado");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={lead.site.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir site
                      </a>
                    </Button>
                    <Button size="sm" variant="gold" onClick={() => setTab("message")}>
                      Gerar abordagem
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Ainda em rascunho — publique para gerar um link que você pode mandar pro lead.
                  </span>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
                  <h3 className="text-sm font-semibold">Conteúdo</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Edite o conteúdo e a identidade visual. Cada alteração salva e atualiza a prévia
                    automaticamente.
                  </p>
                  <div className="space-y-3 border-b border-border pb-4">
                    <div>
                      <h3 className="text-sm font-semibold">Direção visual</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Ajuste as decisões principais sem precisar gerar o site novamente.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <VisualSelect
                        label="Preset"
                        value={
                          Object.entries(VISUAL_PRESETS).find(([, preset]) =>
                            ["layout", "typeface", "shape", "mode", "texture", "accent"].every(
                              (key) =>
                                content[key as keyof SiteSection] ===
                                preset[key as keyof SiteSection],
                            ),
                          )?.[0] ?? "custom"
                        }
                        options={["custom", ...Object.keys(VISUAL_PRESETS)]}
                        onChange={(value) => {
                          const preset = VISUAL_PRESETS[value];
                          if (preset) void patchSiteContent(lead.id, preset);
                        }}
                      />
                      <VisualSelect
                        label="Layout"
                        value={content.layout ?? "editorial"}
                        options={SITE_LAYOUTS}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, { layout: value as SiteSection["layout"] })
                        }
                      />
                      <VisualSelect
                        label="Tipografia"
                        value={content.typeface ?? "sans"}
                        options={SITE_TYPEFACES}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, {
                            typeface: value as SiteSection["typeface"],
                          })
                        }
                      />
                      <VisualSelect
                        label="Formato"
                        value={content.shape ?? "soft"}
                        options={["sharp", "soft", "round"]}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, {
                            shape: value as SiteSection["shape"],
                          })
                        }
                      />
                      <VisualSelect
                        label="Textura"
                        value={content.texture ?? "none"}
                        options={SITE_TEXTURES}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, {
                            texture: value as SiteSection["texture"],
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorField
                        label="Cor principal"
                        value={content.accent}
                        onChange={(accent) => void patchSiteContent(lead.id, { accent })}
                      />
                      <ColorField
                        label="Cor secundária"
                        value={content.secondary ?? content.accent}
                        onChange={(secondary) => void patchSiteContent(lead.id, { secondary })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <VisualSelect
                        label="Fundo"
                        value={content.mode ?? "light"}
                        options={["light", "dark"]}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, {
                            mode: value as SiteSection["mode"],
                          })
                        }
                      />
                      <VisualSelect
                        label="Animação"
                        value={content.motion ?? "rich"}
                        options={["subtle", "rich"]}
                        onChange={(value) =>
                          void patchSiteContent(lead.id, {
                            motion: value as SiteSection["motion"],
                          })
                        }
                      />
                    </div>
                  </div>
                  {blocks.length > 0 && (
                    <div className="space-y-2 border-b border-border pb-4">
                      <div>
                        <h3 className="text-sm font-semibold">Seções</h3>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Reordene ou oculte blocos sem gerar o site novamente.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {blocks.map((block, index) => (
                          <div
                            key={`${block.kind}-${index}`}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
                              block.enabled === false
                                ? "border-border/50 opacity-50"
                                : "border-border bg-background",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {index + 1}. {block.kind}
                              {block.variant ? ` · ${block.variant}` : ""}
                            </span>
                            <button
                              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...blocks];
                                [next[index - 1]!, next[index]!] = [next[index]!, next[index - 1]!];
                                void patchSiteContent(lead.id, { blocks: next });
                              }}
                              title="Mover para cima"
                            >
                              ↑
                            </button>
                            <button
                              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={index === blocks.length - 1}
                              onClick={() => {
                                const next = [...blocks];
                                [next[index]!, next[index + 1]!] = [next[index + 1]!, next[index]!];
                                void patchSiteContent(lead.id, { blocks: next });
                              }}
                              title="Mover para baixo"
                            >
                              ↓
                            </button>
                            <button
                              className="rounded p-1 text-muted-foreground hover:text-primary"
                              disabled={block.kind === "hero"}
                              onClick={() => {
                                const next = blocks.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, enabled: item.enabled === false }
                                    : item,
                                );
                                void patchSiteContent(lead.id, { blocks: next });
                              }}
                              title={block.enabled === false ? "Mostrar seção" : "Ocultar seção"}
                            >
                              {block.enabled === false ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Headline</Label>
                    <Input
                      value={content.headline}
                      onChange={(e) => void patchSiteContent(lead.id, { headline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subheadline</Label>
                    <Textarea
                      rows={2}
                      value={content.subheadline}
                      onChange={(e) =>
                        void patchSiteContent(lead.id, { subheadline: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Textarea
                      rows={3}
                      value={content.about}
                      onChange={(e) => void patchSiteContent(lead.id, { about: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Serviços (um por linha)</Label>
                    <Textarea
                      rows={4}
                      value={content.services.join("\n")}
                      onChange={(e) =>
                        void patchSiteContent(lead.id, { services: e.target.value.split("\n") })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CTA</Label>
                    <Input
                      value={content.cta}
                      onChange={(e) => void patchSiteContent(lead.id, { cta: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input
                      value={lead.phone ?? ""}
                      onChange={(e) => void updateLead(lead.id, { phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold">Código</h3>
                    <p className="text-[11px] text-muted-foreground">
                      O site é um HTML único, sem dependências. Baixe e abra no VS Code para editar
                      à mão — depois publique o arquivo pelo seu próprio deploy.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="goldline"
                        className="flex-1"
                        onClick={() => {
                          downloadSiteHtml(lead);
                          toast.success(`${lead.site!.slug}.html baixado`);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Baixar HTML
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Copiar o HTML"
                        onClick={() => {
                          void copySiteHtml(lead).then(() => toast.success("HTML copiado"));
                        }}
                      >
                        <Code2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="gold"
                      className="flex-1"
                      onClick={() => void publish()}
                      disabled={publishing}
                    >
                      <Rocket className="h-4 w-4" />
                      {publishing
                        ? "Publicando..."
                        : lead.site.published
                          ? "Republicar"
                          : "Publicar"}
                    </Button>
                    <Button
                      variant="goldline"
                      className="flex-1"
                      onClick={() => void publishGithub()}
                      disabled={publishingGithub}
                      title="Enviar o index.html para o repositório GitHub selecionado"
                    >
                      <Github className="h-4 w-4" />
                      {publishingGithub ? "Enviando..." : "GitHub"}
                    </Button>
                    <Button
                      variant="goldline"
                      onClick={() => void generate()}
                      disabled={generating}
                      title="Gerar novamente"
                    >
                      <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(lead.site.variants?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Versões:</span>
                      {[
                        "A",
                        ...(lead.site.variants ?? []).map((_, i) => String.fromCharCode(66 + i)),
                      ].map((name, i) => (
                        <button
                          key={name}
                          onClick={() => setVariant(i)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            variant === i
                              ? "border-primary/50 bg-primary/12 text-primary"
                              : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Versão {name}
                        </button>
                      ))}
                      {variant > 0 && (
                        <Button
                          size="sm"
                          variant="goldline"
                          onClick={() => {
                            void chooseVariant(lead.id, variant - 1).then(() => {
                              setVariant(0);
                              toast.success("Versão escolhida — publique para atualizar o link");
                            });
                          }}
                        >
                          Usar esta versão
                        </Button>
                      )}
                    </div>
                  )}
                  <QualityChecklist content={content} lead={lead} />
                  <SitePreview
                    lead={lead}
                    html={
                      variant === 0
                        ? lead.site.html
                        : (lead.site.variants?.[variant - 1]?.html ?? lead.site.html)
                    }
                    template={lead.site.template}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="diagnostic" className="mt-5 space-y-4">
          {!lead.diagnostic ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum diagnóstico gerado para este lead ainda.
              </p>
              <Button
                variant="goldline"
                className="mt-4"
                onClick={() => void generateDiagnosticReport()}
                disabled={generatingDiagnostic}
              >
                <Sparkles className="h-4 w-4" />{" "}
                {generatingDiagnostic ? "Gerando..." : "Gerar diagnóstico"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void generateDiagnosticReport()}
                  disabled={generatingDiagnostic}
                >
                  <RefreshCw className="h-4 w-4" />{" "}
                  {generatingDiagnostic ? "Gerando..." : "Gerar de novo"}
                </Button>
                <Button
                  variant="goldline"
                  size="sm"
                  onClick={() => void publishDiagnosticReport()}
                  disabled={publishingDiagnostic}
                >
                  <Rocket className="h-4 w-4" />{" "}
                  {publishingDiagnostic
                    ? "Publicando..."
                    : lead.diagnostic.published
                      ? "Republicar"
                      : "Publicar"}
                </Button>
                {lead.diagnostic.url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={lead.diagnostic.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const w = window.open("", "_blank");
                    if (!w || !lead.diagnostic) return;
                    w.document.write(lead.diagnostic.html);
                    w.document.close();
                    w.print();
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>
              </div>
              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center gap-3">
                  <ScoreRing score={lead.diagnostic.content.overallScore} />
                  <div>
                    <p className="text-sm font-semibold">
                      Nota da presença digital: {lead.diagnostic.content.overallScore}/100
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.diagnostic.published ? "Publicado" : "Ainda não publicado"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground/80">{lead.diagnostic.content.summary}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {lead.diagnostic.content.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
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
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs transition-colors",
                        tone === t
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Canal</Label>
                <div className="mt-2 flex gap-2">
                  {(["WhatsApp", "Email"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs transition-colors",
                        channel === c
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {!lead.site?.published && (
                <p className="text-[11px] text-muted-foreground">
                  O site ainda não está publicado, então a mensagem sai sem link. Publique antes
                  para a abordagem ficar completa.
                </p>
              )}
              <Button
                variant="gold"
                className="w-full"
                onClick={() => void write()}
                disabled={writing}
              >
                <Sparkles className="h-4 w-4" />
                {writing ? "Escrevendo..." : lead.message ? "Gerar novamente" : "Gerar abordagem"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              {lead.message ? (
                <>
                  <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs text-primary">
                        {lead.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm">{lead.name}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.message.channel}</p>
                      </div>
                    </div>
                    <Textarea
                      rows={12}
                      value={lead.message.text}
                      onChange={(e) =>
                        void updateLead(lead.id, {
                          message: { ...lead.message!, text: e.target.value },
                        })
                      }
                      className="resize-none border-none bg-transparent text-sm focus-visible:ring-0"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                      variant="goldline"
                      onClick={() => {
                        void navigator.clipboard.writeText(lead.message!.text);
                        toast.success("Mensagem copiada");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    <Button
                      variant="gold"
                      disabled={!whatsappNumber}
                      title={
                        whatsappNumber ? "Abre a conversa já com o texto" : "Lead sem telefone"
                      }
                      onClick={() => {
                        // One click: opens the chat with the text typed, marks
                        // the lead as contacted and schedules the next touch.
                        void sendWhatsApp(lead.id).catch((err: unknown) =>
                          toast.error(err instanceof Error ? err.message : "Falha ao abrir."),
                        );
                      }}
                    >
                      Enviar no WhatsApp <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Escolha um tom e gere a abordagem.
                </p>
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
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleString("pt-BR")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cadence                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Enrolling is the difference between "I sent one message" and "this business
 * hears from me three times over ten days, unless it answers". Everything that
 * stops the cadence — a reply, a click on the page — happens without the seller
 * having to remember anything, so the panel's job is mostly to show state.
 */
function CadencePanel({ lead }: { lead: Lead }) {
  const { state, enrollLead, stopCadence, whatsappReady } = useStore();
  const [busy, setBusy] = useState(false);

  const enrollment = lead.enrollment;
  const sequence = state.sequences.find((s) => s.id === enrollment?.sequenceId);
  const steps = sequence?.steps ?? DEFAULT_SEQUENCE_STEPS;
  const active = enrollment?.status === "active";

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Workflow className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Cadência</h2>
        {active && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
            Passo {Math.min(enrollment.step + 1, steps.length)} de {steps.length}
          </span>
        )}
      </div>

      {active ? (
        <>
          <ol className="mt-4 space-y-1.5">
            {steps.map((step, i) => {
              const done = i < enrollment.step;
              const current = i === enrollment.step;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs",
                    current ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      done
                        ? "bg-primary/20 text-primary"
                        : current
                          ? "bg-primary text-background"
                          : "bg-muted",
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span>{step.tone}</span>
                  <span className="text-[11px]">
                    {i === 0 ? "na hora" : `+${step.days} dia(s)`}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="mt-3 text-xs text-muted-foreground">
            Próximo toque{" "}
            <b className="text-primary">
              {new Date(enrollment.nextAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
            . Se o lead responder ou clicar no CTA da página, a cadência para sozinha.
          </p>

          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => void stopCadence(lead.id, "Encerrada manualmente")}
          >
            Parar cadência
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {enrollment?.status === "stopped"
              ? `Cadência encerrada: ${enrollment.stoppedReason ?? "manualmente"}.`
              : enrollment?.status === "done"
                ? "Cadência concluída — todos os toques foram enviados."
                : "Três toques ao longo de dez dias, com tons diferentes. Para sozinha na resposta."}
          </p>
          {!whatsappReady && (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning">
              Sem instância conectada, cada toque ainda vai pedir um clique seu.
            </p>
          )}
          <Button
            size="sm"
            variant="gold"
            className="mt-4"
            disabled={busy || !lead.phone || lead.neverContact}
            onClick={() => {
              setBusy(true);
              void enrollLead(lead.id)
                .then(() => toast.success("Lead em cadência — primeiro toque a caminho"))
                .catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : "Não foi possível."),
                )
                .finally(() => setBusy(false));
            }}
          >
            <Workflow className="h-3.5 w-3.5" />
            {enrollment ? "Reiniciar cadência" : "Colocar em cadência"}
          </Button>
          {!lead.phone && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Este lead não tem telefone — adicione um acima para usar cadência.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Enrichment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The facts that turn a generic opener into one this business cannot ignore.
 * Everything here is derived from the lead's own site and the public registry,
 * so it costs nothing and can run on every lead automatically.
 */
function IntelPanel({ lead }: { lead: Lead }) {
  const { enrich, setNeverContact } = useStore();
  const [busy, setBusy] = useState(false);
  const intel = lead.enriched;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Ângulos de abordagem</h2>
        </div>
        <Button
          size="sm"
          variant="goldline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void enrich(lead.id)
              .then(() => toast.success("Lead enriquecido"))
              .catch((e: unknown) =>
                toast.error(e instanceof Error ? e.message : "Não foi possível enriquecer."),
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Lendo..." : intel?.checkedAt ? "Atualizar" : "Enriquecer"}
        </Button>
      </div>

      {intel?.angles?.length ? (
        <ul className="mt-4 space-y-2">
          {intel.angles.map((angle, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-foreground/85">{angle}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Lê o site atual do lead (plataforma, ano do rodapé, e-mail público) e, se achar o CNPJ no
          rodapé, busca o registro na Receita. Nenhuma chave de API nova é necessária.
        </p>
      )}

      {(intel?.legalName || intel?.cnpj || lead.email) && (
        <dl className="mt-5 space-y-1.5 border-t border-border/50 pt-4 text-xs">
          {intel?.legalName && <Row label="Razão social" value={intel.legalName} />}
          {intel?.cnpj && <Row label="CNPJ" value={intel.cnpj} />}
          {intel?.openedAt && (
            <Row label="Aberta em" value={new Date(intel.openedAt).toLocaleDateString("pt-BR")} />
          )}
          {intel?.size && <Row label="Porte" value={intel.size} />}
          {lead.email && <Row label="E-mail" value={lead.email} />}
        </dl>
      )}

      <label className="mt-5 flex items-center gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <Switch
          checked={lead.neverContact ?? false}
          onCheckedChange={(v) => void setNeverContact(lead.id, v)}
        />
        Não contatar — fica de fora de toda automação
      </label>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
