import { createServerFn } from "@tanstack/react-start";

/**
 * Sending through the user's OWN WhatsApp instance.
 *
 * We deliberately do not run a WhatsApp integration of our own: the number,
 * the provider bill and the ban risk all belong to whoever is prospecting.
 * They plug in the instance they already pay for, exactly like Apify or
 * Netlify, and this module speaks whichever dialect it turns out to be.
 *
 * The three that cover almost every Brazilian seller:
 *
 *   evolution — self-hosted, free, the de-facto default. `apikey` header.
 *   zapi      — hosted SaaS. Credentials are baked into the base URL.
 *   uazapi    — hosted, Evolution-shaped but with a flatter route.
 *
 * When nothing is connected the app falls back to opening wa.me by hand, which
 * is what it did before this existed. Automation is the upgrade, not the floor.
 */

export type WaFlavor = "auto" | "evolution" | "zapi" | "uazapi";

export type WaConfig = {
  /** e.g. "https://evo.minhaagencia.com" or the full Z-API instance URL. */
  baseUrl: string;
  /** Evolution/Uazapi instance name. Z-API carries it in the URL instead. */
  instance?: string | undefined;
  /** API key / token for the instance. */
  token: string;
  flavor?: WaFlavor | undefined;
  /** Z-API's account-level Client-Token, when the account requires one. */
  clientToken?: string | undefined;
};

export type SendInput = WaConfig & { phone: string; text: string };
export type SendResult = { id: string; to: string };
export type WaStatus = { connected: boolean; detail: string; flavor: Exclude<WaFlavor, "auto"> };

/* -------------------------------------------------------------------------- */
/*  Dialect detection                                                          */
/* -------------------------------------------------------------------------- */

function resolveFlavor(cfg: WaConfig): Exclude<WaFlavor, "auto"> {
  if (cfg.flavor && cfg.flavor !== "auto") return cfg.flavor;
  const url = cfg.baseUrl.toLowerCase();
  if (url.includes("z-api.io")) return "zapi";
  if (url.includes("uazapi")) return "uazapi";
  return "evolution";
}

function trimUrl(s: string): string {
  return s.trim().replace(/\/+$/, "");
}

/**
 * Brazilian numbers arrive as "(11) 98888-7777", "11988887777" or already with
 * the country code. Everything downstream needs one canonical shape.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  // A bare 10/11-digit number is domestic; anything else is already international.
  return digits.length <= 11 ? `55${digits}` : digits;
}

/* -------------------------------------------------------------------------- */
/*  Requests                                                                   */
/* -------------------------------------------------------------------------- */

type Attempt = { url: string; headers: Record<string, string>; body: unknown };

/**
 * Evolution changed its send payload between v1 and v2 and both are widely
 * deployed, so we describe the request twice and let the server pick.
 */
function sendAttempts(cfg: WaConfig, phone: string, text: string): Attempt[] {
  const base = trimUrl(cfg.baseUrl);
  const instance = cfg.instance?.trim() ?? "";
  const flavor = resolveFlavor(cfg);
  const json = { "content-type": "application/json" };

  if (flavor === "zapi") {
    const headers: Record<string, string> = { ...json };
    if (cfg.clientToken?.trim()) headers["Client-Token"] = cfg.clientToken.trim();
    return [{ url: `${base}/send-text`, headers, body: { phone, message: text } }];
  }

  if (flavor === "uazapi") {
    return [
      {
        url: `${base}/send/text`,
        headers: { ...json, token: cfg.token },
        body: { number: phone, text },
      },
    ];
  }

  const headers = { ...json, apikey: cfg.token };
  const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
  return [
    { url, headers, body: { number: phone, text } }, // v2
    { url, headers, body: { number: phone, textMessage: { text } } }, // v1
  ];
}

function readMessageId(payload: unknown): string {
  const p = payload as
    { key?: { id?: string }; messageId?: string; id?: string; zaapId?: string } | undefined;
  return p?.key?.id ?? p?.messageId ?? p?.zaapId ?? p?.id ?? "";
}

/** Turns a provider failure into something the seller can actually act on. */
function explain(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "A instância recusou as credenciais. Confira o token em Configurações.";
  }
  if (status === 404) {
    return "Instância não encontrada nessa URL. Confira a Base URL e o nome da instância.";
  }
  if (/not.*connected|disconnected|close/i.test(body)) {
    return "A instância está desconectada do WhatsApp. Leia o QR Code no painel do provedor.";
  }
  return `A instância respondeu ${status}: ${body.slice(0, 240)}`;
}

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((d: SendInput) => d)
  .handler(async ({ data }): Promise<SendResult> => {
    if (!data.baseUrl?.trim() || !data.token?.trim()) {
      throw new Error("WhatsApp não configurado.");
    }
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Este lead não tem telefone.");
    if (!data.text.trim()) throw new Error("Não há mensagem para enviar.");

    const attempts = sendAttempts(data, phone, data.text);
    let lastStatus = 0;
    let lastBody = "";

    for (const attempt of attempts) {
      let res: Response;
      try {
        res = await fetch(attempt.url, {
          method: "POST",
          headers: attempt.headers,
          body: JSON.stringify(attempt.body),
        });
      } catch {
        throw new Error(`Não consegui alcançar ${trimUrl(data.baseUrl)}. A instância está no ar?`);
      }

      const body = await res.text();
      if (res.ok) {
        let payload: unknown = {};
        try {
          payload = JSON.parse(body);
        } catch {
          // Some builds answer 200 with a bare string; the send still happened.
        }
        return { id: readMessageId(payload), to: phone };
      }

      lastStatus = res.status;
      lastBody = body;
      // Only a shape rejection is worth retrying with the other dialect.
      if (res.status !== 400) break;
    }

    throw new Error(explain(lastStatus, lastBody));
  });

/* -------------------------------------------------------------------------- */
/*  Connection check                                                           */
/* -------------------------------------------------------------------------- */

export const checkWhatsApp = createServerFn({ method: "POST" })
  .validator((d: WaConfig) => d)
  .handler(async ({ data }): Promise<WaStatus> => {
    const flavor = resolveFlavor(data);
    const base = trimUrl(data.baseUrl);
    if (!base) throw new Error("Informe a Base URL da sua instância.");

    const probe =
      flavor === "zapi"
        ? { url: `${base}/status`, headers: {} as Record<string, string> }
        : flavor === "uazapi"
          ? { url: `${base}/instance/status`, headers: { token: data.token } }
          : {
              url: `${base}/instance/connectionState/${encodeURIComponent(data.instance ?? "")}`,
              headers: { apikey: data.token },
            };

    if (flavor === "zapi" && data.clientToken?.trim()) {
      probe.headers["Client-Token"] = data.clientToken.trim();
    }

    let res: Response;
    try {
      res = await fetch(probe.url, { headers: probe.headers });
    } catch {
      return { connected: false, detail: `Não consegui alcançar ${base}.`, flavor };
    }

    const body = await res.text();
    if (!res.ok) return { connected: false, detail: explain(res.status, body), flavor };

    // Every provider spells "connected" differently; all of them say it somewhere.
    const connected =
      /"(state|status)"\s*:\s*"?(open|connected|CONNECTED)"?|"connected"\s*:\s*true/i.test(body);
    return {
      connected,
      detail: connected
        ? "Instância conectada e pronta para enviar."
        : "Instância no ar, mas sem sessão do WhatsApp. Leia o QR Code no painel do provedor.",
      flavor,
    };
  });
