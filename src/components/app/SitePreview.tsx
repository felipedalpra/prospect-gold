import { motion } from "motion/react";
import type { Lead, SiteSection } from "@/lib/types";
import { MapPin, Phone, Star } from "lucide-react";

export function SitePreview({
  lead,
  content,
  template,
  animateIn,
}: {
  lead: Lead;
  content: SiteSection;
  template: string;
  animateIn?: boolean;
}) {
  const sections = ["hero", "servicos", "sobre", "avaliacoes", "local", "cta"];
  const block = (i: number) =>
    animateIn
      ? {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.25 * i, duration: 0.5 },
        }
      : {};

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-destructive/60" />
        <span className="h-2 w-2 rounded-full bg-warning/60" />
        <span className="h-2 w-2 rounded-full bg-success/60" />
        <span className="ml-2 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {lead.site?.url ?? "preview.leadforge.app"}
        </span>
        <span className="ml-auto text-[10px] text-primary">Template {template}</span>
      </div>

      <div className="max-h-[520px] space-y-px overflow-y-auto text-sm">
        {/* hero */}
        <motion.section key={sections[0]} {...block(0)} className="relative overflow-hidden bg-surface px-6 py-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary">{lead.category}</p>
          <h3 className="mt-2 max-w-md text-2xl font-bold leading-tight">{content.headline}</h3>
          <p className="mt-3 max-w-md text-xs text-muted-foreground">{content.subheadline}</p>
          <span className="mt-5 inline-block rounded-lg bg-[image:var(--gradient-gold)] px-4 py-2 text-xs font-semibold text-primary-foreground">
            {content.cta}
          </span>
        </motion.section>

        {/* serviços */}
        <motion.section key={sections[1]} {...block(1)} className="bg-background px-6 py-8">
          <h4 className="text-xs uppercase tracking-widest text-primary">Serviços</h4>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {content.services.map((s) => (
              <div key={s} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">{s}</div>
            ))}
          </div>
        </motion.section>

        {/* sobre */}
        <motion.section key={sections[2]} {...block(2)} className="bg-surface px-6 py-8">
          <h4 className="text-xs uppercase tracking-widest text-primary">Sobre</h4>
          <p className="mt-2 max-w-lg text-xs text-muted-foreground">{content.about}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {content.differentials.map((d) => (
              <span key={d} className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[11px] text-primary">{d}</span>
            ))}
          </div>
        </motion.section>

        {/* avaliações */}
        <motion.section key={sections[3]} {...block(3)} className="bg-background px-6 py-8">
          <h4 className="text-xs uppercase tracking-widest text-primary">Avaliações</h4>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-3xl font-bold text-primary">{lead.rating.toFixed(1)}</span>
            <div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{lead.reviews} avaliações no Google</p>
            </div>
          </div>
        </motion.section>

        {/* localização */}
        <motion.section key={sections[4]} {...block(4)} className="bg-surface px-6 py-8">
          <h4 className="text-xs uppercase tracking-widest text-primary">Localização</h4>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" /> {lead.address} — {lead.city}
          </p>
          {lead.phone && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-primary" /> {lead.phone}
            </p>
          )}
          <div className="mt-3 h-24 rounded-lg border border-border grid-bg opacity-70" />
        </motion.section>

        {/* cta */}
        <motion.section key={sections[5]} {...block(5)} className="relative overflow-hidden bg-background px-6 py-10 text-center">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-primary/8 blur-3xl" />
          <h4 className="relative text-lg font-bold">Pronto para agendar?</h4>
          <p className="relative mt-1 text-xs text-muted-foreground">Fale agora com a equipe da {lead.name}.</p>
          <span className="relative mt-4 inline-block rounded-lg border border-primary/40 px-4 py-2 text-xs font-semibold text-primary">
            {content.cta}
          </span>
        </motion.section>
      </div>
    </div>
  );
}
