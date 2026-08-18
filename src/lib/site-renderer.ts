import type { Lead, SiteLayout, SiteSection } from "./types";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

/** Stable per-lead number, so the same business always gets the same variant. */
function hashOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function hex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

/** Perceived luminance — decides whether text on the accent is black or white. */
function readableOn(color: string): string {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#101010" : "#ffffff";
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const skip = new Set(["de", "da", "do", "dos", "das", "e", "the", "a", "o"]);
  const useful = words.filter((w) => !skip.has(w.toLowerCase()));
  const pick = useful.length ? useful : words;
  return (pick[0]?.[0] ?? "?").concat(pick.length > 1 ? (pick[1]?.[0] ?? "") : "").toUpperCase();
}

/* -------------------------------------------------------------------------- */
/*  Imagery                                                                    */
/*  Real photos of the business come first. The curated pools below only fill  */
/*  the gaps, and rotate per lead so two businesses never look identical.      */
/* -------------------------------------------------------------------------- */

const U = "https://images.unsplash.com/photo-";
const Q = "?auto=format&fit=crop&w=1600&q=80";

const POOLS: { match: RegExp; photos: string[] }[] = [
  {
    match:
      /restaurante|comida|pizza|food|cafeteria|caf\u00e9|\bbar\b|hamburg|lanche|padaria|confeitar|gastro|churrasc|sushi|pizzar/i,
    photos: [
      "1517248135467-4c7edcad34c4",
      "1552566626-52f8b828add9",
      "1414235077428-338989a2e8c0",
      "1466978913421-dad2ebd01d17",
      "1600891964092-4316c288032e",
      "1559339352-11d035aa65de",
    ],
  },
  {
    match: /academ|fitness|pilates|crossfit|treino|yoga|personal/i,
    photos: [
      "1534438327276-14e5300c3a48",
      "1571902943202-507ec2618e8f",
      "1541534741688-6078c6bfb5c5",
      "1583454110551-21f2fa2afe61",
      "1518611012118-696072aa579a",
      "1517836357463-d25dfeac3438",
    ],
  },
  {
    match:
      /barbear|barber|beleza|sal\u00e3o|salao|cabelo|est\u00e9tica|estetica|unha|\bspa\b|manicure|maquiag|depila/i,
    photos: [
      "1503951914875-452162b0f3f1",
      "1585747860715-2ba37e788b70",
      "1560066984-138dadb4c035",
      "1622286342621-4bd786c2447c",
      "1521590832167-7bcbfaa6381f",
      "1599351431202-1e0f0137899a",
    ],
  },
  {
    match: /dent|odonto|clínic|clinic|médic|medic|saúde|saude|fisioter|psic|laborat/i,
    photos: [
      "1629909613654-28e377c37b09",
      "1588776814546-1ffcf47267a5",
      "1631217868264-e5b90bb7e133",
      "1519494026892-80bbd2d6fd0d",
      "1576091160399-112ba8d25d1d",
      "1666214280557-f1b5022eb634",
    ],
  },
  {
    match: /advoc|advog|contab|jurídic|juridic|consultor|escritório|escritorio|financ/i,
    photos: [
      "1497366754035-f200968a6e72",
      "1521737604893-d14cc237f11d",
      "1454165804606-c3d57bc86b40",
      "1497215728101-856f4ea42174",
      "1600880292203-757bb62b4baf",
      "1573164713988-8665fc963095",
    ],
  },
  {
    match: /pet|veterin|animal/i,
    photos: [
      "1548199973-03cce0bbc87b",
      "1425082661705-1834bfd09dca",
      "1450778869180-41d0601e046e",
      "1583337130417-3346a1be7dee",
      "1516734212186-a967f81ad0d7",
      "1587300003388-59208cc962cb",
    ],
  },
  {
    match: /auto|mecânic|mecanic|oficina|carro|veícul|veicul|funilaria|lava/i,
    photos: [
      "1486262715619-67b85e0b08d3",
      "1530046339160-ce3e530c7d2f",
      "1493238792000-8113da705763",
      "1625047509168-a7026f36de04",
      "1580273916550-e323be2ae537",
      "1487754180451-c456f719a1fc",
    ],
  },
  {
    match: /imobili|imóve|imove|construç|construc|arquitet|engenhar|reforma|marcen/i,
    photos: [
      "1560518883-ce09059eeffa",
      "1512917774080-9991f1c4c750",
      "1600585154340-be6161a56a0c",
      "1503387762-592deb58ef4e",
      "1600607687939-ce8a6c25118c",
      "1416331108676-a22ccb276e35",
    ],
  },
  {
    match: /moda|loja|boutique|roupa|joalh|óptic|optic|calçad|calcad/i,
    photos: [
      "1441986300917-64674bd600d8",
      "1445205170230-053b83016050",
      "1490481651871-ab68de25d43d",
      "1567401893414-76b7b1e5a7a5",
      "1483985988355-763728e1935b",
      "1489987707025-afc232f7ea0f",
    ],
  },
];

const NEUTRAL = [
  "1497366754035-f200968a6e72",
  "1497366811353-6870744d04b2",
  "1521737604893-d14cc237f11d",
  "1524758631624-e2822e304c36",
  "1600880292203-757bb62b4baf",
  "1556761175-b413da4baf72",
];

function fallbackImages(category: string, seed: number, count: number): string[] {
  const pool = POOLS.find((p) => p.match.test(category))?.photos ?? NEUTRAL;
  const start = seed % pool.length;
  return Array.from({ length: count }, (_, i) => U + pool[(start + i) % pool.length] + Q);
}

/* -------------------------------------------------------------------------- */
/*  Identity                                                                   */
/* -------------------------------------------------------------------------- */

type Identity = {
  layout: SiteLayout;
  mode: "light" | "dark";
  accent: string;
  secondary: string;
  onAccent: string;
  images: string[];
  logo?: string | undefined;
  mono: string;
  motion: "subtle" | "rich";
  seed: number;
};

const LAYOUTS: SiteLayout[] = ["editorial", "immersive", "showcase", "minimal"];

