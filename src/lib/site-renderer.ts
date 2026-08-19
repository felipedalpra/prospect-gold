import type {
  Lead,
  SiteBlock,
  SiteBlockKind,
  SiteLayout,
  SiteSection,
  SiteTypeface,
} from "./types";
import { SITE_BLOCK_KINDS, SITE_TYPEFACES } from "./types";

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

/**
 * Picks from a list starting at the AI's choice and stepping by the lead's own
 * seed. The AI's taste sets the starting point; the seed guarantees that two
 * businesses in the same segment — which the AI almost always answers
 * identically for — never land on the same value.
 */
function rotate<T>(list: readonly T[], current: T | undefined, seed: number): T {
  const at = list.indexOf(current as T);
  return list[(((at < 0 ? 0 : at) + seed) % list.length + list.length) % list.length]!;
}

/**
 * Rotates a colour's hue while keeping its saturation and lightness, so the
 * AI's read of the business survives but the exact palette does not repeat
 * across a segment.
 */
function shiftHue(color: string, degrees: number): string {
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return color;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h / 6) * 360 + degrees) % 360 + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    const x = (t + 1) % 1;
    const v =
      x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    return Math.round(v * 255);
  };
  return (
    "#" +
    [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
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
    // Therapy is not a medical-equipment business: consulting rooms, quiet
    // interiors and human gestures — never a dentist's chair or a lab coat.
    // Kept above the clinical pool so "Psicólogo" never falls into it.
    match:
      /psic|psiqui|psican|neuropsi|saúde mental|saude mental|terapia de casal|terapia familiar/i,
    photos: [
      "1519710164239-da123dc03ef4",
      "1544027993-37dbfe43562a",
      "1522708323590-d24dbb6b0267",
      "1493663284031-b7e3aefcae8e",
      "1586023492125-27b2c045efd7",
      "1517971129774-8a2b38fa128e",
      "1567016432779-094069958ea5",
      "1512389142860-9c449e58a543",
      "1600607687920-4e2a09cf159d",
      "1490578474895-699cd4e2cf59",
      "1517842645767-c639042777db",
    ],
  },
  {
    match: /dent|odonto|clínic|clinic|médic|medic|saúde|saude|fisioter|laborat/i,
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

/**
 * Stock only ever fills the gaps left by the business's own photos. The pool is
 * walked with a seeded start AND a seeded stride, so two businesses in the same
 * segment get different photos in a different order rather than the same three.
 */
function fallbackImages(category: string, seed: number, count: number, offset = 0): string[] {
  const matched = POOLS.find((p) => p.match.test(category))?.photos ?? [];
  // The neutral office shots only pad a segment pool that cannot fill the page
  // on its own — they are the last resort, never mixed in by default.
  const pool =
    matched.length >= count ? matched : matched.length > 0 ? [...matched, ...NEUTRAL] : NEUTRAL;
  const strides = [1, 3, 5, 7];
  const stride = strides[seed % strides.length]!;
  const start = seed % pool.length;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < count && i < pool.length * 2; i++) {
    const id = pool[(start + (i + offset) * stride) % pool.length]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(U + id + Q);
  }
  return out;
}
/* -------------------------------------------------------------------------- */
/*  Identity                                                                   */
/*  Layout, typography, colour and shape form the "visual system"; the block   */
/*  list below decides which sections exist and in what order. Two businesses  */
/*  in the same segment differ on both axes, not just on the copy.             */
/* -------------------------------------------------------------------------- */

type Identity = {
  layout: SiteLayout;
  typeface: SiteTypeface;
  shape: "sharp" | "soft" | "round";
  mode: "light" | "dark";
  accent: string;
  secondary: string;
  onAccent: string;
  images: string[];
  logo?: string | undefined;
  mono: string;
  motion: "subtle" | "rich";
  seed: number;
  blocks: SiteBlock[];
};

const LAYOUTS: SiteLayout[] = ["editorial", "immersive", "showcase", "minimal"];

/** How many photos a page wants, given how image-hungry its blocks are. */
function imageBudget(blocks: SiteBlock[]): number {
  let n = 2;
  for (const b of blocks) {
    if (b.kind === "gallery")
      n += b.variant === "grid" ? 6 : b.variant === "strip" ? 5 : b.variant === "duo" ? 2 : 4;
    if (b.kind === "about") n += 1;
    if (b.kind === "services" && b.variant === "alternating") n += 2;
  }
  return Math.min(12, Math.max(3, n));
}

/**
 * Fallback composition for sites generated before the AI started choosing one,
 * and for responses that omit it. Seeded so it still varies per business.
 */
function defaultBlocks(layout: SiteLayout, seed: number): SiteBlock[] {
  const pick = <T>(list: T[], salt: number): T => list[(seed + salt) % list.length]!;
  const hero = pick(["split", "full", "stacked", "frame"], 1);
  const services = pick(["cards", "list", "alternating", "grid"], 2);
  const gal = pick(["mosaic", "strip", "grid", "duo"], 3);
  const middle: SiteBlock[] = [
    { kind: "services", variant: services },
    { kind: "gallery", variant: gal },
    { kind: "about", variant: pick(["split", "wide", "overlap"], 4) },
    { kind: "differentials", variant: pick(["rows", "cards", "icons"], 5) },
  ];
  // Rotate the middle so the page does not always run services → gallery.
  const cut = seed % middle.length;
  const ordered = [...middle.slice(cut), ...middle.slice(0, cut)];
  const extras: SiteBlock[] =
    layout === "minimal"
      ? [{ kind: "quote", variant: "band" }]
      : [
          { kind: "stats", variant: pick(["bar", "cards"], 6) },
          seed % 2 === 0
            ? { kind: "quote", variant: "band" }
            : { kind: "cta", variant: pick(["band", "split"], 7) },
        ];
  return [{ kind: "hero", variant: hero }, ...extras.slice(0, 1), ...ordered, ...extras.slice(1)];
}

/** The treatments each kind of block can be drawn with. */
const VARIANTS: Record<SiteBlockKind, readonly string[]> = {
  hero: ["split", "full", "stacked", "frame"],
  stats: ["bar", "cards"],
  services: ["cards", "list", "grid", "alternating"],
  gallery: ["mosaic", "strip", "grid", "duo"],
  about: ["split", "wide", "overlap"],
  differentials: ["rows", "cards", "icons"],
  process: ["steps", "timeline"],
  faq: ["list"],
  quote: ["band"],
  cta: ["band", "split"],
};

function normalizeBlocks(
  raw: SiteBlock[] | undefined,
  layout: SiteLayout,
  seed: number,
): SiteBlock[] {
  const composed =
    !Array.isArray(raw) || raw.length === 0
      ? defaultBlocks(layout, seed)
      : (() => {
          const clean = raw.filter((b) => b && SITE_BLOCK_KINDS.includes(b.kind));
          if (clean.length < 3) return defaultBlocks(layout, seed);
          // Exactly one hero, always first. The middle is rotated by the lead's
          // own seed, because the AI hands every business in a segment the same
          // running order.
          const hero =
            clean.find((b) => b.kind === "hero") ?? ({ kind: "hero", variant: "split" } as SiteBlock);
          const rest = clean.filter((b) => b.kind !== "hero").slice(0, 9);
          const tail = rest.length > 1 && rest[rest.length - 1]!.kind === "cta" ? rest.pop()! : null;
          const cut = rest.length > 1 ? seed % rest.length : 0;
          const middle = [...rest.slice(cut), ...rest.slice(0, cut)];
          return [hero, ...middle, ...(tail ? [tail] : [])];
        })();
  // Same reason, one level down: the treatment of each section is stepped from
  // whatever the AI asked for, so no two pages are drawn the same way.
  return composed
    .slice(0, 10)
    .map((b, i) => ({ ...b, variant: rotate(VARIANTS[b.kind], b.variant, seed + i * 3) }));
}

/**
 * `remix` produces an alternative take on the same copy: the AI's architecture
 * and typography are set aside and re-derived from a shifted seed, so the
 * seller gets a genuinely different page to choose from without paying for a
 * second generation.
 */
function identityOf(lead: Lead, content: SiteSection, template: string, remix = 0): Identity {
  const seed = hashOf(lead.id || lead.placeId || lead.name) + remix * 7919;
  const chosen =
    remix > 0
      ? ({
          ...content,
          blocks: undefined,
          layout: undefined,
          typeface: undefined,
          shape: undefined,
        } as SiteSection)
      : content;
  // The AI reliably answers "psicólogo" (and every other segment) with the same
  // palette, so its colour is a starting hue, not the final one.
  const accent = shiftHue(hex(chosen.accent, "#C8A24A"), ((seed % 9) - 4) * 14);
  const secondary = shiftHue(hex(chosen.secondary, accent), (((seed >> 3) % 9) - 4) * 14);

  const layoutBase: SiteLayout =
    chosen.layout && LAYOUTS.includes(chosen.layout)
      ? chosen.layout
      : (LAYOUTS.find((l) => template.toLowerCase().includes(l)) ?? LAYOUTS[0]!);
  const layout = rotate(LAYOUTS, layoutBase, seed);

  const blocks = normalizeBlocks(chosen.blocks, layout, seed);

  const real = (chosen.images ?? lead.images ?? []).filter((u) => /^https?:\/\//.test(u));
  const wanted = imageBudget(blocks);
  const images =
    real.length >= wanted
      ? real.slice(0, wanted)
      : [...real, ...fallbackImages(lead.category, seed, wanted - real.length, real.length)];

  const typeface = rotate(
    SITE_TYPEFACES,
    chosen.typeface && SITE_TYPEFACES.includes(chosen.typeface) ? chosen.typeface : undefined,
    seed,
  );

  const shapes = ["sharp", "soft", "round"] as const;

  return {
    layout,
    typeface,
    shape: rotate(
      shapes,
      chosen.shape === "sharp" || chosen.shape === "soft" || chosen.shape === "round"
        ? chosen.shape
        : undefined,
      seed,
    ),
    // A dark page is a strong choice, so it is kept when the AI asks for one,
    // and otherwise handed to a minority of leads rather than to a whole layout.
    mode:
      chosen.mode === "dark" || layout === "immersive" || seed % 5 === 0 ? "dark" : "light",
    accent,
    secondary,
    onAccent: readableOn(accent),
    images,
    logo: chosen.logo ?? lead.logo,
    mono: initials(lead.name),
    motion: chosen.motion === "subtle" ? "subtle" : "rich",
    seed,
    blocks,
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

function mapsHref(lead: Lead): string {
  const q = [lead.name, lead.address, lead.city].filter(Boolean).join(" ");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

/**
 * The AI sometimes writes a whole sentence — phone number included — into the
 * CTA. A button label is two or three words, and the number belongs in the
 * link, never in the copy.
 */
function ctaLabel(raw: string): string {
  const clean = raw
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "")
    .replace(/\bligue\b|\bwhats?app\b|\bpara\b|\bno\b/gi, (m) => (/whats/i.test(m) ? m : ""))
    .replace(/[.!]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return "Falar no WhatsApp";
  const label = words.join(" ");
  return label.length > 34 ? "Falar no WhatsApp" : label;
}

const WHATS_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">' +
  '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.07-.13-.27-.2-.57-.35z"/>' +
  '<path d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.33 4.94L2 22l5.34-1.4a9.85 9.85 0 0 0 4.7 1.2h.01c5.43 0 9.86-4.43 9.86-9.87 0-2.64-1.03-5.12-2.9-6.98A9.8 9.8 0 0 0 12.04 2zm0 18.06h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.35c0-4.52 3.68-8.2 8.2-8.2 2.2 0 4.26.86 5.81 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2z"/></svg>';

/** Floating WhatsApp button — standard on every layout. */
function whatsappFab(lead: Lead, label: string): string {
  if (!lead.phone) return "";
  return (
    '<a class="wafab" href="' +
    phoneHref(lead.phone) +
    '" target="_blank" rel="noopener" aria-label="' +
    esc(label) +
    '" title="' +
    esc(label) +
    '">' +
    WHATS_ICON +
    "</a>"
  );
}

/** Shared styles for the WhatsApp button and the map footer. */
function standardCss(id: Identity): string {
  return `
.wafab{position:fixed;right:22px;bottom:22px;z-index:60;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#25d366;color:#fff;box-shadow:0 12px 34px rgba(37,211,102,.42);transition:transform .3s cubic-bezier(.2,.7,.3,1),box-shadow .3s}
.wafab:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 18px 44px rgba(37,211,102,.55)}
.mapfoot{margin-top:24px;border-top:1px solid var(--line)}
.mapfoot iframe{width:100%;height:340px;border:0;display:block;filter:${id.mode === "dark" ? "invert(.92) hue-rotate(180deg) saturate(.75) contrast(.9)" : "saturate(.85)"}}
.footgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:26px;padding:34px 0 40px;font-size:14px;color:var(--muted);align-items:start}
.footgrid strong{display:block;color:var(--ink);font-size:15px;margin-bottom:6px;letter-spacing:-.02em}
.footgrid a:hover{color:var(--accent)}
.footgrid .lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);display:block;margin-bottom:8px}
.footbar{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:16px 0 42px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
@media(max-width:800px){.footgrid{grid-template-columns:1fr;gap:22px}.mapfoot iframe{height:260px}.wafab{right:16px;bottom:16px;width:54px;height:54px}}`;
}

/** Embedded Google map + the address block that replaces the old CTA slab. */
function mapFooter(lead: Lead, id: Identity): string {
  const query = encodeURIComponent(
    lead.address
      ? [lead.address, lead.city].filter(Boolean).join(", ")
      : [lead.name, lead.city].filter(Boolean).join(", "),
  );
  return (
    '<footer class="mapfoot" id="contato">' +
    '<iframe title="Localização de ' +
    esc(lead.name) +
    '" src="https://www.google.com/maps?q=' +
    query +
    '&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' +
    '<div class="wrap footgrid">' +
    '<div><span class="lbl">Onde estamos</span><strong>' +
    esc(lead.name) +
    "</strong>" +
    esc([lead.address, lead.city].filter(Boolean).join(" · ")) +
    '<br><a href="' +
    mapsHref(lead) +
    '" target="_blank" rel="noopener">Como chegar ↗</a></div>' +
    '<div><span class="lbl">Contato</span>' +
    (lead.phone
      ? '<a href="' +
        phoneHref(lead.phone) +
        '" target="_blank" rel="noopener">' +
        esc(lead.phone) +
        "</a><br>"
      : "") +
    (lead.instagram ? esc(lead.instagram) : "") +
    "</div>" +
    '<div><span class="lbl">Avaliações</span>' +
    lead.rating.toFixed(1) +
    " no Google · " +
    lead.reviews +
    " avaliações</div></div>" +
    '<div class="wrap footbar"><span>© ' +
    new Date().getFullYear() +
    " " +
    esc(lead.name) +
    "</span><span>" +
    esc(id.mono) +
    "</span></div></footer>"
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout 1 — Editorial                                                       */
/*  Light, magazine typography, asymmetric grid, restrained motion.            */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Visual system                                                              */
/* -------------------------------------------------------------------------- */

const FONTS: Record<SiteTypeface, { href: string; display: string; body: string }> = {
  sans: {
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    display: '"Inter",ui-sans-serif,system-ui,sans-serif',
    body: '"Inter",ui-sans-serif,system-ui,sans-serif',
  },
  serif: {
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap",
    display: '"Fraunces","Georgia",serif',
    body: '"Inter",ui-sans-serif,system-ui,sans-serif',
  },
  mixed: {
    href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
    display: '"Instrument Serif","Georgia",serif',
    body: '"Inter",ui-sans-serif,system-ui,sans-serif',
  },
  condensed: {
    href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
    display: '"Oswald",ui-sans-serif,system-ui,sans-serif',
    body: '"Inter",ui-sans-serif,system-ui,sans-serif',
  },
};

/** Per-layout rhythm: how much air the page breathes and how wide it runs. */
const RHYTHM: Record<SiteLayout, { pad: number; wrap: number; h1: string; h2: string }> = {
  editorial: { pad: 112, wrap: 1180, h1: "clamp(40px,6.4vw,90px)", h2: "clamp(28px,3.8vw,46px)" },
  immersive: { pad: 96, wrap: 1240, h1: "clamp(38px,7vw,104px)", h2: "clamp(26px,3.6vw,44px)" },
  showcase: { pad: 88, wrap: 1220, h1: "clamp(36px,5.4vw,72px)", h2: "clamp(25px,3.2vw,40px)" },
  minimal: { pad: 104, wrap: 1040, h1: "clamp(34px,5vw,64px)", h2: "clamp(24px,3vw,36px)" },
};

const RADIUS = { sharp: "2px", soft: "14px", round: "28px" } as const;

/** The shared stylesheet every block draws from. Blocks add nothing global. */
function systemCss(id: Identity): string {
  const f = FONTS[id.typeface];
  const r = RHYTHM[id.layout];
  const rad = RADIUS[id.shape];
  const upper = id.typeface === "condensed" ? "text-transform:uppercase;letter-spacing:.01em" : "";
  const tight = id.typeface === "sans" ? "-.04em" : id.typeface === "condensed" ? "0" : "-.02em";
  return `
:root{--rad:${rad};--pad:${r.pad}px}
body{font-family:${f.body};font-size:16.5px;line-height:1.6}
.wrap{width:min(${r.wrap}px,calc(100% - 44px))}
h1,h2,h3,.dsp{font-family:${f.display};font-weight:${id.typeface === "serif" || id.typeface === "mixed" ? 400 : 600};letter-spacing:${tight};line-height:1.06;${upper}}
h1{font-size:${r.h1}}
h2{font-size:${r.h2};line-height:1.12}
.sec{padding:var(--pad) 0}
.sec+.sec{padding-top:calc(var(--pad) * .72)}
.lab{font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:var(--accent);margin-bottom:18px}
.lede{color:var(--muted);font-size:17.5px;line-height:1.85;max-width:64ch}
.btn.primary{background:var(--accent);color:var(--on-accent);padding:15px 30px;font-size:15px}
.btn.ghost{border:1px solid var(--line);padding:14px 28px;font-size:15px;color:var(--ink)}
.btn.primary:hover{box-shadow:0 16px 40px color-mix(in srgb,var(--accent) 42%,transparent)}
.shot{overflow:hidden;border-radius:var(--rad);background:var(--bg2)}
.shot img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.7,.3,1)}
.shot:hover img{transform:scale(1.05)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 0;position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(14px);transition:box-shadow .3s,padding .3s}
.nav.stuck{box-shadow:0 1px 0 var(--line);padding:14px 0}
.brand{display:flex;align-items:center;gap:12px;font-weight:650;letter-spacing:-.02em;font-size:16px}
.mono{display:grid;place-items:center;width:38px;height:38px;border-radius:var(--rad);background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;letter-spacing:.02em}
.logoimg{width:38px;height:38px;object-fit:cover;border-radius:var(--rad)}
.links{display:flex;gap:26px;font-size:14px;color:var(--muted)}
.links a:hover{color:var(--ink)}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--rad);padding:26px;box-shadow:var(--shadow)}
@media(max-width:860px){:root{--pad:${Math.round(r.pad * 0.62)}px}.links{display:none}}`;
}
/* -------------------------------------------------------------------------- */
/*  Block library                                                              */
/*  Each block renders one section in one of several treatments. The page is   */
/*  whatever list of blocks the AI composed, so the architecture itself varies */
/*  from business to business — not only the words inside a fixed template.    */
/* -------------------------------------------------------------------------- */

type Ctx = {
  lead: Lead;
  c: SiteSection;
  id: Identity;
  cta: string;
  label: string;
  /** Hands out photos in order, so no two blocks show the same one twice. */
  next: (n?: number) => string[];
};

type Parts = { css: string; body: string };

function head(block: SiteBlock, fallbackTitle: string, fallbackLab: string): string {
  const lab = block.eyebrow ?? fallbackLab;
  const title = block.title ?? fallbackTitle;
  return (
    (lab ? '<div class="lab rv">' + esc(lab) + "</div>" : "") +
    (title ? '<h2 class="rv">' + esc(title) + "</h2>" : "")
  );
}

function shots(x: Ctx, n: number, cls = "shot"): string {
  return x
    .next(n)
    .map(
      (src, i) =>
        '<figure class="' +
        cls +
        ' rv" data-d="' +
        ((i % 4) + 1) +
        '"><img src="' +
        esc(src) +
        '" alt="' +
        esc(x.lead.name) +
        " — foto " +
        (i + 1) +
        '" loading="lazy"></figure>',
    )
    .join("");
}

/* ---------------------------------- hero ---------------------------------- */

function hero(x: Ctx, b: SiteBlock): Parts {
  const { lead, c, id } = x;
  const eyebrow = '<div class="eyebrow">' + esc(lead.category) + " · " + esc(lead.city) + "</div>";
  const acts =
    '<div class="hacts rv" data-d="2"><a class="btn primary" href="' +
    x.cta +
    '">' +
    esc(x.label) +
    '</a><a class="btn ghost" href="#contato">Onde estamos</a></div>';
  const copy =
    eyebrow +
    '<h1 class="rv">' +
    esc(c.headline) +
    '</h1><p class="lede rv" data-d="1">' +
    esc(c.subheadline) +
    "</p>" +
    acts;

  const css = `
.hero{padding:76px 0 var(--pad)}
.hero .eyebrow{margin-bottom:20px}
.hero .lede{margin-top:22px}
.hacts{display:flex;gap:14px;flex-wrap:wrap;margin-top:34px}
.hsplit{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.hsplit .shot{height:min(70vh,600px)}
.hstack .shot{height:min(66vh,560px);margin-top:52px}
.hframe{text-align:center}
.hframe .lede,.hframe .hacts{margin-inline:auto;justify-content:center}
.hstrip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:52px}
.hstrip .shot{height:250px}
.hfull{position:relative;min-height:min(94vh,860px);display:flex;align-items:flex-end;overflow:hidden}
.hfull .bg{position:absolute;inset:-12% 0;z-index:0}
.hfull .bg img{width:100%;height:100%;object-fit:cover}
.hfull .veil{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 55%,transparent) 0%,transparent 32%,color-mix(in srgb,var(--bg) 88%,transparent) 100%)}
.hfull .in{position:relative;z-index:2;padding:0 0 var(--pad)}
@media(max-width:860px){.hsplit{grid-template-columns:1fr;gap:34px}.hsplit .shot{height:320px}.hstrip{grid-template-columns:1fr}.hstack .shot{height:300px}}`;

  if (b.variant === "full") {
    const [bg] = x.next(1);
    return {
      css,
      body: `<section class="hero hfull"><div class="bg" data-px="0.14"><img src="${esc(bg ?? "")}" alt="${esc(lead.name)}" loading="eager"></div><div class="veil"></div><div class="wrap in">${copy}</div></section>`,
    };
  }
  if (b.variant === "stacked") {
    return {
      css,
      body: `<section class="wrap hero hstack">${copy}<figure class="shot rv" data-d="3"><img src="${esc(x.next(1)[0] ?? "")}" alt="${esc(lead.name)}" loading="eager"></figure></section>`,
    };
  }
  if (b.variant === "frame") {
    return {
      css,
      body: `<section class="wrap hero hframe">${copy}<div class="hstrip">${shots(x, 3)}</div></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap hero hsplit"><div>${copy}</div><figure class="shot rv" data-d="2"><img src="${esc(x.next(1)[0] ?? "")}" alt="${esc(lead.name)}" loading="eager"></figure></section>`,
  };
}

/* --------------------------------- stats ---------------------------------- */

function stats(x: Ctx, b: SiteBlock): Parts {
  const { lead } = x;
  const rows = [
    { k: lead.rating.toFixed(1), v: "nota no Google" },
    { k: String(lead.reviews), v: "avaliações reais" },
    { k: lead.city, v: "onde atendemos" },
    { k: lead.category, v: "especialidade" },
  ];
  const css = `
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.stats>div{padding:34px 24px}
.stats b{display:block;font-size:clamp(24px,3vw,36px);letter-spacing:-.03em;font-weight:600;color:var(--accent)}
.stats span{display:block;margin-top:8px;font-size:13px;color:var(--muted)}
.statc{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;border:0}
.statc>div{border-radius:var(--rad);background:var(--bg2);padding:28px 24px}
@media(max-width:860px){.stats,.statc{grid-template-columns:1fr 1fr}}`;
  const cls = b.variant === "cards" ? "stats statc" : "stats";
  return {
    css,
    body: `<section class="wrap sec"><div class="${cls}">${rows
      .map(
        (r, i) =>
          `<div class="rv" data-d="${i + 1}"><b>${esc(r.k)}</b><span>${esc(r.v)}</span></div>`,
      )
      .join("")}</div></section>`,
  };
}

/* -------------------------------- services -------------------------------- */

function services(x: Ctx, b: SiteBlock): Parts {
  const { c } = x;
  const list = c.services.filter(Boolean).slice(0, 6);
  const note = (i: number) => esc(c.serviceNotes?.[i] ?? "");
  const css = `
.svcards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px}
.svcards h3{font-size:19px;margin-bottom:10px}
.svcards p{color:var(--muted);font-size:14.5px;line-height:1.7}
.svcards .n{font-size:12px;color:var(--accent);letter-spacing:.16em;display:block;margin-bottom:16px}
.svlist{margin-top:40px;border-top:1px solid var(--line)}
.svlist li{display:grid;grid-template-columns:64px 1fr 1.1fr;gap:24px;padding:26px 0;border-bottom:1px solid var(--line);align-items:baseline}
.svlist i{font-style:normal;color:var(--accent);font-size:13px;letter-spacing:.1em}
.svlist h3{font-size:20px}
.svlist p{color:var(--muted);font-size:15px;line-height:1.7}
.svgrid{display:grid;grid-template-columns:1fr 1fr;gap:2px 56px;margin-top:36px}
.svgrid li{padding:24px 0;border-bottom:1px solid var(--line)}
.svgrid h3{font-size:18px}
.svgrid p{color:var(--muted);font-size:14.5px;line-height:1.65;margin-top:7px}
.svalt{margin-top:48px;display:grid;gap:18px}
.svalt .row{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.svalt .row:nth-child(even) figure{order:-1}
.svalt .shot{height:300px}
.svalt h3{font-size:22px;margin-bottom:12px}
.svalt p{color:var(--muted);line-height:1.8}
@media(max-width:860px){.svcards,.svgrid,.svalt .row{grid-template-columns:1fr}.svlist li{grid-template-columns:1fr;gap:8px}.svalt .row:nth-child(even) figure{order:0}}`;

  const h = head(b, "O que fazemos", "Serviços");
  if (b.variant === "list") {
    return {
      css,
      body: `<section class="wrap sec" id="servicos">${h}<ul class="svlist">${list
        .map(
          (s, i) =>
            `<li class="rv" data-d="${(i % 3) + 1}"><i>0${i + 1}</i><h3>${esc(s)}</h3><p>${note(i)}</p></li>`,
        )
        .join("")}</ul></section>`,
    };
  }
  if (b.variant === "grid") {
    return {
      css,
      body: `<section class="wrap sec" id="servicos">${h}<ul class="svgrid">${list
        .map(
          (s, i) =>
            `<li class="rv" data-d="${(i % 3) + 1}"><h3>${esc(s)}</h3><p>${note(i)}</p></li>`,
        )
        .join("")}</ul></section>`,
    };
  }
  if (b.variant === "alternating") {
    const pics = x.next(Math.min(3, list.length));
    return {
      css,
      body: `<section class="wrap sec" id="servicos">${h}<div class="svalt">${list
        .slice(0, pics.length)
        .map(
          (s, i) =>
            `<div class="row"><figure class="shot rv"><img src="${esc(pics[i] ?? "")}" alt="${esc(s)}" loading="lazy"></figure><div class="rv" data-d="1"><h3>${esc(s)}</h3><p>${note(i)}</p></div></div>`,
        )
        .join("")}</div></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap sec" id="servicos">${h}<div class="svcards">${list
      .map(
        (s, i) =>
          `<article class="card rv" data-d="${(i % 3) + 1}"><span class="n">0${i + 1}</span><h3>${esc(s)}</h3><p>${note(i)}</p></article>`,
      )
      .join("")}</div></section>`,
  };
}

/* -------------------------------- gallery --------------------------------- */

function gallery(x: Ctx, b: SiteBlock): Parts {
  const css = `
.gmosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:190px;gap:12px;margin-top:38px}
.gmosaic figure:nth-child(1){grid-column:span 2;grid-row:span 2}
.gmosaic figure:nth-child(4){grid-column:span 2}
.gmosaic figure{height:100%}
.gstrip{display:flex;gap:12px;overflow-x:auto;margin-top:38px;padding-bottom:12px;scroll-snap-type:x mandatory}
.gstrip figure{flex:0 0 min(74vw,430px);height:320px;scroll-snap-align:start}
.ggrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:38px}
.ggrid figure{height:280px}
.gduo{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:38px}
.gduo figure{height:340px}
@media(max-width:860px){.gmosaic,.ggrid,.gduo{grid-template-columns:1fr 1fr;grid-auto-rows:150px}.gmosaic figure:nth-child(1),.gmosaic figure:nth-child(4){grid-column:span 2}.ggrid figure,.gduo figure{height:200px}}`;
  const h = head(b, b.title ?? "", "Galeria");
  const map = { strip: ["gstrip", 5], grid: ["ggrid", 6], duo: ["gduo", 2] } as const;
  const [cls, n] = (map as Record<string, readonly [string, number]>)[b.variant ?? ""] ?? [
    "gmosaic",
    4,
  ];
  return {
    css,
    body: `<section class="wrap sec">${h}<div class="${cls}">${shots(x, n)}</div></section>`,
  };
}

/* --------------------------------- about ---------------------------------- */

function about(x: Ctx, b: SiteBlock): Parts {
  const { lead, c } = x;
  const css = `
.asplit{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;margin-top:34px}
.asplit .shot{height:min(60vh,480px)}
.awide{max-width:70ch;margin-top:30px}
.awide p{font-size:19px;line-height:1.9;color:var(--muted)}
.aover{position:relative;margin-top:34px}
.aover .shot{height:min(58vh,460px)}
.aover .panel{background:var(--card);border:1px solid var(--line);border-radius:var(--rad);padding:34px;box-shadow:var(--shadow);max-width:560px;margin:-72px 0 0 auto;position:relative;z-index:2}
@media(max-width:860px){.asplit{grid-template-columns:1fr;gap:28px}.asplit .shot,.aover .shot{height:260px}.aover .panel{margin-top:-32px;padding:24px}}`;
  const h = head(b, lead.name, "Sobre");
  const text = '<p class="lede rv">' + esc(c.about) + "</p>";
  if (b.variant === "wide") {
    return {
      css,
      body: `<section class="wrap sec" id="sobre">${h}<div class="awide">${text}</div></section>`,
    };
  }
  if (b.variant === "overlap") {
    return {
      css,
      body: `<section class="wrap sec" id="sobre">${h}<div class="aover"><figure class="shot rv"><img src="${esc(x.next(1)[0] ?? "")}" alt="${esc(lead.name)}" loading="lazy"></figure><div class="panel rv" data-d="1">${text}</div></div></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap sec" id="sobre"><div class="asplit"><div>${h}${text}</div><figure class="shot rv" data-d="1"><img src="${esc(x.next(1)[0] ?? "")}" alt="${esc(lead.name)}" loading="lazy"></figure></div></section>`,
  };
}

/* ----------------------------- differentials ------------------------------ */

function differentials(x: Ctx, b: SiteBlock): Parts {
  const list = x.c.differentials.filter(Boolean).slice(0, 4);
  const css = `
.drows{margin-top:34px;max-width:760px}
.drows li{display:flex;gap:22px;padding:20px 0;border-bottom:1px solid var(--line);align-items:baseline}
.drows i{font-style:normal;color:var(--accent);font-size:12px;letter-spacing:.12em}
.dcards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:38px}
.dcards p{font-size:15.5px;line-height:1.65}
.dicons{display:grid;grid-template-columns:repeat(2,1fr);gap:28px 44px;margin-top:38px}
.dicons li{display:flex;gap:16px;align-items:flex-start}
.dicons .dot{flex:0 0 34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent);display:grid;place-items:center;font-size:13px;font-weight:700}
@media(max-width:860px){.dcards,.dicons{grid-template-columns:1fr}}`;
  const h = head(b, "Por que nos escolhem", "Diferenciais");
  if (b.variant === "cards") {
    return {
      css,
      body: `<section class="wrap sec">${h}<div class="dcards">${list
        .map((d, i) => `<div class="card rv" data-d="${i + 1}"><p>${esc(d)}</p></div>`)
        .join("")}</div></section>`,
    };
  }
  if (b.variant === "icons") {
    return {
      css,
      body: `<section class="wrap sec">${h}<ul class="dicons">${list
        .map(
          (d, i) =>
            `<li class="rv" data-d="${i + 1}"><span class="dot">0${i + 1}</span><span>${esc(d)}</span></li>`,
        )
        .join("")}</ul></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap sec">${h}<ul class="drows">${list
      .map((d, i) => `<li class="rv" data-d="${i + 1}"><i>0${i + 1}</i><span>${esc(d)}</span></li>`)
      .join("")}</ul></section>`,
  };
}

/* -------------------------------- process --------------------------------- */

function process(x: Ctx, b: SiteBlock): Parts {
  const items = (b.items ?? []).filter((i) => i?.title).slice(0, 4);
  if (items.length === 0) return { css: "", body: "" };
  const css = `
.steps{display:grid;grid-template-columns:repeat(${items.length},1fr);gap:16px;margin-top:40px}
.steps .n{font-size:13px;letter-spacing:.16em;color:var(--accent);display:block;margin-bottom:14px}
.steps h3{font-size:18px;margin-bottom:9px}
.steps p{color:var(--muted);font-size:14.5px;line-height:1.7}
.tline{margin-top:40px;border-left:2px solid var(--line);padding-left:32px;display:grid;gap:34px}
.tline li{position:relative}
.tline li::before{content:"";position:absolute;left:-40px;top:8px;width:12px;height:12px;border-radius:50%;background:var(--accent)}
.tline h3{font-size:19px;margin-bottom:8px}
.tline p{color:var(--muted);line-height:1.75}
@media(max-width:860px){.steps{grid-template-columns:1fr}}`;
  const h = head(b, "Como funciona", "Processo");
  if (b.variant === "timeline") {
    return {
      css,
      body: `<section class="wrap sec">${h}<ul class="tline">${items
        .map(
          (it, i) =>
            `<li class="rv" data-d="${i + 1}"><h3>${esc(it.title)}</h3><p>${esc(it.text ?? "")}</p></li>`,
        )
        .join("")}</ul></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap sec">${h}<div class="steps">${items
      .map(
        (it, i) =>
          `<div class="rv" data-d="${i + 1}"><span class="n">0${i + 1}</span><h3>${esc(it.title)}</h3><p>${esc(it.text ?? "")}</p></div>`,
      )
      .join("")}</div></section>`,
  };
}

/* ---------------------------------- faq ----------------------------------- */

function faq(x: Ctx, b: SiteBlock): Parts {
  const items = (b.items ?? []).filter((i) => i?.title && i.text).slice(0, 6);
  if (items.length === 0) return { css: "", body: "" };
  const css = `
.faq{margin-top:36px;max-width:840px;border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:22px 0;font-size:17.5px;font-weight:600;display:flex;justify-content:space-between;gap:20px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--accent);font-size:22px;transition:transform .3s}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq p{color:var(--muted);line-height:1.85;padding:0 0 24px;max-width:64ch}`;
  return {
    css,
    body: `<section class="wrap sec">${head(b, "Perguntas frequentes", "Dúvidas")}<div class="faq">${items
      .map(
        (it) =>
          `<details class="rv"><summary>${esc(it.title)}</summary><p>${esc(it.text ?? "")}</p></details>`,
      )
      .join("")}</div></section>`,
  };
}

/* --------------------------------- quote ---------------------------------- */

function quote(x: Ctx, b: SiteBlock): Parts {
  const text = b.title ?? x.c.headline;
  const css = `
.quote{padding:calc(var(--pad) * .9) 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.quote p{font-family:inherit;font-size:clamp(24px,3.6vw,44px);line-height:1.24;letter-spacing:-.03em;max-width:20ch}
.quote .who{margin-top:26px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}`;
  return {
    css,
    body: `<section class="wrap quote"><p class="dsp rv">${esc(text)}</p><div class="who rv" data-d="1">${esc(x.lead.name)} · ${esc(x.lead.city)}</div></section>`,
  };
}

/* ---------------------------------- cta ----------------------------------- */

function ctaBlock(x: Ctx, b: SiteBlock): Parts {
  const css = `
.ctab{background:var(--bg2);border-radius:var(--rad);padding:clamp(38px,6vw,76px);margin:var(--pad) 0;text-align:center}
.ctab p{color:var(--muted);margin-top:18px;max-width:52ch;margin-inline:auto;line-height:1.8}
.ctab .btn{margin-top:32px}
.ctas{display:grid;grid-template-columns:1.1fr .9fr;gap:44px;align-items:center;background:var(--bg2);border-radius:var(--rad);padding:clamp(32px,4.4vw,58px);margin:var(--pad) 0;text-align:left}
.ctas p{color:var(--muted);line-height:1.8;margin-top:16px}
@media(max-width:860px){.ctas{grid-template-columns:1fr;gap:26px}}`;
  const title = b.title ?? x.c.headline;
  const sub = x.c.subheadline;
  if (b.variant === "split") {
    return {
      css,
      body: `<section class="wrap"><div class="ctas rv"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><div><a class="btn primary" href="${x.cta}">${esc(x.label)}</a></div></div></section>`,
    };
  }
  return {
    css,
    body: `<section class="wrap"><div class="ctab rv"><h2>${esc(title)}</h2><p>${esc(sub)}</p><a class="btn primary" href="${x.cta}">${esc(x.label)}</a></div></section>`,
  };
}

const BLOCKS: Record<SiteBlockKind, (x: Ctx, b: SiteBlock) => Parts> = {
  hero,
  stats,
  services,
  gallery,
  about,
  differentials,
  process,
  faq,
  quote,
  cta: ctaBlock,
};
/* -------------------------------------------------------------------------- */
/*  Entry point                                                                */
/* -------------------------------------------------------------------------- */

function navBar(lead: Lead, id: Identity, cta: string, label: string, ids: string[]): string {
  const links = [
    ids.includes("servicos") ? '<a href="#servicos">Serviços</a>' : "",
    ids.includes("sobre") ? '<a href="#sobre">Sobre</a>' : "",
    '<a href="#contato">Contato</a>',
  ].join("");
  return (
    '<header class="wrap nav" data-nav><a class="brand" href="#top">' +
    logoMark(lead, id) +
    esc(lead.name) +
    '</a><nav class="links">' +
    links +
    '</nav><a class="btn primary" href="' +
    cta +
    '">' +
    esc(label) +
    "</a></header>"
  );
}

/**
 * Structured data for the business. Invisible on the page, but it is what makes
 * the link look like a real business when the owner shares it, and what search
 * engines read — a concrete argument the demo is better than their current site.
 */
function jsonLd(lead: Lead, content: SiteSection, id: Identity): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lead.name,
    description: content.subheadline || content.about || undefined,
    image: id.images.slice(0, 3),
    address: { "@type": "PostalAddress", streetAddress: lead.address, addressLocality: lead.city },
    telephone: lead.phone,
    aggregateRating:
      lead.reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: lead.rating,
            reviewCount: lead.reviews,
          }
        : undefined,
  };
  return (
    '<script type="application/ld+json">' +
    JSON.stringify(data).replaceAll("<", "\\u003c") +
    "</script>"
  );
}

/** Favicon drawn from the brand mark, so the tab is not a blank page icon. */
function favicon(id: Identity): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${id.accent}"/>` +
    `<text x="50%" y="52%" dy=".35em" text-anchor="middle" font-family="Inter,system-ui,sans-serif" ` +
    `font-size="30" font-weight="700" fill="${id.onAccent}">${esc(id.mono)}</text></svg>`;
  return '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(svg) + '">';
}

/**
 * Reports opens, attention and CTA clicks back to the app. Without it the
 * seller sends a link into the void; with it they know who is looking.
 */
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

export type RenderOptions = {
  /** Slug of the stored site — the key the beacon reports under. */
  slug?: string | undefined;
  /** Origin of this app, where the beacon is sent. */
  trackUrl?: string | undefined;
  /** >0 renders an alternative take on the same copy. */
  remix?: number | undefined;
};

export function renderSiteHtml(
  lead: Lead,
  content: SiteSection,
  template: string,
  options: RenderOptions = {},
): string {
  const id = identityOf(lead, content, template, options.remix ?? 0);
  const label = ctaLabel(content.cta || "Falar no WhatsApp");
  const cta = phoneHref(lead.phone);

  // Photos are handed out in order across the whole page, so a business with
  // eight real photos shows eight different ones instead of repeating the hero.
  let cursor = 0;
  const next = (n = 1): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n && id.images.length > 0; i++) {
      out.push(id.images[cursor++ % id.images.length]!);
    }
    return out;
  };
  const x: Ctx = { lead, c: content, id, cta, label, next };

  const seen = new Set<string>();
  const css: string[] = [];
  const body: string[] = [];
  for (const block of id.blocks) {
    const render = BLOCKS[block.kind];
    if (!render) continue;
    const part = render(x, block);
    if (!part.body) continue;
    // Each kind contributes its stylesheet once, however often it appears.
    const key = block.kind + ":" + (block.variant ?? "");
    if (!seen.has(key)) {
      seen.add(key);
      css.push(part.css);
    }
    body.push(part.body);
  }

  const anchors = id.blocks.map((b) =>
    b.kind === "services" ? "servicos" : b.kind === "about" ? "sobre" : "",
  );
  const description = (content.subheadline || content.about || lead.name).slice(0, 155);
  const hero0 = id.images[0] ?? "";

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
    esc(hero0) +
    '"><meta property="og:type" content="website">' +
    favicon(id) +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="' +
    FONTS[id.typeface].href +
    '">' +
    "<title>" +
    esc(lead.name) +
    " — " +
    esc(lead.category) +
    "</title><style>" +
    palette(id) +
    RESET +
    systemCss(id) +
    css.join("") +
    standardCss(id) +
    "</style></head><body>" +
    navBar(lead, id, cta, label, anchors) +
    '<main id="top">' +
    body.join("") +
    "</main>" +
    whatsappFab(lead, label) +
    mapFooter(lead, id) +
    jsonLd(lead, content, id) +
    SCRIPT +
    (options.slug && options.trackUrl ? tracker(options.slug, options.trackUrl) : "") +
    "</body></html>"
  );
}
