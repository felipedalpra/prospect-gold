import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { ScoreReason } from "@/lib/types";

export function scoreLabel(score: number) {
  if (score >= 75) return { label: "Alta oportunidade", icon: "🔥" };
  if (score >= 50) return { label: "Média oportunidade", icon: "⚡" };
  return { label: "Baixa oportunidade", icon: "•" };
}

export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={5}
          className="fill-none stroke-border"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={5}
          strokeLinecap="round"
          className="fill-none stroke-primary"
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c - (c * score) / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            filter: "drop-shadow(0 0 8px color-mix(in oklab, var(--gold) 60%, transparent))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold text-primary">{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function ScoreBadge({
  score,
  reasons,
  compact,
}: {
  score: number;
  reasons?: ScoreReason[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { label, icon } = scoreLabel(score);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => reasons && setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
          score >= 75
            ? "border-primary/40 bg-primary/10 text-primary"
            : score >= 50
              ? "border-champagne/30 bg-champagne/10 text-champagne"
              : "border-border bg-surface-2 text-muted-foreground",
          reasons && "cursor-pointer hover:border-primary/70",
        )}
      >
        <span className="tabular-nums">{score}</span>
        {!compact && (
          <span className="font-normal opacity-80">
            {icon} {label}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && reasons && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute left-0 top-full z-30 mt-2 w-60 rounded-xl glass p-3 shadow-[var(--shadow-elevated)]"
          >
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Como calculamos</p>
            <ul className="space-y-1.5">
              {reasons.map((r) => (
                <li key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80">{r.label}</span>
                  <span className="font-semibold text-primary">+{r.points}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
