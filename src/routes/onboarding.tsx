import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — LeadForge" },
      {
        name: "description",
        content:
          "Configure seu perfil de prospecção e encontre seus primeiros clientes com o LeadForge.",
      },
      { property: "og:title", content: "Onboarding — LeadForge" },
      { property: "og:description", content: "Três perguntas rápidas para começar a prospectar." },
    ],
  }),
  component: Onboarding,
});

const SELLS = ["Sites", "Landing Pages", "Automação", "Gestão de tráfego", "Social Media"];
const TARGETS = ["Dentistas", "Academias", "Clínicas", "Barbearias", "Restaurantes", "Outro"];

function Onboarding() {
  const { state, setProfile } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sells, setSells] = useState(state.profile.sells);
  const [targets, setTargets] = useState<string[]>(state.profile.targets);
  const [location, setLocation] = useState(state.profile.location);

  const steps = [
    { title: "O que você vende?", sub: "Assim personalizamos suas abordagens." },
    { title: "Quem você quer prospectar?", sub: "Escolha um ou mais nichos." },
    { title: "Onde você vende?", sub: "Cidade e estado da sua atuação." },
  ];

  async function finish() {
    await setProfile({ sells, targets, location, onboarded: true });
    // Keys come first — nothing in the app runs without them.
    await navigate({ to: "/app/configuracoes" });
  }

  const current = steps[step]!;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 animate-pulse-glow rounded-full bg-primary/10 blur-[140px]" />

      <Logo className="relative mb-10" />

      <div className="relative w-full max-w-xl">
        <div className="mb-8 flex items-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.5 }}
                className="h-full bg-[image:var(--gradient-gold)]"
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -24, filter: "blur(8px)" }}
            transition={{ duration: 0.45 }}
            className="rounded-2xl glass p-8"
          >
            <p className="text-xs uppercase tracking-widest text-primary">Passo {step + 1} de 3</p>
            <h1 className="mt-2 text-3xl font-bold">{current.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{current.sub}</p>

            <div className="mt-7">
              {step === 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {SELLS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSells(s)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm transition-all",
                        sells === s
                          ? "border-primary/60 bg-primary/12 text-primary shadow-[var(--shadow-gold)]"
                          : "border-border bg-surface-2 text-foreground/75 hover:border-primary/35",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {TARGETS.map((t) => {
                    const active = targets.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          setTargets(active ? targets.filter((x) => x !== t) : [...targets, t])
                        }
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all",
                          active
                            ? "border-primary/60 bg-primary/12 text-primary"
                            : "border-border bg-surface-2 text-foreground/75 hover:border-primary/35",
                        )}
                      >
                        {t}
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {step === 2 && (
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Porto Alegre, RS"
                  className="h-12 text-base"
                />
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground",
                  step === 0 && "invisible",
                )}
              >
                Voltar
              </button>
              <Button
                variant="gold"
                size="lg"
                onClick={() => (step === 2 ? void finish() : setStep((s) => s + 1))}
                disabled={(step === 1 && targets.length === 0) || (step === 2 && !location)}
              >
                {step === 2 ? "Vamos encontrar seus primeiros clientes" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
