import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — LeadForge | Prospecção automatizada" },
      {
        name: "description",
        content:
          "Acesse o LeadForge e transforme buscas do Google Maps em clientes prontos para abordar.",
      },
      { property: "og:title", content: "Entrar — LeadForge" },
      {
        property: "og:description",
        content: "Acesse sua conta LeadForge e comece a prospectar em minutos.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { signIn, signUp, session, ready } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/app" });
  }, [ready, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        await navigate({ to: "/app" });
      } else {
        await signUp(name, email, password);
        toast.success("Conta criada! Se pedirem confirmação, verifique seu e-mail.");
        await navigate({ to: "/onboarding" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 animate-pulse-glow rounded-full bg-primary/12 blur-[130px]" />
        <Link to="/">
          <Logo />
        </Link>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            De uma busca a uma <span className="text-gradient-gold">campanha inteira</span>.
          </h2>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Leads reais do Google Maps, sites gerados por IA e abordagens prontas — em um único
            fluxo.
          </p>
          <div className="mt-10 space-y-3">
            {[
              "Busca real via Apify",
              "Sites escritos pela IA",
              "Publicação no Netlify",
              "Copy pronta pro WhatsApp",
            ].map((t, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.15 }}
                className="w-fit rounded-lg glass px-4 py-2 text-sm text-foreground/85"
              >
                {t}
              </motion.div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LeadForge</p>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-sm rounded-2xl glass p-8"
        >
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-4 text-2xl font-bold lg:mt-0">
            {mode === "login" ? "Bem-vindo de volta" : "Criar sua conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Continue de onde parou." : "Comece a prospectar hoje mesmo."}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">Senha</Label>
              <Input
                id="pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
          </div>

          <Button variant="gold" size="lg" className="mt-6 w-full" type="submit" disabled={busy}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
