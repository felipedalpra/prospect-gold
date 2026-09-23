import { test, expect } from "bun:test";
import { computeGmbAudit } from "./gmb";

test("computeGmbAudit dá 100 para um perfil totalmente preenchido", () => {
  const audit = computeGmbAudit({
    category: "Restaurante",
    images: ["a", "b", "c"],
    phone: "11999999999",
    instagram: "@negocio",
  });
  expect(audit).toEqual({
    hasCategory: true,
    hasPhotos: true,
    photoCount: 3,
    hasPhone: true,
    hasInstagram: true,
    completeness: 100,
  });
});

test("computeGmbAudit dá 0 para um perfil vazio", () => {
  const audit = computeGmbAudit({
    category: "",
    images: [],
    phone: undefined,
    instagram: undefined,
  });
  expect(audit.completeness).toBe(0);
  expect(audit.hasPhotos).toBe(false);
});

test("computeGmbAudit exige pelo menos 3 fotos para contar como 'tem fotos'", () => {
  const audit = computeGmbAudit({
    category: "Bar",
    images: ["a", "b"],
    phone: "11999999999",
    instagram: undefined,
  });
  expect(audit.hasPhotos).toBe(false);
  expect(audit.photoCount).toBe(2);
  // categoria + telefone = 2 de 4 sinais
  expect(audit.completeness).toBe(50);
});
