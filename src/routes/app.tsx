import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Users,
  Megaphone,
  MessagesSquare,
  Globe,
  KanbanSquare,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Dashboard — LeadForge" },
      {
        name: "description",
        content: "Gerencie leads, sites demo, abordagens e pipeline de prospecção no LeadForge.",
      },
      { property: "og:title", content: "Dashboard — LeadForge" },
      { property: "og:description", content: "Sua central de prospecção automatizada." },
    ],
  }),
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/prospectar", label: "Prospectar", icon: Search },
  { to: "/app/leads", label: "Leads", icon: Users },
  { to: "/app/sites", label: "Sites", icon: Globe },
  { to: "/app/abordagens", label: "Abordagens", icon: MessagesSquare },
  { to: "/app/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { state } = useStore();
  const { session, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/auth" });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active =
              "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg border border-primary/25 bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="rounded-xl glass-gold p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-primary">
                <Zap className="h-3.5 w-3.5" /> Créditos
              </span>
              <span className="font-semibold tabular-nums text-foreground">{state.credits}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
              <motion.div
                animate={{ width: `${Math.min(100, (state.credits / 1000) * 100)}%` }}
                className="h-full bg-[image:var(--gradient-gold)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
              {(state.profile.name || state.profile.email || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {state.profile.name || state.profile.email}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Plano {state.profile.plan}
              </p>
            </div>
            <button
              onClick={() => {
                void signOut().then(() => navigate({ to: "/auth" }));
              }}
              title="Sair"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-5 py-3 backdrop-blur-xl lg:hidden">
          <Link to="/">
            <Logo compact />
          </Link>
          <div className="flex gap-1 overflow-x-auto">
            {NAV.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground [&.active]:text-primary"
                activeProps={{ className: "text-primary" }}
              >
                {i.label}
              </Link>
            ))}
          </div>
        </div>
        {state.queue.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-primary/25 bg-primary/8 px-5 py-2.5 text-xs lg:px-8">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            <span>
              <b className="text-primary">{state.queue.length}</b> tarefa(s) na fila
              {state.working ? " — trabalhando agora" : " — retomando"}.
            </span>
            <span className="text-muted-foreground">
              Pode fechar a aba: a fila continua de onde parou na próxima vez que você abrir.
            </span>
          </div>
        )}

        <main className="min-w-0 flex-1 p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
