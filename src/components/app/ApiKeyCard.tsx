import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { PROVIDER_INFO, type Provider } from "@/lib/types";
import { Check, ExternalLink, Trash2 } from "lucide-react";

/** Shows only whether a key exists — we never render a stored key back. */
export function ApiKeyCard({ provider }: { provider: Provider }) {
  const { keyFor, saveKey, removeKey } = useStore();
  const info = PROVIDER_INFO[provider];
  const connected = Boolean(keyFor(provider));
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await saveKey(provider, value.trim());
      setValue("");
      toast.success(`${info.label} conectado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a chave.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeKey(provider);
      toast.success(`${info.label} desconectado`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{info.label}</h3>
            {info.required && !connected && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
                obrigatório
              </span>
            )}
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                <Check className="h-3 w-3" /> conectado
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{info.help}</p>
        </div>
        <a
          href={info.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Obter chave <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={connected ? "•••••••• (salva)" : info.placeholder}
          onKeyDown={(e) => e.key === "Enter" && void save()}
        />
        <Button variant="gold" onClick={() => void save()} disabled={busy || !value.trim()}>
          {connected ? "Substituir" : "Salvar"}
        </Button>
        {connected && (
          <Button
            variant="subtle"
            onClick={() => void remove()}
            disabled={busy}
            title="Remover chave"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
