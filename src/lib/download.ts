import type { Lead } from "./types";

/**
 * Hands the generated page to the user as a file. The site is a single
 * standalone HTML document — no assets to bundle — so `index.html` is the whole
 * deliverable and opens straight in VS Code or any editor.
 */
export function downloadSiteHtml(lead: Lead): void {
  const site = lead.site;
  if (!site) return;
  const blob = new Blob([site.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${site.slug || "site"}.html`;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Copies the raw HTML, for pasting straight into an editor. */
export async function copySiteHtml(lead: Lead): Promise<void> {
  if (!lead.site) return;
  await navigator.clipboard.writeText(lead.site.html);
}
