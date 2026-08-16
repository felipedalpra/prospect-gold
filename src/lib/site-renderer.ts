import type { Lead, SiteSection } from "./types";

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

function imageFor(category: string): string {
  const value = category.toLowerCase();
  if (value.includes("restaurante") || value.includes("café") || value.includes("bar"))
    return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=85";
  if (value.includes("academ") || value.includes("fitness") || value.includes("pilates"))
    return "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1800&q=85";
  if (value.includes("barbear") || value.includes("beleza") || value.includes("salão"))
    return "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1800&q=85";
  if (value.includes("dent") || value.includes("clínica") || value.includes("med"))
    return "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1800&q=85";
  return "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85";
}

export function renderSiteHtml(lead: Lead, content: SiteSection, template: string): string {
  const accent = /^#[0-9a-f]{6}$/i.test(content.accent) ? content.accent : "#d5ad61";
  const services = content.services.filter(Boolean).slice(0, 6);
  const differentials = content.differentials.filter(Boolean).slice(0, 4);
  const cta = phoneHref(lead.phone);
  const serviceMarkup = services
    .map(
      (item, i) =>
        '<article class="service reveal"><span>0' +
        (i + 1) +
        "</span><h3>" +
        esc(item) +
        "</h3><p>Uma experiência pensada para entregar cuidado, precisão e atenção em cada detalhe.</p></article>",
    )
    .join("");
  const differentialMarkup = differentials
    .map((item) => '<li class="reveal"><i>✦</i><span>' + esc(item) + "</span></li>")
    .join("");
  const css = [
    ":root{--accent:" +
      accent +
      ";--bg:#080808;--panel:#121212;--muted:#a7a39b;--line:rgba(255,255,255,.12);font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f7f4ee;background:var(--bg)}",
    "*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 80% 0%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 32rem),var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,calc(100% - 40px));margin:auto}",
    ".nav{height:82px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2}.brand{display:flex;align-items:center;gap:11px;font-weight:750;letter-spacing:-.03em}.mark{width:30px;height:30px;border:1px solid var(--accent);border-radius:50%;display:grid;place-items:center;color:var(--accent);box-shadow:0 0 24px color-mix(in srgb,var(--accent) 38%,transparent)}.navlinks{display:flex;gap:27px;color:var(--muted);font-size:13px}.navcta{border:1px solid color-mix(in srgb,var(--accent) 60%,transparent);padding:11px 16px;border-radius:999px;color:var(--accent);font-size:12px}",
    ".hero{min-height:690px;display:grid;align-items:center;grid-template-columns:1fr 1fr;gap:50px;padding:62px 0 100px}.eyebrow{color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.2em;font-weight:700}.hero h1{font-size:clamp(42px,6.2vw,82px);line-height:.98;letter-spacing:-.07em;margin:18px 0 24px;max-width:680px}.hero h1 em{font-style:normal;color:var(--accent)}.lead{font-size:18px;line-height:1.65;color:var(--muted);max-width:560px}.actions{display:flex;gap:13px;flex-wrap:wrap;margin-top:34px}.button{display:inline-block;padding:15px 22px;border-radius:999px;background:var(--accent);color:#0b0a08;font-weight:750;font-size:13px;box-shadow:0 15px 45px color-mix(in srgb,var(--accent) 25%,transparent);transition:transform .25s,box-shadow .25s}.button:hover{transform:translateY(-3px);box-shadow:0 20px 60px color-mix(in srgb,var(--accent) 40%,transparent)}.button.ghost{background:transparent;color:#f7f4ee;border:1px solid var(--line);box-shadow:none}",
    '.visual{position:relative;min-height:500px;display:grid;place-items:center}.visual:before{content:"";position:absolute;width:350px;height:350px;border-radius:50%;background:var(--accent);filter:blur(100px);opacity:.2;animation:pulse 5s ease-in-out infinite}.heroimg{width:min(100%,500px);height:530px;object-fit:cover;border-radius:250px 250px 20px 20px;filter:saturate(.8) contrast(1.05);position:relative;box-shadow:30px 30px 0 color-mix(in srgb,var(--accent) 16%,transparent),0 30px 90px #000}.floating{position:absolute;padding:16px 18px;border:1px solid var(--line);background:rgba(15,15,15,.78);backdrop-filter:blur(14px);border-radius:15px;box-shadow:0 20px 60px #0008;font-size:12px;animation:float 5s ease-in-out infinite}.floating strong{display:block;font-size:23px;color:var(--accent);margin-bottom:4px}.float-a{left:0;bottom:60px}.float-b{right:-14px;top:65px;animation-delay:-2s}',
    ".section{padding:120px 0}.sectionhead{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:42px}.section h2{font-size:clamp(32px,4vw,58px);line-height:1;letter-spacing:-.06em;margin:12px 0 0;max-width:650px}.sectionintro{color:var(--muted);line-height:1.7;max-width:380px}.services{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.service{border:1px solid var(--line);background:linear-gradient(145deg,#191919,#0d0d0d);padding:28px;min-height:220px;border-radius:18px;transition:transform .3s,border-color .3s}.service:hover{transform:translateY(-8px);border-color:color-mix(in srgb,var(--accent) 60%,transparent)}.service span{color:var(--accent);font-size:12px}.service h3{font-size:21px;letter-spacing:-.04em;margin:55px 0 12px}.service p{color:var(--muted);line-height:1.55;font-size:13px;margin:0}",
    ".split{display:grid;grid-template-columns:.9fr 1.1fr;gap:90px;align-items:center}.aboutcopy{color:var(--muted);font-size:17px;line-height:1.8}.differentials{list-style:none;padding:0;margin:30px 0 0;display:grid;gap:15px}.differentials li{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:15px}.differentials i{color:var(--accent);font-style:normal}.statbox{border:1px solid var(--line);border-radius:24px;padding:45px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 15%,#101010),#101010);position:relative;overflow:hidden}.stat{font-size:86px;letter-spacing:-.09em;color:var(--accent);line-height:1}.statlabel{color:var(--muted);margin-top:12px}.contact{border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-radius:24px;padding:65px;background:radial-gradient(circle at 80% 20%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 28rem),#111;text-align:center}.contact h2{margin-left:auto;margin-right:auto}.contact p{margin:20px auto 30px;color:var(--muted);max-width:550px;line-height:1.7}.footer{padding:32px 0 50px;color:var(--muted);font-size:12px;display:flex;justify-content:space-between;border-top:1px solid var(--line)}.reveal{animation:rise .8s both;animation-timeline:view();animation-range:entry 0% cover 28%}@keyframes rise{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes pulse{50%{transform:scale(1.15);opacity:.3}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;scroll-behavior:auto!important}}@media(max-width:800px){.wrap{width:min(100% - 28px,560px)}.navlinks{display:none}.hero{grid-template-columns:1fr;padding-top:34px;gap:35px}.hero h1{font-size:54px}.visual{min-height:430px}.heroimg{height:430px}.float-a{left:-4px}.float-b{right:-5px}.section{padding:80px 0}.sectionhead,.split{display:block}.sectionintro{margin-top:20px}.services{grid-template-columns:1fr}.service h3{margin-top:42px}.split .statbox{margin-top:35px}.contact{padding:42px 22px}.footer{display:block}.footer span{display:block;margin-top:10px}}",
  ].join("");
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080808"><title>' +
    esc(lead.name) +
    " — " +
    esc(lead.category) +
    "</title><style>" +
    css +
    "</style></head><body>" +
    '<header class="wrap nav"><a class="brand" href="#top"><span class="mark">✦</span>' +
    esc(lead.name) +
    '</a><nav class="navlinks"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav><a class="navcta" href="' +
    cta +
    '">Fale conosco ↗</a></header>' +
    '<main id="top"><section class="wrap hero"><div><div class="eyebrow">' +
    esc(lead.category) +
    " · " +
    esc(lead.city) +
    "</div><h1>" +
    esc(content.headline).replace(/\\n/g, "<br>") +
    '</h1><p class="lead">' +
    esc(content.subheadline) +
    '</p><div class="actions"><a class="button" href="' +
    cta +
    '">' +
    esc(content.cta) +
    ' ↗</a><a class="button ghost" href="#servicos">Conheça mais</a></div></div><div class="visual"><img class="heroimg" src="' +
    imageFor(lead.category) +
    '" alt="Ambiente de ' +
    esc(lead.name) +
    '" loading="eager"><div class="floating float-a"><strong>' +
    lead.rating.toFixed(1) +
    " / 5</strong>Google · " +
    lead.reviews +
    ' avaliações</div><div class="floating float-b"><strong>Presença</strong>Feita para ser lembrada</div></div></section>' +
    '<section class="section" id="servicos"><div class="wrap"><div class="sectionhead"><div><div class="eyebrow">O que fazemos</div><h2>Uma experiência pensada para você.</h2></div><p class="sectionintro">' +
    esc(content.about) +
    '</p></div><div class="services">' +
    serviceMarkup +
    "</div></div></section>" +
    '<section class="section" id="sobre"><div class="wrap split"><div><div class="eyebrow">Por que escolher</div><h2>Detalhes que fazem diferença.</h2><ul class="differentials">' +
    differentialMarkup +
    '</ul></div><div class="statbox reveal"><div class="stat">' +
    lead.rating.toFixed(1) +
    '</div><div class="statlabel">de avaliação média no Google<br>com ' +
    lead.reviews +
    " avaliações públicas</div></div></div></section>" +
    '<section class="section"><div class="wrap"><div class="contact reveal" id="contato"><div class="eyebrow">Vamos conversar</div><h2>Pronto para viver essa experiência?</h2><p>Entre em contato com ' +
    esc(lead.name) +
    ' e descubra uma solução feita para o que você precisa.</p><a class="button" href="' +
    cta +
    '">' +
    esc(content.cta) +
    " ↗</a></div></div></section></main>" +
    '<footer class="wrap footer"><span>© ' +
    new Date().getFullYear() +
    " " +
    esc(lead.name) +
    "</span><span>" +
    esc(lead.address) +
    ", " +
    esc(lead.city) +
    "</span></footer></body></html>"
  );
}
