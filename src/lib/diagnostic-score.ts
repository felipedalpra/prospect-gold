import type { DiagnosticFindings } from "./types";

/**
 * Nota mostrada no relatório (0-100, quanto maior melhor a presença atual —
 * mesma leitura de SiteAudit.performance). Quando há site, a performance dele
 * pesa mais que a completude do perfil do Google; sem site, sobra só o GMB.
 */
export function computeDiagnosticScore(findings: DiagnosticFindings): number {
  const raw = findings.site
    ? findings.site.performance * 0.6 + findings.gmb.completeness * 0.4
    : findings.gmb.completeness;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
