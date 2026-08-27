import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-gold)] shadow-[var(--shadow-gold)]">
        <svg
          viewBox="0 0 24 24"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path
            d="M12 2 4 13h6l-1 9 9-12h-6l1-8Z"
            className="text-primary-foreground"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[1.05rem] font-bold tracking-tight">
          Lead<span className="text-primary">Forge</span>
        </span>
      )}
    </span>
  );
}
