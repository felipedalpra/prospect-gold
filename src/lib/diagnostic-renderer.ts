import type { DiagnosticContent, Lead } from "./types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phoneHref(phone?: string): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits
    ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits)
    : "#contato";
}

function scoreColor(score: number): string {
  return score >= 70 ? "#1e8e5a" : score >= 40 ? "#b8860b" : "#c0392b";
}

function scoreLabel(score: number): string {
  return score >= 70
    ? "Presença digital sólida"
    : score >= 40
      ? "Presença digital mediana"
      : "Presença digital crítica";
}

/** Reporta abertura e clique no CTA de volta ao app — mesmo contrato das páginas de site. */
function tracker(slug: string, trackUrl: string): string {
  const base = trackUrl.replace(/\/+$/, "") + "/t/" + encodeURIComponent(slug);
  return (
    "<script>(function(){var B=" +
    JSON.stringify(base) +
    ";function h(k,s){var u=B+'?k='+k+(s?'&s='+s:'')+'&_='+Date.now();" +
    "if(navigator.sendBeacon){navigator.sendBeacon(u)}else{(new Image()).src=u}}" +
    "h('view');var t=0,i=setInterval(function(){if(!document.hidden){t+=15;" +
    "if(t<=300)h('heartbeat',t);else clearInterval(i)}},15000);" +
    "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*=\"wa.me\"],a[href^=\"tel:\"]');" +
    "if(a)h('whatsapp',t)},true);})();</script>"
  );
}

function card(title: string, checks: [string, string, boolean][]): string {
  return (
    '<div class="card"><h3>' +
    esc(title) +
    '</h3><div class="checks">' +
    checks
      .map(
        ([value, label, warn]) =>
          '<div class="check"><span class="v">' +
          esc(value) +
          '</span><span class="l' +
          (warn ? " warn" : "") +
          '">' +
          esc(label) +
          "</span></div>",
      )
      .join("") +
    "</div></div>"
  );
}

function findingCards(content: DiagnosticContent): string {
  const { findings } = content;
  const siteCard = findings.site
    ? card("Site atual", [
        [`${findings.site.performance}/100`, "Nota PageSpeed", findings.site.performance < 50],
        [`${findings.site.lcp}s`, "Carregamento", findings.site.lcp > 2.5],
        [findings.site.mobile ? "Sim" : "Não", "Responsivo", !findings.site.mobile],
        [findings.site.https ? "Sim" : "Não", "HTTPS", !findings.site.https],
      ])
    : '<div class="card"><h3>Site atual</h3><p class="warn">Este negócio não tem site — cada visita ao perfil do Google termina sem um lugar para ir.</p></div>';

  const gmbCard = card("Perfil no Google", [
    [findings.gmb.hasCategory ? "Sim" : "Não", "Categoria definida", !findings.gmb.hasCategory],
    [String(findings.gmb.photoCount), "Fotos publicadas", findings.gmb.photoCount < 3],
    [findings.gmb.hasPhone ? "Sim" : "Não", "Telefone público", !findings.gmb.hasPhone],
    [findings.gmb.hasInstagram ? "Sim" : "Não", "Instagram vinculado", !findings.gmb.hasInstagram],
  ]);

  return siteCard + gmbCard;
}

export type RenderDiagnosticOptions = {
  /** Slug da linha em `sites` — a chave que o beacon reporta. */
  slug?: string | undefined;
  /** Origem deste app, para onde o beacon é enviado. */
  trackUrl?: string | undefined;
};

