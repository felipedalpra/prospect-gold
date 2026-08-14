import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchPublishedSite } from "@/lib/db";

/**
 * Public preview of a generated site, served straight from the database. This
 * is the link that works even before (or without) a Netlify deploy.
 */
export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const site = await fetchPublishedSite(params.slug);
    if (!site) throw notFound();
    return site;
  },
  component: PublicSite,
});

function PublicSite() {
  const { html } = Route.useLoaderData();
  return (
    <iframe
      title="Site"
      srcDoc={html}
      className="fixed inset-0 h-full w-full border-0"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
