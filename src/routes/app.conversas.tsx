import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { cn } from "@/lib/utils";
import type { Lead, OutreachMessage } from "@/lib/types";
import {
  ArrowUpRight,
  Flame,
  MessageSquare,
  Search,
  AlertCircle,
  CheckCheck,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/app/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas — LeadForge" },
      {
        name: "description",
        content: "Tudo que você mandou e tudo que responderam, em um lugar só.",
      },
      { property: "og:title", content: "Conversas — LeadForge" },
      { property: "og:description", content: "A resposta do lead cai aqui dentro." },
    ],
  }),
  component: Conversations,
});

function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Conversations() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // One row per lead, ordered by the newest message — an inbox, not a log.
  const threads = useMemo(() => {
    const byLead = new Map<string, OutreachMessage[]>();
    for (const m of state.messages) {
      byLead.set(m.leadId, [...(byLead.get(m.leadId) ?? []), m]);
    }
    return [...byLead.entries()]
      .map(([leadId, messages]) => {
        const lead = state.leads.find((l) => l.id === leadId);
        const last = messages[0];
        return lead && last
          ? {
              lead,
              messages,
              last,
              unanswered: messages.some((m) => m.direction === "in"),
            }
          : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter(
        (t) =>
          !q ||
          t.lead.name.toLowerCase().includes(q.toLowerCase()) ||
          t.lead.city.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => {
        // Anyone who answered outranks everything else.
        if (a.unanswered !== b.unanswered) return a.unanswered ? -1 : 1;
        return +new Date(b.last.createdAt) - +new Date(a.last.createdAt);
      });
  }, [state.messages, state.leads, q]);

  const active = threads.find((t) => t.lead.id === selected) ?? threads[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Conversas</p>
          <h1 className="mt-1 text-3xl font-bold">Caixa de entrada</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tudo que saiu da sua instância e tudo que responderam. Quem respondeu sobe para o topo e
            sai da cadência automaticamente.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar negócio"
            className="w-64 pl-9"
          />
        </div>
      </header>

      {threads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma conversa ainda. Toda mensagem enviada pelo app aparece aqui — e, com o webhook
          configurado em Configurações, as respostas também.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <div className="max-h-[36rem] space-y-1.5 overflow-y-auto pr-1">
            {threads.map((t) => (
              <button
                key={t.lead.id}
                onClick={() => setSelected(t.lead.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  active?.lead.id === t.lead.id
                    ? "border-primary/40 bg-primary/8"
                    : "border-border bg-surface hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.lead.name}</span>
                  {t.unanswered && <Flame className="h-3 w-3 shrink-0 text-primary" />}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {when(t.last.createdAt)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {t.last.direction === "in" ? "↩ " : ""}
                  {t.last.body}
                </p>
              </button>
            ))}
          </div>

          {active && <Thread lead={active.lead} messages={active.messages} />}
        </div>
      )}
    </div>
  );
}

function Thread({ lead, messages }: { lead: Lead; messages: OutreachMessage[] }) {
  const { sendWhatsApp, stopCadence } = useStore();
  // Stored newest-first; a conversation reads the other way round.
  const ordered = [...messages].reverse();

  return (
    <div className="flex max-h-[36rem] flex-col rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <ScoreBadge score={lead.score} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {lead.category} · {lead.city} · {lead.stage}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lead.enrollment?.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void stopCadence(lead.id, "Encerrada manualmente")}
            >
              Parar cadência
            </Button>
          )}
          <Button variant="goldline" size="sm" onClick={() => void sendWhatsApp(lead.id)}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Responder
          </Button>
          <Link to="/app/leads/$id" params={{ id: lead.id }}>
            <Button variant="ghost" size="icon" title="Abrir lead">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {ordered.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", m.direction === "in" ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.direction === "in"
                  ? "rounded-bl-sm bg-muted text-foreground"
                  : m.status === "failed"
                    ? "rounded-br-sm border border-destructive/40 bg-destructive/10"
                    : "rounded-br-sm bg-primary/15",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {m.direction === "out" && m.tone && <span>{m.tone}</span>}
                <span>{when(m.createdAt)}</span>
                {m.direction === "out" &&
                  (m.status === "failed" ? (
                    <AlertCircle className="h-3 w-3 text-destructive" />
                  ) : m.status === "queued" ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <CheckCheck className="h-3 w-3" />
                  ))}
              </div>
              {m.error && <p className="mt-1 text-[10px] text-destructive">{m.error}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
