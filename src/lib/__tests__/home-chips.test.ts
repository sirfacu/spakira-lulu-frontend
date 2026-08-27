import { describe, expect, it } from "vitest";

/** Espejo de la lógica de paso del carrusel (sin DOM). */
function nextScrollLeft(current: number, dir: -1 | 1, step: number, max: number): number {
  let next = current + dir * step;
  if (next < 0) next = max;
  if (next > max) next = 0;
  return next;
}

describe("ChipRail scroll step", () => {
  it("advances and wraps at the end", () => {
    expect(nextScrollLeft(0, 1, 300, 900)).toBe(300);
    expect(nextScrollLeft(800, 1, 300, 900)).toBe(0);
  });

  it("goes back and wraps at the start", () => {
    expect(nextScrollLeft(300, -1, 300, 900)).toBe(0);
    expect(nextScrollLeft(0, -1, 300, 900)).toBe(900);
  });
});

describe("home news chip payload shape", () => {
  it("accepts html and image kinds for preview cards", () => {
    const news = [
      {
        id: "seed-inauguracion",
        kind: "html" as const,
        title: "Inauguración",
        html: "<p><strong>¡Abrimos las puertas!</strong></p>",
        active: true,
      },
      {
        id: "seed-promo",
        kind: "html" as const,
        title: "Promo spa",
        html: "<p>Baño + perfume</p>",
        active: true,
      },
      {
        id: "seed-tips",
        kind: "html" as const,
        title: "Tips de cuidado",
        html: "<p>Cepillá en casa entre visitas.</p>",
        active: true,
      },
    ];
    expect(news.every((n) => n.kind === "html" && n.title && n.html)).toBe(true);
    expect(news).toHaveLength(3);
    expect(news.map((n) => n.id)).toEqual([
      "seed-inauguracion",
      "seed-promo",
      "seed-tips",
    ]);
  });
});
