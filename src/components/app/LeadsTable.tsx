import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Globe, Phone, Star } from "lucide-react";

export function LeadsTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onGenerate,
}: {
  leads: Lead[];
  selected?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  onGenerate?: (id: string) => void;
}) {
  const selectable = !!selected && !!onToggle;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {selectable && (
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={selected!.length > 0 && selected!.length === leads.length}
                  onCheckedChange={() => onToggleAll?.()}
                />
              </th>
            )}
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Cidade</th>
            <th className="px-4 py-3 font-medium">Avaliação</th>
            <th className="px-4 py-3 font-medium">Site</th>
            <th className="px-4 py-3 font-medium">Telefone</th>
            <th className="px-4 py-3 font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Ação</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <motion.tr
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              className={cn(
                "border-b border-border/60 transition-colors hover:bg-accent/40",
                selected?.includes(lead.id) && "bg-primary/6",
              )}
            >
              {selectable && (
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected!.includes(lead.id)}
                    onCheckedChange={() => onToggle!(lead.id)}
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <Link
                  to="/app/leads/$id"
                  params={{ id: lead.id }}
                  className="font-medium hover:text-primary"
                >
                  {lead.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{lead.category}</td>
              <td className="px-4 py-3 text-muted-foreground">{lead.city}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  {lead.rating.toFixed(1)}
                  <span className="text-xs text-muted-foreground">({lead.reviews})</span>
                </span>
              </td>
              <td className="px-4 py-3">
                {lead.hasWebsite ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" /> Possui
                  </span>
                ) : (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">
                    Sem site
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {lead.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-primary" />
                    Disponível
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <ScoreBadge score={lead.score} reasons={lead.reasons} compact />
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                  {lead.stage}
                </span>
              </td>
              <td className="px-4 py-3">
                {lead.site ? (
                  <Button size="sm" variant="goldline" asChild>
                    <Link to="/app/leads/$id" params={{ id: lead.id }}>
                      Ver site
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="gold" onClick={() => onGenerate?.(lead.id)}>
                    Gerar site
                  </Button>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum lead por aqui ainda.
        </p>
      )}
    </div>
  );
}
