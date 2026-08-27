import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WhatsAppSettings } from "@/lib/types";
import { Check, Copy, Loader2, MessageCircle, Plug, X } from "lucide-react";

/**
 * Connecting the seller's OWN instance. We never operate a number for them:
 * the account, the provider bill and the ban risk stay where they belong. What
 * the app gets in return is the ability to actually send — and to hear back.
 */
export function WhatsAppCard() {
  const { whatsapp, whatsappReady, saveWhatsApp, testWhatsApp, webhookUrl, keyFor } = useStore();

  const [draft, setDraft] = useState<WhatsAppSettings>(whatsapp);
  const [token, setToken] = useState(keyFor("whatsapp") ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);

  // The saved settings arrive one render after the store finishes loading.
  useEffect(() => setDraft(whatsapp), [whatsapp]);
  useEffect(() => setToken(keyFor("whatsapp") ?? ""), [keyFor]);

  const set = <K extends keyof WhatsAppSettings>(k: K, v: WhatsAppSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await saveWhatsApp(draft, token);
      toast.success("Instância salva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setStatus(null);
    try {
      // Testing what is on screen, not what was saved last time, is the only
      // behaviour that makes the button useful while setting things up.
      await saveWhatsApp(draft, token);
      const result = await testWhatsApp();
      setStatus({ ok: result.connected, detail: result.detail });
      if (result.connected) toast.success("Instância conectada");
    } catch (err) {
      setStatus({ ok: false, detail: err instanceof Error ? err.message : "Falhou." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">WhatsApp — sua instância</h3>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Conecte a instância que <strong>você já usa</strong> (Evolution API, Z-API, Uazapi). O
              número, a conta e o risco continuam seus — o LeadForge só envia por ela. Sem instância
              conectada, o envio segue manual pelo wa.me, como sempre foi.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
            whatsappReady
              ? "bg-primary/15 text-primary"
              : "bg-muted-foreground/10 text-muted-foreground",
          )}
        >
          {whatsappReady ? "Conectada" : "Manual"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Base URL</Label>
          <Input
            value={draft.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="https://evolution.minhaagencia.com.br"
          />
          <p className="text-[11px] text-muted-foreground">
            No Z-API, cole a URL completa da instância (…/instances/ID/token/TOKEN).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Instância</Label>
          <Input
            value={draft.instance}
            onChange={(e) => set("instance", e.target.value)}
            placeholder="minha-instancia"
          />
          <p className="text-[11px] text-muted-foreground">Deixe vazio no Z-API.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Token da instância</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Provedor</Label>
          <Select
            value={draft.flavor}
            onValueChange={(v) => set("flavor", v as WhatsAppSettings["flavor"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Detectar pela URL</SelectItem>
              <SelectItem value="evolution">Evolution API</SelectItem>
              <SelectItem value="zapi">Z-API</SelectItem>
              <SelectItem value="uazapi">Uazapi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Intervalo entre envios</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5}
              max={600}
              value={draft.throttleSeconds ?? 45}
              onChange={(e) => set("throttleSeconds", Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">seg</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Rajadas derrubam número. 45s é conservador.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Janela de envio</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={23}
              value={draft.windowStart ?? 8}
              onChange={(e) => set("windowStart", Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">às</span>
            <Input
              type="number"
              min={1}
              max={24}
              value={draft.windowEnd ?? 20}
              onChange={(e) => set("windowEnd", Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">
              — fora disso, a fila segura o envio para a manhã seguinte.
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="gold" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Salvar
        </Button>
        <Button variant="goldline" onClick={() => void test()} disabled={testing}>
          {testing ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plug className="mr-2 h-3.5 w-3.5" />
          )}
          Testar conexão
        </Button>
        {status && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              status.ok ? "text-primary" : "text-destructive",
            )}
          >
            {status.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {status.detail}
          </span>
        )}
      </div>

      {webhookUrl && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-4">
          <Label className="text-xs">Webhook de resposta</Label>
          <p className="text-[11px] text-muted-foreground">
            Cole esta URL no campo de webhook do seu provedor (evento de mensagem recebida). É o que
            faz a resposta do lead cair aqui dentro, mover o card e{" "}
            <strong>interromper a cadência automaticamente</strong>.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-[11px]" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void navigator.clipboard
                  .writeText(webhookUrl)
                  .then(() => toast.success("URL copiada"));
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