function identityOf(lead: Lead, content: SiteSection, template: string): Identity {
  const seed = hashOf(lead.id || lead.placeId || lead.name);
  const accent = hex(content.accent, "#C8A24A");
  const secondary = hex(content.secondary, accent);

  // The AI picks the architecture; when it doesn't, the seed keeps variety.
  const layout: SiteLayout =
    content.layout && LAYOUTS.includes(content.layout)
      ? content.layout
      : (LAYOUTS.find((l) => template.toLowerCase().includes(l)) ??
        LAYOUTS[seed % LAYOUTS.length]!);

  const real = (content.images ?? lead.images ?? []).filter((u) => /^https?:\/\//.test(u));
  const wanted = layout === "showcase" ? 9 : layout === "minimal" ? 3 : 6;
  const images =
    real.length >= wanted
      ? real.slice(0, wanted)
      : [...real, ...fallbackImages(lead.category, seed, wanted - real.length)];

  return {
    layout,
    mode:
      content.mode === "light" || content.mode === "dark"
        ? content.mode
        : layout === "immersive"
          ? "dark"
          : "light",
    accent,
    secondary,
    onAccent: readableOn(accent),
    images,
    logo: content.logo ?? lead.logo,
    mono: initials(lead.name),
    motion: content.motion === "subtle" ? "subtle" : "rich",
    seed,
  };
}

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                     */
/* -------------------------------------------------------------------------- */

function palette(id: Identity): string {
  const dark = id.mode === "dark";
  return `:root{
--accent:${id.accent};--accent2:${id.secondary};--on-accent:${id.onAccent};
--bg:${dark ? "#0a0a0b" : "#ffffff"};
--bg2:${dark ? "#131316" : "#f5f3ef"};
--ink:${dark ? "#f6f4f0" : "#141414"};
--muted:${dark ? "#a3a09a" : "#6b6763"};
--line:${dark ? "rgba(255,255,255,.13)" : "rgba(20,20,20,.12)"};
--card:${dark ? "#141417" : "#ffffff"};
--shadow:${dark ? "0 30px 80px rgba(0,0,0,.6)" : "0 24px 60px rgba(20,20,20,.10)"};
}`;
}

const RESET = `*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit;text-decoration:none}
h1,h2,h3,p,ul,figure{margin:0}ul{padding:0;list-style:none}
.wrap{width:min(1200px,calc(100% - 44px));margin-inline:auto}
.btn{display:inline-flex;align-items:center;gap:.5em;border-radius:999px;font-weight:650;transition:transform .3s cubic-bezier(.2,.7,.3,1),box-shadow .3s,background .3s,color .3s}
.btn:hover{transform:translateY(-2px)}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:var(--accent)}
.rv{transition:opacity .9s cubic-bezier(.2,.7,.3,1),transform .9s cubic-bezier(.2,.7,.3,1)}
.js .rv{opacity:0;transform:translateY(26px)}
.js .rv.in{opacity:1;transform:none}
.rv[data-d="1"]{transition-delay:.09s}.rv[data-d="2"]{transition-delay:.18s}.rv[data-d="3"]{transition-delay:.27s}.rv[data-d="4"]{transition-delay:.36s}.rv[data-d="5"]{transition-delay:.45s}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}}`;

/** Scroll reveals + light parallax. Kept tiny and dependency free. */
const SCRIPT = `<script>
(function(){
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var els=document.querySelectorAll('.rv');
if(rm||!('IntersectionObserver'in window)){els.forEach(function(e){e.classList.add('in')});}
else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.12});els.forEach(function(e){io.observe(e)});}
var px=[].slice.call(document.querySelectorAll('[data-px]'));
if(px.length&&!rm){var t=false;addEventListener('scroll',function(){if(t)return;t=true;requestAnimationFrame(function(){var y=scrollY;px.forEach(function(e){e.style.transform='translate3d(0,'+(y*parseFloat(e.dataset.px)).toFixed(1)+'px,0)'});t=false})},{passive:true});}
var nav=document.querySelector('[data-nav]');
if(nav){addEventListener('scroll',function(){nav.classList.toggle('stuck',scrollY>40)},{passive:true});}
})();
</script>`;

function logoMark(lead: Lead, id: Identity, size = 40): string {
  if (id.logo)
    return (
      '<img class="logoimg" src="' +
      esc(id.logo) +
      '" alt="' +
      esc(lead.name) +
      '" width="' +
      size +
      '" height="' +
      size +
      '">'
    );
  return '<span class="mono">' + esc(id.mono) + "</span>";
}

function gallery(id: Identity, lead: Lead, from: number, count: number): string {
  return id.images
    .slice(from, from + count)
    .map(
      (src, i) =>
        '<figure class="shot rv" data-d="' +
        ((i % 5) + 1) +
        '"><img src="' +
        esc(src) +
        '" alt="' +
        esc(lead.name) +
        " — foto " +
        (i + 1) +
        '" loading="lazy"></figure>',
    )
    .join("");
}

function serviceNote(content: SiteSection, i: number): string {
  const note = content.serviceNotes?.[i];
  return note ? esc(note) : "";
}

function mapsHref(lead: Lead): string {
  const q = [lead.name, lead.address, lead.city].filter(Boolean).join(" ");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

type Parts = { css: string; body: string };

/* -------------------------------------------------------------------------- */
/*  Layout 1 — Editorial                                                       */
/*  Light, magazine typography, asymmetric grid, restrained motion.            */
/* -------------------------------------------------------------------------- */

function editorial(lead: Lead, c: SiteSection, id: Identity): Parts {
  const cta = phoneHref(lead.phone);
  const css = `
body{font-family:"Inter",ui-sans-serif,system-ui,sans-serif;background:var(--bg)}
.serif{font-family:"Georgia","Times New Roman",serif;font-weight:400;letter-spacing:-.02em}
.nav{display:flex;align-items:center;justify-content:space-between;padding:26px 0;position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(12px);transition:box-shadow .3s}
.nav.stuck{box-shadow:0 1px 0 var(--line)}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:-.02em;font-size:16px}
.mono{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);font-size:14px;font-weight:800;letter-spacing:.02em}
.logoimg{width:38px;height:38px;border-radius:10px;object-fit:cover}
.links{display:flex;gap:26px;font-size:14px;color:var(--muted)}.links a:hover{color:var(--ink)}
.navbtn{padding:11px 18px;font-size:13px;border:1px solid var(--ink);background:transparent}
.navbtn:hover{background:var(--ink);color:var(--bg)}
.hero{padding:56px 0 40px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.hero>*{min-width:0}
.hero h1{font-size:clamp(46px,6.4vw,86px);line-height:.95;margin:20px 0 0}
.hero h1 em{font-style:italic;color:var(--accent)}
.sub{margin-top:26px;font-size:19px;line-height:1.65;color:var(--muted);max-width:46ch}
.acts{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}
.primary{background:var(--ink);color:var(--bg);padding:15px 24px;font-size:14px}
.ghost{padding:15px 24px;font-size:14px;border:1px solid var(--line)}
.heroshot{position:relative}
.heroshot img{width:100%;height:min(64vh,560px);object-fit:cover;border-radius:4px}
.rule{display:flex;gap:30px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:56px;padding:22px 0;font-size:13px;color:var(--muted);flex-wrap:wrap}
.rule b{color:var(--ink)}
.sec{padding:110px 0}
.sechead{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:end;margin-bottom:54px}
.sechead h2{font-size:clamp(32px,4.4vw,56px);line-height:1.02}
.sechead p{color:var(--muted);line-height:1.75;font-size:17px}
.list{border-top:1px solid var(--line)}
.item{display:grid;grid-template-columns:70px 1fr 1.1fr;gap:26px;padding:30px 4px;border-bottom:1px solid var(--line);align-items:baseline;transition:padding-left .35s,background .35s}
.item:hover{padding-left:18px;background:var(--bg2)}
.item .n{color:var(--accent);font-size:13px;font-weight:700;letter-spacing:.1em}
.item h3{font-size:clamp(21px,2.4vw,30px);line-height:1.15;font-weight:500}
.item p{color:var(--muted);line-height:1.7;font-size:15px}
.mosaic{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:210px;gap:14px}
.mosaic .shot:nth-child(1){grid-column:span 4;grid-row:span 2}
.mosaic .shot:nth-child(2),.mosaic .shot:nth-child(3){grid-column:span 2}
.mosaic .shot:nth-child(4),.mosaic .shot:nth-child(5){grid-column:span 3}
.shot{overflow:hidden;border-radius:4px;background:var(--bg2)}
.shot img{width:100%;height:100%;object-fit:cover;transition:transform 1.1s cubic-bezier(.2,.7,.3,1)}
.shot:hover img{transform:scale(1.06)}
.about{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center}.about>*{min-width:0}
.about p{font-size:18px;line-height:1.85;color:var(--muted)}
.diffs{margin-top:34px;display:grid;gap:0}
.diffs li{display:flex;gap:16px;padding:18px 0;border-bottom:1px solid var(--line);align-items:baseline}
.diffs i{font-style:normal;color:var(--accent)}
.score{border:1px solid var(--line);padding:44px;border-radius:4px;background:var(--bg2)}
.score .big{font-size:96px;line-height:.9;letter-spacing:-.05em}
.score .lab{color:var(--muted);margin-top:16px;line-height:1.6}
.cta{background:var(--bg2);border-radius:4px;padding:88px 40px;text-align:center}
.cta h2{font-size:clamp(34px,5vw,62px);line-height:1.02;max-width:16ch;margin-inline:auto}
.cta p{color:var(--muted);margin:22px auto 32px;max-width:52ch;line-height:1.75}
.foot{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:34px 0 56px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;margin-top:100px}
@media(max-width:900px){.links{display:none}.nav{padding:18px 0}.hero,.sechead,.about{grid-template-columns:1fr;gap:34px}.hero{padding-top:26px}.heroshot img{height:52vh}.sec{padding:74px 0}.item{grid-template-columns:44px 1fr;gap:14px}.item p{grid-column:2}.mosaic{grid-template-columns:repeat(2,1fr);grid-auto-rows:150px}.mosaic .shot:nth-child(n){grid-column:span 1;grid-row:span 1}.mosaic .shot:nth-child(1){grid-column:span 2}.cta{padding:56px 22px}}`;

  const body = `
<header class="wrap nav" data-nav><a class="brand" href="#top">${logoMark(lead, id)}${esc(lead.name)}</a>
<nav class="links"><a href="#servicos">Serviços</a><a href="#galeria">Galeria</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
<a class="btn navbtn" href="${cta}">${esc(c.cta)}</a></header>
<main id="top">
<section class="wrap hero">
<div><div class="eyebrow">${esc(lead.category)} · ${esc(lead.city)}</div>
<h1 class="serif">${esc(c.headline)}</h1>
<p class="sub">${esc(c.subheadline)}</p>
<div class="acts"><a class="btn primary" href="${cta}">${esc(c.cta)}</a><a class="btn ghost" href="#servicos">Ver serviços</a></div></div>
<div class="heroshot rv"><img src="${esc(id.images[0] ?? "")}" alt="${esc(lead.name)}" loading="eager"></div>
</section>
<div class="wrap"><div class="rule"><span><b>${lead.rating.toFixed(1)}</b> no Google · ${lead.reviews} avaliações</span><span><b>Local</b> ${esc(lead.address || lead.city)}</span>${lead.instagram ? `<span><b>Instagram</b> ${esc(lead.instagram)}</span>` : ""}</div></div>

<section class="sec wrap" id="servicos">
<div class="sechead"><div><div class="eyebrow">O que fazemos</div><h2 class="serif rv">Serviços</h2></div><p class="rv">${esc(c.about)}</p></div>
<div class="list">${c.services
    .filter(Boolean)
    .slice(0, 6)
    .map(
      (s, i) =>
        `<article class="item rv"><span class="n">${String(i + 1).padStart(2, "0")}</span><h3 class="serif">${esc(s)}</h3><p>${serviceNote(c, i)}</p></article>`,
    )
    .join("")}</div></section>

<section class="sec wrap" id="galeria">
<div class="sechead"><div><div class="eyebrow">Por dentro</div><h2 class="serif rv">O ambiente</h2></div><p class="rv">Imagens reais de ${esc(lead.name)}.</p></div>
<div class="mosaic">${gallery(id, lead, 1, 5)}</div></section>

<section class="sec wrap" id="sobre"><div class="about">
<div><div class="eyebrow">Por que escolher</div><h2 class="serif rv" style="font-size:clamp(30px,4vw,52px);margin:12px 0 24px">Detalhes que fazem diferença.</h2>
<p class="rv">${esc(c.about)}</p>
<ul class="diffs">${c.differentials
    .filter(Boolean)
    .slice(0, 4)
    .map((d, i) => `<li class="rv" data-d="${i + 1}"><i>—</i><span>${esc(d)}</span></li>`)
    .join("")}</ul></div>
<div class="score rv"><div class="big serif">${lead.rating.toFixed(1)}</div><div class="lab">de avaliação média no Google,<br>com ${lead.reviews} avaliações públicas.</div></div>
</div></section>

<section class="wrap" id="contato"><div class="cta rv"><div class="eyebrow">Vamos conversar</div>
<h2 class="serif" style="margin-top:14px">Pronto quando você estiver.</h2>
<p>${esc(lead.name)} atende em ${esc(lead.address || lead.city)}. Chame agora e garanta seu horário.</p>
<a class="btn primary" href="${cta}">${esc(c.cta)}</a></div></section>
</main>
<footer class="wrap foot"><span>© ${new Date().getFullYear()} ${esc(lead.name)}</span><a href="${mapsHref(lead)}" target="_blank" rel="noopener">${esc(lead.address || lead.city)} ↗</a></footer>`;

  return { css, body };
}

/* -------------------------------------------------------------------------- */
/*  Layout 2 — Immersive                                                       */
/*  Dark, full-bleed photography, parallax, marquee, heavy motion.             */
/* -------------------------------------------------------------------------- */

function immersive(lead: Lead, c: SiteSection, id: Identity): Parts {
  const cta = phoneHref(lead.phone);
  const marquee = [...c.services.filter(Boolean), esc(lead.city)]
    .slice(0, 8)
    .map((s) => `<span>${esc(s)}</span><i>✦</i>`)
    .join("");
  const css = `
body{font-family:"Inter",ui-sans-serif,system-ui,sans-serif}
.nav{position:fixed;inset:0 0 auto;z-index:30;display:flex;align-items:center;justify-content:space-between;padding:18px max(22px,calc((100vw - 1200px)/2));transition:background .4s,backdrop-filter .4s,padding .4s}
.nav.stuck{background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(16px);padding-block:12px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:12px;font-weight:750;letter-spacing:-.03em}
.mono{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--accent);color:var(--accent);font-weight:800;font-size:13px;box-shadow:0 0 30px color-mix(in srgb,var(--accent) 45%,transparent)}
.logoimg{width:38px;height:38px;border-radius:50%;object-fit:cover}
.links{display:flex;gap:26px;font-size:13px;color:var(--muted)}.links a:hover{color:var(--accent)}
.navbtn{border:1px solid color-mix(in srgb,var(--accent) 55%,transparent);color:var(--accent);padding:11px 18px;font-size:12px}
.navbtn:hover{background:var(--accent);color:var(--on-accent)}
.stage{position:relative;min-height:100svh;display:grid;align-items:center;overflow:hidden}
.stagebg{position:absolute;inset:-12% 0 -12%;z-index:0}
.stagebg img{width:100%;height:124%;object-fit:cover;filter:saturate(.85) contrast(1.05) brightness(.55)}
.stage:after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(90% 70% at 20% 30%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 60%),linear-gradient(180deg,rgba(6,6,7,.55),rgba(6,6,7,.35) 40%,var(--bg))}
.stageinner{position:relative;z-index:2;padding:120px 0 90px}
.stage h1{font-size:clamp(48px,9vw,132px);line-height:.9;letter-spacing:-.055em;margin:18px 0 0;max-width:16ch;font-weight:760}
.stage h1 em{font-style:normal;color:var(--accent);display:inline-block;animation:glow 4.5s ease-in-out infinite}
@keyframes glow{50%{text-shadow:0 0 44px color-mix(in srgb,var(--accent) 65%,transparent)}}
.sub{margin-top:26px;font-size:19px;line-height:1.7;color:#d9d5cf;max-width:52ch}
.acts{display:flex;gap:13px;flex-wrap:wrap;margin-top:38px}
.primary{background:var(--accent);color:var(--on-accent);padding:16px 26px;font-size:14px;box-shadow:0 18px 50px color-mix(in srgb,var(--accent) 34%,transparent)}
.primary:hover{box-shadow:0 26px 70px color-mix(in srgb,var(--accent) 50%,transparent)}
.ghost{padding:16px 26px;font-size:14px;border:1px solid var(--line);backdrop-filter:blur(8px)}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:44px}
.chip{border:1px solid var(--line);background:rgba(255,255,255,.05);backdrop-filter:blur(10px);border-radius:999px;padding:10px 16px;font-size:12px;color:#e6e2db}
.chip b{color:var(--accent)}
.marq{border-block:1px solid var(--line);overflow:hidden;padding:16px 0;background:var(--bg2)}
.marq div{display:flex;gap:26px;align-items:center;width:max-content;animation:slide 26s linear infinite;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.marq i{color:var(--accent);font-style:normal}
@keyframes slide{to{transform:translateX(-50%)}}
.sec{padding:130px 0}
.sechead{max-width:760px;margin-bottom:56px}
.sechead h2{font-size:clamp(34px,5.4vw,72px);line-height:.98;letter-spacing:-.05em;margin:14px 0 18px}
.sechead p{color:var(--muted);line-height:1.75;font-size:17px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{position:relative;border:1px solid var(--line);border-radius:20px;padding:30px;min-height:250px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02));overflow:hidden;transition:transform .45s cubic-bezier(.2,.7,.3,1),border-color .45s}
.card:before{content:"";position:absolute;inset:auto -30% -60% auto;width:240px;height:240px;border-radius:50%;background:var(--accent);filter:blur(70px);opacity:0;transition:opacity .5s}
.card:hover{transform:translateY(-10px);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.card:hover:before{opacity:.22}
.card .n{color:var(--accent);font-size:12px;letter-spacing:.14em}
.card h3{font-size:24px;letter-spacing:-.035em;margin-top:auto;font-weight:650}
.card p{color:var(--muted);font-size:14px;line-height:1.6;margin-top:10px}
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
.shot{overflow:hidden;border-radius:16px;height:290px;background:var(--bg2)}
.shot img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.7,.3,1),filter .6s;filter:grayscale(.25)}
.shot:hover img{transform:scale(1.08);filter:none}
.split{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center}.split>*{min-width:0}
.split p{color:var(--muted);font-size:18px;line-height:1.85}
.diffs{margin-top:30px;display:grid;gap:14px}
.diffs li{display:flex;gap:14px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:14px}
.diffs i{color:var(--accent);font-style:normal}
.panel{border:1px solid var(--line);border-radius:26px;padding:48px;background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 16%,var(--bg2)),var(--bg2));position:relative;overflow:hidden}
.panel:before{content:"";position:absolute;width:320px;height:320px;right:-90px;top:-90px;border-radius:50%;background:var(--accent2);filter:blur(90px);opacity:.25;animation:pulse 6s ease-in-out infinite}
@keyframes pulse{50%{transform:scale(1.2);opacity:.35}}
.panel .big{font-size:92px;line-height:.9;letter-spacing:-.07em;color:var(--accent)}
.panel .lab{color:var(--muted);margin-top:14px;line-height:1.6}
.final{position:relative;border-radius:28px;overflow:hidden;padding:110px 40px;text-align:center;border:1px solid var(--line)}
.final img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.35) saturate(.8)}
.final .in2{position:relative;z-index:2}
.final h2{font-size:clamp(34px,5.6vw,68px);line-height:1;letter-spacing:-.05em;max-width:16ch;margin-inline:auto}
.final p{color:#ded9d2;margin:22px auto 32px;max-width:54ch;line-height:1.75}
.foot{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:36px 0 58px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:110px}
@media(max-width:900px){.links{display:none}.stageinner{padding:130px 0 70px}.sec{padding:84px 0}.cards{grid-template-columns:1fr}.strip{grid-template-columns:1fr 1fr}.shot{height:200px}.split{grid-template-columns:1fr;gap:36px}.panel{padding:32px}.final{padding:70px 22px}}`;

  const body = `
<header class="nav" data-nav><a class="brand" href="#top">${logoMark(lead, id)}${esc(lead.name)}</a>
<nav class="links"><a href="#servicos">Serviços</a><a href="#galeria">Galeria</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
<a class="btn navbtn" href="${cta}">${esc(c.cta)} ↗</a></header>
<main id="top">
<section class="stage"><div class="stagebg" data-px="0.16"><img src="${esc(id.images[0] ?? "")}" alt="${esc(lead.name)}" loading="eager"></div>
<div class="wrap stageinner"><div class="eyebrow rv">${esc(lead.category)} · ${esc(lead.city)}</div>
<h1 class="rv" data-d="1">${esc(c.headline)}</h1>
<p class="sub rv" data-d="2">${esc(c.subheadline)}</p>
<div class="acts rv" data-d="3"><a class="btn primary" href="${cta}">${esc(c.cta)} ↗</a><a class="btn ghost" href="#servicos">Explorar</a></div>
<div class="chips rv" data-d="4"><span class="chip"><b>${lead.rating.toFixed(1)}/5</b> · ${lead.reviews} avaliações no Google</span><span class="chip">${esc(lead.address || lead.city)}</span>${lead.instagram ? `<span class="chip">${esc(lead.instagram)}</span>` : ""}</div>
</div></section>

<div class="marq"><div>${marquee}${marquee}</div></div>

<section class="sec wrap" id="servicos">
<div class="sechead"><div class="eyebrow">O que fazemos</div><h2 class="rv">Feito para impressionar.</h2><p class="rv">${esc(c.about)}</p></div>
<div class="cards">${c.services
    .filter(Boolean)
    .slice(0, 6)
    .map(
      (s, i) =>
        `<article class="card rv" data-d="${(i % 3) + 1}"><span class="n">${String(i + 1).padStart(2, "0")}</span><h3>${esc(s)}</h3><p>${serviceNote(c, i)}</p></article>`,
    )
    .join("")}</div></section>

<section class="sec wrap" id="galeria" style="padding-top:0">
<div class="sechead"><div class="eyebrow">Galeria</div><h2 class="rv">Por dentro de ${esc(lead.name)}.</h2></div>
<div class="strip">${gallery(id, lead, 1, 4)}</div></section>

<section class="sec wrap" id="sobre"><div class="split">
<div><div class="eyebrow">Por que escolher</div><h2 class="rv" style="font-size:clamp(30px,4.4vw,56px);letter-spacing:-.05em;line-height:1.02;margin:14px 0 22px">Cada detalhe importa.</h2>
<p class="rv">${esc(c.about)}</p>
<ul class="diffs">${c.differentials
    .filter(Boolean)
    .slice(0, 4)
    .map((d, i) => `<li class="rv" data-d="${i + 1}"><i>✦</i><span>${esc(d)}</span></li>`)
    .join("")}</ul></div>
<div class="panel rv"><div class="big">${lead.rating.toFixed(1)}</div><div class="lab">de avaliação média no Google<br>com ${lead.reviews} avaliações públicas</div></div>
</div></section>

<section class="wrap" id="contato"><div class="final rv"><img src="${esc(id.images[id.images.length - 1] ?? "")}" alt="" loading="lazy">
<div class="in2"><div class="eyebrow">Vamos conversar</div><h2 style="margin-top:14px">${esc(c.cta)} hoje mesmo.</h2>
<p>${esc(lead.name)} · ${esc(lead.address || lead.city)}</p>
<a class="btn primary" href="${cta}">${esc(c.cta)} ↗</a></div></div></section>
</main>
<footer class="wrap foot"><span>© ${new Date().getFullYear()} ${esc(lead.name)}</span><a href="${mapsHref(lead)}" target="_blank" rel="noopener">Como chegar ↗</a></footer>`;

  return { css, body };
}

/* -------------------------------------------------------------------------- */
/*  Layout 3 — Showcase                                                        */
/*  The most complete page: sticky nav, gallery grid, services, stats,         */
/*  location and a contact block.                                              */
/* -------------------------------------------------------------------------- */

function showcase(lead: Lead, c: SiteSection, id: Identity): Parts {
  const cta = phoneHref(lead.phone);
  const css = `
body{font-family:"Inter",ui-sans-serif,system-ui,sans-serif;background:var(--bg)}
.nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px max(22px,calc((100vw - 1200px)/2));background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);transition:box-shadow .3s}
.nav.stuck{box-shadow:0 6px 30px rgba(0,0,0,.10)}
.brand{display:flex;align-items:center;gap:12px;font-weight:750;letter-spacing:-.025em}
.mono{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(140deg,var(--accent),var(--accent2));color:var(--on-accent);font-weight:800;font-size:14px}
.logoimg{width:42px;height:42px;border-radius:14px;object-fit:cover}
.links{display:flex;gap:24px;font-size:14px;color:var(--muted)}.links a:hover{color:var(--accent)}
.navbtn{background:var(--accent);color:var(--on-accent);padding:12px 20px;font-size:13px;box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 30%,transparent)}
.hero{display:grid;grid-template-columns:1.02fr .98fr;gap:56px;align-items:center;padding:64px 0 70px}
.hero>*{min-width:0}
.hero h1{font-size:clamp(42px,5.6vw,76px);line-height:1;letter-spacing:-.045em;margin:18px 0 0}
.hero h1 em{font-style:normal;background:linear-gradient(120deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:22px;font-size:18px;line-height:1.7;color:var(--muted);max-width:48ch}
.acts{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}
.primary{background:var(--accent);color:var(--on-accent);padding:15px 24px;font-size:14px;box-shadow:0 16px 40px color-mix(in srgb,var(--accent) 28%,transparent)}
.ghost{padding:15px 24px;font-size:14px;border:1px solid var(--line)}
.trust{display:flex;gap:22px;margin-top:34px;flex-wrap:wrap;color:var(--muted);font-size:13px;align-items:center}
.stars{color:var(--accent);letter-spacing:2px}
.collage{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,170px);gap:12px;min-width:0}
.collage .shot{border-radius:24px}
.collage .shot:nth-child(1){grid-column:1;grid-row:1 / span 2}
.collage .shot:nth-child(2){grid-column:2;grid-row:1 / span 2}
.collage .shot:nth-child(3){grid-column:1 / span 2;grid-row:3}
.shot{overflow:hidden;border-radius:20px;background:var(--bg2);box-shadow:var(--shadow)}
.shot img{width:100%;height:100%;object-fit:cover;transition:transform 1s cubic-bezier(.2,.7,.3,1)}
.shot:hover img{transform:scale(1.07)}
.band{background:var(--bg2);border-block:1px solid var(--line)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:46px 0;text-align:center}
.stats b{display:block;font-size:38px;letter-spacing:-.04em;color:var(--accent);line-height:1}
.stats span{color:var(--muted);font-size:13px;display:block;margin-top:8px}
.sec{padding:100px 0}
.sechead{text-align:center;max-width:680px;margin:0 auto 52px}
.sechead h2{font-size:clamp(30px,4.4vw,52px);line-height:1.05;letter-spacing:-.04em;margin:12px 0 16px}
.sechead p{color:var(--muted);line-height:1.75}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{border:1px solid var(--line);border-radius:22px;padding:28px;background:var(--card);box-shadow:var(--shadow);transition:transform .4s cubic-bezier(.2,.7,.3,1),box-shadow .4s}
.card:hover{transform:translateY(-8px)}
.ico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent);font-weight:800;font-size:14px;margin-bottom:20px}
.card h3{font-size:20px;letter-spacing:-.025em}
.card p{color:var(--muted);line-height:1.65;font-size:14.5px;margin-top:10px}
.gal{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:230px;gap:14px}
.gal .shot:nth-child(3n+1){grid-row:span 1}
.about{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}.about>*{min-width:0}
.about p{color:var(--muted);font-size:17px;line-height:1.85}
.diffs{margin-top:28px;display:grid;gap:12px}
.diffs li{display:flex;gap:12px;align-items:flex-start;background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.diffs i{color:var(--accent);font-style:normal}
.aboutimg{border-radius:26px;overflow:hidden;height:480px;box-shadow:var(--shadow)}
.aboutimg img{width:100%;height:100%;object-fit:cover}
.contact{display:grid;grid-template-columns:1.05fr .95fr;gap:0;border:1px solid var(--line);border-radius:26px;overflow:hidden;box-shadow:var(--shadow)}
.cbox{padding:56px 46px;background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 14%,var(--card)),var(--card))}
.cbox h2{font-size:clamp(28px,3.6vw,44px);letter-spacing:-.04em;line-height:1.05;margin:12px 0 16px}
.cbox p{color:var(--muted);line-height:1.75}
.info{margin:26px 0 30px;display:grid;gap:14px;font-size:15px}
.info div{display:flex;gap:12px;align-items:center}.info i{font-style:normal;color:var(--accent)}
.cimg{min-height:100%}.cimg img{width:100%;height:100%;object-fit:cover;min-height:380px}
.foot{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:34px 0 56px;border-top:1px solid var(--line);margin-top:90px;color:var(--muted);font-size:13px}
@media(max-width:900px){.links{display:none}.hero{grid-template-columns:1fr;gap:36px;padding-top:34px}.collage{grid-template-rows:150px 150px 150px}.stats{grid-template-columns:1fr 1fr;gap:28px;padding:34px 0}.sec{padding:70px 0}.grid,.gal{grid-template-columns:1fr}.gal{grid-auto-rows:210px}.about{grid-template-columns:1fr;gap:32px}.aboutimg{height:320px}.contact{grid-template-columns:1fr}.cbox{padding:36px 24px}}`;

  const stars = "★★★★★".slice(0, Math.max(1, Math.round(lead.rating)));

  const body = `
<header class="nav" data-nav><a class="brand" href="#top">${logoMark(lead, id)}${esc(lead.name)}</a>
<nav class="links"><a href="#servicos">Serviços</a><a href="#galeria">Galeria</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
<a class="btn navbtn" href="${cta}">${esc(c.cta)}</a></header>
<main id="top">
<section class="wrap hero">
<div><div class="eyebrow">${esc(lead.category)} · ${esc(lead.city)}</div>
<h1 class="rv">${esc(c.headline)}</h1>
<p class="sub rv" data-d="1">${esc(c.subheadline)}</p>
<div class="acts rv" data-d="2"><a class="btn primary" href="${cta}">${esc(c.cta)}</a><a class="btn ghost" href="#galeria">Ver a galeria</a></div>
<div class="trust rv" data-d="3"><span class="stars">${stars}</span><span><b>${lead.rating.toFixed(1)}</b> · ${lead.reviews} avaliações no Google</span><span>${esc(lead.address || lead.city)}</span></div></div>
<div class="collage rv">${gallery(id, lead, 0, 3)}</div>
</section>

<div class="band"><div class="wrap stats">
<div class="rv"><b>${lead.rating.toFixed(1)}</b><span>nota no Google</span></div>
<div class="rv" data-d="1"><b>${lead.reviews}</b><span>avaliações reais</span></div>
<div class="rv" data-d="2"><b>${c.services.filter(Boolean).length || 4}</b><span>serviços oferecidos</span></div>
<div class="rv" data-d="3"><b>${esc(lead.city.split(",")[0] ?? lead.city)}</b><span>atendimento local</span></div>
</div></div>

<section class="sec wrap" id="servicos">
<div class="sechead"><div class="eyebrow">Serviços</div><h2 class="rv">Tudo o que oferecemos</h2><p class="rv">${esc(c.about)}</p></div>
<div class="grid">${c.services
    .filter(Boolean)
    .slice(0, 6)
    .map(
      (s, i) =>
        `<article class="card rv" data-d="${(i % 3) + 1}"><div class="ico">${String(i + 1).padStart(2, "0")}</div><h3>${esc(s)}</h3><p>${serviceNote(c, i)}</p></article>`,
    )
    .join("")}</div></section>

<section class="sec wrap" id="galeria" style="padding-top:0">
<div class="sechead"><div class="eyebrow">Galeria</div><h2 class="rv">Fotos do nosso espaço</h2></div>
<div class="gal">${gallery(id, lead, 3, 6)}</div></section>

<section class="sec wrap" id="sobre"><div class="about">
<div><div class="eyebrow">Sobre nós</div><h2 class="rv" style="font-size:clamp(28px,4vw,48px);letter-spacing:-.04em;line-height:1.05;margin:12px 0 20px">${esc(lead.name)}</h2>
<p class="rv">${esc(c.about)}</p>
<ul class="diffs">${c.differentials
    .filter(Boolean)
    .slice(0, 4)
    .map((d, i) => `<li class="rv" data-d="${i + 1}"><i>✓</i><span>${esc(d)}</span></li>`)
    .join("")}</ul></div>
<div class="aboutimg rv"><img src="${esc(id.images[2] ?? id.images[0] ?? "")}" alt="${esc(lead.name)}" loading="lazy"></div>
</div></section>

<section class="wrap" id="contato"><div class="contact rv">
<div class="cbox"><div class="eyebrow">Contato</div><h2>Fale com a gente</h2>
<p>Atendemos em ${esc(lead.city)}. Chame no WhatsApp e responda rápido.</p>
<div class="info"><div><i>◉</i><span>${esc(lead.address || lead.city)}</span></div>
${lead.phone ? `<div><i>✆</i><span>${esc(lead.phone)}</span></div>` : ""}
${lead.instagram ? `<div><i>◎</i><span>${esc(lead.instagram)}</span></div>` : ""}
<div><i>★</i><span>${lead.rating.toFixed(1)} de ${lead.reviews} avaliações no Google</span></div></div>
<a class="btn primary" href="${cta}">${esc(c.cta)}</a></div>
<div class="cimg"><img src="${esc(id.images[1] ?? id.images[0] ?? "")}" alt="${esc(lead.name)}" loading="lazy"></div>
</div></section>
</main>
<footer class="wrap foot"><span>© ${new Date().getFullYear()} ${esc(lead.name)}</span><a href="${mapsHref(lead)}" target="_blank" rel="noopener">Ver no mapa ↗</a></footer>`;

  return { css, body };
}

/* -------------------------------------------------------------------------- */
/*  Layout 4 — Minimal                                                         */
/*  Extreme whitespace, one strong image, quiet motion.                        */
/* -------------------------------------------------------------------------- */

function minimal(lead: Lead, c: SiteSection, id: Identity): Parts {
  const cta = phoneHref(lead.phone);
  const css = `
body{font-family:"Inter",ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em}
.wrap{width:min(940px,calc(100% - 44px))}
.nav{display:flex;align-items:center;justify-content:space-between;padding:34px 0;font-size:13px}
.brand{display:flex;align-items:center;gap:11px;font-weight:600}
.mono{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);font-size:12px;font-weight:700}
.logoimg{width:32px;height:32px;border-radius:50%;object-fit:cover}
.links{display:flex;gap:22px;color:var(--muted)}.links a:hover{color:var(--ink)}
.hero{padding:96px 0 72px;max-width:780px}
.hero h1{font-size:clamp(38px,5.6vw,68px);line-height:1.04;letter-spacing:-.045em;font-weight:600;margin:22px 0 0}
.hero h1 em{font-style:normal;color:var(--accent)}
.sub{margin-top:24px;font-size:19px;line-height:1.75;color:var(--muted);max-width:52ch}
.acts{display:flex;gap:14px;flex-wrap:wrap;margin-top:36px;align-items:center}
.primary{background:var(--ink);color:var(--bg);padding:14px 24px;font-size:14px}
.link{font-size:14px;color:var(--muted);border-bottom:1px solid var(--line);border-radius:0;padding-bottom:3px}
.link:hover{color:var(--accent);border-color:var(--accent)}
.cover{margin:20px 0 0;border-radius:2px;overflow:hidden;height:min(60vh,520px)}
.cover img{width:100%;height:100%;object-fit:cover;transition:transform 1.4s cubic-bezier(.2,.7,.3,1)}
.cover:hover img{transform:scale(1.03)}
.meta{display:flex;gap:28px;flex-wrap:wrap;padding:20px 0 0;color:var(--muted);font-size:13px}
.meta b{color:var(--ink);font-weight:600}
.sec{padding:104px 0}
.lab{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:34px}
.sec h2{font-size:clamp(26px,3.4vw,38px);line-height:1.2;letter-spacing:-.035em;font-weight:600;max-width:22ch}
.body{margin-top:22px;font-size:17px;line-height:1.9;color:var(--muted);max-width:62ch}
.svc{display:grid;grid-template-columns:1fr 1fr;gap:2px 60px;margin-top:8px}
.svc li{padding:22px 0;border-bottom:1px solid var(--line)}
.svc h3{font-size:18px;font-weight:600;letter-spacing:-.02em}
.svc p{color:var(--muted);font-size:14.5px;line-height:1.65;margin-top:6px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:44px}
.shot{overflow:hidden;border-radius:2px;height:300px;background:var(--bg2)}
.shot img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.7,.3,1)}
.shot:hover img{transform:scale(1.05)}
.diffs{display:grid;gap:0;margin-top:26px;max-width:640px}
.diffs li{display:flex;gap:18px;padding:18px 0;border-bottom:1px solid var(--line);align-items:baseline}
.diffs i{font-style:normal;color:var(--accent);font-size:12px}
.end{padding:120px 0;border-top:1px solid var(--line)}
.end h2{font-size:clamp(30px,4.4vw,52px);letter-spacing:-.045em;line-height:1.06;max-width:18ch}
.end p{color:var(--muted);margin-top:20px;line-height:1.8;max-width:48ch}
.foot{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:0 0 60px;color:var(--muted);font-size:12px}
@media(max-width:800px){.links{display:none}.hero{padding:54px 0 44px}.sec{padding:66px 0}.svc,.pair{grid-template-columns:1fr}.shot{height:230px}.end{padding:74px 0}}`;

  const body = `
<header class="wrap nav"><a class="brand" href="#top">${logoMark(lead, id)}${esc(lead.name)}</a>
<nav class="links"><a href="#servicos">Serviços</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
<a class="link" href="${cta}">${esc(c.cta)} →</a></header>
<main id="top">
<section class="wrap hero"><div class="eyebrow">${esc(lead.category)} · ${esc(lead.city)}</div>
<h1 class="rv">${esc(c.headline)}</h1><p class="sub rv" data-d="1">${esc(c.subheadline)}</p>
<div class="acts rv" data-d="2"><a class="btn primary" href="${cta}">${esc(c.cta)}</a><a class="link" href="#servicos">Conheça o trabalho</a></div></section>
<div class="wrap"><div class="cover rv"><img src="${esc(id.images[0] ?? "")}" alt="${esc(lead.name)}" loading="eager"></div>
<div class="meta"><span><b>${lead.rating.toFixed(1)}</b> no Google</span><span><b>${lead.reviews}</b> avaliações</span><span>${esc(lead.address || lead.city)}</span></div></div>

<section class="sec wrap" id="servicos"><div class="lab">Serviços</div>
<h2 class="rv">O que fazemos</h2>
<ul class="svc">${c.services
    .filter(Boolean)
    .slice(0, 6)
    .map(
      (s, i) =>
        `<li class="rv" data-d="${(i % 3) + 1}"><h3>${esc(s)}</h3><p>${serviceNote(c, i)}</p></li>`,
    )
    .join("")}</ul>
<div class="pair">${gallery(id, lead, 1, 2)}</div></section>

<section class="sec wrap" id="sobre"><div class="lab">Sobre</div>
<h2 class="rv">${esc(lead.name)}</h2><p class="body rv">${esc(c.about)}</p>
<ul class="diffs">${c.differentials
    .filter(Boolean)
    .slice(0, 4)
    .map((d, i) => `<li class="rv" data-d="${i + 1}"><i>0${i + 1}</i><span>${esc(d)}</span></li>`)
    .join("")}</ul></section>

<section class="wrap end" id="contato"><div class="lab">Contato</div>
<h2 class="rv">Vamos conversar.</h2>
<p class="rv">${esc(lead.name)} · ${esc(lead.address || lead.city)}${lead.phone ? " · " + esc(lead.phone) : ""}</p>
<div class="acts"><a class="btn primary" href="${cta}">${esc(c.cta)}</a><a class="link" href="${mapsHref(lead)}" target="_blank" rel="noopener">Ver no mapa</a></div></section>
</main>
<footer class="wrap foot"><span>© ${new Date().getFullYear()} ${esc(lead.name)}</span><span>${esc(lead.city)}</span></footer>`;

  return { css, body };
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                                */
/* -------------------------------------------------------------------------- */

const BUILDERS: Record<SiteLayout, (l: Lead, c: SiteSection, i: Identity) => Parts> = {
  editorial,
  immersive,
  showcase,
  minimal,
};

export function renderSiteHtml(lead: Lead, content: SiteSection, template: string): string {
  const id = identityOf(lead, content, template);
  const { css, body } = BUILDERS[id.layout](lead, content, id);
  const description = (content.subheadline || content.about || lead.name).slice(0, 155);

  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    // Only arm the scroll reveals when scripts can actually undo them.
    '<script>document.documentElement.className+=" js"</script>' +
    '<meta name="theme-color" content="' +
    (id.mode === "dark" ? "#0a0a0b" : "#ffffff") +
    '">' +
    '<meta name="description" content="' +
    esc(description) +
    '">' +
    '<meta property="og:title" content="' +
    esc(lead.name) +
    '"><meta property="og:description" content="' +
    esc(description) +
    '"><meta property="og:image" content="' +
    esc(id.images[0] ?? "") +
    '"><meta property="og:type" content="website">' +
    "<title>" +
    esc(lead.name) +
    " — " +
    esc(lead.category) +
    "</title><style>" +
    palette(id) +
    RESET +
    css +
    "</style></head><body>" +
    body +
    SCRIPT +
    "</body></html>"
  );
}
