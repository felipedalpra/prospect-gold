import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import {
  Problem,
  Transformation,
  HowItWorks,
  OneSearch,
  FinalCta,
  Footer,
} from "@/components/landing/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadForge — Prospecção automatizada via Google Maps" },
      {
        name: "description",
        content:
          "Encontre empresas locais, qualifique com Opportunity Score, gere sites com IA e receba abordagens prontas para vender.",
      },
      { property: "og:title", content: "LeadForge — Prospecção automatizada via Google Maps" },
      {
        property: "og:description",
        content: "De uma busca no Google Maps a uma campanha inteira de prospecção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Transformation />
        <HowItWorks />
        <OneSearch />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
