import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";
import { Counter } from "@/components/shared/Counter";
import { ScoreRing } from "@/components/shared/ScoreBadge";
import { Logo } from "@/components/shared/Logo";
import { ArrowRight, Check, Copy, MessageCircle } from "lucide-react";

const rise = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

const MANUAL = [
  "Pesquisar empresa no Google Maps",
  "Abrir perfil",
  "Ver se tem site",
  "Copiar telefone",
  "Criar landing page",
  "Fazer deploy",
  "Escrever mensagem",
  "Salvar lead em planilha",
];

export function Problem() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const converge = useTransform(scrollYProgress, [0.4, 0.85], [0, 1]);

  return (
    <section id="problema" ref={ref} className="relative py-32">
      <div className="mx-auto max-w-6xl px-5">
        <motion.h2 {...rise} className="max-w-2xl text-4xl font-bold md:text-5xl">
          Você ainda faz <span className="text-gradient-gold">tudo isso manualmente?</span>
        </motion.h2>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MANUAL.map((t, i) => {
            const x = useTransform(converge, [0, 1], [0, (i % 4) * -40 + 60]);
            const y = useTransform(converge, [0, 1], [0, Math.floor(i / 4) * -30 + 20]);
            const scale = useTransform(converge, [0, 1], [1, 0.86]);
            const opacity = useTransform(converge, [0, 1], [1, 0.35]);
            return (
              <motion.div
                key={t}
                style={{ x, y, scale, opacity }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.07, duration: 0.6 }}
                className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground/80"
              >
                <span className="mb-2 block text-xs text-muted-foreground">0{i + 1}</span>
                {t}
              </motion.div>
            );
          })}
        </div>

        <motion.p {...rise} className="mt-14 text-center text-2xl text-muted-foreground">
          Agora imagine transformar tudo isso em{" "}
          <span className="text-primary">um único fluxo.</span>
        </motion.p>
      </div>
    </section>
  );
}

const FLOW = ["Google Maps", "Leads", "IA", "Site", "Prospecção"];

