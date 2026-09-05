import { useState } from "react";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Monitor, Smartphone, Tablet } from "lucide-react";

/**
 * Renders the actual generated document in a sandboxed iframe — what you see
 * here is byte-for-byte what gets deployed.
 */
export function SitePreview({
  lead,
  html,
  template,
}: {
  lead: Lead;
  html: string;
  template: string;
}) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-destructive/60" />
        <span className="h-2 w-2 rounded-full bg-warning/60" />
        <span className="h-2 w-2 rounded-full bg-success/60" />
        <span className="ml-2 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {lead.site?.url ?? `preview / ${lead.site?.slug ?? "rascunho"}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-[10px] text-primary sm:inline">{template}</span>
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setDevice(mode)}
              title={
                mode === "desktop"
                  ? "Ver como desktop"
                  : mode === "tablet"
                    ? "Ver como tablet"
                    : "Ver como celular"
              }
              className={cn(
                "rounded p-1 transition-colors",
                device === mode
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className={cn("bg-surface-2", device !== "desktop" && "flex justify-center p-4")}>
        <iframe
          title={`Site de ${lead.name}`}
          srcDoc={html}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          className={cn(
            "h-[620px] border-0 bg-white",
            device === "desktop"
              ? "w-full"
              : device === "tablet"
                ? "w-[768px] rounded-xl border border-border shadow-lg"
                : "w-[390px] rounded-2xl border border-border shadow-lg",
          )}
        />
      </div>
    </div>
  );
}
