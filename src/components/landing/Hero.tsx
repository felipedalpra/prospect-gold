import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";

const QUERY = "Academias em Porto Alegre";

const PIPELINE = [
  { label: "empresas encontradas", value: 137 },
  { label: "sem site", value: 46 },
  { label: "com telefone", value: 31 },
  { label: "oportunidades de alta prioridade", value: 18 },
  { label: "sites gerados", value: 10 },
  { label: "abordagens prontas", value: 10 },
];

function TypedQuery({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setText(QUERY.slice(0, i));
      if (i >= QUERY.length) {
        clearInterval(id);
        setTimeout(onDone, 400);
      }
    }, 55);
    return () => clearInterval(id);
  }, [onDone]);
  return (
    <span>
      {text}
      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
    </span>
  );
}

function HeroConsole() {
  const [phase, setPhase] = useState(-1);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (phase < 0) return;
    if (phase >= PIPELINE.length) {
      const id = setTimeout(() => {
        setPhase(-1);
        setKey((k) => k + 1);
      }, 3200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase((p) => p + 1), 620);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <div className="relative w-full max-w-md rounded-2xl glass-gold p-5 shadow-[var(--shadow-elevated)]">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 text-[11px] text-muted-foreground">
          leadforge — prospecção ao vivo
        </span>
      </div>

      <div className="rounded-lg border border-primary/25 bg-background/60 px-3 py-2.5 font-mono text-sm text-foreground">
        <span className="mr-2 text-primary">›</span>
        <TypedQuery key={key} onDone={() => setPhase(0)} />
      </div>

      <div className="mt-4 space-y-2">
        {PIPELINE.map((step, i) => (
          <motion.div
            key={`${key}-${step.label}`}
            initial={{ opacity: 0, x: -12, filter: "blur(6px)" }}
            animate={
              phase > i
                ? { opacity: 1, x: 0, filter: "blur(0px)" }
                : { opacity: 0, x: -12, filter: "blur(6px)" }
            }
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-2/60 px-3 py-2"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="font-display text-lg font-bold text-primary tabular-nums">
              {step.value}
            </span>
            <span className="text-xs text-muted-foreground">{step.label}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        animate={{ opacity: phase >= PIPELINE.length ? 1 : 0.35 }}
        className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Campanha pronta para prospecção
      </motion.div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.3);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const glowX = useTransform(sx, (v) => `${v * 100}%`);
  const glowY = useTransform(sy, (v) => `${v * 100}%`);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yText = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const yCard = useTransform(scrollYProgress, [0, 1], [0, -170]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <motion.div
        style={{ left: glowX, top: glowY }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-primary/12 blur-[120px]"
      />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 animate-pulse-glow rounded-full bg-primary/10 blur-[130px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 animate-pulse-glow rounded-full bg-champagne/10 blur-[140px]" />

      <motion.div
        style={{ opacity: fade }}
        className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
      >
        <motion.div style={{ y: yText }}>
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs text-primary"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Prospecção automatizada com IA
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-balance text-5xl font-bold leading-[1.03] md:text-6xl lg:text-7xl"
          >
            Transforme o Google Maps em uma{" "}
            <span className="text-gradient-gold">máquina de clientes</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="mt-6 max-w-xl text-lg text-muted-foreground"
          >
            Encontre empresas que precisam do seu serviço, gere sites personalizados automaticamente
            e comece sua prospecção em minutos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button variant="gold" size="xl" asChild>
              <Link to="/auth">
                Encontrar oportunidades <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="goldline" size="xl" asChild>
              <a href="#como-funciona">
                <PlayCircle className="h-4 w-4" /> Ver como funciona
              </a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground"
          >
            <span>+120 nichos mapeados</span>
            <span className="text-primary/30">/</span>
            <span>Sites gerados em segundos</span>
            <span className="text-primary/30">/</span>
            <span>Abordagem pronta para enviar</span>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: yCard }}
          initial={{ opacity: 0, y: 40, rotateY: -12 }}
          animate={{ opacity: 1, y: 0, rotateY: -6 }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-end [perspective:1400px]"
        >
          <div className="animate-float [transform-style:preserve-3d]">
            <HeroConsole />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
