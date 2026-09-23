import { test, expect } from "bun:test";
import { computeDiagnosticScore } from "./diagnostic-score";
import type { DiagnosticFindings } from "./types";

test("computeDiagnosticScore combina performance do site e completude do GMB quando há site", () => {
  const findings: DiagnosticFindings = {
    site: {
      performance: 80,
      lcp: 2,
      mobile: true,
      https: true,
      url: "https://exemplo.com",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
    gmb: { hasCategory: true, hasPhotos: true, photoCount: 5, hasPhone: true, hasInstagram: true, completeness: 100 },
  };
  // 80*0.6 + 100*0.4 = 88
  expect(computeDiagnosticScore(findings)).toBe(88);
});

test("computeDiagnosticScore usa só a completude do GMB quando não há site", () => {
  const findings: DiagnosticFindings = {
    gmb: { hasCategory: true, hasPhotos: false, photoCount: 0, hasPhone: false, hasInstagram: false, completeness: 25 },
  };
  expect(computeDiagnosticScore(findings)).toBe(25);
});

test("computeDiagnosticScore nunca sai do intervalo 0-100", () => {
  const findings: DiagnosticFindings = {
    site: {
      performance: 0,
      lcp: 9,
      mobile: false,
      https: false,
      url: "https://exemplo.com",
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
    gmb: { hasCategory: false, hasPhotos: false, photoCount: 0, hasPhone: false, hasInstagram: false, completeness: 0 },
  };
  expect(computeDiagnosticScore(findings)).toBe(0);
});
