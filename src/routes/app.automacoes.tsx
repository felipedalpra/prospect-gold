import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SEQUENCE_STEPS,
  TONES,
  type Schedule,
  type Sequence,
  type SequenceStep,
  type Tone,
} from "@/lib/types";
import {
  CalendarClock,
  Clock,
  Plus,
  Repeat,
  Trash2,
  Workflow,
  Zap,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/app/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — LeadForge" },
      {
        name: "description",
        content: "Cadências de follow-up e prospecção recorrente que rodam sozinhas.",
      },
      { property: "og:title", content: "Automações — LeadForge" },
      { property: "og:description", content: "Deixe a esteira rodando sem você." },
    ],
  }),
  component: Automations,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function Automations() {
  const { state, whatsappReady } = useStore();

  const enrolled = useMemo(
    () => state.leads.filter((l) => l.enrollment?.status === "active").length,
    [state.leads],
  );

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Automações</p>
        <h1 className="mt-1 text-3xl font-bold">A esteira rodando sem você</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Uma cadência decide quantas vezes e com que tom você insiste. Um agendamento decide de
          onde vêm os leads novos. Juntos, o trabalho de segunda-feira já está feito quando você
          abre o app.
        </p>
      </header>

      {!whatsappReady && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Sem uma instância de WhatsApp conectada, as cadências param no passo de{" "}
            <strong>abrir a conversa</strong> — cada envio ainda pede um clique seu. Conecte a sua
            em Configurações para que os follow-ups saiam sozinhos.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Leads em cadência" value={enrolled} icon={Workflow} />
        <Stat
          label="Agendamentos ativos"
          value={state.schedules.filter((s) => s.active).length}
          icon={Repeat}
        />
        <Stat label="Na fila agora" value={state.queue.length} icon={Zap} />
      </div>

      <Sequences />
      <Schedules />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Workflow;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cadences                                                                   */
/* -------------------------------------------------------------------------- */

function Sequences() {
  const { state, createSequence } = useStore();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Cadências</h2>
          <p className="text-xs text-muted-foreground">
            Prospecção fria fecha no segundo e no terceiro toque — que é justamente o que ninguém
            lembra de fazer.
          </p>
        </div>
        <Button
          variant="goldline"
          size="sm"
          onClick={() => {
            void createSequence("Nova cadência", DEFAULT_SEQUENCE_STEPS)
              .then(() => toast.success("Cadência criada"))
              .catch(() => toast.error("Não foi possível criar."));
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova cadência
        </Button>
      </div>

      {state.sequences.length === 0 ? (
        <EmptyCard>
          Nenhuma cadência ainda. Uma padrão de 3 toques (dia 0, dia 3, dia 7) é criada sozinha na
          primeira vez que você colocar um lead em cadência.
        </EmptyCard>
      ) : (
        <div className="grid gap-3">
          {state.sequences.map((s) => (
            <SequenceCard key={s.id} sequence={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function SequenceCard({ sequence }: { sequence: Sequence }) {
  const { state, updateSequence, removeSequence } = useStore();
  const [name, setName] = useState(sequence.name);
  const inUse = state.leads.filter((l) => l.enrollment?.sequenceId === sequence.id).length;

  const setStep = (index: number, patch: Partial<SequenceStep>) => {
    const steps = sequence.steps.map((st, i) => (i === index ? { ...st, ...patch } : st));
    void updateSequence(sequence.id, { steps });
  };

  const addStep = () => {
    const last = sequence.steps[sequence.steps.length - 1];
    void updateSequence(sequence.id, {
      steps: [
        ...sequence.steps,
        { days: (last?.days ?? 0) + 4, tone: "Casual" as Tone, channel: "WhatsApp" },
      ],
    });
  };

  return (
    <motion.div layout className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== sequence.name && void updateSequence(sequence.id, { name })}
          className="h-9 max-w-xs font-medium"
        />
        <span className="text-[11px] text-muted-foreground">{inUse} lead(s) nesta cadência</span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={sequence.active}
              onCheckedChange={(v) => void updateSequence(sequence.id, { active: v })}
            />
            Ativa
          </label>
          <Button
            variant="ghost"
            size="icon"
            title="Excluir"
            onClick={() => {
              // Leads already enrolled lose their cadence with the sequence, so
              // this is worth one confirmation.
              if (inUse > 0 && !confirm(`${inUse} lead(s) vão sair da cadência. Continuar?`))
                return;
              void removeSequence(sequence.id).then(() => toast.success("Cadência removida"));
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ol className="space-y-2">
        {sequence.steps.map((step, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {i + 1}
            </span>

            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {i === 0 ? (
                <span className="text-xs text-muted-foreground">na hora</span>
              ) : (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={step.days}
                    onChange={(e) => setStep(i, { days: Number(e.target.value) })}
                    className="h-8 w-16"
                  />
                  <span className="text-xs text-muted-foreground">dia(s) depois</span>
                </>
              )}
            </div>

            <Select value={step.tone} onValueChange={(v) => setStep(i, { tone: v as Tone })}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {sequence.steps.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() =>
                  void updateSequence(sequence.id, {
                    steps: sequence.steps.filter((_, k) => k !== i),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={addStep}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar toque
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Uma resposta do lead — ou um clique no CTA da página — encerra a cadência sozinha.
        </p>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recurring prospecting                                                      */
/* -------------------------------------------------------------------------- */

function Schedules() {
  const { state, createSchedule } = useStore();
  const [draft, setDraft] = useState({ niche: "", location: "" });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Prospecção recorrente</h2>
        <p className="text-xs text-muted-foreground">
          “Toda segunda, buscar 20 pizzarias em Curitiba, gerar o site das melhores e mandar a
          primeira mensagem.” Você abre o app e o trabalho já está feito.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
        <Input
          value={draft.niche}
          onChange={(e) => setDraft((d) => ({ ...d, niche: e.target.value }))}
          placeholder="Nicho (ex.: pizzaria)"
          className="max-w-52"
        />
        <Input
          value={draft.location}
          onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          placeholder="Cidade"
          className="max-w-52"
        />
        <Button
          variant="gold"
          onClick={() => {
            if (!draft.niche.trim() || !draft.location.trim()) {
              toast.error("Informe nicho e cidade.");
              return;
            }
            void createSchedule({
              name: `${draft.niche} — ${draft.location}`,
              niche: draft.niche.trim(),
              location: draft.location.trim(),
            })
              .then(() => {
                setDraft({ niche: "", location: "" });
                toast.success("Agendamento criado");
              })
              .catch((e: unknown) =>
                toast.error(e instanceof Error ? e.message : "Não foi possível criar."),
              );
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Agendar
        </Button>
      </div>

      {state.schedules.length === 0 ? (
        <EmptyCard>
          Nenhum agendamento. O primeiro costuma ser o nicho que já te deu resposta — veja quais no
          Dashboard, em “onde vale prospectar”.
        </EmptyCard>
      ) : (
        <div className="grid gap-3">
          {state.schedules.map((s) => (
            <ScheduleCard key={s.id} schedule={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const { state, updateSchedule, removeSchedule, runSchedule } = useStore();
  const [running, setRunning] = useState(false);

  return (
    <motion.div layout className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{schedule.name}</h3>
          <p className="text-[11px] text-muted-foreground">
            {schedule.frequency === "weekly" ? `Toda ${WEEKDAYS[schedule.weekday]}` : "Todo dia"} às{" "}
            {String(schedule.hour).padStart(2, "0")}:00 · próxima{" "}
            {new Date(schedule.nextRunAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={schedule.active}
              onCheckedChange={(v) => void updateSchedule(schedule.id, { active: v })}
            />
            Ativo
          </label>
          <Button
            variant="goldline"
            size="sm"
            disabled={running}
            onClick={() => {
              setRunning(true);
              void runSchedule(schedule.id)
                .then((n) => toast.success(`${n} lead(s) entraram na esteira`))
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Falhou."))
                .finally(() => setRunning(false));
            }}
          >
            Rodar agora
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void removeSchedule(schedule.id).then(() => toast.success("Removido"))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Frequência</Label>
          <Select
            value={schedule.frequency}
            onValueChange={(v) =>
              void updateSchedule(schedule.id, { frequency: v as Schedule["frequency"] })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="daily">Diária</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {schedule.frequency === "weekly" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Dia</Label>
            <Select
              value={String(schedule.weekday)}
              onValueChange={(v) => void updateSchedule(schedule.id, { weekday: Number(v) })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d, i) => (
                  <SelectItem key={d} value={String(i)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Hora</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={schedule.hour}
            onChange={(e) => void updateSchedule(schedule.id, { hour: Number(e.target.value) })}
            className="h-8"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Leads por rodada</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={schedule.leadLimit}
            onChange={(e) =>
              void updateSchedule(schedule.id, { leadLimit: Number(e.target.value) })
            }
            className="h-8"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Score mínimo</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={schedule.minScore}
            onChange={(e) => void updateSchedule(schedule.id, { minScore: Number(e.target.value) })}
            className="h-8"
          />
          <p className="text-[10px] text-muted-foreground">
            Só quem passa disso consome crédito de site.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-3">
          <Label className="text-xs">Cadência ao final</Label>
          <Select
            value={schedule.sequenceId ?? "none"}
            onValueChange={(v) =>
              void updateSchedule(schedule.id, { sequenceId: v === "none" ? undefined : v })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma — só deixar pronto</SelectItem>
              {state.sequences.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-5 border-t border-border/50 pt-4">
        <Toggle
          label="Gerar site"
          checked={schedule.autoSite}
          onChange={(v) => void updateSchedule(schedule.id, { autoSite: v })}
        />
        <Toggle
          label="Publicar"
          checked={schedule.autoPublish}
          onChange={(v) => void updateSchedule(schedule.id, { autoPublish: v })}
        />
        <Toggle
          label="Escrever abordagem"
          checked={schedule.autoMessage}
          onChange={(v) => void updateSchedule(schedule.id, { autoMessage: v })}
        />
        {schedule.lastRunAt && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            Última rodada {new Date(schedule.lastRunAt).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className={cn(checked ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </label>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