export function renderDiagnosticHtml(
  lead: Lead,
  content: DiagnosticContent,
  options: RenderDiagnosticOptions = {},
): string {
  const color = scoreColor(content.overallScore);
  const cta = phoneHref(lead.phone);

  const css = `
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:"Inter",ui-sans-serif,system-ui,sans-serif;background:#f7f6f3;color:#141414;-webkit-font-smoothing:antialiased}
.wrap{width:min(880px,calc(100% - 40px));margin-inline:auto}
header.nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0;font-size:13.5px;color:#4a463f}
.brand{font-weight:700;letter-spacing:-.02em;font-size:16px;color:#141414}
.hero{padding:20px 0 8px;text-align:center}
.hero .eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8a8579;font-weight:700}
.hero h1{font-size:clamp(24px,4vw,34px);margin:10px auto 0;letter-spacing:-.02em;max-width:26ch}
.gauge{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;margin:26px auto 6px;background:conic-gradient(${color} calc(${content.overallScore}*1%),#e7e4dc 0)}
.gauge .in{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;flex-direction:column}
.gauge b{font-size:32px;color:${color};line-height:1}
.gauge span{font-size:11px;color:#8a8579;margin-top:4px}
.glabel{text-align:center;font-weight:600}
.summary{max-width:64ch;margin:14px auto 0;text-align:center;color:#4a463f;line-height:1.7;font-size:15.5px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:34px 0}
.card{background:#fff;border:1px solid #eae7e0;border-radius:14px;padding:22px}
.card h3{margin:0 0 14px;font-size:15px}
.card .warn{color:#b8860b;font-size:14px;line-height:1.6;margin:0}
.checks{display:grid;gap:10px}
.check{display:flex;justify-content:space-between;align-items:center;font-size:13.5px}
.check .v{font-weight:700}
.check .l.warn{color:#c0392b}
.recs{background:#fff;border:1px solid #eae7e0;border-radius:14px;padding:26px 28px;margin-bottom:34px}
.recs h2{font-size:17px;margin:0 0 16px}
.recs ol{margin:0;padding-left:20px;display:grid;gap:12px}
.recs li{line-height:1.65;font-size:14.5px}
.cta{background:${color};color:#fff;border-radius:14px;padding:28px;text-align:center;margin-bottom:44px}
.cta a{display:inline-flex;margin-top:14px;background:#fff;color:${color};padding:13px 26px;border-radius:999px;font-weight:700;text-decoration:none}
footer{text-align:center;color:#8a8579;font-size:12px;padding-bottom:40px}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
@media print{.cta a{display:none}}
`;

  const recs = content.recommendations.map((r) => "<li>" + esc(r) + "</li>").join("");

  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="Diagnóstico de presença digital de ' +
    esc(lead.name) +
    '">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">' +
    "<title>Diagnóstico de presença digital — " +
    esc(lead.name) +
    "</title><style>" +
    css +
    "</style></head><body>" +
    '<div class="wrap"><header class="nav"><span class="brand">' +
    esc(lead.name) +
    "</span><span>" +
    esc(lead.category) +
    " · " +
    esc(lead.city) +
    "</span></header></div>" +
    '<div class="wrap hero"><div class="eyebrow">Diagnóstico de presença digital</div><h1>Como ' +
    esc(lead.name) +
    ' aparece hoje no Google</h1><div class="gauge"><div class="in"><b>' +
    content.overallScore +
    '</b><span>de 100</span></div></div><div class="glabel" style="color:' +
    color +
    '">' +
    esc(scoreLabel(content.overallScore)) +
    '</div><p class="summary">' +
    esc(content.summary) +
    "</p></div>" +
    '<div class="wrap grid">' +
    findingCards(content) +
    "</div>" +
    '<div class="wrap recs"><h2>Recomendações</h2><ol>' +
    recs +
    "</ol></div>" +
    '<div class="wrap cta"><strong>Quer resolver isso?</strong><br>Fale com quem te mandou este diagnóstico.<br>' +
    '<a href="' +
    cta +
    '" target="_blank" rel="noopener">Falar no WhatsApp</a></div>' +
    '<footer class="wrap">Diagnóstico gerado a partir de dados públicos do Google — ' +
    new Date().getFullYear() +
    "</footer>" +
    (options.slug && options.trackUrl ? tracker(options.slug, options.trackUrl) : "") +
    "</body></html>"
  );
}
