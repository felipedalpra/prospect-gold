import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { scrollY } = useScroll();
  const bg = useTransform(
    scrollY,
    [0, 120],
    ["oklch(0.13 0.006 80 / 0)", "oklch(0.13 0.006 80 / 0.82)"],
  );
  const border = useTransform(scrollY, [0, 120], ["oklch(1 0 0 / 0)", "oklch(0.28 0.01 82 / 1)"]);

  return (
    <motion.header
      style={{ backgroundColor: bg, borderBottomColor: border }}
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#problema" className="transition-colors hover:text-primary">
            Problema
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-primary">
            Como funciona
          </a>
          <a href="#uma-busca" className="transition-colors hover:text-primary">
            Uma busca
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button variant="gold" size="sm" asChild>
            <Link to="/auth">Começar agora</Link>
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}
