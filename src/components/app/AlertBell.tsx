import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types";
import { Bell, Flame, MessageCircle, Eye, Cog } from "lucide-react";

/**
 * The signal that changes what a seller does with their next ten minutes. These
 * alerts are written by Postgres the moment a lead opens the page or answers —
 * no tab needs to have been open for it to have happened.
 */

const ICONS: Record<Alert["kind"], typeof Bell> = {
  hot: Flame,
  reply: MessageCircle,
  engagement: Eye,
  system: Cog,
};

const TINTS: Record<Alert["kind"], string> = {
  hot: "text-primary",
  reply: "text-primary",
  engagement: "text-foreground",
  system: "text-muted-foreground",
};

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export function AlertBell() {
  const { state, dismissAlerts } = useStore();
  const unread = useMemo(() => state.alerts.filter((a) => !a.read), [state.alerts]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Alertas">
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unread.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-background"
              >
                {unread.length > 9 ? "9+" : unread.length}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold">Alertas</span>
          {unread.length > 0 && (
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => void dismissAlerts(unread.map((a) => a.id))}
            >
              Marcar como lidos
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {state.alerts.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Nada por aqui ainda. Assim que um lead abrir a página que você enviou, o aviso aparece
              aqui — mesmo que você esteja com o app fechado na hora.
            </p>
          )}

          {state.alerts.map((alert) => {
            const Icon = ICONS[alert.kind];
            const row = (
              <div
                className={cn(
                  "flex gap-3 border-b border-border/50 px-4 py-3 text-xs last:border-0",
                  !alert.read && "bg-primary/5",
                )}
              >
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", TINTS[alert.kind])} />
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">{alert.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{ago(alert.createdAt)}</p>
                </div>
              </div>
            );

            return alert.leadId ? (
              <Link
                key={alert.id}
                to="/app/leads/$id"
                params={{ id: alert.leadId }}
                onClick={() => void dismissAlerts([alert.id])}
                className="block transition-colors hover:bg-muted/40"
              >
                {row}
              </Link>
            ) : (
              <div key={alert.id}>{row}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