export function Transformation() {
  return (
    <section className="relative overflow-hidden py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[150px]" />
      <div className="relative mx-auto max-w-6xl px-5 text-center">
        <motion.h2 {...rise} className="text-4xl font-bold md:text-6xl">
          Um processo. <span className="text-gradient-gold">Uma plataforma.</span>
        </motion.h2>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-3 md:gap-5">
          {FLOW.map((f, i) => (
            <div key={f} className="flex items-center gap-3 md:gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.18, duration: 0.6 }}
                className="rounded-xl glass-gold px-5 py-3 text-sm font-medium"
              >
                {f}
              </motion.div>
              {i < FLOW.length - 1 && (
                <motion.svg width="44" height="8" viewBox="0 0 44 8" className="hidden md:block">
                  <motion.line
                    x1="0" y1="4" x2="44" y2="4"
                    className="stroke-primary/60"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.18 + 0.2, duration: 0.6 }}
                  />
                </motion.svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepShell({
  index, title, desc, children,
}: { index: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-10 py-20 lg:grid-cols-2">
      <motion.div {...rise}>
        <span className="inline-flex h-8 items-center rounded-full border border-primary/30 bg-primary/8 px-3 text-xs text-primary">
          Passo {index}
        </span>
        <h3 className="mt-5 text-3xl font-bold md:text-4xl">{title}</h3>
        <p className="mt-3 max-w-md text-muted-foreground">{desc}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 50, rotateX: 8 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="[perspective:1200px]"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-20">
      <div className="mx-auto max-w-6xl px-5">
        <motion.p {...rise} className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          Como funciona
        </motion.p>

        <StepShell index={1} title="Encontre oportunidades" desc="Escolha segmento, localização e filtros. Os resultados aparecem em tempo real.">
          <div className="rounded-2xl glass p-5">
            <div className="grid gap-2 text-sm">
              {["Dentistas", "Porto Alegre", "Sem site", "Nota acima de 4", "20+ avaliações"].map((f, i) => (
                <motion.div
                  key={f}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
                >
                  <Check className="h-3.5 w-3.5 text-primary" /> {f}
                </motion.div>
              ))}
            </div>
            <p className="mt-4 font-display text-3xl font-bold text-primary">
              <Counter to={47} /> <span className="text-sm font-normal text-muted-foreground">empresas qualificadas</span>
            </p>
          </div>
        </StepShell>

        <StepShell index={2} title="Descubra quem realmente vale abordar" desc="Cada empresa recebe um Opportunity Score com o porquê da nota.">
          <div className="flex flex-wrap items-center gap-8 rounded-2xl glass p-6">
            <div className="text-center">
              <ScoreRing score={92} size={120} />
              <p className="mt-2 text-sm text-primary">🔥 Alta oportunidade</p>
              <p className="text-xs text-muted-foreground">Clínica Sorriso</p>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {[["Sem site", 30], ["4.8 estrelas", 15], ["132 avaliações", 15], ["Telefone disponível", 10], ["Instagram ativo", 10], ["Segmento relevante", 10]].map(([l, p], i) => (
                <motion.li
                  key={l as string}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between border-b border-border/50 pb-1.5"
                >
                  <span className="text-foreground/80">{l}</span>
                  <span className="font-semibold text-primary">+{p}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </StepShell>

        <StepShell index={3} title="Gere um site em segundos" desc="A IA monta uma landing page personalizada com base nos dados reais do negócio.">
          <div className="rounded-2xl glass p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="rounded-lg bg-surface-2 px-3 py-1.5">Clínica Sorriso</span>
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="text-primary"
              >
                Generating...
              </motion.span>
              <span className="rounded-lg bg-primary/12 px-3 py-1.5 text-primary">Site completo</span>
            </div>
            <div className="mt-5 space-y-2">
              {["Hero", "Serviços", "Sobre", "Avaliações", "Localização", "CTA"].map((s, i) => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  whileInView={{ opacity: 1, scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.16, duration: 0.5 }}
                  className="origin-left rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm"
                >
                  {s}
                </motion.div>
              ))}
            </div>
          </div>
        </StepShell>

        <StepShell index={4} title="Sua abordagem já está pronta" desc="Mensagem personalizada com os dados da empresa, pronta para enviar no WhatsApp.">
          <div className="mx-auto max-w-md rounded-2xl glass p-5">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs text-primary">CS</span>
              <div><p className="text-sm">Clínica Sorriso</p><p className="text-[11px] text-primary">online</p></div>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
              className="whitespace-pre-line rounded-xl rounded-tl-none bg-surface-2 p-3 text-[13px] leading-relaxed text-foreground/85"
            >
              {`Oi! Tudo bem?\n\nEncontrei a Clínica Sorriso pesquisando clínicas em Porto Alegre e vi que vocês possuem nota 4,8 e mais de 130 avaliações no Google.\n\nPercebi que vocês ainda não possuem um site próprio e acabei criando uma ideia de como poderia ficar:\n\n[visualizar demonstração]\n\nSe fizer sentido, posso te explicar como funciona.`}
            </motion.p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="goldline" className="flex-1"><Copy className="h-3.5 w-3.5" /> Copiar mensagem</Button>
              <Button size="sm" variant="gold" className="flex-1"><MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp</Button>
            </div>
          </div>
        </StepShell>

        <StepShell index={5} title="Acompanhe tudo em um único lugar" desc="Um CRM Kanban feito para prospecção: do primeiro contato à venda.">
          <div className="flex gap-2 overflow-hidden rounded-2xl glass p-4">
            {["Novo", "Site criado", "Contatado", "Respondeu", "Reunião", "Proposta", "Venda"].map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: [24, -6, 0] }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.7 }}
                className="w-24 shrink-0 rounded-lg border border-border bg-surface-2 p-2"
              >
                <p className="mb-2 text-[10px] text-muted-foreground">{c}</p>
                {Array.from({ length: Math.max(1, 4 - i) }).map((_, j) => (
                  <div key={j} className="mb-1.5 h-6 rounded bg-primary/10" />
                ))}
              </motion.div>
            ))}
          </div>
        </StepShell>
      </div>
    </section>
  );
}

const SEARCH_FLOW = [
  { v: 100, l: "empresas encontradas" },
  { v: 58, l: "possuem site" },
  { v: 42, l: "sem site" },
  { v: 34, l: "possuem telefone" },
  { v: 22, l: "oportunidades relevantes" },
  { v: 10, l: "sites gerados" },
  { v: 10, l: "mensagens prontas" },
];

export function OneSearch() {
  return (
    <section id="uma-busca" className="relative overflow-hidden py-32">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 animate-pulse-glow rounded-full bg-primary/10 blur-[160px]" />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <motion.div {...rise} className="mx-auto w-full max-w-md rounded-xl glass-gold px-5 py-4 text-left font-mono text-sm">
          <span className="mr-2 text-primary">›</span>Academias em Florianópolis
        </motion.div>

        <div className="mt-12 space-y-3">
          {SEARCH_FLOW.map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="mx-auto flex max-w-md items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3"
              style={{ width: `${100 - i * 5}%` }}
            >
              <span className="font-display text-2xl font-bold text-primary tabular-nums">
                <Counter to={s.v} />
              </span>
              <span className="text-sm text-muted-foreground">{s.l}</span>
            </motion.div>
          ))}
        </div>

        <motion.h2 {...rise} className="mt-16 text-3xl font-bold md:text-5xl">
          De uma busca a uma <span className="text-gradient-gold">campanha inteira.</span>
        </motion.h2>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-32">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-96 bg-primary/8 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <motion.h2 {...rise} className="text-4xl font-bold md:text-6xl">
          Transforme prospecção manual em uma{" "}
          <span className="text-gradient-gold">máquina de oportunidades.</span>
        </motion.h2>
        <motion.div {...rise} className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variant="gold" size="xl" asChild>
            <Link to="/auth">Encontrar oportunidades <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="goldline" size="xl" asChild>
            <Link to="/app">Ver o dashboard</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-xs text-muted-foreground">
        <Logo />
        <p>© {new Date().getFullYear()} LeadForge. Prospecção automatizada com IA.</p>
      </div>
    </footer>
  );
}
