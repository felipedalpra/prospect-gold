import type { Lead } from "./types";
import type { ImportRow } from "./store";

/** Minimal RFC-4180 field splitter — handles quotes, commas and semicolons. */
function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "nome", "empresa", "razao social", "razão social", "negocio", "negócio"],
  category: ["category", "categoria", "nicho", "segmento"],
  city: ["city", "cidade", "municipio", "município", "localidade"],
  phone: ["phone", "telefone", "whatsapp", "celular", "fone"],
  website: ["website", "site", "url", "pagina", "página"],
  address: ["address", "endereco", "endereço", "rua"],
};

/**
 * Reads a CSV the user already had. Column names are matched loosely, in
 * Portuguese and English, so nobody has to reformat a spreadsheet to import it.
 */
export function parseLeadsCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep =
    (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitRow(lines[0]!, sep).map((h) => h.toLowerCase().replace(/^"|"$/g, ""));

  const indexOf = (field: keyof ImportRow): number =>
    header.findIndex((h) => ALIASES[field].includes(h));

  const cols = {
    name: indexOf("name"),
    category: indexOf("category"),
    city: indexOf("city"),
    phone: indexOf("phone"),
    website: indexOf("website"),
    address: indexOf("address"),
  };
  // Without a name column there is no lead to create; fall back to column 0.
  const nameCol = cols.name === -1 ? 0 : cols.name;

  const pick = (row: string[], i: number): string | undefined =>
    i >= 0 ? row[i]?.replace(/^"|"$/g, "").trim() || undefined : undefined;

  return lines
    .slice(1)
    .map((line) => splitRow(line, sep))
    .map((row) => ({
      name: (row[nameCol] ?? "").replace(/^"|"$/g, "").trim(),
      category: pick(row, cols.category),
      city: pick(row, cols.city),
      phone: pick(row, cols.phone),
      website: pick(row, cols.website),
      address: pick(row, cols.address),
    }))
    .filter((r) => r.name);
}

function cell(value: string | number | undefined): string {
  const v = String(value ?? "");
  return /[",;\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/** Exports the working list — the base belongs to the user, not to the app. */
export function leadsToCsv(leads: Lead[]): string {
  const header = [
    "nome",
    "categoria",
    "cidade",
    "endereco",
    "telefone",
    "instagram",
    "site_atual",
    "nota",
    "avaliacoes",
    "score",
    "etapa",
    "site_gerado",
    "visitas",
    "cliques_whatsapp",
  ];
  const rows = leads.map((l) =>
    [
      l.name,
      l.category,
      l.city,
      l.address,
      l.phone,
      l.instagram,
      l.website,
      l.rating,
      l.reviews,
      l.score,
      l.stage,
      l.site?.url ?? (l.site ? "rascunho" : ""),
      l.visits?.views ?? 0,
      l.visits?.whatsappClicks ?? 0,
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM keeps Excel from mangling accented names.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
